import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('RunWar Uncaught UI Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetApp = () => {
    try {
      // Clear non-critical local caches while preserving offline workouts if possible
      sessionStorage.clear();
      window.location.href = '/';
    } catch {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 select-none">
          <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-500/5 text-center space-y-5">
            {/* Warning Icon */}
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle size={32} />
            </div>

            {/* Error Title & Description */}
            <div className="space-y-2">
              <h1 className="font-display text-2xl font-black text-white tracking-tight">
                Something went wrong
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                RunWar ran into an unexpected display issue. Your workout progress is stored safely in local memory.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                onClick={this.handleReload}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-98 transition-all"
              >
                <RefreshCw size={16} />
                <span>Reload RunWar</span>
              </button>

              <button
                onClick={this.handleResetApp}
                className="w-full py-3 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-medium text-xs flex items-center justify-center gap-2 border border-slate-700/60 active:scale-98 transition-all"
              >
                <Trash2 size={14} />
                <span>Restart Session</span>
              </button>
            </div>

            {/* Collapsible Error Debug Details */}
            {this.state.error && (
              <details className="pt-3 text-left border-t border-slate-800/80">
                <summary className="text-[10px] uppercase font-bold text-slate-500 hover:text-slate-400 cursor-pointer tracking-wider">
                  Technical Details
                </summary>
                <div className="mt-2 p-3 rounded-lg bg-slate-950/80 border border-slate-800/60 font-mono text-[11px] text-rose-400 overflow-x-auto max-h-36">
                  <p className="font-bold">{this.state.error.toString()}</p>
                  {this.state.errorInfo?.componentStack && (
                    <pre className="text-[10px] text-slate-400 mt-1 whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
