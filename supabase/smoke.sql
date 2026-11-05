-- Run AFTER migration in SQL Editor (postgres role). Everything rolls back.
-- Separate concurrent-session test is described in BACKEND.md.
begin;
do $$
declare v_run_id uuid := '11111111-1111-4111-8111-111111111111'; r jsonb; payload jsonb; denied boolean := false;
begin
 if has_table_privilege('anon','public.sn_entries','SELECT') or has_table_privilege('authenticated','public.sn_entries','INSERT') then raise exception 'Unsafe table grants'; end if;
 if has_function_privilege('anon','public.sn_submit(jsonb)','EXECUTE') then raise exception 'Unsafe RPC grant'; end if;
 if not has_function_privilege('service_role','public.sn_submit(jsonb)','EXECUTE') then raise exception 'Missing server RPC grant'; end if;
 if exists(select 1 from pg_class where oid in('public.sn_runs'::regclass,'public.sn_entries'::regclass,'public.sn_rate_limits'::regclass) and not relrowsecurity) then raise exception 'RLS missing'; end if;
 perform public.sn_create_run(jsonb_build_object('id',v_run_id,'token_hash',repeat('a',64),'seed',42,'version','smoke-replay','board_version','smoke-board'));
 update public.sn_runs set created_at=clock_timestamp()-interval '2 minutes' where sn_runs.id=v_run_id;
 payload:=jsonb_build_object('id',v_run_id,'token_hash',repeat('a',64),'digest',repeat('b',64),'name','Smoke Captain','version','smoke-replay','board_version','smoke-board','verified_run',jsonb_build_object('state','lost','time',60,'health',0,'hits',2,'distance',1200,'supportCollected',0),'result',jsonb_build_object('total',1200,'time',60,'health',0,'status','lost'));
 r:=public.sn_submit(payload);
 if r->>'rank'<>'1' or r->'entry'->>'score'<>'1200' then raise exception 'Submission failed: %',r; end if;
 r:=public.sn_submit(payload);
 if r->'board'->>'total'<>'1' then raise exception 'Duplicate submission'; end if;
 r:=public.sn_submit(payload||jsonb_build_object('digest',repeat('c',64)));
 if r->>'error'<>'conflict' then raise exception 'Missing conflict'; end if;
 if not public.sn_rate(repeat('d',64),'smoke',1,3600) or public.sn_rate(repeat('d',64),'smoke',1,3600) then raise exception 'Rate limiter failed'; end if;
 raise notice 'PASS: grants, RLS, insert, duplicate retry, conflict, rate limit';
end $$;
rollback;
