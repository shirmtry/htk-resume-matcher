export const SKILL_ALIASES: Record<string, string> = {
  node: 'node.js',
  nodejs: 'node.js',
  'node js': 'node.js',
  ts: 'typescript',
  js: 'javascript',
  postgres: 'postgresql',
  psql: 'postgresql',
  nextjs: 'next.js',
  'next js': 'next.js',
  k8s: 'kubernetes',
  rest: 'rest api',
  restful: 'rest api',
  restapi: 'rest api',
  reactjs: 'react',
  'react native': 'react native',
  vuejs: 'vue',
  'ci/cd': 'ci/cd',
  cicd: 'ci/cd',
  ml: 'machine learning',
  'machine-learning': 'machine learning',
  test: 'testing',
  tests: 'testing',
  jest: 'testing',
  playwright: 'testing',
  vitest: 'testing',
  a11y: 'accessibility',
};

const STOPWORDS = new Set([
  'va',
  'voi',
  'cua',
  'cho',
  'cac',
  'nhung',
  'trong',
  'ngoai',
  'tren',
  'duoi',
  'khi',
  'de',
  'la',
  'co',
  'duoc',
  'tu',
  'den',
  'theo',
  'mot',
  'hai',
  'ba',
  'cung',
  'nhu',
  'tai',
  've',
  'da',
  'dang',
  'se',
  'hoac',
  'vao',
  'ra',
  'len',
  'xuong',
  'and',
  'the',
  'with',
  'for',
  'from',
  'that',
  'this',
  'have',
  'has',
  'had',
  'was',
  'were',
  'are',
  'you',
  'your',
  'our',
  'their',
  'team',
  'work',
  'worked',
  'working',
  'experience',
  'years',
  'year',
  'nam',
  'kinh',
  'nghiem',
  'cong',
  'ty',
  'du',
  'an',
  'xay',
  'dung',
  'thiet',
  'ke',
  'phat',
  'trien',
  'quan',
  'ly',
  'ho',
  'tro',
  'cai',
  'tien',
  'moi',
  'cung',
]);

export function stripDiacritics(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function normalizeSkill(raw: string): string {
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  return SKILL_ALIASES[cleaned] ?? cleaned;
}

export function splitSkills(raw: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of raw.split(/[,;|\n]/)) {
    const skill = normalizeSkill(part);
    if (!skill || seen.has(skill)) continue;
    seen.add(skill);
    result.push(skill);
  }
  return result;
}

export function tokenize(value: string): string[] {
  const plain = stripDiacritics(value).toLowerCase();
  const tokens = plain
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .split(' ')
    .map((token) => token.replace(/^\.+|\.+$/g, ''))
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
  return tokens;
}

export function parseYears(value: string): number | null {
  const match = stripDiacritics(value).match(/(\d{1,2})\s*(?:\+)?\s*(?:nam|year|years|yrs?|yr)\b/i);
  if (!match) return null;
  const years = Number(match[1]);
  if (!Number.isFinite(years) || years < 0 || years > 50) return null;
  return years;
}

function hasSkill(text: string, skill: string, tokens: Set<string>, plain: string): boolean {
  const aliases = [skill, ...Object.entries(SKILL_ALIASES).filter(([, target]) => target === skill).map(([alias]) => alias)];
  return aliases.some((alias) => {
    const needle = stripDiacritics(alias).toLowerCase().replace(/\s+/g, ' ').trim();
    if (needle.length < 2) return false;
    if (needle.includes('/')) {
      return plain.replace(/[^a-z0-9]+/g, '').includes(needle.replace(/[^a-z0-9]+/g, ''));
    }
    if (needle.includes(' ')) {
      return plain.includes(needle);
    }
    return tokens.has(needle);
  });
}

export function detectSkills(text: string, vocabulary: Iterable<string>): string[] {
  const tokens = new Set(tokenize(text));
  const plain = stripDiacritics(text).toLowerCase().replace(/[^a-z0-9+#./]+/g, ' ');
  const found: string[] = [];
  for (const skill of new Set(vocabulary)) {
    if (skill && hasSkill(text, skill, tokens, plain)) found.push(skill);
  }
  return found.sort((a, b) => a.localeCompare(b));
}

export function buildIdf(documents: string[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const document of documents) {
    for (const token of new Set(tokenize(document))) {
      df.set(token, (df.get(token) ?? 0) + 1);
    }
  }
  const total = documents.length;
  const idf = new Map<string, number>();
  for (const [token, count] of df) {
    idf.set(token, Math.log((total + 1) / (count + 1)) + 1);
  }
  return idf;
}

export function idfOverlap(jobTokens: string[], candidateTokens: Set<string>, idf: Map<string, number>): number {
  const uniqueJob = [...new Set(jobTokens)];
  let total = 0;
  let present = 0;
  for (const token of uniqueJob) {
    const weight = idf.get(token) ?? 1;
    total += weight;
    if (candidateTokens.has(token)) present += weight;
  }
  if (total === 0) return 0;
  return present / total;
}
