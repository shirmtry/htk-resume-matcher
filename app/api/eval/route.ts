import { listEvalRuns, runEvaluation } from '@/lib/data';
import { requireUser } from '@/lib/guard';
import { route } from '@/lib/http';
import { enforceLimit } from '@/lib/limits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const user = await requireUser();
  return Response.json({ runs: await listEvalRuns(user.id) });
});

export const POST = route(async () => {
  const user = await requireUser();
  await enforceLimit(`eval:${user.id}`, 10, 60);
  const run = await runEvaluation(user.id);
  return Response.json({ run }, { status: 201 });
});
