# HTK Match — Sàng CV có thể kiểm chứng

Xếp hạng hồ sơ ứng viên theo kỹ năng kèm giải thích từng điểm, đo precision@5 / recall@10 / MRR trên golden set và chặn hồi quy trước khi đổi thuật toán.

## Demo

- Live: https://htk-resume-matcher.vercel.app
- Tài khoản demo: `recruiter@htk.dev` / `Demo12345!`
- Dữ liệu seed: 3 vị trí (backend, frontend, data), 12 CV, 36 nhãn vàng, 1 lần đánh giá baseline.

Chạy thử trong 3 bước:

```bash
npm install
npm run dev
# mở http://localhost:3000/login và bấm "Recruiter demo"
```

## Bài toán

Recruiter thường sàng CV bằng cảm tính hoặc một mô hình hộp đen không ai kiểm tra lại. Khi đổi từ khoá, trọng số hay nhà cung cấp AI, không có cách nào biết chất lượng xếp hạng tăng hay giảm. HTK Match biến việc đó thành một quy trình đo được: một golden set nhãn 0/1/2, ba chỉ số chuẩn và một cổng chặn hồi quy chạy sau mỗi thay đổi. Mọi điểm số đều kèm lý do để recruiter có thể phản biện thay vì tin mù.

## Tính năng

1. **Xếp hạng có giải thích** — điểm = 0,5 phủ kỹ năng bắt buộc + 0,32 trùng từ khoá có trọng số IDF + 0,18 mức kinh nghiệm. Mỗi ứng viên hiện kỹ năng khớp, kỹ năng thiếu, lý do seniority và độ trùng văn bản.
2. **Golden set theo từng job** — 12 nhãn 0/1/2 mỗi vị trí trong seed; nhãn 0 vẫn được lưu để đo false positive. Có thể chấm hoặc bỏ nhãn ngay trên trang xếp hạng.
3. **Đánh giá ba chỉ số** — precision@5, recall@10 và MRR, tính trung bình theo job, chỉ trên các job có nhãn vàng.
4. **Cổng chặn hồi quy** — ngưỡng 0,60 / 0,90 / 0,80; mỗi lần chạy lưu kết quả vào `eval_runs` và hiện lịch sử trên dashboard.
5. **Feedback tách khỏi phép đo** — recruiter đánh dấu phù hợp/không phù hợp để cộng/trừ 0,12 điểm khi xếp hạng, nhưng gate luôn chấm trên ranking thuần để không tự khen.
6. **Nhập CV thật** — tải file `.txt`/`.md` tối đa 200 KB hoặc dán nội dung; hệ thống tách kỹ năng theo alias (`nodejs` → `node.js`, `k8s` → `kubernetes`) và đọc số năm từ câu "6 năm kinh nghiệm".
7. **Workspace nhiều tài khoản** — job, CV, nhãn, feedback và lịch sử eval tách theo người dùng; đăng nhập scrypt + session httpOnly, rate limit cho login, upload, nhãn và eval.

## Tech stack và đánh đổi

- **Next.js 15 App Router + React 19 + TypeScript** — UI và API trong cùng một repo, deploy Vercel một lần.
- **PGlite (PostgreSQL WASM) + Vercel Blob** — chạy PostgreSQL thật mà không cần dịch vụ ngoài. Production lưu snapshot JSON vào Blob riêng tư và đồng bộ theo ETag; local dùng file `./.data/pg`.
- **So khớp từ vựng IDF, không gọi AI** — kết quả tất định, chạy offline, không lộ CV cho bên thứ ba.

Ba đánh đổi có chủ ý:

1. **Tất định nhưng không hiểu ngữ nghĩa.** CV backend chỉ thiếu TypeScript có thể bị xếp dưới CV frontend có TypeScript. Bù lại có golden set để nhìn thấy lỗi này và feedback để chỉnh. Muốn thay bằng embedding chỉ cần thay hàm xếp hạng; golden set, gate và lịch sử eval giữ nguyên.
2. **PGlite một writer.** Mọi request ghi đi qua một instance PGlite; phù hợp demo và tải nhỏ, không phù hợp ghi đồng thời quy mô lớn. Snapshot Blob cũng là eventual consistency giữa các lambda.
3. **Nhãn vàng do chính người dùng chấm.** Chất lượng gate phụ thuộc chất lượng nhãn. Với 12 ứng viên/job, recall@10 gần như bằng recall toàn bộ pool; cần pool lớn hơn để recall có ý nghĩa thực sự.

