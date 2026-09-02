'use client';

import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (authError) {
      setError(authError.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-sm font-bold text-white">
            M
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Monitor político</h1>
            <p className="text-sm text-zinc-500">Social listening personal</p>
          </div>
        </div>

        {sent ? (
          <p className="text-sm text-emerald-700">Revisa tu correo para entrar.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-zinc-600">Magic link — solo email autorizado</p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none ring-zinc-900 focus:ring-2"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Enviar enlace
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
