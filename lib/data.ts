import { randomUUID } from 'node:crypto';
import { getDb, saveState } from './db';
import { computeMetrics, GATE_THRESHOLDS, type EvalMetrics, type Relevance } from './eval';
import { HttpError } from './http';
import { rankCandidates, type FeedbackLabel, type MatchCandidate, type MatchJob, type RankedCandidate } from './match';
import { detectSkills, parseYears, splitSkills } from './text';

export const BASE_VOCABULARY = [
  'accessibility',
  'airflow',
  'aws',
  'css',
  'docker',
  'excel',
  'html',
  'javascript',
  'kafka',
  'kubernetes',
  'linux',
  'machine learning',
  'next.js',
  'node.js',
  'pandas',
  'postgresql',
  'python',
  'react',
  'react native',
  'redis',
  'redux',
  'rest api',
  'spark',
  'sql',
  'swift',
  'tableau',
  'terraform',
  'testing',
  'typescript',
];

type JobRow = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  skills: string;
  min_years: number;
  created_at: Date;
  label_count?: number;
};

type CandidateRow = {
  id: string;
  user_id: string;
  name: string;
  text: string;
  skills: string;
  years: number;
  created_at: Date;
};

export type JobRecord = {
  id: string;
  title: string;
  description: string;
  skills: string[];
  minYears: number;
  createdAt: Date;
  labelCount: number;
};

export type CandidateRecord = {
  id: string;
  name: string;
  text: string;
  skills: string[];
  years: number;
  createdAt: Date;
};

export type EvalRunRecord = {
  id: string;
  precision5: number;
  recall10: number;
  mrr: number;
  passed: boolean;
  metrics: EvalMetrics;
  createdAt: Date;
};

function parseArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function toJob(row: JobRow): JobRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    skills: parseArray(row.skills),
    minYears: Number(row.min_years),
    createdAt: row.created_at,
    labelCount: Number(row.label_count ?? 0),
  };
}

function toCandidate(row: CandidateRow): CandidateRecord {
  return {
    id: row.id,
    name: row.name,
    text: row.text,
    skills: parseArray(row.skills),
    years: Number(row.years),
    createdAt: row.created_at,
  };
}

async function workspaceVocabulary(userId: string): Promise<string[]> {
  const db = await getDb();
  const [jobs, candidates] = await Promise.all([
    db.query<{ skills: string }>('select skills from jobs where user_id = $1', [userId]),
    db.query<{ skills: string }>('select skills from candidates where user_id = $1', [userId]),
  ]);
  const vocabulary = new Set(BASE_VOCABULARY);
  for (const row of [...jobs.rows, ...candidates.rows]) {
    for (const skill of parseArray(row.skills)) vocabulary.add(skill);
  }
  return [...vocabulary];
}

export async function listJobs(userId: string): Promise<JobRecord[]> {
  const db = await getDb();
  const result = await db.query<JobRow>(
    `select j.*, (select count(*) from golden_labels g where g.job_id = j.id)::int as label_count
     from jobs j where j.user_id = $1 order by j.created_at desc, j.title asc`,
    [userId],
  );
  return result.rows.map(toJob);
}

export async function getJob(userId: string, jobId: string): Promise<JobRecord> {
  const db = await getDb();
  const result = await db.query<JobRow>(
    `select j.*, (select count(*) from golden_labels g where g.job_id = j.id)::int as label_count
     from jobs j where j.id = $1 and j.user_id = $2`,
    [jobId, userId],
  );
  const row = result.rows[0];
  if (!row) throw new HttpError(404, 'job_not_found', 'Không tìm thấy vị trí này.');
  return toJob(row);
}

export async function createJob(
  userId: string,
  input: { title: string; description: string; skills: string[]; minYears: number },
): Promise<JobRecord> {
  const db = await getDb();
  const id = `job-${randomUUID().slice(0, 8)}`;
  await db.query(
    'insert into jobs (id, user_id, title, description, skills, min_years) values ($1,$2,$3,$4,$5,$6)',
    [id, userId, input.title, input.description, JSON.stringify(input.skills), input.minYears],
  );
  void saveState().catch(() => undefined);
  return getJob(userId, id);
}