## Chạy local

Yêu cầu Node.js 20+.

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 30 test
npm run build && npm start
```

Biến môi trường (xem `.env.example`):

| Biến | Ý nghĩa |
| --- | --- |
| `PGLITE_DIR` | Thư mục dữ liệu PGlite local, mặc định `./.data/pg` |
| `BLOB_READ_WRITE_TOKEN` | Token Blob riêng tư khi chạy trên Vercel; để trống ở local |

Docker:

```bash
docker build -t htk-resume-matcher .
docker run -p 3000:3000 -v htk-match-data:/data htk-resume-matcher
```

Deploy Vercel:

```bash
vercel link
vercel blob create-store htk-resume-data --access private
vercel deploy --prod
```

Gắn `BLOB_READ_WRITE_TOKEN` của store vào project trước khi deploy production.

## Kiểm thử

`npm test` chạy 30 test, tất cả pass:

- **7 test chuẩn hoá văn bản** — bỏ dấu tiếng Việt, alias kỹ năng, stopword, đọc số năm, nhận diện kỹ năng theo token trọn vẹn, IDF và overlap.
- **7 test xếp hạng** — thứ tự backend mạnh, giải thích kỹ năng khớp/thiếu, phạt dưới số năm, cộng/trừ feedback, biên 0..1, thứ tự ổn định.
- **5 test chỉ số** — precision@5, recall@10, MRR, gate fail, baseline seed = 0,6667 / 1 / 1.
- **11 test tích hợp PGlite** — seed 3 job/12 CV/36 nhãn, feedback đưa ứng viên junior vào top 5, cập nhật/xoá nhãn, chạy eval và lưu lịch sử, upload CV tách kỹ năng, chặn xoá ứng viên có nhãn, cô lập dữ liệu giữa hai tài khoản, job chưa có nhãn không vào eval, rate limit.

## Metrics và đánh giá

Đo trên máy local (Windows, Node 24, `next dev`, 40 request xếp hạng và 6 lần chạy eval):

| Phép đo | Kết quả |
| --- | --- |
| Precision@5 baseline | **0,6667** (ngưỡng 0,60) |
| Recall@10 baseline | **1,0000** (ngưỡng 0,90) |
| MRR baseline | **1,0000** (ngưỡng 0,80) |
| `GET /api/jobs/:id/ranking` (12 CV) | p50 **36,2 ms**, p95 **45,5 ms** |
| `POST /api/eval` (3 job × 12 CV) | p50 **47,0 ms**, p95 **54,5 ms** |
| Login sai liên tiếp | 10 × 401 rồi 2 × 429 |

Baseline thấp hơn 1 ở precision vì top 5 của job frontend chứa ba ứng viên liên quan và hai ứng viên backend có TypeScript; đây là lỗi ngữ nghĩa đã biết của so khớp từ vựng, không phải số liệu làm đẹp. Các con số latency là dev server một máy, chưa đo trên production.

## Cấu trúc

```
app/
  api/            auth, jobs, candidates, ranking, feedback, labels, eval, metrics, health
  workspace/      dashboard và trang xếp hạng từng job
  login, register, landing
components/       AuthForm, Workspace, JobRanking
lib/
  text.ts         chuẩn hoá, alias, tokenize, IDF
  match.ts        scoring và giải thích
  eval.ts         precision@5, recall@10, MRR, gate
  data.ts         truy vấn workspace, nhãn, feedback, eval
  db.ts           PGlite + Vercel Blob snapshot
  migrations.ts   schema từ số 0
```

## Giới hạn đã biết

- Recall@10 gần bằng recall toàn pool vì seed chỉ có 12 ứng viên mỗi job.
- Chưa parse PDF/DOCX; chỉ nhận văn bản thuần.
- Trích kỹ năng theo từ điển nên không hiểu phủ định ("chưa từng dùng Kubernetes" vẫn bị tính là có).
- Chưa có phân quyền nhiều vai trò; mỗi tài khoản là một workspace riêng.
- Rate limit theo instance, chưa dùng Redis dùng chung.
- Blob snapshot có độ trễ đồng bộ giữa các instance serverless.

## Tác giả

HTK 0396241674 — dự án 08/10 trong portfolio full-stack.
