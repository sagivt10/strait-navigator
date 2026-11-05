/** Server-only Supabase RPC adapter. Never import from dist/. */
export class StoreError extends Error {
  constructor(code, message = code) { super(message); this.code = code; }
}
export function createSupabaseStore(env = process.env, fetcher = fetch) {
  const url = env.SUPABASE_URL?.replace(/\/$/, '');
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !/^https:\/\//.test(url)) throw new StoreError('configuration');
  async function rpc(name, args) {
    let response;
    try {
      response = await fetcher(`${url}/rest/v1/rpc/sn_${name}`, {
        method: 'POST', headers: { apikey: key, ...(key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${key}` }), 'Content-Type': 'application/json' },
        body: JSON.stringify(args), signal: AbortSignal.timeout(12000),
      });
    } catch { throw new StoreError('unavailable'); }
    if (!response.ok) throw new StoreError('unavailable');
    const data = await response.json();
    if (data?.error) throw new StoreError(data.error);
    return data;
  }
  return {
    rate: (key, scope, limit, seconds) => rpc('rate', { p_key: key, p_scope: scope, p_limit: limit, p_seconds: seconds }),
    create: challenge => rpc('create_run', { p_run: challenge }),
    get: id => rpc('get_run', { p_id: id }),
    submit: payload => rpc('submit', { p_submission: payload }),
    board: version => rpc('board', { p_version: version }),
  };
}