export async function deleteJob(userId: string, jobId: string): Promise<void> {
  await getJob(userId, jobId);
  const db = await getDb();
  await db.query('delete from golden_labels where job_id = $1', [jobId]);
  await db.query('delete from feedback where job_id = $1 and user_id = $2', [jobId, userId]);
  await db.query('delete from jobs where id = $1 and user_id = $2', [jobId, userId]);
  void saveState().catch(() => undefined);
}

export async function listCandidates(userId: string): Promise<CandidateRecord[]> {
  const db = await getDb();
  const result = await db.query<CandidateRow>(
    'select * from candidates where user_id = $1 order by created_at desc, name asc',
    [userId],
  );
  return result.rows.map(toCandidate);
}

async function getCandidate(userId: string, candidateId: string): Promise<CandidateRecord> {
  const db = await getDb();
  const result = await db.query<CandidateRow>(
    'select * from candidates where id = $1 and user_id = $2',
    [candidateId, userId],
  );
  const row = result.rows[0];
  if (!row) throw new HttpError(404, 'candidate_not_found', 'Không tìm thấy ứng viên này.');
  return toCandidate(row);
}

export async function createCandidate(
  userId: string,
  input: { name: string; text: string; skills?: string; years?: number | null },
): Promise<CandidateRecord> {
  const vocabulary = await workspaceVocabulary(userId);
  const structured = splitSkills(input.skills ?? '');
  const detected = detectSkills(`${input.name} ${input.text}`, vocabulary);
  const skills = [...new Set([...structured, ...detected])].sort((a, b) => a.localeCompare(b));
  const years = input.years ?? parseYears(input.text) ?? 0;
  const db = await getDb();
  const id = `cand-${randomUUID().slice(0, 8)}`;
  await db.query(
    'insert into candidates (id, user_id, name, text, skills, years) values ($1,$2,$3,$4,$5,$6)',
    [id, userId, input.name, input.text, JSON.stringify(skills), years],
  );
  void saveState().catch(() => undefined);
  return getCandidate(userId, id);
}

export async function deleteCandidate(userId: string, candidateId: string): Promise<void> {
  await getCandidate(userId, candidateId);
  const db = await getDb();
  const labels = await db.query<{ n: number }>(
    `select count(*)::int as n from golden_labels g join jobs j on j.id = g.job_id
     where g.candidate_id = $1 and j.user_id = $2`,
    [candidateId, userId],
  );
  if (Number(labels.rows[0]?.n ?? 0) > 0) {
    throw new HttpError(
      409,
      'candidate_labeled',
      'Ứng viên đang nằm trong golden set. Bỏ nhãn vàng trước khi xoá.',
    );
  }
  await db.query('delete from feedback where candidate_id = $1 and user_id = $2', [candidateId, userId]);
  await db.query('delete from candidates where id = $1 and user_id = $2', [candidateId, userId]);
  void saveState().catch(() => undefined);
}

async function feedbackMap(userId: string, jobId: string): Promise<Map<string, FeedbackLabel>> {
  const db = await getDb();
  const result = await db.query<{ candidate_id: string; label: FeedbackLabel }>(
    'select candidate_id, label from feedback where user_id = $1 and job_id = $2',
    [userId, jobId],
  );
  return new Map(result.rows.map((row) => [row.candidate_id, row.label]));
}

export async function setFeedback(
  userId: string,
  jobId: string,
  candidateId: string,
  label: FeedbackLabel | null,
): Promise<void> {
  await getJob(userId, jobId);
  await getCandidate(userId, candidateId);
  const db = await getDb();
  if (label === null) {
    await db.query('delete from feedback where user_id = $1 and job_id = $2 and candidate_id = $3', [
      userId,
      jobId,
      candidateId,
    ]);
  } else {
    await db.query(
      `insert into feedback (id, user_id, job_id, candidate_id, label) values ($1,$2,$3,$4,$5)
       on conflict (user_id, job_id, candidate_id) do update set label = excluded.label`,
      [randomUUID(), userId, jobId, candidateId, label],
    );
  }
  void saveState().catch(() => undefined);
}

