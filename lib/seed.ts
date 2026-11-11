import type { PGlite } from '@electric-sql/pglite';
import { computeMetrics, type Relevance } from './eval';
import { rankCandidates, type MatchCandidate, type MatchJob } from './match';
import { hashPassword } from './password';

export const DEMO_EMAIL = 'recruiter@htk.dev';
export const DEMO_PASSWORD = 'Demo12345!';

type SeedJob = MatchJob & { createdAt: string };
type SeedCandidate = MatchCandidate & { createdAt: string };

export const SEED_JOBS: SeedJob[] = [
  {
    id: 'job-1001',
    title: 'Senior Backend Engineer (Node.js)',
    description:
      'Xây dựng dịch vụ thanh toán và API nội bộ bằng Node.js, TypeScript. Thiết kế schema PostgreSQL, đóng gói bằng Docker, viết REST API có versioning và integration test. Theo dõi độ trễ p95, xử lý idempotency và retry.',
    skills: ['node.js', 'typescript', 'postgresql', 'docker', 'rest api', 'testing'],
    minYears: 5,
    createdAt: '2026-10-02T08:00:00Z',
  },
  {
    id: 'job-1002',
    title: 'Frontend Engineer (React)',
    description:
      'Phát triển sản phẩm SaaS bằng React, TypeScript và Next.js. Xây design system, đảm bảo accessibility theo WCAG, viết test tương tác và tối ưu Core Web Vitals cho người dùng doanh nghiệp.',
    skills: ['react', 'typescript', 'next.js', 'css', 'testing', 'accessibility'],
    minYears: 3,
    createdAt: '2026-10-08T08:00:00Z',
  },
  {
    id: 'job-1003',
    title: 'Data Engineer (ETL)',
    description:
      'Thiết kế pipeline ETL với Python, SQL, Airflow và Spark trên kho dữ liệu PostgreSQL. Đóng gói job bằng Docker, đảm bảo dữ liệu đến đúng hạn và có kiểm tra chất lượng trước khi phát hành cho dashboard.',
    skills: ['python', 'sql', 'airflow', 'spark', 'postgresql', 'docker'],
    minYears: 4,
    createdAt: '2026-10-15T08:00:00Z',
  },
];

