import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth';
import { thisEnv } from '@/lib/admin/env';

export default async function AdminHome() {
  await requireAdmin();
  redirect(`/admin/${thisEnv()}`);
}
