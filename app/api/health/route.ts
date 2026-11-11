import { getDb, usingBlob } from '@/lib/db';
import { route } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const db = await getDb();
  const jobs = await db.query<{ n: number }>('select count(*)::int as n from jobs');
  const candidates = await db.query<{ n: number }>('select count(*)::int as n from candidates');
  return Response.json({
    ok: true,
    service: 'htk-resume-matcher',
    db: 'ok',
    persistence: usingBlob() ? 'vercel-blob' : 'pglite-file',
    jobs: Number(jobs.rows[0]?.n ?? 0),
    candidates: Number(candidates.rows[0]?.n ?? 0),
    ts: new Date().toISOString(),
  });
});
