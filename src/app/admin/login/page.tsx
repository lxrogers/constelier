import { notFound, redirect } from 'next/navigation';
import { Wordmark } from '@/components/Logo';
import { adminEnabled, isAdmin } from '@/lib/admin/auth';
import SignInForm from '../components/SignInForm';

export default async function AdminLogin() {
  if (!adminEnabled()) notFound();
  if (await isAdmin()) redirect('/admin');
  return (
    <main className="admin-login">
      <Wordmark />
      <h1>Admin</h1>
      <SignInForm />
    </main>
  );
}