export type RankingResult = {
  job: JobRecord;
  ranked: RankedCandidate[];
  feedback: Record<string, FeedbackLabel>;
  labels: Record<string, number>;
};

export async function getRanking(userId: string, jobId: string, withFeedback = true): Promise<RankingResult> {
  const job = await getJob(userId, jobId);
  const [candidates, jobs, feedback, labels] = await Promise.all([
    listCandidates(userId),
    listJobs(userId),
    withFeedback ? feedbackMap(userId, jobId) : Promise.resolve(new Map<string, FeedbackLabel>()),
    listLabels(userId, jobId),
  ]);
  const matchJob: MatchJob = {
    id: job.id,
    title: job.title,
    description: job.description,
    skills: job.skills,
    minYears: job.minYears,
  };
  const matchCandidates: MatchCandidate[] = candidates.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    text: candidate.text,
    skills: candidate.skills,
    years: candidate.years,
  }));
  const matchJobs: MatchJob[] = jobs.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    skills: item.skills,
    minYears: item.minYears,
  }));
  const ranked = rankCandidates({
    job: matchJob,
    candidates: matchCandidates,
    feedback,
    jobsForVocabulary: matchJobs,
  });
  return { job, ranked, feedback: Object.fromEntries(feedback), labels: Object.fromEntries(labels) };
}

export async function listLabels(userId: string, jobId: string): Promise<Map<string, Relevance>> {
  await getJob(userId, jobId);
  const db = await getDb();
  const result = await db.query<{ candidate_id: string; relevance: number }>(
    `select g.candidate_id, g.relevance from golden_labels g join jobs j on j.id = g.job_id
     where g.job_id = $1 and j.user_id = $2`,
    [jobId, userId],
  );
  return new Map(result.rows.map((row) => [row.candidate_id, Number(row.relevance) as Relevance]));
}

export async function setGoldenLabel(
  userId: string,
  jobId: string,
  candidateId: string,
  relevance: Relevance | null,
): Promise<void> {
  await getJob(userId, jobId);
  await getCandidate(userId, candidateId);
  const db = await getDb();
  if (relevance === null) {
    await db.query('delete from golden_labels where job_id = $1 and candidate_id = $2', [jobId, candidateId]);
  } else {
    await db.query(
      `insert into golden_labels (id, job_id, candidate_id, relevance) values ($1,$2,$3,$4)
       on conflict (job_id, candidate_id) do update set relevance = excluded.relevance`,
      [randomUUID(), jobId, candidateId, relevance],
    );
  }
  void saveState().catch(() => undefined);
}

