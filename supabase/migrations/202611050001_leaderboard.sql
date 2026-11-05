-- Apply once with Supabase SQL Editor or `supabase db push`.
begin;
create table public.sn_runs (
 id uuid primary key, token_hash text not null check(token_hash ~ '^[0-9a-f]{64}$'),
 seed bigint not null check(seed between 0 and 4294967295), version text not null, board_version text not null,
 created_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null default(clock_timestamp()+interval '30 minutes'),
 digest text, submitted boolean not null default false
);
create table public.sn_entries (
 id uuid primary key, name text not null check(char_length(name) between 1 and 24),
 score integer not null check(score between 0 and 100000), time double precision not null check(time>=0 and time<=600),
 health integer not null check(health between 0 and 2), status text not null check(status in ('won','lost')),
 verified_run jsonb not null check(jsonb_typeof(verified_run)='object'),
 version text not null, submitted_at timestamptz not null default clock_timestamp()
);
create index sn_entries_order on public.sn_entries(version,score desc,time asc,health desc,submitted_at asc,id asc);
create index sn_runs_expiry on public.sn_runs(expires_at);
create table public.sn_rate_limits (
 key text not null, scope text not null, bucket bigint not null, requests integer not null, expires_at timestamptz not null,
 primary key(key,scope,bucket)
);
alter table public.sn_runs enable row level security;
alter table public.sn_entries enable row level security;
alter table public.sn_rate_limits enable row level security;
-- No RLS policies or direct API table privileges; service_role uses only RPCs.
revoke all on public.sn_runs,public.sn_entries,public.sn_rate_limits from public,anon,authenticated,service_role;
create function public.sn_rate(p_key text,p_scope text,p_limit integer,p_seconds integer) returns boolean
language plpgsql security definer set search_path=pg_catalog,public as $$
declare n integer; b bigint;
begin
 if p_key !~ '^[0-9a-f]{64}$' or p_limit<1 or p_seconds<1 then return false; end if;
 b:=floor(extract(epoch from clock_timestamp())/p_seconds);
 insert into public.sn_rate_limits(key,scope,bucket,requests,expires_at)
 values(p_key,p_scope,b,1,to_timestamp((b+1)*p_seconds)+interval '1 hour')
 on conflict(key,scope,bucket) do update set requests=least(public.sn_rate_limits.requests+1,p_limit+1) returning requests into n;
 return n<=p_limit;
end $$;
create function public.sn_create_run(p_run jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.sn_runs;
begin
 insert into public.sn_runs(id,token_hash,seed,version,board_version)
 values((p_run->>'id')::uuid,p_run->>'token_hash',(p_run->>'seed')::bigint,p_run->>'version',p_run->>'board_version') returning * into r;
 return jsonb_build_object('id',r.id,'created_at',r.created_at,'expires_at',r.expires_at);
end $$;
create function public.sn_get_run(p_id uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog,public as $$
 select to_jsonb(r) from public.sn_runs r where id=p_id;
$$;
create function public.sn_board(p_version text) returns jsonb
language sql stable security definer set search_path=pg_catalog,public as $$
 with ranked as (
 select e.*,row_number() over(order by score desc,time asc,health desc,submitted_at asc,id asc) as rank from public.sn_entries e where version=p_version
 ), top_rows as (select * from ranked order by rank limit 100)
 select jsonb_build_object('version',p_version,'total',(select count(*) from ranked),'entries',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'score',score,'total',score,'time',time,'health',health,'status',status,'version',version,'submittedAt',submitted_at,'rank',rank) order by rank) from top_rows),'[]'::jsonb));
$$;
create function public.sn_submit(p_submission jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.sn_runs; s jsonb; entry jsonb; position bigint; b jsonb; verified jsonb;
begin
 select * into r from public.sn_runs where id=(p_submission->>'id')::uuid for update;
 if not found then return '{"error":"missing"}'::jsonb; end if;
 if r.token_hash<>p_submission->>'token_hash' then return '{"error":"token"}'::jsonb; end if;
 if r.version<>p_submission->>'version' or r.board_version<>p_submission->>'board_version' then return '{"error":"version"}'::jsonb; end if;
 if r.submitted then
   if r.digest<>p_submission->>'digest' then return '{"error":"conflict"}'::jsonb; end if;
 else
   if r.expires_at<clock_timestamp() then return '{"error":"expired"}'::jsonb; end if;
   s:=p_submission->'result';
   if (s->>'time')::double precision>extract(epoch from(clock_timestamp()-r.created_at))+5 then return '{"error":"too_fast"}'::jsonb; end if;
   insert into public.sn_entries(id,name,score,time,health,status,version,verified_run)
   values(r.id,p_submission->>'name',(s->>'total')::integer,(s->>'time')::double precision,(s->>'health')::integer,s->>'status',r.board_version,p_submission->'verified_run');
   update public.sn_runs set submitted=true,digest=p_submission->>'digest' where id=r.id;
 end if;
 -- Rank, selected entry and board share one statement snapshot under READ COMMITTED.
 with ranked as (
 select e.*,row_number() over(order by score desc,time asc,health desc,submitted_at asc,id asc) as rank from public.sn_entries e where version=r.board_version
 )
 select jsonb_build_object('id',id,'name',name,'score',score,'total',score,'time',time,'health',health,'status',status,'version',version,'submittedAt',submitted_at,'rank',rank),
 rank,public.sn_board(r.board_version),verified_run into entry,position,b,verified from ranked where id=r.id;
 return jsonb_build_object('entry',entry,'rank',position,'board',b,'verifiedRun',verified);
end $$;
-- Run daily. Keep accepted challenge tokens 30 days for safe retry; entries forever.
create function public.sn_cleanup() returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 delete from public.sn_rate_limits where expires_at<clock_timestamp();
 delete from public.sn_runs where(not submitted and expires_at<clock_timestamp()-interval '1 day') or(submitted and expires_at<clock_timestamp()-interval '30 days');
end $$;
revoke all on function public.sn_rate(text,text,integer,integer),public.sn_create_run(jsonb),public.sn_get_run(uuid),public.sn_board(text),public.sn_submit(jsonb),public.sn_cleanup() from public,anon,authenticated;
grant execute on function public.sn_rate(text,text,integer,integer),public.sn_create_run(jsonb),public.sn_get_run(uuid),public.sn_board(text),public.sn_submit(jsonb),public.sn_cleanup() to service_role;
commit;
