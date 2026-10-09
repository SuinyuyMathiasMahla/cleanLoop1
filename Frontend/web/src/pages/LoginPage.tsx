import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf, Eye, EyeOff, AlertCircle, ClipboardList, CalendarCheck, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';

const STEPS = [
  { icon: ClipboardList, title: 'Citizens report', text: 'Photos and locations arrive in real time.' },
  { icon: CalendarCheck, title: 'You schedule', text: 'Assign crews to the reports that need action.' },
  { icon: CheckCircle2, title: 'Crews resolve', text: 'Evidence comes back and citizens are notified.' },
];

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error, user, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  const validate = () => {
    const errs: typeof fieldErrors = {};
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email';
    if (!password) errs.password = 'Password is required';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!validate()) return;
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch {
      // error handled in store
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      {/* Brand panel */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[#0f3d2e] p-12 text-white">
        {/* Concentric rings: the "loop" */}
        <div className="pointer-events-none absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-[360px] w-[360px] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute right-6 top-6 h-[160px] w-[160px] rounded-full border-[18px] border-emerald-400/20" />
        <div className="pointer-events-none absolute -bottom-52 -left-32 h-[480px] w-[480px] rounded-full border border-white/10" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
            <Leaf className="h-5 w-5 text-[#0f3d2e]" />
          </div>
          <span className="text-xl font-bold tracking-tight">CleanLoop</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">
            Every report, followed until the street is clean.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-emerald-100/80">
            Manage reports, schedule crews and keep citizens informed from one place.
          </p>

          <ul className="mt-10 space-y-5">
            {STEPS.map(({ icon: Icon, title, text }, index) => (
              <li key={title} className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <Icon className="h-5 w-5 text-emerald-200" />
                </div>
                <div>
                  <p className="font-semibold">
                    <span className="mr-2 text-emerald-300/70 tabular-nums">0{index + 1}</span>
                    {title}
                  </p>
                  <p className="mt-0.5 text-sm text-emerald-100/70">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-emerald-100/50">CleanLoop Admin</p>
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Compact brand for small screens */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f3d2e]">
              <Leaf className="h-5 w-5 text-emerald-100" />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">CleanLoop</span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Welcome back</h1>
          <p className="mt-2 text-sm text-gray-500">Sign in to the admin portal to manage reports and crews.</p>

          {error && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
              }}
              placeholder="admin@cleanloop.co.za"
              error={fieldErrors.email}
              autoComplete="email"
              required
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
              }}
              placeholder="Enter your password"
              error={fieldErrors.password}
              autoComplete="current-password"
              required
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-gray-400 transition-colors hover:text-gray-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="mt-2 w-full">
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-gray-400">
            Admin accounts are provisioned by your system administrator.
          </p>
        </div>
      </main>
    </div>
  );
}
