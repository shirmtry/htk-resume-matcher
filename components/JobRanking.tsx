'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type Ranking = {
  job: {
    id: string;
    title: string;
    description: string;
    skills: string[];
    minYears: number;
    labelCount: number;
  };
  ranked: {
    candidateId: string;
    name: string;
    years: number;
    skills: string[];
    score: number;
    breakdown: { coverage: number; overlap: number; seniority: number; feedback: number; base: number };
    matchedSkills: string[];
    missingSkills: string[];
    reasons: string[];
  }[];
  feedback: Record<string, 'relevant' | 'not_relevant'>;
  labels: Record<string, number>;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (response.status === 401) {
    window.location.href = '/login';
    throw new Error('Cần đăng nhập.');
  }
  const data = (await response.json().catch(() => null)) as
    | (T & { error?: { message: string } })
    | null;
  if (!response.ok) throw new Error(data?.error?.message ?? 'Có lỗi xảy ra, thử lại sau.');
  return data as T;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1).replace('.', ',')}%`;
}

function signed(value: number): string {
  if (value === 0) return '0';
  const text = value.toFixed(2).replace('.', ',');
  return value > 0 ? `+${text}` : text;
}

export function JobRanking({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [data, setData] = useState<Ranking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api<Ranking>(`/api/jobs/${jobId}/ranking`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được xếp hạng.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleFeedback(candidateId: string, label: 'relevant' | 'not_relevant') {
    const current = data?.feedback[candidateId];
    setPendingId(candidateId);
    setError(null);
    try {
      await api(`/api/jobs/${jobId}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ candidateId, label: current === label ? null : label }),
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không lưu được feedback.');
    } finally {
      setPendingId(null);
    }
  }

  async function setLabel(candidateId: string, value: string) {
    setPendingId(candidateId);
    setError(null);
    try {
      await api(`/api/jobs/${jobId}/labels`, {
        method: 'POST',
        body: JSON.stringify({ candidateId, relevance: value === '' ? null : Number(value) }),
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không lưu được nhãn vàng.');
    } finally {
      setPendingId(null);
    }
  }

  async function deleteJob() {
    if (!data) return;
    if (!window.confirm(`Xoá vị trí "${data.job.title}" cùng toàn bộ nhãn vàng và feedback của vị trí này?`)) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await api(`/api/jobs/${jobId}`, { method: 'DELETE' });
      router.push('/workspace');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không xoá được vị trí.');
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <p className="text-sm text-slate-400" role="status" aria-busy="true">
          Đang tải xếp hạng…
        </p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <Link className="link text-sm" href="/workspace">
          ← Về workspace
        </Link>
        <div role="alert" className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error ?? 'Không tìm thấy vị trí.'}
        </div>
      </main>
    );
  }

  const labelCount = Object.keys(data.labels).length;
  const feedbackCount = Object.keys(data.feedback).length;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-8 sm:px-6">
      <Link className="text-sm text-slate-400 hover:text-slate-200" href="/workspace">
        ← Về workspace
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{data.job.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tối thiểu {data.job.minYears} năm · {data.ranked.length} ứng viên · {labelCount} nhãn vàng ·{' '}
            {feedbackCount} feedback
          </p>
        </div>
        <button className="btn-ghost" type="button" onClick={() => void deleteJob()} disabled={deleting}>
          {deleting ? 'Đang xoá…' : 'Xoá vị trí'}
        </button>
      </header>

      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">{data.job.description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {data.job.skills.map((skill) => (
          <span key={skill} className="badge border-accent/40 text-accent">
            {skill}
          </span>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-line bg-panel/50 px-3 py-2 text-xs leading-relaxed text-slate-400">
        Điểm = 0,5 × phủ kỹ năng + 0,32 × trùng từ khoá IDF + 0,18 × mức kinh nghiệm, rồi cộng/trừ 0,12 theo
        feedback. Nhãn vàng: 0 = loại, 1 = cân nhắc, 2 = mạnh. Đánh giá gate không dùng feedback.
      </div>

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      )}

      {data.ranked.length === 0 ? (
        <div className="card mt-6 text-sm text-slate-400">
          Chưa có ứng viên nào. <Link className="link" href="/workspace">Thêm CV trong workspace</Link> rồi quay lại.
        </div>
      ) : (
        <ol className="mt-6 space-y-4">
          {data.ranked.map((row, index) => {
            const label = data.labels[row.candidateId];
            const feedback = data.feedback[row.candidateId];
            const busy = pendingId === row.candidateId;
            return (
              <li key={row.candidateId} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-100">{row.name}</p>
                      <p className="text-xs text-slate-500">
                        {row.years} năm kinh nghiệm · {row.skills.length} kỹ năng
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-semibold text-accent">{pct(row.score)}</p>
                    <p className="text-xs text-slate-500">điểm tổng</p>
                  </div>
                </div>

                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.max(2, Math.min(100, row.score * 100))}%` }}
                  />
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div className="rounded-lg border border-line px-2 py-1.5">
                    <dt className="text-slate-500">Phủ kỹ năng</dt>
                    <dd className="font-semibold text-slate-200">{pct(row.breakdown.coverage)}</dd>
                  </div>
                  <div className="rounded-lg border border-line px-2 py-1.5">
                    <dt className="text-slate-500">IDF</dt>
                    <dd className="font-semibold text-slate-200">{pct(row.breakdown.overlap)}</dd>
                  </div>
                  <div className="rounded-lg border border-line px-2 py-1.5">
                    <dt className="text-slate-500">Kinh nghiệm</dt>
                    <dd className="font-semibold text-slate-200">{pct(row.breakdown.seniority)}</dd>
                  </div>
                  <div className="rounded-lg border border-line px-2 py-1.5">
                    <dt className="text-slate-500">Feedback</dt>
                    <dd className="font-semibold text-slate-200">{signed(row.breakdown.feedback)}</dd>
                  </div>
                </dl>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {row.matchedSkills.map((skill) => (
                    <span key={`m-${skill}`} className="badge border-emerald-500/40 text-emerald-200">
                      ✓ {skill}
                    </span>
                  ))}
                  {row.missingSkills.map((skill) => (
                    <span key={`x-${skill}`} className="badge border-rose-500/40 text-rose-200">
                      ✗ {skill}
                    </span>
                  ))}
                </div>

                <ul className="mt-3 space-y-1 text-xs leading-relaxed text-slate-400">
                  {row.reasons.map((reason) => (
                    <li key={reason}>· {reason}</li>
                  ))}
                </ul>

                <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-line/60 pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500">Feedback:</span>
                    <button
                      className={`btn px-2.5 py-1.5 text-xs ${
                        feedback === 'relevant'
                          ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/60'
                          : 'border border-line text-slate-300 hover:border-emerald-400/50'
                      }`}
                      type="button"
                      aria-pressed={feedback === 'relevant'}
                      disabled={busy}
                      onClick={() => void toggleFeedback(row.candidateId, 'relevant')}
                    >
                      Phù hợp
                    </button>
                    <button
                      className={`btn px-2.5 py-1.5 text-xs ${
                        feedback === 'not_relevant'
                          ? 'bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/60'
                          : 'border border-line text-slate-300 hover:border-rose-400/50'
                      }`}
                      type="button"
                      aria-pressed={feedback === 'not_relevant'}
                      disabled={busy}
                      onClick={() => void toggleFeedback(row.candidateId, 'not_relevant')}
                    >
                      Không phù hợp
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500" htmlFor={`label-${row.candidateId}`}>
                      Nhãn vàng
                    </label>
                    <select
                      id={`label-${row.candidateId}`}
                      className="input w-auto py-1.5 text-xs"
                      value={label === undefined ? '' : String(label)}
                      disabled={busy}
                      onChange={(event) => void setLabel(row.candidateId, event.target.value)}
                    >
                      <option value="">—</option>
                      <option value="0">0 · loại</option>
                      <option value="1">1 · cân nhắc</option>
                      <option value="2">2 · mạnh</option>
                    </select>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
