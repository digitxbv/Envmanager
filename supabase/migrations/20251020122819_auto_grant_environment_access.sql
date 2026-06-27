-- =====================================================
-- Auto-Grant Environment Access
-- =====================================================
-- Created: 2025-10-20
-- Description: Automatically grants environment access to the user
--              who creates an environment. This ensures users can
--              immediately access variables in environments they create.
-- =====================================================

-- =====================================================
-- 1. Trigger Function: Auto-Grant Environment Access
-- =====================================================

create or replace function public.auto_grant_environment_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  creating_user_id uuid;
begin
  -- Get the user creating this environment
  creating_user_id := (select auth.uid());

  -- If no user (e.g., system operation), skip
  if creating_user_id is null then
    return new;
  end if;

  -- Grant access to the creating user
  insert into public.environment_access (
    environment_id,
    organization_id,
    user_id,
    granted_by
  ) values (
    new.id,
    new.organization_id,
    creating_user_id,
    creating_user_id
  )
  on conflict (environment_id, user_id) do nothing;

  return new;
end;
$$;

comment on function public.auto_grant_environment_access is
  'Automatically grants environment access to the user who creates an environment. Runs as AFTER INSERT trigger.';

-- =====================================================
-- 2. Create Trigger
-- =====================================================

create trigger grant_environment_access_after_insert
  after insert on public.environments
  for each row
  execute function public.auto_grant_environment_access();

comment on trigger grant_environment_access_after_insert on public.environments is
  'Automatically grants the creating user access to newly created environments';

-- =====================================================
-- 3. Backfill Existing Environments
-- =====================================================

-- Grant access to all existing environments for all organization members
-- This ensures existing data works correctly after this migration

do $$
declare
  env_record record;
  member_record record;
begin
  -- For each environment
  for env_record in
    select id, organization_id
    from public.environments
  loop
    -- Grant access to all members of the environment's organization
    for member_record in
      select user_id
      from public.organization_members
      where organization_id = env_record.organization_id
    loop
      -- Insert environment access (ignore if already exists)
      insert into public.environment_access (
        environment_id,
        organization_id,
        user_id,
        granted_by
      ) values (
        env_record.id,
        env_record.organization_id,
        member_record.user_id,
        member_record.user_id  -- Self-granted for backfill
      )
      on conflict (environment_id, user_id) do nothing;
    end loop;
  end loop;
end;
$$;

-- =====================================================
-- Migration Complete
-- =====================================================

-- Notes:
-- - New environments automatically grant access to creator
-- - Existing environments now have access for all org members
-- - This fixes the bug where users couldn't see variables in their own environments
