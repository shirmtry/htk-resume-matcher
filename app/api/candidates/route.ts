import { z } from 'zod';
import { createCandidate, listCandidates } from '@/lib/data';
import { requireUser } from '@/lib/guard';
import { HttpError, readJson, route } from '@/lib/http';
import { enforceLimit } from '@/lib/limits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  text: z.string().trim().min(40).max(20000),
  skills: z.string().trim().max(600).optional(),
  years: z.number().int().min(0).max(40).nullable().optional(),
});

export const GET = route(async () => {
  const user = await requireUser();
  return Response.json({ candidates: await listCandidates(user.id) });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  await enforceLimit(`candidate-create:${user.id}`, 30, 60);
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) {
    throw new HttpError(
      400,
      'invalid_input',
      'Cần tên (≥2 ký tự) và nội dung CV (≥40 ký tự). Số năm nếu có phải từ 0 đến 40.',
    );
  }
  const candidate = await createCandidate(user.id, parsed.data);
  return Response.json({ candidate }, { status: 201 });
});
