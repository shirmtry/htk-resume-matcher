'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

type Job = {
  id: string;
  title: string;
  description: string;
  skills: string[];
  minYears: number;
  labelCount: number;
  createdAt: string;
};

type Candidate = {
  id: string;
  name: string;
  text: string;
  skills: string[];
  years: number;
  createdAt: string;
};

type EvalRun = {
  id: string;
  precision5: number;
  recall10: number;
  mrr: number;
  passed: boolean;
  createdAt: string;
  metrics: {
    jobs: {
      jobId: string;
      title: string;
      precision5: number;
      recall10: number;
      mrr: number;
      relevant: number;
    }[];
  };
};

type Metrics = {
  jobs: number;
  candidates: number;
  labels: number;
  feedback: number;
  latestEval: EvalRun | null;
  requestP50: number | null;
  requestP95: number | null;
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

function percent(value: number): string {
  return `${(value * 100).toFixed(2).replace('.', ',')}%`;
}

function decimal(value: number): string {
  return value.toFixed(4).replace('.', ',');
}

export function Workspace({ user }: { user: { id: string; email: string; name: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [runs, setRuns] = useState<EvalRun[]>([]);

  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jobSkills, setJobSkills] = useState('');
  const [jobYears, setJobYears] = useState('3');
  const [jobPending, setJobPending] = useState(false);

  const [cvName, setCvName] = useState('');
  const [cvText, setCvText] = useState('');
  const [cvSkills, setCvSkills] = useState('');
  const [cvYears, setCvYears] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [cvPending, setCvPending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [evalPending, setEvalPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [metricData, jobData, candidateData, runData] = await Promise.all([
        api<Metrics>('/api/metrics'),
        api<{ jobs: Job[] }>('/api/jobs'),
        api<{ candidates: Candidate[] }>('/api/candidates'),
        api<{ runs: EvalRun[] }>('/api/eval'),
      ]);
      setMetrics(metricData);
      setJobs(jobData.jobs);
      setCandidates(candidateData.candidates);
      setRuns(runData.runs);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  async function createJob(event: React.FormEvent) {
    event.preventDefault();
    setJobPending(true);
    setError(null);
    setNotice(null);
    try {
      await api<{ job: Job }>('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({
          title: jobTitle,
          description: jobDescription,
          skills: jobSkills,
          minYears: Number(jobYears || 0),
        }),
      });
      setJobTitle('');
      setJobDescription('');
      setJobSkills('');
      setJobYears('3');
      setNotice('Đã tạo vị trí mới. Chấm nhãn vàng để đưa vị trí vào lần đánh giá tiếp theo.');
      await loadAll();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tạo được vị trí.');
    } finally {
      setJobPending(false);
    }
  }

  async function uploadCandidate(event: React.FormEvent) {
    event.preventDefault();
    setCvPending(true);
    setError(null);
    setNotice(null);
    try {
      const candidate = await api<{ candidate: Candidate }>('/api/candidates', {
        method: 'POST',
        body: JSON.stringify({
          name: cvName,
          text: cvText,
          skills: cvSkills || undefined,
          years: cvYears.trim() === '' ? null : Number(cvYears),
        }),
      });
      setNotice(
        `Đã thêm ${candidate.candidate.name}: ${candidate.candidate.skills.length} kỹ năng, ${candidate.candidate.years} năm kinh nghiệm.`,
      );
      setCvName('');
      setCvText('');
      setCvSkills('');
      setCvYears('');
      setFileName(null);
      if (fileInput.current) fileInput.current.value = '';
      await loadAll();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thêm được CV.');
    } finally {
      setCvPending(false);
    }
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > 200_000) {
      setError('File vượt 200 KB. Hãy dán phần nội dung chính thay vì tải toàn bộ.');
      event.target.value = '';
      return;
    }
    try {
      const content = await file.text();
      setCvText(content);
      setFileName(file.name);
      if (!cvName) setCvName(file.name.replace(/\.(txt|md)$/i, '').replace(/[-_]+/g, ' '));
    } catch {
      setError('Không đọc được file. Chỉ hỗ trợ .txt và .md dạng văn bản.');
    }
  }

  async function deleteCandidate(candidate: Candidate) {
    if (!window.confirm(`Xoá CV của ${candidate.name}? Thao tác này không hoàn tác.`)) return;
    setDeletingId(candidate.id);
    setError(null);
    setNotice(null);
    try {
      await api(`/api/candidates/${candidate.id}`, { method: 'DELETE' });
      setNotice(`Đã xoá CV của ${candidate.name}.`);
      await loadAll();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không xoá được CV.');
    } finally {
      setDeletingId(null);
    }
  }

  async function runEval() {
    setEvalPending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api<{ run: EvalRun }>('/api/eval', { method: 'POST' });
      setNotice(
        result.run.passed
          ? `Đạt cổng: P@5 ${percent(result.run.precision5)}, R@10 ${percent(result.run.recall10)}, MRR ${decimal(result.run.mrr)}.`
          : `Không đạt cổng: P@5 ${percent(result.run.precision5)}, R@10 ${percent(result.run.recall10)}, MRR ${decimal(result.run.mrr)}.`,
      );
      await loadAll();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không chạy được đánh giá.');
    } finally {
      setEvalPending(false);
    }
  }

  const latest = metrics?.latestEval ?? null;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link className="text-sm text-slate-400 hover:text-slate-200" href="/">
            HTK Match
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">Workspace tuyển dụng</h1>
          <p className="text-sm text-slate-500">
            {user.name} · {user.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" type="button" onClick={() => void loadAll()}>
            Tải lại
          </button>
          <button className="btn-ghost" type="button" onClick={() => void logout()}>
            Đăng xuất
          </button>
        </div>
      </header>

      <div aria-live="polite" role="status" className="mt-4 space-y-2">
        {notice && (
          <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {notice}
          </p>
        )}
      </div>

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          <p>{error}</p>
          <button className="link mt-2 text-xs" type="button" onClick={() => void loadAll()}>
            Thử tải lại
          </button>
        </div>
      )}

      {loading ? (
        <p className="mt-10 text-sm text-slate-400" role="status" aria-busy="true">
          Đang tải workspace…
        </p>
      ) : (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Chỉ số workspace">
            <div className="card">
              <p className="text-xs uppercase tracking-wide text-slate-500">Vị trí</p>
              <p className="mt-1 text-2xl font-semibold">{metrics?.jobs ?? 0}</p>
              <p className="mt-1 text-xs text-slate-500">job đang tuyển</p>
            </div>
            <div className="card">
              <p className="text-xs uppercase tracking-wide text-slate-500">Ứng viên</p>
              <p className="mt-1 text-2xl font-semibold">{metrics?.candidates ?? 0}</p>
              <p className="mt-1 text-xs text-slate-500">{metrics?.labels ?? 0} nhãn vàng · {metrics?.feedback ?? 0} feedback</p>
            </div>
            <div className="card">
              <p className="text-xs uppercase tracking-wide text-slate-500">Precision@5</p>
              <p className="mt-1 text-2xl font-semibold">{latest ? percent(latest.precision5) : '—'}</p>
              <p className="mt-1 text-xs text-slate-500">
                {latest ? (
                  <span className={latest.passed ? 'text-emerald-300' : 'text-rose-300'}>
                    {latest.passed ? 'Đạt cổng chặn hồi quy' : 'Dưới ngưỡng chặn hồi quy'}
                  </span>
                ) : (
                  'chưa chạy đánh giá'
                )}
              </p>
            </div>
            <div className="card">
              <p className="text-xs uppercase tracking-wide text-slate-500">Độ trễ request</p>
              <p className="mt-1 text-2xl font-semibold">
                {metrics?.requestP95 === null || metrics?.requestP95 === undefined
                  ? '—'
                  : `${metrics.requestP95} ms`}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                p95 · p50 {metrics?.requestP50 ?? '—'} ms trên 200 request gần nhất
              </p>
            </div>
          </section>

          <section className="mt-8" aria-labelledby="jobs-heading">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 id="jobs-heading" className="text-lg font-semibold">
                Vị trí đang tuyển
              </h2>
              <p className="text-xs text-slate-500">Mở một vị trí để xem xếp hạng, chấm nhãn và feedback.</p>
            </div>
            {jobs.length === 0 ? (
              <div className="card mt-3 text-sm text-slate-400">
                Chưa có vị trí nào. Tạo vị trí đầu tiên ở biểu mẫu bên dưới.
              </div>
            ) : (
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {jobs.map((job) => (
                  <article key={job.id} className="card flex flex-col">
                    <h3 className="text-base font-semibold text-slate-100">{job.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Tối thiểu {job.minYears} năm · {job.labelCount} nhãn vàng
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-400">{job.description}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {job.skills.slice(0, 6).map((skill) => (
                        <span key={skill} className="badge">
                          {skill}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <Link className="link text-sm" href={`/workspace/jobs/${job.id}`}>
                        Xem xếp hạng →
                      </Link>
                      <span className="text-xs text-slate-500">{job.labelCount > 0 ? 'Trong eval' : 'Chưa có nhãn'}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
            <section aria-labelledby="candidates-heading">
              <div className="flex items-end justify-between gap-2">
                <h2 id="candidates-heading" className="text-lg font-semibold">
                  Thư viện CV
                </h2>
                <span className="text-xs text-slate-500">{candidates.length} ứng viên</span>
              </div>
              {candidates.length === 0 ? (
                <div className="card mt-3 text-sm text-slate-400">
                  Chưa có CV. Tải file .txt/.md hoặc dán nội dung ở biểu mẫu bên cạnh.
                </div>
              ) : (
                <ul className="mt-3 space-y-3">
                  {candidates.map((candidate) => (
                    <li key={candidate.id} className="card">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-100">{candidate.name}</p>
                          <p className="text-xs text-slate-500">{candidate.years} năm kinh nghiệm</p>
                        </div>
                        <button
                          className="btn-ghost px-2.5 py-1.5 text-xs"
                          type="button"
                          disabled={deletingId === candidate.id}
                          onClick={() => void deleteCandidate(candidate)}
                          aria-label={`Xoá CV của ${candidate.name}`}
                        >
                          {deletingId === candidate.id ? 'Đang xoá…' : 'Xoá'}
                        </button>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-400">{candidate.text}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {candidate.skills.slice(0, 8).map((skill) => (
                          <span key={skill} className="badge">
                            {skill}
                          </span>
                        ))}
                        {candidate.skills.length > 8 && (
                          <span className="badge">+{candidate.skills.length - 8}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="space-y-6">
              <section className="card" aria-labelledby="eval-heading">
                <h2 id="eval-heading" className="text-lg font-semibold">
                  Đánh giá &amp; cổng hồi quy
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Chỉ job có nhãn vàng được chấm. Ranking dùng tín hiệu thuần, không cộng feedback.
                </p>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-slate-400">
                  <div className="rounded-xl border border-line px-2 py-2">
                    <dt>P@5 ≥ 60%</dt>
                    <dd className="mt-1 text-base font-semibold text-slate-100">
                      {latest ? percent(latest.precision5) : '—'}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-line px-2 py-2">
                    <dt>R@10 ≥ 90%</dt>
                    <dd className="mt-1 text-base font-semibold text-slate-100">
                      {latest ? percent(latest.recall10) : '—'}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-line px-2 py-2">
                    <dt>MRR ≥ 0,80</dt>
                    <dd className="mt-1 text-base font-semibold text-slate-100">
                      {latest ? decimal(latest.mrr) : '—'}
                    </dd>
                  </div>
                </dl>
                <button
                  className="btn-primary mt-3 w-full"
                  type="button"
                  onClick={() => void runEval()}
                  disabled={evalPending}
                >
                  {evalPending ? 'Đang chấm…' : 'Chạy đánh giá'}
                </button>

                <h3 className="mt-5 text-sm font-semibold text-slate-200">Lịch sử</h3>
                {runs.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-400">Chưa có lần đánh giá nào.</p>
                ) : (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-slate-500">
                        <tr>
                          <th className="py-1 pr-2 font-medium">Thời điểm</th>
                          <th className="py-1 pr-2 font-medium">P@5</th>
                          <th className="py-1 pr-2 font-medium">R@10</th>
                          <th className="py-1 pr-2 font-medium">MRR</th>
                          <th className="py-1 font-medium">Gate</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-300">
                        {runs.map((run) => (
                          <tr key={run.id} className="border-t border-line/60">
                            <td className="py-1.5 pr-2 whitespace-nowrap">
                              {new Date(run.createdAt).toLocaleString('vi-VN', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="py-1.5 pr-2">{percent(run.precision5)}</td>
                            <td className="py-1.5 pr-2">{percent(run.recall10)}</td>
                            <td className="py-1.5 pr-2">{decimal(run.mrr)}</td>
                            <td className={`py-1.5 font-semibold ${run.passed ? 'text-emerald-300' : 'text-rose-300'}`}>
                              {run.passed ? 'Đạt' : 'Fail'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="card" aria-labelledby="upload-heading">
                <h2 id="upload-heading" className="text-lg font-semibold">
                  Thêm CV
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Hỗ trợ .txt/.md tối đa 200 KB, hoặc dán trực tiếp. Kỹ năng và số năm được tách tự động.
                </p>
                <form className="mt-3 space-y-3" onSubmit={(event) => void uploadCandidate(event)}>
                  <div>
                    <label className="label" htmlFor="cv-file">
                      Tệp CV
                    </label>
                    <input
                      ref={fileInput}
                      id="cv-file"
                      className="input file:mr-3 file:rounded-lg file:border-0 file:bg-accent/20 file:px-2 file:py-1 file:text-xs file:text-accent"
                      type="file"
                      accept=".txt,.md,text/plain,text/markdown"
                      onChange={(event) => void onFile(event)}
                    />
                    {fileName && <p className="mt-1 text-xs text-slate-500">Đã đọc: {fileName}</p>}
                  </div>
                  <div>
                    <label className="label" htmlFor="cv-name">
                      Tên ứng viên
                    </label>
                    <input
                      id="cv-name"
                      className="input"
                      value={cvName}
                      onChange={(event) => setCvName(event.target.value)}
                      required
                      minLength={2}
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="cv-text">
                      Nội dung CV
                    </label>
                    <textarea
                      id="cv-text"
                      className="input min-h-[140px] resize-y"
                      value={cvText}
                      onChange={(event) => setCvText(event.target.value)}
                      required
                      minLength={40}
                      maxLength={20000}
                      placeholder="Ví dụ: Kỹ sư dữ liệu 6 năm với Python, SQL, Airflow…"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label" htmlFor="cv-years">
                        Số năm (tuỳ chọn)
                      </label>
                      <input
                        id="cv-years"
                        className="input"
                        type="number"
                        min={0}
                        max={40}
                        inputMode="numeric"
                        value={cvYears}
                        onChange={(event) => setCvYears(event.target.value)}
                        placeholder="Tự đọc"
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="cv-skills">
                        Kỹ năng (tuỳ chọn)
                      </label>
                      <input
                        id="cv-skills"
                        className="input"
                        value={cvSkills}
                        onChange={(event) => setCvSkills(event.target.value)}
                        placeholder="python, sql, airflow"
                      />
                    </div>
                  </div>
                  <button className="btn-primary w-full" type="submit" disabled={cvPending}>
                    {cvPending ? 'Đang xử lý…' : 'Thêm vào thư viện'}
                  </button>
                </form>
              </section>

              <section className="card" aria-labelledby="job-form-heading">
                <h2 id="job-form-heading" className="text-lg font-semibold">
                  Tạo vị trí
                </h2>
                <form className="mt-3 space-y-3" onSubmit={(event) => void createJob(event)}>
                  <div>
                    <label className="label" htmlFor="job-title">
                      Tiêu đề
                    </label>
                    <input
                      id="job-title"
                      className="input"
                      value={jobTitle}
                      onChange={(event) => setJobTitle(event.target.value)}
                      required
                      minLength={3}
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="job-description">
                      Mô tả
                    </label>
                    <textarea
                      id="job-description"
                      className="input min-h-[100px] resize-y"
                      value={jobDescription}
                      onChange={(event) => setJobDescription(event.target.value)}
                      required
                      minLength={30}
                      maxLength={4000}
                    />
                  </div>
                  <div className="grid grid-cols-[1fr_110px] gap-3">
                    <div>
                      <label className="label" htmlFor="job-skills">
                        Kỹ năng bắt buộc
                      </label>
                      <input
                        id="job-skills"
                        className="input"
                        value={jobSkills}
                        onChange={(event) => setJobSkills(event.target.value)}
                        placeholder="node.js, typescript, postgresql"
                        required
                        minLength={2}
                        maxLength={600}
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="job-years">
                        Năm tối thiểu
                      </label>
                      <input
                        id="job-years"
                        className="input"
                        type="number"
                        min={0}
                        max={30}
                        inputMode="numeric"
                        value={jobYears}
                        onChange={(event) => setJobYears(event.target.value)}
                      />
                    </div>
                  </div>
                  <button className="btn-primary w-full" type="submit" disabled={jobPending}>
                    {jobPending ? 'Đang tạo…' : 'Tạo vị trí'}
                  </button>
                </form>
              </section>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
