import { createApi } from '../../server/api.js';
const handle = createApi();
export default (request, context) => handle(request, { ip: context.ip || 'unknown' });
export const config = { path: ['/api/runs', '/api/runs/*', '/api/leaderboard'] };
