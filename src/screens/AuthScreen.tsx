import React, { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Shield,
  KeyRound,
  RefreshCw,
} from 'lucide-react';

interface AuthScreenProps {
  initialMode?: 'signin' | 'signup';
  onAuthSuccess: (user: any, isNewUser?: boolean) => void;
  onGuestAccess: () => void;
}

const HERO_IMAGES = [
  '/images/runner_hero_1.jpg',
  '/images/runner_hero_2.jpg',
  '/images/runner_hero_3.jpg',
  '/images/runner_hero_4.jpg',
  '/images/runner_hero_5.jpg',
];

export const AuthScreen: React.FC<AuthScreenProps> = ({
  initialMode = 'signin',
  onAuthSuccess,
  onGuestAccess,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'verify'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Automatic smooth 5-image cycle
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 3800);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!name.trim()) throw new Error('Please enter your full name');
        if (password.length < 6) throw new Error('Password must be at least 6 characters');
        if (confirmPassword && password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }

        const result = await authService.signUp(email.trim(), password, name.trim());
        if (result?.user && result?.user?.emailVerified) {
          onAuthSuccess(result.user, true);
        } else {
          setSuccessMsg('Account created! A 6-digit verification code was sent to your email.');
          setMode('verify');
        }
      } else if (mode === 'signin') {
        const result = await authService.signIn(email.trim(), password);
        if (result?.user) {
          onAuthSuccess(result.user, false);
        }
      } else if (mode === 'verify') {
        if (!otp.trim() || otp.trim().length < 4) {
          throw new Error('Please enter the verification code sent to your email');
        }
        const result = await authService.verifyEmail(email.trim(), otp.trim());
        if (result?.user) {
          onAuthSuccess(result.user, true);
        } else {
          const signinResult = await authService.signIn(email.trim(), password);
          if (signinResult?.user) {
            onAuthSuccess(signinResult.user, true);
          }
        }
      } else if (mode === 'forgot') {
        await authService.sendPasswordReset(email.trim());
        setSuccessMsg('Password reset instructions sent to your email.');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      const msg = err.message || '';

      if (msg.toLowerCase().includes('email verification required') || msg.toLowerCase().includes('verify')) {
        setErrorMsg('Email verification is required. Enter the code sent to your email.');
        setMode('verify');
      } else {
        setErrorMsg(msg || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email.trim()) return;
    setResending(true);
    setErrorMsg(null);
    try {
      await authService.resendVerificationEmail(email.trim());
      setSuccessMsg('A new verification code has been sent to your email.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend verification code.');
    } finally {
      setResending(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google' = 'google') => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await authService.signInWithOAuth('google');
    } catch (err: any) {
      console.error('Google OAuth sign in error:', err);
      setErrorMsg(err?.message || 'Failed to connect with Google. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#e8f3f0] flex flex-col justify-between items-center select-none relative overflow-x-hidden font-sans">
      <div className="w-full max-w-xl md:max-w-2xl flex flex-col flex-1 min-h-screen justify-between relative">

        {/* Upper Hero Area with 5 Auto-Cycling Background Images */}
        <div className="relative pt-3 px-5 sm:px-6 pb-8 min-h-[300px] sm:min-h-[340px] flex flex-col justify-between overflow-hidden">

          {/* 5 Cross-Fading Hero Background Images */}
          {HERO_IMAGES.map((imgSrc, idx) => (
            <div
              key={imgSrc}
              className={`absolute inset-0 bg-cover bg-center z-0 transition-opacity duration-1000 ease-in-out ${idx === currentImageIndex ? 'opacity-100 scale-105' : 'opacity-0 scale-100'
                }`}
              style={{
                backgroundImage: `url('${imgSrc}')`,
                backgroundPosition: 'right 20% center',
                transition: 'opacity 1s ease-in-out, transform 4s ease-out',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#eef7f5]/95 via-[#eef7f5]/75 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#eef7f5] via-transparent to-transparent" />
            </div>
          ))}

          {/* Top Brand Header Bar */}
          <div className="relative z-10 pt-2 sm:pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-white shadow-md border border-emerald-500/30 p-1 flex items-center justify-center">
                  <img
                    src="/logo.png"
                    alt="RunWar Logo"
                    className="w-full h-full rounded-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
                <div>
                  <div className="font-display font-black text-lg sm:text-xl tracking-tight text-slate-950 leading-none">
                    RUNWAR
                  </div>
                  <div className="text-[10px] font-medium text-slate-600 tracking-tight">
                    Run. Track. Improve.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Headline & 5-Step Dots Indicator */}
          <div className="relative z-10 mt-5 mb-2 flex items-end justify-between">
            <div className="max-w-[280px] sm:max-w-xs">
              <h1 className="font-display text-2xl sm:text-3xl font-black text-slate-950 leading-[1.15] tracking-tight">
                {mode === 'signup' ? (
                  <>
                    Create account<br />
                    to track your runs<br />
                    and <span className="text-[#00d09c]">fitness goals.</span>
                  </>
                ) : mode === 'signin' ? (
                  <>
                    Log in to stay<br />
                    on top of your runs<br />
                    and <span className="text-[#00d09c]">fitness goals.</span>
                  </>
                ) : mode === 'verify' ? (
                  <>
                    Verify code<br />
                    to unlock live<br />
                    and <span className="text-[#00d09c]">cloud tracking.</span>
                  </>
                ) : (
                  <>
                    Reset password<br />
                    and restore your<br />
                    running <span className="text-[#00d09c]">records.</span>
                  </>
                )}
              </h1>

              <p className="text-xs text-slate-600 font-medium mt-2 leading-relaxed">
                Track your progress, set new goals and become a better you.
              </p>

              {/* 5 Step Dots Slider Indicator */}
              <div className="flex items-center gap-1.5 mt-3">
                {HERO_IMAGES.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`h-1.5 rounded-full transition-all duration-500 ${idx === currentImageIndex
                      ? 'w-6 bg-[#00d09c]'
                      : 'w-2 bg-slate-300 hover:bg-slate-400'
                      }`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Script Slogan Tag */}
            <div className="hidden xs:flex flex-col items-end transform -rotate-6 mr-1 mb-6">
              <span className="font-serif italic font-bold text-slate-700 text-sm tracking-wide">
                A Healthier
              </span>
              <span className="font-serif italic font-bold text-slate-800 text-sm tracking-wide flex flex-col items-center">
                Happier You
                <svg className="w-16 h-2 text-[#00d09c] mt-0.5" viewBox="0 0 70 8" fill="none">
                  <path d="M2 5.5C20 1.5 50 1.5 68 5.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Sheet Card with Scenic Landscape Watermark */}
        <div className="w-full bg-white rounded-t-[36px] shadow-2xl px-6 sm:px-8 pt-7 pb-8 z-20 flex-1 flex flex-col justify-between border-t border-emerald-100/80 relative overflow-hidden">
          {/* Scenic Mountain & Runner Landscape Watermark Background */}
          <div className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden">
            <svg
              className="w-full h-full object-cover"
              viewBox="0 0 500 280"
              preserveAspectRatio="xMidYMid slice"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="authMntFar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d09c" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="#00d09c" stopOpacity="0.03" />
                </linearGradient>
                <linearGradient id="authMntMid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d09c" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#00d09c" stopOpacity="0.06" />
                </linearGradient>
                <linearGradient id="authMntNear" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d09c" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#00d09c" stopOpacity="0.08" />
                </linearGradient>
                <linearGradient id="authPathGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d09c" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="#00d09c" stopOpacity="0.30" />
                </linearGradient>
                <linearGradient id="authFadeTop" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                  <stop offset="60%" stopColor="#ffffff" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
              </defs>

              <path d="M-30,140 Q60,65 170,105 T380,75 T530,120 L530,280 L-30,280 Z" fill="url(#authMntFar)" />
              <path d="M-30,165 Q80,105 190,145 T410,110 T530,155 L530,280 L-30,280 Z" fill="url(#authMntMid)" />
              <path d="M-30,195 Q90,155 180,180 T370,160 T530,195 L530,280 L-30,280 Z" fill="url(#authMntNear)" />

              <g fill="#00d09c" opacity="0.30">
                <polygon points="35,160 43,178 27,178" /><polygon points="35,170 45,190 25,190" /><polygon points="35,182 47,204 23,204" /><rect x="33" y="204" width="4" height="6" />
                <polygon points="65,150 73,168 57,168" /><polygon points="65,160 75,180 55,180" /><polygon points="65,172 78,194 52,194" /><rect x="63" y="194" width="4" height="6" />
                <polygon points="95,165 102,180 88,180" /><polygon points="95,175 104,192 86,192" /><rect x="93" y="192" width="4" height="6" />
                <polygon points="460,155 467,172 453,172" /><polygon points="460,166 469,184 451,184" /><polygon points="460,178 472,198 448,198" /><rect x="458" y="198" width="4" height="6" />
                <polygon points="430,165 437,180 423,180" /><polygon points="430,175 439,192 421,192" /><rect x="428" y="192" width="4" height="6" />
              </g>

              <path d="M245,150 C240,178 215,215 130,280 L370,280 C290,230 270,185 255,150 Z" fill="url(#authPathGrad)" />

              <g transform="translate(195, 155) scale(0.7)" fill="#00d09c" opacity="0.45">
                <circle cx="20" cy="8" r="4.5" />
                <path d="M17,14 C17,12 23,12 23,14 L24,28 L16,28 Z" />
                <path d="M17,15 L10,22 L13,26" stroke="#00d09c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M23,15 L29,20 L27,24" stroke="#00d09c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M18,27 L11,36 L15,44" stroke="#00d09c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M22,27 L28,34 L33,31" stroke="#00d09c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </g>

              <g transform="translate(370, 75) rotate(-8)" opacity="0.4">
                <text x="0" y="0" fontFamily="serif" fontStyle="italic" fontWeight="bold" fontSize="16" fill="#00d09c" textAnchor="middle">
                  Stronger Every Day
                </text>
                <path d="M-50,8 Q0,2 50,8" stroke="#00d09c" strokeWidth="2" strokeLinecap="round" fill="none" />
              </g>

              <rect x="0" y="0" width="500" height="140" fill="url(#authFadeTop)" />
            </svg>
          </div>

          <div className="w-full max-w-md md:max-w-lg mx-auto relative z-10">
            {/* Sheet Title & Mode Switcher Subtitle */}
            <div className="mb-5">
              <h2 className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {mode === 'signup'
                  ? 'Create Account'
                  : mode === 'signin'
                    ? 'Welcome Back'
                    : mode === 'verify'
                      ? 'Verification Code'
                      : 'Reset Password'}
              </h2>

              {mode === 'signin' && (
                <p className="text-xs text-slate-600 mt-1">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-emerald-700 font-bold hover:underline ml-0.5"
                  >
                    Sign Up
                  </button>
                </p>
              )}

              {mode === 'signup' && (
                <p className="text-xs text-slate-600 mt-1">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-emerald-700 font-bold hover:underline ml-0.5"
                  >
                    Sign In
                  </button>
                </p>
              )}
            </div>

            {/* Error / Success Toast Messages */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 text-xs flex items-center gap-2 animate-fade-in">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2 animate-fade-in">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
              {/* Full Name Input (Sign Up Only) */}
              {mode === 'signup' && (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <User size={18} />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#00d09c] focus:bg-white shadow-sm transition-all"
                  />
                </div>
              )}

              {/* Email Address */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  required
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#00d09c] focus:bg-white shadow-sm transition-all"
                />
              </div>

              {/* Verification OTP */}
              {mode === 'verify' ? (
                <div>
                  <div className="flex items-center justify-between mb-1 px-1">
                    <span className="text-[11px] font-bold text-slate-600">Enter 6-Digit Code</span>
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={resending}
                      className="text-[11px] text-emerald-700 font-bold hover:underline flex items-center gap-1"
                    >
                      <RefreshCw size={11} className={resending ? 'animate-spin' : ''} />
                      <span>Resend code</span>
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <KeyRound size={18} />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="6-digit code"
                      maxLength={8}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-base font-mono tracking-widest text-center font-bold focus:outline-none focus:border-[#00d09c] focus:bg-white shadow-sm"
                    />
                  </div>
                </div>
              ) : mode !== 'forgot' ? (
                <>
                  {/* Password Input */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <Lock size={18} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-11 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#00d09c] focus:bg-white shadow-sm transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {/* Confirm Password (Sign Up Only) */}
                  {mode === 'signup' && (
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                        <Lock size={18} />
                      </div>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        placeholder="Confirm password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-11 pr-11 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#00d09c] focus:bg-white shadow-sm transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  )}

                  {/* Remember Me & Forgot Password */}
                  <div className="flex items-center justify-between px-1 text-xs pt-0.5">
                    <label className="flex items-center gap-2 text-slate-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded text-[#00d09c] focus:ring-[#00d09c] border-slate-300 accent-[#00d09c]"
                      />
                      <span>Remember Me</span>
                    </label>

                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot');
                          setErrorMsg(null);
                          setSuccessMsg(null);
                        }}
                        className="text-emerald-700 font-semibold hover:underline"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                </>
              ) : null}

              {/* Primary Log In / Sign Up Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-1.5 py-4 px-6 rounded-2xl bg-[#00d09c] hover:bg-[#00ba8b] active:scale-[0.98] disabled:opacity-50 text-slate-950 font-black text-base shadow-lg shadow-[#00d09c]/25 flex items-center justify-center gap-2 transition-all"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>
                      {mode === 'signup'
                        ? 'Sign Up'
                        : mode === 'signin'
                          ? 'Log In'
                          : mode === 'verify'
                            ? 'Verify & Log In'
                            : 'Send Reset Link'}
                    </span>
                    <ArrowRight size={18} strokeWidth={2.5} />
                  </>
                )}
              </button>
            </form>

            {/* Social Auth Divider */}
            {mode !== 'verify' && (
              <>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest">
                    <span className="bg-white px-3 text-slate-400">
                      OR CONTINUE WITH
                    </span>
                  </div>
                </div>

                {/* Google Sign In Button */}
                <button
                  type="button"
                  onClick={() => handleOAuthSignIn('google')}
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50 text-slate-900 font-bold text-sm flex items-center justify-center gap-3 shadow-sm border border-slate-200 transition-all"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </>
            )}

            {/* Bottom Security Badge & Script Watermark */}
            <div className="mt-5 pt-2 flex flex-col items-center gap-1 text-center">
              {/* Watermark Script */}
              <div className="w-full flex justify-end pr-2 pt-1 opacity-70">
                <span className="font-serif italic font-bold text-[#00d09c] text-xs">
                  Every Run Counts
                </span>
              </div>
            </div>

            {/* Back to sign-in option for reset/verify */}
            {(mode === 'forgot' || mode === 'verify') && (
              <div className="text-center mt-3">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-xs text-emerald-700 font-bold hover:underline"
                >
                  ← Back to Login
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
