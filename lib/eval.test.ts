import { describe, expect, it } from 'vitest';
import { computeMetrics, evaluateJob, GATE_THRESHOLDS, type EvalJobInput, type Relevance } from './eval';
import { rankCandidates } from './match';
import { SEED_CANDIDATES, SEED_JOBS, SEED_LABELS } from './seed';

function labelsFor(jobId: string): Map<string, Relevance> {
  return new Map(
    SEED_LABELS.filter((label) => label.jobId === jobId).map((label) => [label.candidateId, label.relevance]),
  );
}

describe('chỉ số đánh giá', () => {
  it('đạt điểm tuyệt đối khi xếp đúng toàn bộ ứng viên liên quan', () => {
    const job: EvalJobInput = {
      jobId: 'j1',
      title: 'Backend',
      rankedCandidateIds: ['a', 'b', 'c', 'd'],
      labels: new Map([
        ['a', 2],
        ['b', 1],
        ['c', 0],
      ]),
    };
    const result = evaluateJob(job);
    expect(result.precision5).toBe(0.5);
    expect(result.recall10).toBe(1);
    expect(result.mrr).toBe(1);
    expect(result.top5[0]).toEqual({ candidateId: 'a', relevance: 2, hit: true });
  });

  it('MRR giảm khi ứng viên liên quan đầu tiên ở vị trí thứ ba', () => {
    const job: EvalJobInput = {
      jobId: 'j2',
      title: 'Frontend',
      rankedCandidateIds: ['x', 'y', 'relevant', 'z'],
      labels: new Map([['relevant', 1]]),
    };
    const result = evaluateJob(job);
    expect(result.mrr).toBe(0.3333);
    expect(result.precision5).toBeCloseTo(1 / 4, 5);
    expect(result.recall10).toBe(1);
  });

  it('gate thất bại khi không có ứng viên liên quan trong top 5', () => {
    const jobs: EvalJobInput[] = [
      {
        jobId: 'j3',
        title: 'Data',
        rankedCandidateIds: ['a', 'b', 'c', 'd', 'e', 'relevant'],
        labels: new Map([['relevant', 2]]),
      },
    ];
    const metrics = computeMetrics(jobs);
    expect(metrics.precision5).toBe(0);
    expect(metrics.mrr).toBeCloseTo(1 / 6, 4);
    expect(metrics.passed).toBe(false);
  });

  it('tính trung bình theo job, không gộp toàn bộ ứng viên', () => {
    const jobs: EvalJobInput[] = [
      { jobId: 'a', title: 'A', rankedCandidateIds: ['r1', 'x'], labels: new Map([['r1', 1]]) },
      { jobId: 'b', title: 'B', rankedCandidateIds: ['x', 'r2'], labels: new Map([['r2', 1]]) },
    ];
    const metrics = computeMetrics(jobs);
    expect(metrics.precision5).toBe(0.5);
    expect(metrics.recall10).toBe(1);
    expect(metrics.mrr).toBe(0.75);
    expect(metrics.passed).toBe(false);
  });

  it('baseline seed vượt ngưỡng chặn hồi quy', () => {
    const jobs: EvalJobInput[] = SEED_JOBS.map((job) => ({
      jobId: job.id,
      title: job.title,
      rankedCandidateIds: rankCandidates({
        job,
        candidates: SEED_CANDIDATES,
        jobsForVocabulary: SEED_JOBS,
      }).map((row) => row.candidateId),
      labels: labelsFor(job.id),
    }));
    const metrics = computeMetrics(jobs);
    expect(metrics.precision5).toBe(0.6667);
    expect(metrics.recall10).toBe(1);
    expect(metrics.mrr).toBe(1);
    expect(metrics.passed).toBe(true);
  });
});
