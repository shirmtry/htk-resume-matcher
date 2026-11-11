import { deleteJob, getJob, listJobs } from '@/lib/data';
import { requireUser } from '@/lib/guard';
import { route } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const [job, jobs] = await Promise.all([getJob(user.id, id), listJobs(user.id)]);
  return Response.json({ job, jobCount: jobs.length });
});

export const DELETE = route(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await deleteJob(user.id, id);
  return Response.json({ ok: true });
});
