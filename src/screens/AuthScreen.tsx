import React, { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { PhoneOtpInput } from '../components/auth/PhoneOtpInput';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
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
  // Method selection: 'email_otp' (Primary SMTP OTP) | 'password' (Email & Password)
  const [authMethod, setAuthMethod] = useState<'email_otp' | 'password'>('email_otp');

  // Primary: Email OTP State (InsForge SMTP powered)
  const [emailOtpStep, setEmailOtpStep] = useState<'input' | 'verify'>('input');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpName, setOtpName] = useState('');
  const [emailOtpCode, setEmailOtpCode] = useState('');
  const [emailOtpCountdown, setEmailOtpCountdown] = useState(0);

  // Secondary: Email / Password Auth State
  const [emailMode, setEmailMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Shared UI State
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Automatic hero slider cycle
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 3800);
    return () => clearInterval(timer);
  }, []);

  // Resend Countdown Timer
  useEffect(() => {
    if (emailOtpCountdown <= 0) return;
    const timer = setInterval(() => {
      setEmailOtpCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [emailOtpCountdown]);

  // -------------------------------------------------------------
  // 1. PRIMARY: EMAIL OTP HANDLERS (InsForge SMTP)
  // -------------------------------------------------------------
  const handleSendEmailOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = otpEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await authService.sendOtpToEmail(cleanEmail, otpName.trim());
      setEmailOtpStep('verify');
      setEmailOtpCode('');
      setEmailOtpCountdown(30);
      setSuccessMsg(`6-digit code sent to ${cleanEmail}. Check your inbox!`);
    } catch (err: any) {
      console.error('Email OTP send error:', err);
      setErrorMsg(err?.message || 'Failed to send verification code. Please check your email and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailOtpCode = async (otpToVerify?: string) => {
    const targetOtp = otpToVerify || emailOtpCode;
    if (!targetOtp || targetOtp.length < 6) {
      setErrorMsg('Please enter the complete 6-digit verification code.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const result = await authService.verifyEmailOtp(otpEmail.trim(), targetOtp.trim());
      if (result?.user) {
        onAuthSuccess(result.user, result.isNew);
      } else {
        setSuccessMsg('Email verified successfully! Setting up your session...');
      }
    } catch (err: any) {
      console.error('Email OTP verify error:', err);
      setErrorMsg(err.message || 'The verification code is incorrect or expired. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmailOtp = async () => {
    if (!otpEmail.trim() || emailOtpCountdown > 0 || resending) return;
    setResending(true);
    setErrorMsg(null);
    try {
      await authService.resendVerificationEmail(otpEmail.trim().toLowerCase());
      setEmailOtpCountdown(30);
      setSuccessMsg(`A new 6-digit verification code has been sent to ${otpEmail.trim()}.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend verification code.');
    } finally {
      setResending(false);
    }
  };

  // -------------------------------------------------------------
  // 2. SECONDARY: PASSWORD AUTH HANDLERS
  // -------------------------------------------------------------
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (emailMode === 'signup') {
        if (!name.trim()) throw new Error('Please enter your full name');
        if (password.length < 6) throw new Error('Password must be at least 6 characters');
        if (confirmPassword && password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }

        const result = await authService.signUp(email.trim(), password, name.trim());
        if (result?.user && result?.user?.emailVerified) {
          onAuthSuccess(result.user, true);
        } else {
          // Switch to OTP verification with entered email
          setOtpEmail(email.trim());
          setAuthMethod('email_otp');
          setEmailOtpStep('verify');
          setEmailOtpCode('');
          setEmailOtpCountdown(30);
          setSuccessMsg(`Verification code sent to ${email.trim()}! Please enter the 6-digit code.`);
        }
      } else if (emailMode === 'signin') {
        const result = await authService.signIn(email.trim(), password);
        if (result?.user) {
          onAuthSuccess(result.user, false);
        }
      } else if (emailMode === 'forgot') {
        await authService.sendPasswordReset(email.trim());
        setSuccessMsg('Password reset instructions sent to your email.');
      }
    } catch (err: any) {
      console.error('Password Auth error:', err);
      const msg = err.message || '';

      if (msg.toLowerCase().includes('email verification required') || msg.toLowerCase().includes('verify')) {
        setOtpEmail(email.trim());
        setAuthMethod('email_otp');
        setEmailOtpStep('verify');
        setEmailOtpCountdown(30);
        setErrorMsg('Email verification is required. Enter the 6-digit code sent to your email.');
      } else {
        setErrorMsg(msg || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth Handler
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
        <div className="relative pt-3 px-5 sm:px-6 pb-6 min-h-[260px] sm:min-h-[300px] flex flex-col justify-between overflow-hidden">
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
          <div className="relative z-10 pt-2 sm:pt-3">
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

          {/* Headline & Slider Dots */}
          <div className="relative z-10 mt-4 mb-2 flex items-end justify-between">
            <div className="max-w-[280px] sm:max-w-xs">
              <h1 className="font-display text-2xl sm:text-3xl font-black text-slate-950 leading-[1.15] tracking-tight">
                {authMethod === 'email_otp' ? (
                  emailOtpStep === 'verify' ? (
                    <>
                      Verify your<br />
                      email code to<br />
                      start <span className="text-[#00d09c]">running.</span>
                    </>
                  ) : (
                    <>
                      Sign in with<br />
                      instant email OTP<br />
                      and <span className="text-[#00d09c]">track runs.</span>
                    </>
                  )
                ) : emailMode === 'signup' ? (
                  <>
                    Create account<br />
                    to track your runs<br />
                    and <span className="text-[#00d09c]">fitness goals.</span>
                  </>
                ) : emailMode === 'signin' ? (
                  <>
                    Log in to stay<br />
                    on top of your runs<br />
                    and <span className="text-[#00d09c]">fitness goals.</span>
                  </>
                ) : (
                  <>
                    Reset password<br />
                    and restore your<br />
                    running <span className="text-[#00d09c]">records.</span>
                  </>
                )}
              </h1>

              <p className="text-xs text-slate-600 font-medium mt-1.5 leading-relaxed">
                Track GPS routes, monitor pace & elevate your performance.
              </p>

              {/* 5 Step Dots Slider Indicator */}
              <div className="flex items-center gap-1.5 mt-2.5">
                {HERO_IMAGES.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
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
            <div className="hidden xs:flex flex-col items-end transform -rotate-6 mr-1 mb-4">
              <span className="font-serif italic font-bold text-slate-700 text-sm tracking-wide">
                A Healthier
              </span>
              <span className="font-serif italic font-bold text-slate-800 text-sm tracking-wide flex flex-col items-center">
                Happier You
                <svg className="w-16 h-2 text-[#00d09c] mt-0.5" viewBox="0 0 70 8" fill="none">
                  <path
                    d="M2 5.5C20 1.5 50 1.5 68 5.5"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Sheet Card with Scenic Landscape Watermark */}
        <div className="w-full bg-white rounded-t-[36px] shadow-2xl px-6 sm:px-8 pt-6 pb-8 z-20 flex-1 flex flex-col justify-between border-t border-emerald-100/80 relative overflow-hidden">
          {/* Scenic Mountain & Runner Landscape Watermark */}
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
              <path d="M245,150 C240,178 215,215 130,280 L370,280 C290,230 270,185 255,150 Z" fill="url(#authPathGrad)" />
              <rect x="0" y="0" width="500" height="140" fill="url(#authFadeTop)" />
            </svg>
          </div>

          <div className="w-full max-w-md md:max-w-lg mx-auto relative z-10">
            {/* Auth Method Segmented Tabs: [Email OTP (Primary)] | [Email & Password] */}
            {emailOtpStep !== 'verify' && emailMode !== 'forgot' && (
              <div className="flex items-center p-1 bg-slate-100 rounded-2xl mb-4 border border-slate-200 gap-1">
                {/* 1. Primary: Email OTP */}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMethod('email_otp');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${authMethod === 'email_otp'
                    ? 'bg-white text-slate-950 shadow-sm border border-slate-200/80 font-black'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  <Mail size={14} className={authMethod === 'email_otp' ? 'text-[#00d09c]' : ''} />
                  <span>Email OTP</span>

                </button>

                {/* 2. Secondary: Email & Password */}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMethod('password');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${authMethod === 'password'
                    ? 'bg-white text-slate-950 shadow-sm border border-slate-200/80 font-black'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  <Lock size={14} className={authMethod === 'password' ? 'text-[#00d09c]' : ''} />
                  <span>Email & Password</span>
                </button>
              </div>
            )}

            {/* Sheet Title */}
            <div className="mb-4">
              <h2 className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {authMethod === 'email_otp'
                  ? emailOtpStep === 'verify'
                    ? 'Enter 6-Digit OTP'
                    : 'Instant Email OTP'
                  : emailMode === 'signup'
                    ? 'Create Account'
                    : emailMode === 'signin'
                      ? 'Welcome Back'
                      : 'Reset Password'}
              </h2>

              {/* Secondary links for password mode */}
              {authMethod === 'password' && emailMode === 'signin' && (
                <p className="text-xs text-slate-600 mt-1">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setEmailMode('signup');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-emerald-700 font-bold hover:underline ml-0.5 cursor-pointer"
                  >
                    Sign Up
                  </button>
                </p>
              )}

              {authMethod === 'password' && emailMode === 'signup' && (
                <p className="text-xs text-slate-600 mt-1">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setEmailMode('signin');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-emerald-700 font-bold hover:underline ml-0.5 cursor-pointer"
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
                <span className="leading-snug">{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2 animate-fade-in">
                <CheckCircle2 size={16} className="shrink-0" />
                <span className="leading-snug">{successMsg}</span>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* VIEW 1: EMAIL OTP AUTHENTICATION (PRIMARY OTP FLOW)           */}
            {/* ------------------------------------------------------------- */}
            {authMethod === 'email_otp' && (
              <div>
                {emailOtpStep === 'input' ? (
                  <form onSubmit={handleSendEmailOtp} className="flex flex-col gap-3.5">
                    {/* Email Input Field */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1 px-1">
                        Email Address
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Mail size={16} />
                        </div>
                        <input
                          type="email"
                          inputMode="email"
                          required
                          autoFocus
                          placeholder="runner@example.com"
                          value={otpEmail}
                          onChange={(e) => setOtpEmail(e.target.value)}
                          className="w-full h-12 pl-10 pr-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold placeholder:text-slate-400 focus:outline-none focus:border-[#00d09c] focus:bg-white shadow-sm transition-all"
                        />
                      </div>
                    </div>

                    {/* Subtitle / Tip */}
                    <div className="flex items-center gap-1.5 px-1 text-[11px] text-slate-500">

                      <span>Instant 6-digit code delivered via InsForge SMTP</span>
                    </div>

                    {/* Send Code Action Button */}
                    <button
                      type="submit"
                      disabled={loading || !otpEmail.trim()}
                      className="w-full mt-1 py-3.5 px-6 rounded-2xl bg-[#00d09c] hover:bg-[#00ba8b] active:scale-[0.98] disabled:opacity-50 text-slate-950 font-black text-sm shadow-lg shadow-[#00d09c]/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Send Verification Code</span>
                          <ArrowRight size={18} strokeWidth={2.5} />
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  /* 6-Digit Email OTP Verification Step */
                  <div className="flex flex-col gap-3">
                    {/* Header with Change Email Option */}
                    <div className="flex items-center justify-between px-1 text-xs">
                      <span className="text-slate-600">
                        Code sent to <strong className="text-slate-950 font-black">{otpEmail}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEmailOtpStep('input');
                          setEmailOtpCode('');
                          setErrorMsg(null);
                        }}
                        className="text-emerald-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowLeft size={12} />
                        <span>Change</span>
                      </button>
                    </div>

                    {/* 6-Digit Auto-Advancing OTP Input */}
                    <PhoneOtpInput
                      value={emailOtpCode}
                      onChange={setEmailOtpCode}
                      length={6}
                      disabled={loading}
                      onComplete={(code) => handleVerifyEmailOtpCode(code)}
                    />

                    {/* Resend OTP Timer & Button */}
                    <div className="flex items-center justify-between px-1 text-xs">
                      <span className="text-slate-500">Didn't receive email? Check spam or</span>
                      <button
                        type="button"
                        onClick={handleResendEmailOtp}
                        disabled={emailOtpCountdown > 0 || resending}
                        className={`font-bold flex items-center gap-1 transition-all cursor-pointer ${emailOtpCountdown > 0
                          ? 'text-slate-400 cursor-not-allowed'
                          : 'text-emerald-700 hover:underline'
                          }`}
                      >
                        <RefreshCw size={12} className={resending ? 'animate-spin' : ''} />
                        <span>
                          {emailOtpCountdown > 0 ? `Resend in ${emailOtpCountdown}s` : 'Resend Code'}
                        </span>
                      </button>
                    </div>

                    {/* Verify & Continue Action Button */}
                    <button
                      type="button"
                      onClick={() => handleVerifyEmailOtpCode()}
                      disabled={loading || emailOtpCode.length !== 6}
                      className="w-full mt-2 py-3.5 px-6 rounded-2xl bg-[#00d09c] hover:bg-[#00ba8b] active:scale-[0.98] disabled:opacity-50 text-slate-950 font-black text-sm shadow-lg shadow-[#00d09c]/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Verify & Continue</span>
                          <ArrowRight size={18} strokeWidth={2.5} />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* VIEW 2: PASSWORD & ACCOUNT (EMAIL/PASSWORD AUTH)              */}
            {/* ------------------------------------------------------------- */}
            {authMethod === 'password' && (
              <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
                {/* Full Name Input (Sign Up Only) */}
                {emailMode === 'signup' && (
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
                      className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#00d09c] focus:bg-white shadow-sm transition-all"
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
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#00d09c] focus:bg-white shadow-sm transition-all"
                  />
                </div>

                {emailMode !== 'forgot' && (
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
                        className="w-full pl-11 pr-11 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#00d09c] focus:bg-white shadow-sm transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>

                    {/* Confirm Password (Sign Up Only) */}
                    {emailMode === 'signup' && (
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
                          className="w-full pl-11 pr-11 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#00d09c] focus:bg-white shadow-sm transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
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

                      {emailMode === 'signin' && (
                        <button
                          type="button"
                          onClick={() => {
                            setEmailMode('forgot');
                            setErrorMsg(null);
                            setSuccessMsg(null);
                          }}
                          className="text-emerald-700 font-semibold hover:underline cursor-pointer"
                        >
                          Forgot Password?
                        </button>
                      )}
                    </div>
                  </>
                )}

                {/* Primary Action Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-1.5 py-3.5 px-6 rounded-2xl bg-[#00d09c] hover:bg-[#00ba8b] active:scale-[0.98] disabled:opacity-50 text-slate-950 font-black text-sm shadow-lg shadow-[#00d09c]/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>
                        {emailMode === 'signup'
                          ? 'Sign Up & Send Code'
                          : emailMode === 'signin'
                            ? 'Log In'
                            : 'Send Reset Link'}
                      </span>
                      <ArrowRight size={18} strokeWidth={2.5} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Social Auth Divider (Always Available) */}
            {emailOtpStep !== 'verify' && (
              <>
                <div className="relative my-3.5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest">
                    <span className="bg-white px-3 text-slate-400">OR CONTINUE WITH</span>
                  </div>
                </div>

                {/* Google Sign In Button */}
                <button
                  type="button"
                  onClick={() => handleOAuthSignIn('google')}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50 text-slate-900 font-bold text-xs sm:text-sm flex items-center justify-center gap-3 shadow-sm border border-slate-200 transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24">
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

                {/* Demo / Guest Access Button */}
                <button
                  type="button"
                  onClick={onGuestAccess}
                  className="w-full mt-2 py-2 px-3 text-xs text-slate-500 hover:text-slate-900 font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles size={13} className="text-[#00d09c]" />
                  <span>Try Quick Demo / Guest Mode</span>
                </button>
              </>
            )}

            {/* Back to sign-in option for password reset */}
            {authMethod === 'password' && emailMode === 'forgot' && (
              <div className="text-center mt-3">
                <button
                  type="button"
                  onClick={() => {
                    setEmailMode('signin');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-xs text-emerald-700 font-bold hover:underline cursor-pointer"
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
