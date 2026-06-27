alter table public.projects
  add column friendly_id integer;

alter table public.environments
  add column friendly_id integer;

update public.projects p
set friendly_id = sub.rn
from (
  select
    id,
    row_number() over (
      partition by organization_id
      order by created_at asc, name asc, id asc
    ) as rn
  from public.projects
) sub
where p.id = sub.id;

update public.environments e
set friendly_id = sub.rn
from (
  select
    id,
    row_number() over (
      partition by project_id
      order by created_at asc, name asc, id asc
    ) as rn
  from public.environments
) sub
where e.id = sub.id;

alter table public.projects
  alter column friendly_id set not null;

alter table public.projects
  add constraint projects_org_friendly_id_unique
  unique (organization_id, friendly_id);

alter table public.environments
  alter column friendly_id set not null;

alter table public.environments
  add constraint environments_project_friendly_id_unique
  unique (project_id, friendly_id);

create index idx_projects_friendly_id
  on public.projects (friendly_id);

create index idx_environments_friendly_id
  on public.environments (friendly_id);

create or replace function public.assign_project_friendly_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Advisory lock prevents concurrent inserts from sharing friendly_id.
  perform pg_advisory_xact_lock(hashtext('project_friendly_id_' || new.organization_id::text));

  new.friendly_id := coalesce(
    (
      select max(friendly_id)
      from public.projects
      where organization_id = new.organization_id
    ),
    0
  ) + 1;

  return new;
end;
$$;

comment on function public.assign_project_friendly_id is
  'Assigns scoped project friendly_id values using advisory locks.';

create or replace function public.assign_environment_friendly_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Advisory lock prevents concurrent inserts from sharing friendly_id.
  perform pg_advisory_xact_lock(hashtext('environment_friendly_id_' || new.project_id::text));

  new.friendly_id := coalesce(
    (
      select max(friendly_id)
      from public.environments
      where project_id = new.project_id
    ),
    0
  ) + 1;

  return new;
end;
$$;

comment on function public.assign_environment_friendly_id is
  'Assigns scoped environment friendly_id values using advisory locks.';

create trigger assign_project_friendly_id_before_insert
  before insert on public.projects
  for each row
  execute function public.assign_project_friendly_id();

create trigger assign_environment_friendly_id_before_insert
  before insert on public.environments
  for each row
  execute function public.assign_environment_friendly_id();

comment on trigger assign_project_friendly_id_before_insert on public.projects is
  'Assigns project friendly_id values before insert.';

comment on trigger assign_environment_friendly_id_before_insert on public.environments is
  'Assigns environment friendly_id values before insert.';

grant execute on function public.assign_project_friendly_id() to authenticated;

grant execute on function public.assign_environment_friendly_id() to authenticated;
