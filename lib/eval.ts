export type Relevance = 0 | 1 | 2;

export type EvalJobInput = {
  jobId: string;
  title: string;
  rankedCandidateIds: string[];
  labels: Map<string, Relevance>;
};

export type EvalJobResult = {
  jobId: string;
  title: string;
  precision5: number;
  recall10: number;
  mrr: number;
  relevant: number;
  top5: { candidateId: string; relevance: Relevance; hit: boolean }[];
};

export type EvalMetrics = {
  precision5: number;
  recall10: number;
  mrr: number;
  passed: boolean;
  jobs: EvalJobResult[];
};

export const GATE_THRESHOLDS = { precision5: 0.6, recall10: 0.9, mrr: 0.8 } as const;

const round = (value: number) => Math.round(value * 10000) / 10000;

export function evaluateJob(input: EvalJobInput): EvalJobResult {
  const relevantIds = new Set(
    [...input.labels.entries()].filter(([, relevance]) => relevance >= 1).map(([id]) => id),
  );
  const top5 = input.rankedCandidateIds.slice(0, 5).map((candidateId) => {
    const relevance = input.labels.get(candidateId) ?? 0;
    return { candidateId, relevance, hit: relevance >= 1 };
  });
  const hits5 = top5.filter((row) => row.hit).length;
  const denominator = Math.min(5, input.rankedCandidateIds.length);
  const precision5 = denominator === 0 ? 0 : hits5 / denominator;

  const top10 = input.rankedCandidateIds.slice(0, 10);
  const hits10 = top10.filter((id) => relevantIds.has(id)).length;
  const recall10 = relevantIds.size === 0 ? 0 : hits10 / relevantIds.size;

  let rr = 0;
  for (let index = 0; index < input.rankedCandidateIds.length; index += 1) {
    if (relevantIds.has(input.rankedCandidateIds[index])) {
      rr = 1 / (index + 1);
      break;
    }
  }

  return {
    jobId: input.jobId,
    title: input.title,
    precision5: round(precision5),
    recall10: round(recall10),
    mrr: round(rr),
    relevant: relevantIds.size,
    top5,
  };
}

export function computeMetrics(jobs: EvalJobInput[], thresholds = GATE_THRESHOLDS): EvalMetrics {
  const results = jobs.map(evaluateJob);
  const count = results.length || 1;
  const precision5 = round(results.reduce((sum, job) => sum + job.precision5, 0) / count);
  const recall10 = round(results.reduce((sum, job) => sum + job.recall10, 0) / count);
  const mrr = round(results.reduce((sum, job) => sum + job.mrr, 0) / count);
  const passed =
    precision5 >= thresholds.precision5 &&
    recall10 >= thresholds.recall10 &&
    mrr >= thresholds.mrr;
  return { precision5, recall10, mrr, passed, jobs: results };
}
