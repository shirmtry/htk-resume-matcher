import { describe, expect, it } from 'vitest';
import { FEEDBACK_DELTA, rankCandidates } from './match';
import { SEED_CANDIDATES, SEED_JOBS } from './seed';

const backend = SEED_JOBS.find((job) => job.id === 'job-1001')!;
const frontend = SEED_JOBS.find((job) => job.id === 'job-1002')!;

function rankFor(job = backend, feedback = new Map<string, 'relevant' | 'not_relevant'>()) {
  return rankCandidates({ job, candidates: SEED_CANDIDATES, feedback, jobsForVocabulary: SEED_JOBS });
}

describe('xếp hạng ứng viên', () => {
  it('đưa hai backend senior mạnh nhất lên đầu vị trí backend', () => {
    const ranked = rankFor();
    expect(new Set(ranked.slice(0, 2).map((row) => row.candidateId))).toEqual(
      new Set(['cand-2001', 'cand-2007']),
    );
  });

  it('giải thích kỹ năng khớp và còn thiếu', () => {
    const ranked = rankFor();
    const bao = ranked.find((row) => row.candidateId === 'cand-2002')!;
    expect(bao.matchedSkills).toContain('node.js');
    expect(bao.missingSkills).toContain('typescript');
    expect(bao.missingSkills).toContain('testing');
    expect(bao.reasons.join(' ')).toContain('Còn thiếu');
    expect(bao.breakdown.seniority).toBeCloseTo(0.8, 4);
  });

  it('phạt ứng viên dưới số năm tối thiểu', () => {
    const ranked = rankFor(frontend);
    const ha = ranked.find((row) => row.candidateId === 'cand-2003')!;
    const truc = ranked.find((row) => row.candidateId === 'cand-2008')!;
    expect(ha.breakdown.seniority).toBe(1);
    expect(truc.breakdown.seniority).toBeCloseTo(2 / 3, 4);
    expect(truc.score).toBeLessThan(ha.score);
  });

  it('cộng điểm khi recruiter đánh dấu phù hợp', () => {
    const base = rankFor(frontend).find((row) => row.candidateId === 'cand-2008')!;
    const boosted = rankFor(frontend, new Map([['cand-2008', 'relevant']])).find(
      (row) => row.candidateId === 'cand-2008',
    )!;
    expect(boosted.score).toBeCloseTo(Math.min(1, base.score + FEEDBACK_DELTA), 4);
    expect(boosted.breakdown.feedback).toBeCloseTo(FEEDBACK_DELTA, 4);
    expect(boosted.reasons.join(' ')).toContain('cộng');
  });

  it('trừ điểm khi recruiter đánh dấu không phù hợp', () => {
    const ranked = rankFor(backend, new Map([['cand-2002', 'not_relevant']]));
    const bao = ranked.find((row) => row.candidateId === 'cand-2002')!;
    expect(bao.breakdown.feedback).toBeCloseTo(-FEEDBACK_DELTA, 4);
    expect(bao.reasons.join(' ')).toContain('trừ');
  });

  it('điểm luôn nằm trong khoảng 0..1 và sắp xếp giảm dần', () => {
    const ranked = rankFor();
    for (const row of ranked) {
      expect(row.score).toBeGreaterThanOrEqual(0);
      expect(row.score).toBeLessThanOrEqual(1);
    }
    const scores = ranked.map((row) => row.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('giữ thứ tự ổn định khi điểm bằng nhau', () => {
    const first = rankFor().map((row) => row.candidateId);
    const second = rankFor().map((row) => row.candidateId);
    expect(first).toEqual(second);
  });
});
