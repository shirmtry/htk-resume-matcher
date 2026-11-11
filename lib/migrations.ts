export type Migration = { version: number; sql: string };

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    sql: `
      create table users (
        id text primary key,
        email text not null unique,
        name text not null,
        password_hash text not null,
        created_at timestamptz not null default now()
      );

      create table sessions (
        id text primary key,
        user_id text not null,
        expires_at timestamptz not null,
        created_at timestamptz not null default now()
      );

      create table jobs (
        id text primary key,
        user_id text not null,
        title text not null,
        description text not null,
        skills text not null,
        min_years integer not null default 0,
        created_at timestamptz not null default now()
      );

      create table candidates (
        id text primary key,
        user_id text not null,
        name text not null,
        text text not null,
        skills text not null,
        years integer not null default 0,
        created_at timestamptz not null default now()
      );

      create table golden_labels (
        id text primary key,
        job_id text not null,
        candidate_id text not null,
        relevance integer not null check (relevance in (0,1,2)),
        unique (job_id, candidate_id)
      );

      create table feedback (
        id text primary key,
        user_id text not null,
        job_id text not null,
        candidate_id text not null,
        label text not null check (label in ('relevant','not_relevant')),
        created_at timestamptz not null default now(),
        unique (user_id, job_id, candidate_id)
      );

      create table eval_runs (
        id text primary key,
        user_id text not null,
        precision5 numeric(6,4) not null,
        recall10 numeric(6,4) not null,
        mrr numeric(6,4) not null,
        passed boolean not null,
        detail text not null,
        created_at timestamptz not null default now()
      );

      create table request_logs (
        id text primary key,
        method text not null,
        path text not null,
        status integer not null,
        duration_ms integer not null,
        created_at timestamptz not null default now()
      );

      create table rate_limits (
        key text primary key,
        window_start bigint not null,
        count integer not null
      );

      create index idx_jobs_user on jobs (user_id, created_at desc);
      create index idx_candidates_user on candidates (user_id, created_at desc);
      create index idx_golden_job on golden_labels (job_id);
      create index idx_feedback_job on feedback (user_id, job_id);
    `,
  },
];