export const SEED_CANDIDATES: SeedCandidate[] = [
  {
    id: 'cand-2001',
    name: 'Nguyễn Minh Anh',
    text: 'Backend engineer 6 năm với Node.js, TypeScript, PostgreSQL, Docker, REST API. Xây dựng dịch vụ thanh toán, viết integration test và dùng Redis cho cache. Từng xử lý sự cố p95 tăng gấp ba sau khi thêm retry.',
    skills: ['node.js', 'typescript', 'postgresql', 'docker', 'rest api', 'redis', 'testing'],
    years: 6,
    createdAt: '2026-10-20T09:00:00Z',
  },
  {
    id: 'cand-2002',
    name: 'Trần Quốc Bảo',
    text: 'Lập trình viên backend 4 năm: Node.js, JavaScript, PostgreSQL, Docker, REST API. Kinh nghiệm microservices và MongoDB, quen làm việc với log tập trung.',
    skills: ['node.js', 'javascript', 'postgresql', 'docker', 'rest api'],
    years: 4,
    createdAt: '2026-10-20T09:05:00Z',
  },
  {
    id: 'cand-2003',
    name: 'Lê Thu Hà',
    text: 'Frontend engineer 5 năm với React, TypeScript, Next.js, CSS, Accessibility. Viết test với Playwright, xây design system dùng chung cho bốn sản phẩm.',
    skills: ['react', 'typescript', 'next.js', 'css', 'accessibility', 'testing'],
    years: 5,
    createdAt: '2026-10-20T09:10:00Z',
  },
  {
    id: 'cand-2004',
    name: 'Phạm Gia Hân',
    text: 'Frontend 3 năm: React, JavaScript, CSS, Redux. Xây dashboard nội bộ, tối ưu bundle và phối hợp với designer để chuẩn hoá component.',
    skills: ['react', 'javascript', 'css', 'redux'],
    years: 3,
    createdAt: '2026-10-20T09:15:00Z',
  },
  {
    id: 'cand-2005',
    name: 'Đỗ Nhật Nam',
    text: 'Data engineer 7 năm: Python, SQL, Airflow, Spark, PostgreSQL, Docker, Kafka. Vận hành pipeline hai tỷ sự kiện mỗi ngày và đặt cảnh báo độ trễ dữ liệu.',
    skills: ['python', 'sql', 'airflow', 'spark', 'postgresql', 'docker', 'kafka'],
    years: 7,
    createdAt: '2026-10-20T09:20:00Z',
  },
  {
    id: 'cand-2006',
    name: 'Vũ Khánh Linh',
    text: 'Data analyst 4 năm: Python, SQL, Pandas, PostgreSQL. Xây báo cáo doanh thu và mô hình dự báo, quen viết truy vấn trên kho dữ liệu lớn.',
    skills: ['python', 'sql', 'pandas', 'postgresql'],
    years: 4,
    createdAt: '2026-10-20T09:25:00Z',
  },
  {
    id: 'cand-2007',
    name: 'Hoàng Anh Tuấn',
    text: 'Senior backend 8 năm: Node.js, TypeScript, PostgreSQL, Docker, REST API, Testing, AWS, Kubernetes. Dẫn dắt nhóm sáu người, thiết kế hệ thống chịu tải cao và quy trình release.',
    skills: ['node.js', 'typescript', 'postgresql', 'docker', 'rest api', 'testing', 'aws', 'kubernetes'],
    years: 8,
    createdAt: '2026-10-20T09:30:00Z',
  },
  {
    id: 'cand-2008',
    name: 'Bùi Thanh Trúc',
    text: 'Frontend 2 năm: HTML, CSS, JavaScript, React. Làm landing page, component library và hỗ trợ kiểm thử giao diện trên nhiều trình duyệt.',
    skills: ['html', 'css', 'javascript', 'react'],
    years: 2,
    createdAt: '2026-10-20T09:35:00Z',
  },
  {
    id: 'cand-2009',
    name: 'Trịnh Quang Huy',
    text: 'Fullstack 5 năm: TypeScript, React, Node.js, PostgreSQL, Docker. Làm sản phẩm SaaS B2B, viết test end-to-end và trực tiếp xử lý phản hồi khách hàng.',
    skills: ['typescript', 'react', 'node.js', 'postgresql', 'docker'],
    years: 5,
    createdAt: '2026-10-20T09:40:00Z',
  },
  {
    id: 'cand-2010',
    name: 'Ngô Bảo Châu',
    text: 'DevOps 6 năm: Docker, Kubernetes, Terraform, AWS, Linux. Xây CI/CD cho bốn mươi repository và chuẩn hoá quan sát hệ thống.',
    skills: ['docker', 'kubernetes', 'terraform', 'aws', 'linux'],
    years: 6,
    createdAt: '2026-10-20T09:45:00Z',
  },
  {
    id: 'cand-2011',
    name: 'Lý Mỹ Duyên',
    text: 'Data analyst 3 năm: SQL, Python, Tableau, Excel. Phân tích funnel, viết truy vấn trên kho dữ liệu và trình bày insight cho ban giám đốc.',
    skills: ['sql', 'python', 'tableau', 'excel'],
    years: 3,
    createdAt: '2026-10-20T09:50:00Z',
  },
  {
    id: 'cand-2012',
    name: 'Đặng Hữu Phước',
    text: 'Mobile engineer 4 năm: Swift, Kotlin, React Native, TypeScript. Phát hành năm ứng dụng, tối ưu thời gian khởi động và xử lý crash reporting.',
    skills: ['swift', 'kotlin', 'react native', 'typescript'],
    years: 4,
    createdAt: '2026-10-20T09:55:00Z',
  },
];

