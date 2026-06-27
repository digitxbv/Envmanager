-- Abuse protection for the anonymous one-time secret share tool: per-IP create cap.
-- We store only a salted md5 of the forwarded IP, and prune rows older than the window.

create table if not exists public.shared_secret_creates (
  ip_hash    text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ssc_iphash_time
  on public.shared_secret_creates (ip_hash, created_at);

alter table public.shared_secret_creates enable row level security;
revoke all on public.shared_secret_creates from anon, authenticated;

-- Recreate create_shared_secret with rate limiting (max 30 creates / IP / hour).
create or replace function public.create_shared_secret(
  p_ciphertext text,
  p_iv text,
  p_ttl_seconds integer default 604800  -- 7 days
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_ttl integer;
  v_ip text;
  v_ip_hash text;
  v_recent integer;
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

  -- Per-IP rate limit. IP comes from the proxy via PostgREST's request.headers GUC.
  -- If unavailable (e.g. direct DB call), we skip the limit rather than break the tool.
  v_ip := split_part(
    coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''),
    ',', 1
  );
  if v_ip <> '' then
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

grant execute on function public.create_shared_secret(text, text, integer) to anon, authenticated;
