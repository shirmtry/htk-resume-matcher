import { buildIdf, detectSkills, idfOverlap, normalizeSkill, tokenize } from './text';

export type MatchJob = {
  id: string;
  title: string;
  description: string;
  skills: string[];
  minYears: number;
};

export type MatchCandidate = {
  id: string;
  name: string;
  text: string;
  skills: string[];
  years: number;
};

export type FeedbackLabel = 'relevant' | 'not_relevant';

export type ScoreBreakdown = {
  coverage: number;
  overlap: number;
  seniority: number;
  feedback: number;
  base: number;
};

export type RankedCandidate = {
  candidateId: string;
  name: string;
  years: number;
  skills: string[];
  score: number;
  breakdown: ScoreBreakdown;
  matchedSkills: string[];
  missingSkills: string[];
  reasons: string[];
};

export const WEIGHTS = { coverage: 0.5, overlap: 0.32, seniority: 0.18 } as const;
export const FEEDBACK_DELTA = 0.12;

export function candidateVocabulary(candidates: MatchCandidate[], jobs: MatchJob[] = []): string[] {
  const vocabulary = new Set<string>();
  for (const job of jobs) for (const skill of job.skills) vocabulary.add(normalizeSkill(skill));
  for (const candidate of candidates) {
    for (const skill of candidate.skills) vocabulary.add(normalizeSkill(skill));
    for (const skill of detectSkills(candidate.text, [...new Set([...candidate.skills, ...jobs.flatMap((job) => job.skills)])])) {
      vocabulary.add(skill);
    }
  }
  return [...vocabulary];
}

export function rankCandidates(input: {
  job: MatchJob;
  candidates: MatchCandidate[];
  feedback?: Map<string, FeedbackLabel>;
  jobsForVocabulary?: MatchJob[];
}): RankedCandidate[] {
  const { job, candidates } = input;
  const feedback = input.feedback ?? new Map<string, FeedbackLabel>();
  const requiredSkills = job.skills.map(normalizeSkill).filter(Boolean);
  const vocabulary = candidateVocabulary(candidates, [job, ...(input.jobsForVocabulary ?? [])]);
  const idf = buildIdf(candidates.map((candidate) => `${candidate.text} ${candidate.skills.join(' ')}`));
  const jobTokens = [
    ...tokenize(job.description),
    ...tokenize(job.title),
    ...requiredSkills.flatMap((skill) => [skill, skill, skill]),
  ];

  const ranked = candidates.map((candidate) => {
    const textSkills = detectSkills(`${candidate.name} ${candidate.text} ${candidate.skills.join(' ')}`, vocabulary);
    const skills = [...new Set([...candidate.skills.map(normalizeSkill), ...textSkills])];
    const skillSet = new Set(skills);
    const candidateTokens = new Set(tokenize(`${candidate.text} ${skills.join(' ')}`));

    const matchedSkills = requiredSkills.filter((skill) => skillSet.has(skill));
    const missingSkills = requiredSkills.filter((skill) => !skillSet.has(skill));
    const coverage = requiredSkills.length === 0 ? 0 : matchedSkills.length / requiredSkills.length;
    const overlap = idfOverlap(jobTokens, candidateTokens, idf);
    const seniority =
      job.minYears <= 0 ? 1 : Math.max(0, Math.min(1, candidate.years / job.minYears));
    const base = WEIGHTS.coverage * coverage + WEIGHTS.overlap * overlap + WEIGHTS.seniority * seniority;
    const label = feedback.get(candidate.id);
    const delta = label === 'relevant' ? FEEDBACK_DELTA : label === 'not_relevant' ? -FEEDBACK_DELTA : 0;
    const score = Math.max(0, Math.min(1, base + delta));

    const reasons: string[] = [];
    if (matchedSkills.length > 0) {
      reasons.push(`Khớp ${matchedSkills.length}/${requiredSkills.length} kỹ năng bắt buộc: ${matchedSkills.join(', ')}.`);
    } else {
      reasons.push(`Chưa khớp kỹ năng bắt buộc nào trong ${requiredSkills.join(', ')}.`);
    }
    if (missingSkills.length > 0) {
      reasons.push(`Còn thiếu: ${missingSkills.join(', ')}.`);
    }
    if (job.minYears > 0) {
      reasons.push(
        candidate.years >= job.minYears
          ? `Kinh nghiệm ${candidate.years} năm, đạt yêu cầu tối thiểu ${job.minYears} năm.`
          : `Kinh nghiệm ${candidate.years} năm, dưới yêu cầu ${job.minYears} năm (${Math.round((candidate.years / job.minYears) * 100)}%).`,
      );
    }
    reasons.push(`Độ trùng từ khoá có trọng số IDF: ${Math.round(overlap * 100)}%.`);
    if (label === 'relevant') reasons.push(`Recruiter đã đánh dấu phù hợp nên được cộng ${FEEDBACK_DELTA.toFixed(2).replace('.', ',')} điểm.`);
    if (label === 'not_relevant') reasons.push(`Recruiter đã đánh dấu không phù hợp nên bị trừ ${FEEDBACK_DELTA.toFixed(2).replace('.', ',')} điểm.`);

    const round = (value: number) => Math.round(value * 10000) / 10000;
    return {
      candidateId: candidate.id,
      name: candidate.name,
      years: candidate.years,
      skills,
      score: round(score),
      breakdown: {
        coverage: round(coverage),
        overlap: round(overlap),
        seniority: round(seniority),
        feedback: delta,
        base: round(base),
      },
      matchedSkills,
      missingSkills,
      reasons,
    };
  });

  return ranked.sort(
    (a, b) => b.score - a.score || b.years - a.years || a.name.localeCompare(b.name),
  );
}
