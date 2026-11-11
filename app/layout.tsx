import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HTK Match — Sàng CV có thể kiểm chứng',
  description:
    'Xếp hạng CV theo kỹ năng kèm giải thích, đo precision@5 / recall@10 / MRR trên golden set và chặn hồi quy trước khi đổi thuật toán.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
