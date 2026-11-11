import Link from 'next/link';
import { getUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const FEATURES = [
  {
    title: 'Xếp hạng có giải thích',
    body: 'Điểm = 0,5 phủ kỹ năng + 0,32 trùng từ khoá IDF + 0,18 mức kinh nghiệm. Mỗi dòng hiện kỹ năng khớp, kỹ năng thiếu và lý do tăng/giảm điểm.',
  },
  {
    title: 'Golden set thật',
    body: 'Mỗi job có 12 nhãn vàng 0/1/2 do recruiter chấm. Nhãn 0 vẫn được lưu để đo cả false positive, không chỉ đếm ứng viên tốt.',
  },
  {
    title: 'Ba chỉ số chuẩn',
    body: 'Precision@5 đo top 5 có bao nhiêu người liên quan, recall@10 đo độ phủ, MRR đo ứng viên liên quan đầu tiên bị đẩy xuống bao xa.',
  },
  {
    title: 'Cổng chặn hồi quy',
    body: 'Mỗi lần chạy lưu precision@5, recall@10 và MRR. Ngưỡng 0,60 / 0,90 / 0,80; dưới ngưỡng là fail và hiện ngay trên dashboard.',
  },
  {
    title: 'Feedback tách khỏi eval',
    body: 'Recruiter đánh dấu phù hợp/không phù hợp để cộng trừ 0,12 điểm khi xếp hạng, nhưng đánh giá gate luôn dùng tín hiệu thuần để không tự khen.',
  },
  {
    title: 'Upload CV tất định',
    body: 'Tải file .txt/.md hoặc dán nội dung. Hệ thống tách kỹ năng theo từ điển chuẩn hoá và đọc số năm từ câu “6 năm kinh nghiệm”.',
  },
];

export default async function HomePage() {
  const user = await getUser();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-10 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-lg font-black text-accent">
            M
          </span>
          <div>
            <p className="text-sm font-semibold tracking-wide text-slate-200">HTK Match</p>
            <p className="text-xs text-slate-500">Recruiting evaluation workspace</p>
          </div>
        </div>
        <nav className="flex items-center gap-2">
          {user ? (
            <Link className="btn-ghost" href="/workspace">
              Mở workspace
            </Link>
          ) : (
            <>
              <Link className="btn-ghost" href="/register">
                Đăng ký
              </Link>
              <Link className="btn-primary" href="/login">
                Đăng nhập
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="mt-16 max-w-3xl">
        <span className="badge border-accent/40 text-accent">Next.js · PGlite · IDF ranking · Eval gate</span>
        <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl">
          Sàng CV không chỉ cần đúng,
          <span className="text-accent"> mà còn phải chứng minh được là đúng</span>.
        </h1>
        <p className="mt-5 text-base leading-relaxed text-slate-300 sm:text-lg">
          Xếp hạng ứng viên theo kỹ năng bắt buộc, giải thích từng điểm, chấm golden set và chạy cổng
          precision@5 / recall@10 / MRR trước khi thay đổi trọng số. Feedback của recruiter được tách khỏi
          phép đo để không tự khen.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link className="btn-primary" href={user ? '/workspace' : '/login'}>
            {user ? 'Mở workspace' : 'Thử bản demo'}
          </Link>
          <Link className="btn-ghost" href="/register">
            Tạo tài khoản
          </Link>
        </div>
        <div className="mt-8 rounded-xl border border-line bg-panel/50 px-4 py-3 text-sm">
          <p className="font-semibold text-slate-200">Tài khoản demo</p>
          <p className="mt-1 font-mono text-xs text-accent">recruiter@htk.dev · Demo12345!</p>
          <p className="mt-1 text-xs text-slate-400">
            3 vị trí backend/frontend/data, 12 CV, 36 nhãn vàng và baseline precision@5 = 0,6667.
          </p>
        </div>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Tính năng">
        {FEATURES.map((feature) => (
          <article key={feature.title} className="card">
            <h2 className="text-base font-semibold text-slate-100">{feature.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{feature.body}</p>
          </article>
        ))}
      </section>

      <section className="mt-14 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="card">
          <h2 className="text-lg font-semibold">Một vòng đánh giá diễn ra thế nào?</h2>
          <ol className="mt-4 space-y-3 text-sm text-slate-300">
            {[
              'Recruiter tạo vị trí với kỹ năng bắt buộc và số năm tối thiểu.',
              'CV được tải lên, tách kỹ năng và số năm; ứng viên vào thư viện dùng chung.',
              'Hệ thống xếp hạng từng job, hiện điểm, kỹ năng khớp/thiếu và lý do.',
              'Recruiter chấm nhãn vàng 0/1/2 cho ứng viên trong từng job.',
              'Chạy đánh giá: precision@5, recall@10, MRR được tính trên ranking thuần và lưu lịch sử.',
              'Nếu chỉ số dưới ngưỡng, gate fail; recruiter xem job nào tụt và sửa trọng số hoặc dữ liệu.',
            ].map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold">Vì sao không gọi AI?</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Bản demo dùng so khớp từ vựng có trọng số IDF để kết quả tất định, chạy được offline và không
            phụ thuộc API ngoài. Đổi lại, nó không hiểu ngữ nghĩa: một CV backend chỉ thiếu TypeScript vẫn
            bị xếp dưới CV frontend có TypeScript. Đó là lý do có feedback và golden set để đo đúng sai.
          </p>
          <p className="mt-4 text-xs text-slate-500">
            Nếu thay bằng embedding, chỉ cần thay hàm xếp hạng; golden set, gate và lịch sử eval giữ nguyên.
          </p>
        </div>
      </section>

      <footer className="mt-16 border-t border-line pt-6 text-sm text-slate-500">
        <p>
          Tác giả <span className="text-slate-300">HTK 0396241674</span> · Dự án 08/10 trong portfolio
          full-stack.
        </p>
      </footer>
    </main>
  );
}
