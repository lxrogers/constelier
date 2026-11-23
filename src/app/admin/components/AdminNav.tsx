import Link from 'next/link';
import { Wordmark } from '@/components/Logo';
import { signOut } from '../actions';

// The admin header: wordmark, the Production / Staging switch, sign out.
export default function AdminNav({ env, envs }: { env: string; envs: { id: string; label: string }[] }) {
  return (
    <header className="admin-nav">
      <Link href={`/admin/${env}`} className="admin-nav-home" aria-label="Quote requests"><Wordmark /></Link>
      <div className="admin-nav-right">
        {envs.length > 1 ? (
          <nav className="admin-switch" aria-label="Which data to show">
            {envs.map((e) => (
              <Link key={e.id} href={`/admin/${e.id}`} className={e.id === env ? 'on' : ''} aria-current={e.id === env ? 'page' : undefined}>
                {e.label}
              </Link>
            ))}
          </nav>
        ) : (
          <span className="admin-env-name">{envs[0]?.label}</span>
        )}
        <form action={signOut}><button type="submit" className="admin-link">Sign out</button></form>
      </div>
    </header>
  );
}