const RELEVANT_LABELS: { jobId: string; candidateId: string; relevance: Relevance }[] = [
  { jobId: 'job-1001', candidateId: 'cand-2001', relevance: 2 },
  { jobId: 'job-1001', candidateId: 'cand-2007', relevance: 2 },
  { jobId: 'job-1001', candidateId: 'cand-2002', relevance: 1 },
  { jobId: 'job-1001', candidateId: 'cand-2009', relevance: 1 },
  { jobId: 'job-1002', candidateId: 'cand-2003', relevance: 2 },
  { jobId: 'job-1002', candidateId: 'cand-2004', relevance: 1 },
  { jobId: 'job-1002', candidateId: 'cand-2008', relevance: 1 },
  { jobId: 'job-1002', candidateId: 'cand-2009', relevance: 1 },
  { jobId: 'job-1003', candidateId: 'cand-2005', relevance: 2 },
  { jobId: 'job-1003', candidateId: 'cand-2006', relevance: 1 },
  { jobId: 'job-1003', candidateId: 'cand-2011', relevance: 1 },
];

export const SEED_LABELS: { jobId: string; candidateId: string; relevance: Relevance }[] = [
  ...RELEVANT_LABELS,
  ...SEED_JOBS.flatMap((job) =>
    SEED_CANDIDATES.filter(
      (candidate) => !RELEVANT_LABELS.some((label) => label.jobId === job.id && label.candidateId === candidate.id),
    ).map((candidate) => ({ jobId: job.id, candidateId: candidate.id, relevance: 0 as Relevance })),
  ),
];

export async function seedDemo(db: PGlite): Promise<void> {
  const existing = await db.query<{ n: number }>('select count(*)::int as n from users');
  if (Number(existing.rows[0]?.n ?? 0) > 0) return;

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  await db.query('insert into users (id, email, name, password_hash) values ($1,$2,$3,$4)', [
    'u-recruiter',
    DEMO_EMAIL,
    'Mai Recruiter',
    passwordHash,
  ]);

  for (const job of SEED_JOBS) {
    await db.query(
      'insert into jobs (id, user_id, title, description, skills, min_years, created_at) values ($1,$2,$3,$4,$5,$6,$7)',
      [job.id, 'u-recruiter', job.title, job.description, JSON.stringify(job.skills), job.minYears, job.createdAt],
    );
  }

  for (const candidate of SEED_CANDIDATES) {
    await db.query(
      'insert into candidates (id, user_id, name, text, skills, years, created_at) values ($1,$2,$3,$4,$5,$6,$7)',
      [
        candidate.id,
        'u-recruiter',
        candidate.name,
        candidate.text,
        JSON.stringify(candidate.skills),
        candidate.years,
        candidate.createdAt,
      ],
    );
  }

  for (const label of SEED_LABELS) {
    await db.query(
      'insert into golden_labels (id, job_id, candidate_id, relevance) values ($1,$2,$3,$4)',
      [`gl-${label.jobId}-${label.candidateId}`, label.jobId, label.candidateId, label.relevance],
    );
  }

  await db.query(
    "insert into feedback (id, user_id, job_id, candidate_id, label) values ($1,$2,$3,$4,$5), ($6,$7,$8,$9,$10)",
    [
      'fb-seed-1',
      'u-recruiter',
      'job-1001',
      'cand-2002',
      'not_relevant',
      'fb-seed-2',
      'u-recruiter',
      'job-1003',
      'cand-2011',
      'relevant',
    ],
  );

  const metrics = computeMetrics(
    SEED_JOBS.map((job) => {
      const labels = new Map(
        SEED_LABELS.filter((label) => label.jobId === job.id).map((label) => [label.candidateId, label.relevance]),
      );
      const ranked = rankCandidates({
        job,
        candidates: SEED_CANDIDATES,
        jobsForVocabulary: SEED_JOBS,
      });
      return { jobId: job.id, title: job.title, rankedCandidateIds: ranked.map((item) => item.candidateId), labels };
    }),
  );

  await db.query(
    `insert into eval_runs (id, user_id, precision5, recall10, mrr, passed, detail)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [
      'eval-seed-baseline',
      'u-recruiter',
      metrics.precision5,
      metrics.recall10,
      metrics.mrr,
      metrics.passed,
      JSON.stringify({ thresholds: { precision5: 0.6, recall10: 0.9, mrr: 0.8 }, jobs: metrics.jobs, candidates: SEED_CANDIDATES.length }),
    ],
  );
}
