-- READ ONLY: metadata only. No table row values, function bodies, policy expressions,
-- credentials, defaults, or comments are returned. Review output before sharing.
-- Run in the existing project's Supabase SQL Editor, not against a new project.
begin transaction read only;

-- User tables and RLS flags (Supabase-managed schemas intentionally excluded).
select n.nspname as schema_name, c.relname as table_name,
       c.relkind as relation_kind, c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p')
  and n.nspname not like 'pg_%'
  and n.nspname not in ('information_schema','auth','storage','extensions','realtime',
    'supabase_functions','supabase_migrations','graphql','graphql_public','vault',
    'net','cron','pgsodium','pgsodium_masks')
order by 1, 2;

select col.table_schema, col.table_name, col.ordinal_position, col.column_name,
       col.data_type, col.udt_schema, col.udt_name, col.is_nullable,
       col.character_maximum_length, col.numeric_precision, col.numeric_scale,
       col.is_identity, col.identity_generation, col.is_generated
from information_schema.columns col
where col.table_schema not like 'pg_%'
  and col.table_schema not in ('information_schema','auth','storage','extensions','realtime',
    'supabase_functions','supabase_migrations','graphql','graphql_public','vault',
    'net','cron','pgsodium','pgsodium_masks')
order by col.table_schema, col.table_name, col.ordinal_position;

-- Ordered PK / UNIQUE / FK column pairs, including composite keys.
select ns.nspname as schema_name, tbl.relname as table_name,
       con.conname as constraint_name,
       case con.contype when 'p' then 'PRIMARY KEY' when 'u' then 'UNIQUE' when 'f' then 'FOREIGN KEY' end as constraint_type,
       key.ordinality as column_position, att.attname as column_name,
       refns.nspname as referenced_schema, reftbl.relname as referenced_table,
       refatt.attname as referenced_column
from pg_catalog.pg_constraint con
join pg_catalog.pg_class tbl on tbl.oid = con.conrelid
join pg_catalog.pg_namespace ns on ns.oid = tbl.relnamespace
cross join lateral unnest(con.conkey) with ordinality as key(attnum, ordinality)
join pg_catalog.pg_attribute att on att.attrelid = tbl.oid and att.attnum = key.attnum
left join pg_catalog.pg_class reftbl on reftbl.oid = con.confrelid
left join pg_catalog.pg_namespace refns on refns.oid = reftbl.relnamespace
left join pg_catalog.pg_attribute refatt on refatt.attrelid = reftbl.oid and refatt.attnum = con.confkey[key.ordinality::int]
where con.contype in ('p','u','f') and ns.nspname not like 'pg_%'
  and ns.nspname not in ('information_schema','auth','storage','extensions','realtime',
    'supabase_functions','supabase_migrations','graphql','graphql_public','vault',
    'net','cron','pgsodium','pgsodium_masks')
order by 1,2,3,5;

-- Policy names, roles and command only. Expressions are deliberately omitted.
select schemaname, tablename, policyname, permissive, roles, cmd
from pg_catalog.pg_policies
where schemaname not like 'pg_%'
  and schemaname not in ('information_schema','auth','storage','extensions','realtime',
    'supabase_functions','supabase_migrations','graphql','graphql_public','vault',
    'net','cron','pgsodium','pgsodium_masks')
order by 1,2,3;

-- Detect collisions before additive migration. Do not drop/replace matching objects.
select n.nspname as schema_name, c.relname as object_name, 'relation' as object_kind
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname like 'sn\_%' escape '\'
union all
select n.nspname, p.proname, 'function'
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname like 'sn\_%' escape '\'
order by 1,2,3;
commit;
