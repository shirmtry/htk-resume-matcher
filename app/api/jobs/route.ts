import { z } from 'zod';
import { createJob, listJobs } from '@/lib/data';
import { requireUser } from '@/lib/guard';
import { HttpError, readJson, route } from '@/lib/http';
import { enforceLimit } from '@/lib/limits';
import { splitSkills } from '@/lib/text';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(30).max(4000),
  skills: z.string().trim().min(2).max(600),
  minYears: z.number().int().min(0).max(30),
});

export const GET = route(async () => {
  const user = await requireUser();
  return Response.json({ jobs: await listJobs(user.id) });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  await enforceLimit(`job-create:${user.id}`, 20, 60);
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) {
    throw new HttpError(400, 'invalid_input', 'Tiêu đề, mô tả (≥30 ký tự) hoặc kỹ năng chưa hợp lệ.');
  }
  const skills = splitSkills(parsed.data.skills);
  if (skills.length === 0) {
    throw new HttpError(400, 'invalid_skills', 'Cần ít nhất một kỹ năng bắt buộc.');
  }
  const job = await createJob(user.id, { ...parsed.data, skills });
  return Response.json({ job }, { status: 201 });
});
