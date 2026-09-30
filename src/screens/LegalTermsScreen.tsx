import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  FileText, 
  ArrowLeft, 
  MapPin, 
  Radio, 
  Activity, 
  Heart, 
  Flame, 
  Lock, 
  CheckCircle2, 
  AlertTriangle, 
  Trash2, 
  ExternalLink, 
  Mail, 
  Sparkles,
  Users,
  Compass
} from 'lucide-react';

interface LegalTermsScreenProps {
  initialTab?: 'terms' | 'privacy';
  onBack: () => void;
}

export const LegalTermsScreen: React.FC<LegalTermsScreenProps> = ({
  initialTab = 'terms',
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(initialTab);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Top Fixed / Sticky Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all text-xs font-bold cursor-pointer group active:scale-95"
            title="Return to previous screen"
          >
            <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Back</span>
          </button>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck size={16} />
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-black tracking-tight text-white flex items-center gap-1.5">
                <span>RunWar</span>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                  Legal Center
                </span>
              </h1>
            </div>
          </div>
        </div>

        {/* Tab Toggle Pills */}
        <div className="flex items-center bg-slate-900/90 p-1 rounded-2xl border border-slate-800/90 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'terms'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <FileText size={13} />
            <span>Terms of Service</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'privacy'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Lock size={13} />
            <span>Privacy Policy</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">
        
        {/* Document Header Badge & Title */}
        <div className="space-y-3 pb-6 border-b border-slate-800/80">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold tracking-wide uppercase">
            {activeTab === 'terms' ? (
              <>
                <FileText size={13} />
                <span>User Agreement & Conditions</span>
              </>
            ) : (
              <>
                <ShieldCheck size={13} />
                <span>Data Sovereignty & Privacy Protections</span>
              </>
            )}
          </div>

          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            {activeTab === 'terms' ? 'RunWar Terms of Service' : 'RunWar Privacy Policy'}
          </h2>

          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
            {activeTab === 'terms'
              ? 'Please review the agreement governing your access to and use of RunWar workout tracking, real-time audio channels, and competitive fitness features.'
              : 'Our commitment to runner privacy: zero background location tracking, end-to-end encrypted audio streams, zero advertising data sales, and complete user data sovereignty.'}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-500 font-mono">
            <span>Effective Date: September 2026</span>
            <span>•</span>
            <span>Version 2.4</span>
            <span>•</span>
            <span className="text-emerald-400 font-semibold">Live & Enforced</span>
          </div>
        </div>

        {/* Dynamic Tab Body */}
        {activeTab === 'terms' ? (
          /* ================= TERMS OF SERVICE ================= */
          <div className="space-y-10 text-slate-300 leading-relaxed text-sm sm:text-[15px]">
            
            {/* Quick Summary Pill Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Activity size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Fitness Companion</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    High-accuracy GPS telemetry for outdoor runs, walks, and jogs.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Radio size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Live Walkie-Talkie</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Real-time runner-to-runner audio. Never recorded or stored.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Heart size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Safety First</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Live beacon sharing and clear athletic health guidelines.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 1: Acceptance */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  01
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Acceptance of User Agreement
                </h3>
              </div>
              <p>
                By creating an account, signing in, downloading, or engaging with RunWar, you confirm that you have read, understood, and consented to these Terms of Service. If you do not agree to every clause outlined herein, you must refrain from using the platform.
              </p>
            </section>

            {/* Section 2: Core Platform Capabilities */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  02
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Scope of RunWar Application Features
                </h3>
              </div>
              <p>
                RunWar is an athletic performance tracking and social fitness platform engineered to empower runners and active individuals through:
              </p>
              <ul className="space-y-2 list-none pl-0">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Precision GPS Run Tracking:</strong> High-frequency capture of route coordinates, split times, current pace, average speed, elevation gain/loss, and cadence.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Live Walkie-Talkie & Buddy Tether:</strong> Real-time, hands-free voice streaming between workout partners during active runs to provide encouragement and pacing sync.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Safety Live Beacon:</strong> Real-time location sharing via encrypted spectator links for friends and family during outdoor workouts.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Territory Battles & Challenges:</strong> Friendly neighborhood competitions, leaderboard progression, and milestone badges.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Connected Health Synchronization:</strong> Unified aggregation of daily steps and heart rate from authorized device sensors.
                  </span>
                </li>
              </ul>
            </section>

            {/* Section 3: Health & Physical Safety Warning (Prominent Callout) */}
            <section className="p-5 sm:p-6 rounded-3xl bg-amber-500/10 border border-amber-500/30 space-y-3">
              <div className="flex items-center gap-2.5 text-amber-400">
                <AlertTriangle size={20} className="shrink-0" />
                <h3 className="text-sm sm:text-base font-black uppercase tracking-wide">
                  03. Physical Activity & Medical Safety Disclaimer
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-amber-200/90 leading-relaxed font-medium">
                RunWar is strictly an athletic telemetry utility and motivation platform. It is <strong className="text-white">not a certified medical device</strong> and cannot provide medical diagnostics, clinical advice, or customized rehabilitation protocols.
              </p>
              <ul className="text-xs text-amber-200/80 space-y-1.5 list-disc pl-5">
                <li>
                  Consult a licensed medical doctor or healthcare provider before beginning any vigorous cardiovascular conditioning program.
                </li>
                <li>
                  Maintain total situational awareness at all times. Obey municipal traffic signals, pedestrian walkways, and trail safety signs. Never fixate on your device screen while crossing roads or traversing hazardous terrain.
                </li>
                <li>
                  All caloric calculations, pace targets, and cadence indicators are mathematical estimations derived from device sensor inputs and should not replace clinical assessments.
                </li>
              </ul>
            </section>

            {/* Section 4: Live Audio & Walkie-Talkie Conduct */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  04
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Buddy Tether & Live Audio Code of Conduct
                </h3>
              </div>
              <p>
                When utilizing RunWar’s live voice channel features (Walkie-Talkie and Buddy Tether), you agree to interact respectfully with all participating runners. You expressly agree not to:
              </p>
              <ul className="space-y-1.5 text-xs sm:text-sm list-disc pl-5 text-slate-400">
                <li>Transmit defamatory, harassing, sexually explicit, abusive, or threatening speech over open audio frequencies.</li>
                <li>Broadcast non-consensual recordings, unauthorized commercial advertisements, or disruptive background noise intended to interfere with fellow runners.</li>
                <li>Misrepresent your identity or impersonate other community athletes or organizers.</li>
              </ul>
              <p className="text-xs text-slate-400 bg-slate-900 p-3 rounded-xl border border-slate-800">
                <strong className="text-emerald-400">Audio Privacy Guarantee:</strong> Voice transmissions are delivered live through low-latency real-time communication channels. Audio packets are <span className="text-white font-bold">never recorded, stored on persistent disks, monitored, or analyzed</span>. Once the voice stream ends, audio data is instantly expunged.
              </p>
            </section>

            {/* Section 5: Fair Play & GPS Telemetry Integrity */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  05
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Fair Play, Challenges & Leaderboard Standards
                </h3>
              </div>
              <p>
                Community challenges and territory battles are sustained by athletic integrity. Any intentional falsification of GPS coordinates, usage of vehicular transport during recorded foot workouts, elevation spoofing, or automated activity manipulation constitutes a material breach of these Terms and will result in the immediate removal of tainted records and account ban.
              </p>
            </section>

            {/* Section 6: User Data Sovereignty & Intellectual Property */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  06
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Data Ownership & Intellectual Property
                </h3>
              </div>
              <p>
                You retain complete, exclusive ownership of your recorded workout telemetry, GPS routes, personal logs, and profile imagery. RunWar claims no ownership rights over your personal athletic data.
              </p>
              <p>
                All application visual design systems, algorithms, source code, logos, brand elements, and interface assets remain the exclusive intellectual property of RunWar.
              </p>
            </section>

            {/* Section 7: Account Termination & Deletion */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  07
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Account Termination & Data Erasure
                </h3>
              </div>
              <p>
                You possess the absolute right to terminate your account and erase all associated workout records at any time directly through the in-app Privacy & Data settings. Upon initiating deletion, your workout history, split points, and profile credentials are permanently purged with immediate effect.
              </p>
            </section>

            {/* Section 8: Limitation of Liability */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  08
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Limitation of Liability
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-400">
                To the fullest extent sanctioned by applicable law, RunWar and its engineering team shall not be held liable for any direct, indirect, incidental, or consequential injuries, equipment damages, loss of biometric data, or navigation disruptions incurred in connection with physical exercise or use of the service.
              </p>
            </section>

          </div>
        ) : (
          /* ================= PRIVACY POLICY ================= */
          <div className="space-y-10 text-slate-300 leading-relaxed text-sm sm:text-[15px]">
            
            {/* Privacy Pillars Callout Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <MapPin size={16} />
                </div>
                <h4 className="text-xs font-black text-emerald-300">Active Tracking Only</h4>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Location is captured strictly while you actively record a run. Zero background snooping.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 space-y-1.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                  <ShieldCheck size={16} />
                </div>
                <h4 className="text-xs font-black text-cyan-300">Zero Ad-Network Sales</h4>
                <p className="text-[11px] text-slate-400 leading-normal">
                  We never sell, broker, or monetize your route maps or fitness metrics to ad agencies.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20 space-y-1.5">
                <div className="w-8 h-8 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold">
                  <Trash2 size={16} />
                </div>
                <h4 className="text-xs font-black text-violet-300">One-Click Erasure</h4>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Complete user sovereignty: export or permanently wipe all workout data whenever you wish.
                </p>
              </div>
            </div>

            {/* Section 1: Philosophy */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  01
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Privacy-by-Design Architecture
                </h3>
              </div>
              <p>
                At RunWar, privacy is an engineering prerequisite, not an afterthought. Running routes reveal intimate personal habits—where you live, where you run, and what times you are active. We enforce rigorous structural safeguards to ensure your athletic journey remains entirely under your personal control.
              </p>
            </section>

            {/* Section 2: Data Collected and Why */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  02
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Categories of Data Handled & Purpose
                </h3>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-white font-bold text-xs sm:text-sm">
                    <MapPin size={16} className="text-emerald-400" />
                    <span>Real-Time GPS Location Coordinates</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    <strong className="text-slate-200">How it is gathered:</strong> Collected via your device’s satellite GPS hardware strictly while a workout session is actively running.
                    <br />
                    <strong className="text-slate-200">Why it is needed:</strong> To draw your interactive route map, compute instantaneous pace, determine split times per kilometer/mile, and record total distance.
                    <br />
                    <strong className="text-emerald-400">Strict Enforcement:</strong> GPS hardware polling halts the moment you pause, save, or discard a workout. RunWar does not maintain background tracking when you are not in an active workout session.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-white font-bold text-xs sm:text-sm">
                    <Radio size={16} className="text-cyan-400" />
                    <span>Buddy Walkie-Talkie & Audio Telemetry</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    <strong className="text-slate-200">How it is gathered:</strong> Captured via device microphone solely when you push-to-talk or enable live buddy audio channels.
                    <br />
                    <strong className="text-slate-200">Why it is needed:</strong> To transmit live voice communication to your authenticated running partner in real time.
                    <br />
                    <strong className="text-cyan-400">No Recording Policy:</strong> Audio streams are transmitted over encrypted peer-to-peer / low-latency WebRTC channels. Voice packets are never persisted on cloud disks, transcribed into text, or analyzed.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-white font-bold text-xs sm:text-sm">
                    <Activity size={16} className="text-emerald-400" />
                    <span>Physical Biometrics & Connected Health</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    <strong className="text-slate-200">How it is gathered:</strong> Optional integration with connected health ecosystems (such as Google Fit / Health) or Bluetooth sensors.
                    <br />
                    <strong className="text-slate-200">Why it is needed:</strong> Aggregating daily step totals, cadence, and heart rate readings into your workout summary.
                    <br />
                    <strong className="text-slate-200">User Control:</strong> Health sync permissions can be linked or severed at any second through Connected Health settings.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 3: Google API Compliance */}
            <section className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-white">
                <Sparkles size={18} className="text-emerald-400" />
                <h3 className="text-sm sm:text-base font-bold">
                  03. Google API Services Limited Use Compliance
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                RunWar’s use and transfer of information received from Google APIs to any other service strictly complies with the{' '}
                <span className="text-emerald-400 font-semibold underline">
                  Google API Services User Data Policy
                </span>
                , including the Limited Use requirements:
              </p>
              <ul className="space-y-1.5 text-xs text-slate-400 list-disc pl-5">
                <li>We do not utilize Google user data to serve personalized advertisements or retargeting campaigns.</li>
                <li>We do not transfer or sell Google fitness data to third-party data brokers, information aggregators, or marketing services.</li>
                <li>No human is permitted to read your personal fitness data unless you provide explicit affirmative consent for technical customer troubleshooting.</li>
                <li>We do not train generalized artificial intelligence or machine learning foundation models on your private fitness data.</li>
              </ul>
            </section>

            {/* Section 4: Data Security & Storage */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  04
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Storage & Cryptographic Protections
                </h3>
              </div>
              <p>
                All information transmitted between your mobile device, browser, and cloud storage systems is protected using TLS 1.3 / HTTPS encryption protocols. In storage, workout records and personal profiles are isolated by authenticated user boundaries so that no third party can access your private route traces.
              </p>
            </section>

            {/* Section 5: Data Sovereignty, Export & Deletion */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  05
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  User Sovereignty: Export & Permanent Deletion
                </h3>
              </div>
              <p>
                You retain complete governance over your digital footprint inside RunWar:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <span>Data Export</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Export your workouts in industry-standard GPX, TCX, or CSV formats for personal backup or use in external analysis software.
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Trash2 size={14} className="text-rose-400" />
                    <span>Permanent Deletion</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Trigger complete workout or account erasure in Settings. Associated GPS tracks and profile metrics are permanently expunged immediately.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 6: Children's Privacy */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  06
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Protection of Children's Privacy
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-400">
                RunWar is engineered for athletic training and is not directed at or designed for children under the age of 13. We do not knowingly collect personal identity or GPS coordinates from children. If we discover that personal data from a child under 13 has been submitted, it will be removed promptly.
              </p>
            </section>

          </div>
        )}

        {/* Bottom Contact & Legal Representative Card */}
        <div className="mt-12 p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2.5">
            <Mail size={18} className="text-emerald-400" />
            <h4 className="text-sm font-bold text-white">
              Questions or Data Rights Requests?
            </h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            If you have questions regarding our Terms of Service, wish to exercise privacy rights, or need assistance regarding your account data, please reach out directly:
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs pt-1">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Application</span>
              <span className="text-white font-semibold">RunWar Fitness Application</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Developer & Lead</span>
              <span className="text-white font-semibold">Mannam Ganesh Babu</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Direct Email</span>
              <a
                href="mailto:mannamganeshbabu8@gmail.com"
                className="text-emerald-400 font-semibold hover:underline"
              >
                mannamganeshbabu8@gmail.com
              </a>
            </div>
          </div>
        </div>

        {/* Back To Top / Back Button Bar */}
        <div className="pt-6 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Return to Sign In</span>
          </button>

          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors font-medium cursor-pointer"
          >
            ↑ Back to Top
          </button>
        </div>

      </main>
    </div>
  );
};
