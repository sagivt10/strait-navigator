-- Optional setup, run once AFTER migration. Enable Supabase Cron in the dashboard
-- first. This registers only an internal SQL cleanup job (no external HTTP call).
-- Running again updates the same named job rather than creating duplicates.
select cron.schedule('strait-navigator-cleanup', '17 3 * * *', $$select public.sn_cleanup();$$);
-- Inspect: select jobid, jobname, schedule, active from cron.job where jobname='strait-navigator-cleanup';
-- Remove if needed: select cron.unschedule('strait-navigator-cleanup');
