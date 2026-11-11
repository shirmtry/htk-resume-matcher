import { getMetrics } from '@/lib/data';
import { requireUser } from '@/lib/guard';
import { route } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const user = await requireUser();
  return Response.json(await getMetrics(user.id));
});
