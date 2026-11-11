import { z } from 'zod';
import { setGoldenLabel } from '@/lib/data';
import { requireUser } from '@/lib/guard';
import { HttpError, readJson, route } from '@/lib/http';
import { enforceLimit } from '@/lib/limits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  candidateId: z.string().trim().min(1).max(64),
  relevance: z.union([z.literal(0), z.literal(1), z.literal(2)]).nullable(),
});

export const POST = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  await enforceLimit(`labels:${user.id}`, 120, 60);
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, 'invalid_input', 'Nhãn vàng phải là 0, 1, 2 hoặc bỏ trống.');
  await setGoldenLabel(user.id, id, parsed.data.candidateId, parsed.data.relevance);
  return Response.json({ ok: true });
});
