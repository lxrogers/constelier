import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth';
import { adminEnvs, envLabel, isAdminEnv } from '@/lib/admin/env';
import AdminNav from '../components/AdminNav';

// Everything under /admin/production or /admin/staging: signed in, and
// reading that environment's database.
export default async function AdminEnvLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ env: string }>;
}) {
  await requireAdmin();
  const { env } = await params;
  if (!isAdminEnv(env)) notFound();
  const envs = adminEnvs().map((id) => ({ id, label: envLabel(id) }));
  return (
    <>
      <AdminNav env={env} envs={envs} />
      {env !== 'production' && (
        <p className="admin-env-note">
          {envLabel(env)} data. Messages sent from here only reach addresses on the allowlist.
        </p>
      )}
      {children}
    </>
  );
}
