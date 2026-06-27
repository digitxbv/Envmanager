-- Zero-knowledge one-time secret share tool.
-- The server ONLY ever stores ciphertext + IV. The AES-256-GCM key never reaches
-- the server (it lives in the URL #fragment). Access is exclusively via the two
-- SECURITY DEFINER RPCs below; the table itself is not readable by anon/authenticated.

create table if not exists public.shared_secrets (
  id          uuid primary key default gen_random_uuid(),
  ciphertext  text not null,
  iv          text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

create index if not exists idx_shared_secrets_expires_at
  on public.shared_secrets (expires_at);

alter table public.shared_secrets enable row level security;

-- No RLS policies on purpose: the table is reachable only through the RPCs below.
revoke all on public.shared_secrets from anon, authenticated;

-- Create a one-time secret. Anonymous-friendly. Returns the new id.
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
begin
  if p_ciphertext is null or length(p_ciphertext) = 0 then
    raise exception 'ciphertext required';
  end if;
  -- ~100 KB plaintext ceiling (base64 ciphertext is ~1.35x); guards against abuse.
  if length(p_ciphertext) > 140000 then
    raise exception 'secret too large';
  end if;
  if p_iv is null or length(p_iv) = 0 or length(p_iv) > 64 then
    raise exception 'invalid iv';
  end if;

  -- Clamp TTL: min 5 minutes, max 30 days.
  v_ttl := least(greatest(coalesce(p_ttl_seconds, 604800), 300), 2592000);

  insert into public.shared_secrets (ciphertext, iv, expires_at)
  values (p_ciphertext, p_iv, now() + make_interval(secs => v_ttl))
  returning id into v_id;

  -- Opportunistic cleanup of expired rows.
  delete from public.shared_secrets where expires_at < now();

  return v_id;
end;
$$;

-- Consume (burn after read): atomically fetch + delete. Returns 0 or 1 row.
create or replace function public.consume_shared_secret(p_id uuid)
returns table (ciphertext text, iv text)
language plpgsql
security definer
set search_path = public
as $$
begin
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
