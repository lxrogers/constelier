'use client';

import { useActionState } from 'react';
import { signIn, type FormState } from '../actions';

export default function SignInForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});
  return (
    <form action={action} className="admin-form admin-login-form">
      <label htmlFor="admin-password">Password</label>
      <input id="admin-password" name="password" type="password" required autoFocus autoComplete="current-password" />
      {state.error && <p className="admin-error" role="alert">{state.error}</p>}
      <button type="submit" className="admin-btn" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
