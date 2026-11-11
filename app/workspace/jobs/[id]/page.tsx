import { redirect } from 'next/navigation';
import { JobRanking } from '@/components/JobRanking';
import { getUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) redirect('/login');
  const { id } = await params;
  return <JobRanking jobId={id} />;
}
