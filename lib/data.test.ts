import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'htk-resume-test-'));
process.env.PGLITE_DIR = dir;

let db: PGlite;
let data: typeof import('./data');
let limits: typeof import('./rate-limit');

beforeAll(async () => {
  const dbModule = await import('./db');
  data = await import('./data');
  limits = await import('./rate-limit');
  db = await dbModule.getDb();
});

afterAll(async () => {
  await db.close();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows may keep the WASM handle briefly; the temp dir is disposable.
  }
});

describe('dữ liệu seed', () => {
  it('seed 1 người dùng, 3 job, 12 ứng viên, 36 nhãn vàng và 1 lần eval', async () => {
    const [users, jobs, candidates, labels, evaluations] = await Promise.all([
      db.query<{ n: number }>('select count(*)::int as n from users'),
      db.query<{ n: number }>('select count(*)::int as n from jobs'),
      db.query<{ n: number }>('select count(*)::int as n from candidates'),
      db.query<{ n: number }>('select count(*)::int as n from golden_labels'),
      db.query<{ n: number }>('select count(*)::int as n from eval_runs'),
    ]);
    expect(Number(users.rows[0].n)).toBe(1);
    expect(Number(jobs.rows[0].n)).toBe(3);
    expect(Number(candidates.rows[0].n)).toBe(12);
    expect(Number(labels.rows[0].n)).toBe(36);
    expect(Number(evaluations.rows[0].n)).toBe(1);
  });

  it('mỗi job có 12 nhãn vàng và baseline đạt gate', async () => {
    const jobs = await data.listJobs('u-recruiter');
    expect(jobs).toHaveLength(3);
    expect(jobs.every((job) => job.labelCount === 12)).toBe(true);
    const metrics = await data.getMetrics('u-recruiter');
    expect(metrics.latestEval?.passed).toBe(true);
    expect(metrics.latestEval?.precision5).toBe(0.6667);
    expect(metrics.labels).toBe(36);
  });

  it('xếp hạng backend đúng người và có giải thích', async () => {
    const result = await data.getRanking('u-recruiter', 'job-1001');
    expect(result.ranked.slice(0, 2).map((row) => row.candidateId).sort()).toEqual([
      'cand-2001',
      'cand-2007',
    ]);
    const first = result.ranked[0];
    expect(first.matchedSkills.length).toBeGreaterThan(0);
    expect(first.reasons.length).toBeGreaterThanOrEqual(2);
    expect(first.score).toBeGreaterThan(0.7);
  });
});

describe('phản hồi của recruiter', () => {
  it('đánh dấu phù hợp đưa ứng viên junior vào top 5', async () => {
    const before = await data.getRanking('u-recruiter', 'job-1002');
    const positionBefore = before.ranked.findIndex((row) => row.candidateId === 'cand-2008') + 1;
    expect(positionBefore).toBeGreaterThan(5);

    await data.setFeedback('u-recruiter', 'job-1002', 'cand-2008', 'relevant');
    const after = await data.getRanking('u-recruiter', 'job-1002');
    const positionAfter = after.ranked.findIndex((row) => row.candidateId === 'cand-2008') + 1;
    expect(positionAfter).toBeLessThanOrEqual(5);
    expect(after.feedback['cand-2008']).toBe('relevant');

    await data.setFeedback('u-recruiter', 'job-1002', 'cand-2008', null);
    const restored = await data.getRanking('u-recruiter', 'job-1002');
    expect(restored.ranked.find((row) => row.candidateId === 'cand-2008')?.breakdown.feedback).toBe(0);
  });
});

