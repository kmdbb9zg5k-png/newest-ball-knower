-- Read-only schema metadata. No application/auth rows, credentials, cron jobs,
-- network jobs, migration statement bodies or sequence values are selected.
set search_path = '';
with app_tables as (
  select c.*, n.nspname from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where c.relkind='r' and (n.nspname in ('ball_knower_private','bk_minigames_private','bk_football_private')
    or (n.nspname='public' and c.relname ~ '^(ball_knower_|bk_)'))
), app_functions as (
  select p.*, n.nspname from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where p.prokind='f' and (n.nspname in ('ball_knower_private','bk_minigames_private','bk_football_private')
    or (n.nspname='public' and p.proname ~ '(ball_knower|^bk_|^fantasy_)'))
)
select jsonb_build_object(
  'format',1,
  'tables',(select jsonb_agg(jsonb_build_object(
    'schema',t.nspname,'name',t.relname,'rls',t.relrowsecurity,'forceRls',t.relforcerowsecurity,
    'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid)) order by a.attnum) from pg_catalog.pg_attribute a left join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped),
    'constraints',(select jsonb_agg(jsonb_build_object('name',c.conname,'kind',c.contype,'definition',pg_catalog.pg_get_constraintdef(c.oid)) order by c.conname) from pg_catalog.pg_constraint c where c.conrelid=t.oid),
    'indexes',(select jsonb_agg(pg_catalog.pg_get_indexdef(i.indexrelid) order by i.indexrelid::regclass::text) from pg_catalog.pg_index i where i.indrelid=t.oid and not exists(select 1 from pg_catalog.pg_constraint c where c.conindid=i.indexrelid)),
    'triggers',(select jsonb_agg(jsonb_build_object('name',g.tgname,'definition',pg_catalog.pg_get_triggerdef(g.oid),'enabled',g.tgenabled) order by g.tgname) from pg_catalog.pg_trigger g where g.tgrelid=t.oid and not g.tgisinternal),
    'policies',(select jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',(select jsonb_agg(case when r=0 then 'public' else pg_catalog.pg_get_userbyid(r) end order by r) from unnest(p.polroles) r),'using',pg_catalog.pg_get_expr(p.polqual,p.polrelid),'check',pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid)) order by p.polname) from pg_catalog.pg_policy p where p.polrelid=t.oid),
    'acl',(select jsonb_agg(jsonb_build_object('grantee',case when a.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end,'privilege',a.privilege_type,'grantable',a.is_grantable) order by a.grantee,a.privilege_type) from pg_catalog.aclexplode(coalesce(t.relacl,pg_catalog.acldefault('r',t.relowner))) a)
  ) order by t.nspname,t.relname) from app_tables t),
  'functions',(select jsonb_agg(jsonb_build_object('schema',f.nspname,'name',f.proname,'arguments',pg_catalog.pg_get_function_identity_arguments(f.oid),'definition',pg_catalog.pg_get_functiondef(f.oid),'acl',(select jsonb_agg(jsonb_build_object('grantee',case when a.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end,'privilege',a.privilege_type,'grantable',a.is_grantable) order by a.grantee,a.privilege_type) from pg_catalog.aclexplode(coalesce(f.proacl,pg_catalog.acldefault('f',f.proowner))) a)) order by f.nspname,f.proname,pg_catalog.pg_get_function_identity_arguments(f.oid)) from app_functions f),
  'schemaAcl',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'grantee',case when a.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end,'privilege',a.privilege_type) order by n.nspname,a.grantee,a.privilege_type) from pg_catalog.pg_namespace n cross join lateral pg_catalog.aclexplode(coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) a where n.nspname in ('ball_knower_private','bk_minigames_private','bk_football_private')),
  'realtime',(select jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename) order by schemaname,tablename) from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public'),
  'migrations',
  -- BEGIN SOURCE MIGRATION METADATA
  (select jsonb_agg(jsonb_build_object('version',version,'name',name,'sha256',encode(sha256(convert_to(array_to_string(statements,E'\n'),'UTF8')),'hex')) order by version) from supabase_migrations.schema_migrations)
  -- END SOURCE MIGRATION METADATA
) as snapshot;
