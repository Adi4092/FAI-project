import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Eye, EyeOff, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import { APP_NAME, APP_TAGLINE, HERO_TAGLINE } from '../utils/constants';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional(),
});

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'admin@medstock.local',
      password: 'password123',
      rememberMe: true,
    },
  });

  const onSubmit = async (data) => {
    try {
      setServerError('');
      setLoading(true);
      await login(data.email, data.password);
      showToast('Signed in successfully!', 'success');
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err.error?.message || 'Invalid email or password. Please verify credentials.';
      setServerError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (roleEmail) => {
    setValue('email', roleEmail);
    setValue('password', 'password123');
    setServerError('');
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-white">
      {/* Left Column: Login Form */}
      <div className="w-full md:w-1/2 flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12">
        <div className="max-w-md w-full mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand to-cyan-400 flex items-center justify-center shadow-md shadow-brand/20">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 10.5h-5.5V5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v5.5H5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.5V19c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-5.5H19c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
                {APP_NAME}
              </h1>
              <p className="text-xs text-slate-500 font-medium">{APP_TAGLINE}</p>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Welcome back!</h2>
            <p className="text-sm text-slate-500 mt-1">
              Please sign in to your inventory account.
            </p>
          </div>

          {/* Error Banner */}
          {serverError && (
            <div className="mb-5 p-3.5 rounded-lg bg-status-critical-bg border border-red-200 text-status-critical-text text-xs flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                className={`input-base ${errors.email ? 'border-status-critical' : ''}`}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-status-critical mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  className={`input-base pr-10 ${errors.password ? 'border-status-critical' : ''}`}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-status-critical mt-1">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-border text-brand focus:ring-brand/20 w-4 h-4"
                  {...register('rememberMe')}
                />
                <span className="text-xs text-slate-600 select-none">Remember me</span>
              </label>
              <a
                href="#forgot"
                onClick={(e) => {
                  e.preventDefault();
                  showToast('Password reset link requested. Contact your system admin.', 'info');
                }}
                className="text-xs font-medium text-brand hover:text-brand-hover transition-colors"
              >
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-brand hover:bg-brand-hover text-white text-sm font-semibold rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : null}
              <span>Sign in</span>
            </button>
          </form>

          {/* Quick Fill Test Accounts */}
          <div className="mt-6 pt-5 border-t border-border">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Demo Credentials (Click to fill)
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('admin@medstock.local')}
                className="p-2 text-left rounded-lg bg-slate-50 hover:bg-brand-light border border-border text-xs transition-colors"
              >
                <div className="font-semibold text-slate-800">Admin</div>
                <div className="text-[10px] text-slate-400">admin@...</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('manager@medstock.local')}
                className="p-2 text-left rounded-lg bg-slate-50 hover:bg-brand-light border border-border text-xs transition-colors"
              >
                <div className="font-semibold text-slate-800">Manager</div>
                <div className="text-[10px] text-slate-400">manager@...</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('staff@medstock.local')}
                className="p-2 text-left rounded-lg bg-slate-50 hover:bg-brand-light border border-border text-xs transition-colors"
              >
                <div className="font-semibold text-slate-800">Staff</div>
                <div className="text-[10px] text-slate-400">staff@...</div>
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-slate-500 mt-6">
            Don't have an account?{' '}
            <span className="text-brand font-medium cursor-pointer hover:underline">
              Contact administrator
            </span>
          </p>
        </div>
      </div>

      {/* Right Column: Hero Graphic matching UI Reference Screen 01 */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-[#EBF3FE] via-[#E1EEFD] to-[#D5E7FC] p-12 items-center justify-center relative overflow-hidden">
        {/* Soft decorative background circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-cyan-200/40 blur-3xl" />

        <div className="relative z-10 max-w-md text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 shadow-xs text-xs font-semibold text-brand mb-4 backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5" /> AI-Driven Inventory Intelligence
          </div>

          <h2 className="text-3xl lg:text-4xl font-extrabold text-[#0B2A5B] tracking-tight leading-tight">
            Smarter Inventory.
            <br />
            <span className="text-brand">Healthier Tomorrow.</span>
          </h2>
          <p className="text-sm text-slate-600 mt-3 leading-relaxed">
            Eliminate medicine wastage with predictive expiry simulation, FEFO automation, and intelligent reorder forecasting.
          </p>

          {/* Medicine Bottle & Pills SVG Illustration */}
          <div className="mt-8 relative w-64 h-64 flex items-center justify-center">
            {/* Soft shadow glow */}
            <div className="absolute w-48 h-12 bg-blue-900/10 rounded-full blur-xl bottom-4" />

            {/* Medical Jar Illustration */}
            <svg viewBox="0 0 200 200" className="w-56 h-56 drop-shadow-xl" fill="none">
              {/* Bottle */}
              <rect x="65" y="60" width="70" height="95" rx="14" fill="#FFFFFF" stroke="#1F6FEB" strokeWidth="3" />
              <rect x="75" y="42" width="50" height="18" rx="4" fill="#0B2A5B" />
              <rect x="70" y="55" width="60" height="7" rx="3" fill="#1F6FEB" />
              {/* Bottle Label */}
              <rect x="72" y="80" width="56" height="55" rx="6" fill="#F0F6FF" stroke="#D1E3FC" strokeWidth="1" />
              <path d="M100 95v25M87.5 107.5h25" stroke="#1F6FEB" strokeWidth="3.5" strokeLinecap="round" />
              <circle cx="100" cy="107.5" r="18" stroke="#1F6FEB" strokeWidth="1.5" strokeDasharray="3 3" />
              {/* Pills around */}
              <g transform="translate(140, 130) rotate(-25)">
                <rect x="0" y="0" width="28" height="14" rx="7" fill="#00D2FF" />
                <path d="M14 0h7a7 7 0 017 7v0a7 7 0 01-7 7h-7V0z" fill="#1F6FEB" />
              </g>
              <g transform="translate(35, 125) rotate(35)">
                <rect x="0" y="0" width="26" height="13" rx="6.5" fill="#38BDF8" />
                <path d="M13 0h6.5a6.5 6.5 0 016.5 6.5v0a6.5 6.5 0 01-6.5 6.5H13V0z" fill="#0B2A5B" />
              </g>
              <circle cx="45" cy="90" r="8" fill="#16A34A" fillOpacity="0.85" />
              <circle cx="155" cy="85" r="7" fill="#F59E0B" fillOpacity="0.85" />
            </svg>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium text-slate-500 mt-2">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-status-success" /> FEFO Dispatch
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-status-success" /> Expiry Risk AI
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-status-success" /> Ledger Integrity
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
