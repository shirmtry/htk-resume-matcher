import { z } from 'zod';
import { setFeedback } from '@/lib/data';
import { requireUser } from '@/lib/guard';
import { HttpError, readJson, route } from '@/lib/http';
import { enforceLimit } from '@/lib/limits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  candidateId: z.string().trim().min(1).max(64),
  label: z.union([z.literal('relevant'), z.literal('not_relevant')]).nullable(),
});

export const POST = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  await enforceLimit(`feedback:${user.id}`, 120, 60);
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, 'invalid_input', 'Nhãn phản hồi không hợp lệ.');
  await setFeedback(user.id, id, parsed.data.candidateId, parsed.data.label);
  return Response.json({ ok: true });
});
