import { describe, expect, it } from 'vitest';
import { buildIdf, detectSkills, idfOverlap, normalizeSkill, parseYears, splitSkills, stripDiacritics, tokenize } from './text';

describe('chuẩn hoá văn bản', () => {
  it('bỏ dấu tiếng Việt và giữ nguyên chữ không dấu', () => {
    expect(stripDiacritics('Kỹ sư phần mềm Đà Nẵng')).toBe('Ky su phan mem Da Nang');
  });

  it('gộp alias kỹ năng và loại trùng', () => {
    expect(splitSkills('NodeJS, TS, node.js; Postgres | testing')).toEqual([
      'node.js',
      'typescript',
      'postgresql',
      'testing',
    ]);
    expect(normalizeSkill('  K8S ')).toBe('kubernetes');
  });

  it('tokenize bỏ stopword và giữ từ chuyên môn', () => {
    const tokens = tokenize('Kinh nghiệm 6 năm với Node.js và PostgreSQL, viết integration test');
    expect(tokens).toContain('node.js');
    expect(tokens).toContain('postgresql');
    expect(tokens).not.toContain('kinh');
    expect(tokens).not.toContain('nam');
  });

  it('đọc số năm kinh nghiệm từ nhiều cách viết', () => {
    expect(parseYears('Có 6 năm kinh nghiệm backend')).toBe(6);
    expect(parseYears('8+ years of experience')).toBe(8);
    expect(parseYears('3 yrs')).toBe(3);
    expect(parseYears('không ghi số năm')).toBeNull();
  });

  it('nhận diện kỹ năng trong CV theo từ trọn vẹn', () => {
    const text = 'Frontend 5 năm: React, TypeScript, Next.js, CSS. Viết test với Playwright và đảm bảo accessibility.';
    const found = detectSkills(text, ['react', 'typescript', 'next.js', 'css', 'testing', 'node.js']);
    expect(found).toContain('react');
    expect(found).toContain('next.js');
    expect(found).toContain('testing');
    expect(found).not.toContain('node.js');
  });
});

describe('trọng số IDF', () => {
  it('từ hiếm có trọng số cao hơn từ phổ biến', () => {
    const idf = buildIdf([
      'node.js typescript postgresql',
      'node.js react css',
      'node.js python sql',
    ]);
    expect(idf.get('typescript')!).toBeGreaterThan(idf.get('node.js')!);
  });

  it('overlap bằng 1 khi ứng viên có đủ token của job', () => {
    const idf = new Map([
      ['node.js', 1.2],
      ['docker', 2.4],
    ]);
    expect(idfOverlap(['node.js', 'docker'], new Set(['node.js', 'docker', 'redis']), idf)).toBe(1);
    expect(idfOverlap(['node.js', 'docker'], new Set(['node.js']), idf)).toBeCloseTo(1.2 / 3.6, 5);
  });
});