describe('nhãn vàng và đánh giá', () => {
  it('cập nhật và xoá nhãn vàng của một ứng viên', async () => {
    await data.setGoldenLabel('u-recruiter', 'job-1001', 'cand-2008', 2);
    let labels = await data.listLabels('u-recruiter', 'job-1001');
    expect(labels.get('cand-2008')).toBe(2);

    await data.setGoldenLabel('u-recruiter', 'job-1001', 'cand-2008', null);
    labels = await data.listLabels('u-recruiter', 'job-1001');
    expect(labels.has('cand-2008')).toBe(false);
  });

  it('chạy đánh giá và lưu lần chạy mới với chi tiết từng job', async () => {
    const before = await db.query<{ n: number }>('select count(*)::int as n from eval_runs');
    const run = await data.runEvaluation('u-recruiter');
    expect(run.passed).toBe(true);
    expect(run.metrics.jobs).toHaveLength(3);
    expect(run.metrics.precision5).toBe(0.6667);

    const after = await db.query<{ n: number }>('select count(*)::int as n from eval_runs');
    expect(Number(after.rows[0].n)).toBe(Number(before.rows[0].n) + 1);
    const history = await data.listEvalRuns('u-recruiter');
    expect(history[0].id).toBe(run.id);
    expect(history[0].metrics.jobs[0].top5.length).toBeGreaterThan(0);
  });
});

describe('nhập CV và cô lập dữ liệu', () => {
  it('nhập CV tự tách kỹ năng và số năm', async () => {
    const candidate = await data.createCandidate('u-recruiter', {
      name: 'Phan Thảo Vy',
      text: 'Kỹ sư dữ liệu 6 năm kinh nghiệm với Python, SQL, Airflow, PostgreSQL và Docker. Xây pipeline ETL cho kho dữ liệu.',
    });
    expect(candidate.years).toBe(6);
    expect(candidate.skills).toEqual(expect.arrayContaining(['python', 'sql', 'airflow', 'postgresql', 'docker']));

    const ranked = await data.getRanking('u-recruiter', 'job-1003');
    const row = ranked.ranked.find((item) => item.candidateId === candidate.id);
    expect(row?.matchedSkills).toContain('airflow');

    await data.deleteCandidate('u-recruiter', candidate.id);
    const remaining = await data.listCandidates('u-recruiter');
    expect(remaining.some((item) => item.id === candidate.id)).toBe(false);
  });

  it('không cho xoá ứng viên đang nằm trong golden set', async () => {
    await expect(data.deleteCandidate('u-recruiter', 'cand-2001')).rejects.toMatchObject({
      status: 409,
      code: 'candidate_labeled',
    });
  });

  it('job của người dùng khác không truy cập được', async () => {
    await db.query('insert into users (id, email, name, password_hash) values ($1,$2,$3,$4)', [
      'u-other',
      'other@htk.dev',
      'Other Recruiter',
      'scrypt$x$y',
    ]);
    const foreign = await data.createJob('u-other', {
      title: 'Kỹ sư an ninh',
      description: 'Đánh giá lỗ hổng ứng dụng web.',
      skills: ['linux', 'python'],
      minYears: 2,
    });
    await expect(data.getJob('u-recruiter', foreign.id)).rejects.toMatchObject({ status: 404 });
    await expect(data.getRanking('u-recruiter', foreign.id)).rejects.toMatchObject({ status: 404 });
  });

  it('tạo job mới không có nhãn thì không được đưa vào eval', async () => {
    const job = await data.createJob('u-recruiter', {
      title: 'Platform Engineer',
      description: 'Vận hành Kubernetes và Terraform cho nền tảng nội bộ.',
      skills: ['kubernetes', 'terraform', 'docker', 'linux'],
      minYears: 3,
    });
    const run = await data.runEvaluation('u-recruiter');
    expect(run.metrics.jobs.some((item) => item.jobId === job.id)).toBe(false);
    await data.deleteJob('u-recruiter', job.id);
  });
});

describe('giới hạn tần suất', () => {
  it('chặn sau khi vượt ngưỡng trong cùng cửa sổ', async () => {
    const key = `test-${Date.now()}`;
    expect((await limits.hitLimit(key, 2, 60)).ok).toBe(true);
    expect((await limits.hitLimit(key, 2, 60)).ok).toBe(true);
    const blocked = await limits.hitLimit(key, 2, 60);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });
});
