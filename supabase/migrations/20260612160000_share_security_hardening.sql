-- Security hardening for the one-time secret share RPCs (from adversarial review):
--  * rate limit uses the RIGHTMOST x-forwarded-for hop (leftmost is client-spoofable)
--  * global hourly create backstop (storage-DoS protection even if IP is spoofed)
--  * search_path = '' hardening (all table refs schema-qualified)
--  * opportunistic expired-row cleanup on consume too (not only on create)

create or replace function public.create_shared_secret(
  p_ciphertext text,
  p_iv text,
  p_ttl_seconds integer default 604800
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_ttl integer;
  v_headers json;
  v_xff text;
  v_ip text;
  v_ip_hash text;
  v_recent integer;
  v_total integer;
  v_parts text[];
begin
  if p_ciphertext is null or length(p_ciphertext) = 0 then
    raise exception 'ciphertext required';
  end if;
  if length(p_ciphertext) > 140000 then
    raise exception 'secret too large';
  end if;
  if p_iv is null or length(p_iv) = 0 or length(p_iv) > 64 then
    raise exception 'invalid iv';
  end if;

  -- Global backstop: cap total creates/hour regardless of (spoofable) IP.
  select count(*) into v_total
    from public.shared_secret_creates
    where created_at > now() - interval '1 hour';
  if v_total >= 2000 then
    raise exception 'Service busy. Please try again later.';
  end if;

  -- Per-IP limit. Use the RIGHTMOST x-forwarded-for entry — the hop closest to our
  -- proxy. Leftmost entries are attacker-controlled. If no header (e.g. direct DB
  -- connection), skip the per-IP limit rather than break the tool.
  v_headers := nullif(current_setting('request.headers', true), '')::json;
  v_xff := coalesce(v_headers ->> 'x-forwarded-for', '');
  if v_xff <> '' then
    v_parts := string_to_array(v_xff, ',');
    v_ip := nullif(trim(v_parts[array_length(v_parts, 1)]), '');
  end if;

  if v_ip is not null then
    v_ip_hash := md5('envmanager-share:' || v_ip);
    select count(*) into v_recent
      from public.shared_secret_creates
      where ip_hash = v_ip_hash and created_at > now() - interval '1 hour';
    if v_recent >= 30 then
      raise exception 'Rate limit exceeded. Please try again later.';
    end if;
    insert into public.shared_secret_creates (ip_hash) values (v_ip_hash);
    delete from public.shared_secret_creates where created_at < now() - interval '1 hour';
  end if;

  v_ttl := least(greatest(coalesce(p_ttl_seconds, 604800), 300), 2592000);

  insert into public.shared_secrets (ciphertext, iv, expires_at)
  values (p_ciphertext, p_iv, now() + make_interval(secs => v_ttl))
  returning id into v_id;

  delete from public.shared_secrets where expires_at < now();

  return v_id;
end;
$$;

create or replace function public.consume_shared_secret(p_id uuid)
returns table (ciphertext text, iv text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Opportunistic cleanup so expired ciphertext doesn't linger without create traffic.
  delete from public.shared_secrets where expires_at < now();

  return query
  with del as (
    delete from public.shared_secrets s
    where s.id = p_id
      and s.expires_at >= now()
    returning s.ciphertext, s.iv
  )
  select del.ciphertext, del.iv from del;
end;
$$;

grant execute on function public.create_shared_secret(text, text, integer) to anon, authenticated;
grant execute on function public.consume_shared_secret(uuid) to anon, authenticated;
