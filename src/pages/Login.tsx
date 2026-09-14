import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('insti_team');
  const [department, setDepartment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signedUp, setSignedUp] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      setBusy(false);
      if (error) setError(error);
      else navigate('/dashboard');
    } else {
      const { error } = await signUp(email, password, name, role, department);
      setBusy(false);
      if (error) setError(error);
      else setSignedUp(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--paper)] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-lg font-semibold text-[var(--ink)]">Sales Samples and Dispenser Requests</div>
          <div className="text-sm text-[var(--ink-soft)] mt-1">Request &middot; Route &middot; Prepare &middot; Release &middot; Monitor</div>
        </div>

        <div className="bg-[var(--panel)] border border-[var(--line)] rounded-xl p-6 shadow-sm">
          {signedUp ? (
            <div className="text-center py-4">
              <p className="text-sm text-[var(--ink)] font-medium">Account created.</p>
              <p className="text-sm text-[var(--ink-soft)] mt-1">
                An Admin needs to approve your account before you can sign in and use the system. You can try signing in any time — you'll see a pending screen until you're approved.
              </p>
              <button
                onClick={() => { setSignedUp(false); setMode('signin'); }}
                className="mt-4 text-sm font-medium text-[var(--brand)] hover:underline"
              >
                Go to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
              <div className="flex rounded-md border border-[var(--line)] overflow-hidden mb-1">
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className={`flex-1 py-2 text-sm font-medium ${mode === 'signin' ? 'bg-[var(--brand)] text-white' : 'bg-white text-[var(--ink-soft)]'}`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className={`flex-1 py-2 text-sm font-medium ${mode === 'signup' ? 'bg-[var(--brand)] text-white' : 'bg-white text-[var(--ink-soft)]'}`}
                >
                  Create Account
                </button>
              </div>

              {mode === 'signup' && (
                <>
                  <Field label="Full Name">
                    <input required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Juan Dela Cruz" />
                  </Field>
                  <Field label="Role">
                    <select value={role} onChange={(e) => setRole(e.target.value)} className="input">
                      <option value="insti_team">Sales Agent</option>
                      <option value="warehouse_officer">Warehouse Officer</option>
                      <option value="approving_officer">Approving Officer</option>
                    </select>
                  </Field>
                  <p className="text-xs text-[var(--ink-soft)] -mt-2">
                    Admin accounts are assigned by an existing Admin, not through sign up.
                  </p>
                  <Field label="Department (optional)">
                    <input value={department} onChange={(e) => setDepartment(e.target.value)} className="input" placeholder="Installation Team" />
                  </Field>
                </>
              )}

              <Field label="Email">
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@company.com" />
              </Field>
              <Field label="Password">
                <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="••••••••" />
              </Field>

              {error && <div className="text-xs text-[var(--rust)] bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}

              <button
                type="submit"
                disabled={busy}
                className="mt-1 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white text-sm font-semibold rounded-md py-2.5 disabled:opacity-60"
              >
                {busy ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
        <style>{`.input { border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; font-size: 14px; width: 100%; background: white; }`}</style>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-left">
      <span className="text-xs font-medium text-[var(--ink-soft)]">{label}</span>
      {children}
    </label>
  );
}