export async function runEvaluation(userId: string): Promise<EvalRunRecord> {
  const jobs = await listJobs(userId);
  const candidates = await listCandidates(userId);
  if (candidates.length === 0) {
    throw new HttpError(409, 'no_candidates', 'Cần ít nhất một ứng viên trước khi chạy đánh giá.');
  }
  const matchJobs: MatchJob[] = jobs.map((job) => ({
    id: job.id,
    title: job.title,
    description: job.description,
    skills: job.skills,
    minYears: job.minYears,
  }));
  const matchCandidates: MatchCandidate[] = candidates.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    text: candidate.text,
    skills: candidate.skills,
    years: candidate.years,
  }));

  const inputs = [];
  for (const job of jobs) {
    const labels = await listLabels(userId, job.id);
    if (labels.size === 0) continue;
    const ranked = rankCandidates({ job: matchJobs.find((item) => item.id === job.id)!, candidates: matchCandidates, jobsForVocabulary: matchJobs });
    inputs.push({
      jobId: job.id,
      title: job.title,
      rankedCandidateIds: ranked.map((item) => item.candidateId),
      labels,
    });
  }
  if (inputs.length === 0) {
    throw new HttpError(409, 'no_labels', 'Chưa có job nào có nhãn vàng để đánh giá.');
  }

  const metrics = computeMetrics(inputs);
  const db = await getDb();
  const id = `eval-${randomUUID().slice(0, 8)}`;
  const detail = {
    thresholds: GATE_THRESHOLDS,
    jobs: metrics.jobs,
    candidates: candidates.length,
  };
  await db.query(
    `insert into eval_runs (id, user_id, precision5, recall10, mrr, passed, detail)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [id, userId, metrics.precision5, metrics.recall10, metrics.mrr, metrics.passed, JSON.stringify(detail)],
  );
  void saveState().catch(() => undefined);
  return {
    id,
    precision5: metrics.precision5,
    recall10: metrics.recall10,
    mrr: metrics.mrr,
    passed: metrics.passed,
    metrics,
    createdAt: new Date(),
  };
}

export async function listEvalRuns(userId: string, limit = 8): Promise<EvalRunRecord[]> {
  const db = await getDb();
  const result = await db.query<{
    id: string;
    precision5: string | number;
    recall10: string | number;
    mrr: string | number;
    passed: boolean;
    detail: string;
    created_at: Date;
  }>(
    'select * from eval_runs where user_id = $1 order by created_at desc limit $2',
    [userId, limit],
  );
  return result.rows.map((row) => {
    let metrics: EvalMetrics;
    try {
      const detail = JSON.parse(row.detail) as { thresholds: typeof GATE_THRESHOLDS; jobs: EvalMetrics['jobs'] };
      metrics = {
        precision5: Number(row.precision5),
        recall10: Number(row.recall10),
        mrr: Number(row.mrr),
        passed: row.passed,
        jobs: detail.jobs ?? [],
      };
    } catch {
      metrics = {
        precision5: Number(row.precision5),
        recall10: Number(row.recall10),
        mrr: Number(row.mrr),
        passed: row.passed,
        jobs: [],
      };
    }
    return {
      id: row.id,
      precision5: Number(row.precision5),
      recall10: Number(row.recall10),
      mrr: Number(row.mrr),
      passed: row.passed,
      metrics,
      createdAt: row.created_at,
    };
  });
}

export type WorkspaceMetrics = {
  jobs: number;
  candidates: number;
  labels: number;
  feedback: number;
  latestEval: EvalRunRecord | null;
  requestP50: number | null;
  requestP95: number | null;
};

export async function getMetrics(userId: string): Promise<WorkspaceMetrics> {
  const db = await getDb();
  const [jobs, candidates, labels, feedback, requests] = await Promise.all([
    db.query<{ n: number }>('select count(*)::int as n from jobs where user_id = $1', [userId]),
    db.query<{ n: number }>('select count(*)::int as n from candidates where user_id = $1', [userId]),
    db.query<{ n: number }>(
      'select count(*)::int as n from golden_labels g join jobs j on j.id = g.job_id where j.user_id = $1',
      [userId],
    ),
    db.query<{ n: number }>('select count(*)::int as n from feedback where user_id = $1', [userId]),
    db.query<{ duration_ms: number }>(
      'select duration_ms from request_logs order by created_at desc limit 200',
    ),
  ]);
  const durations = requests.rows.map((row) => Number(row.duration_ms)).sort((a, b) => a - b);
  const percentile = (ratio: number) =>
    durations.length === 0 ? null : durations[Math.min(durations.length - 1, Math.floor(ratio * durations.length))];
  const latest = await listEvalRuns(userId, 1);
  return {
    jobs: Number(jobs.rows[0]?.n ?? 0),
    candidates: Number(candidates.rows[0]?.n ?? 0),
    labels: Number(labels.rows[0]?.n ?? 0),
    feedback: Number(feedback.rows[0]?.n ?? 0),
    latestEval: latest[0] ?? null,
    requestP50: percentile(0.5),
    requestP95: percentile(0.95),
  };
}
