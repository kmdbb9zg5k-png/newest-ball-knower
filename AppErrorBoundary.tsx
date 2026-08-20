import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ball-knower-ui-crash', error, info.componentStack);
  }

  private reload = () => {
    try { window.location.reload(); } catch {}
  };

  private resetToHome = () => {
    try {
      window.history.replaceState({}, '', window.location.pathname);
      window.location.reload();
    } catch {
      this.setState({ error: null });
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-[100dvh] bg-[#07090d] px-4 py-12 text-white">
        <div className="mx-auto max-w-lg rounded-[2rem] border border-red-500/25 bg-[#11151c] p-6 shadow-2xl sm:p-8">
          <div className="text-[10px] font-black uppercase tracking-[.24em] text-red-300">Ball Knower recovered a screen crash</div>
          <h1 className="mt-3 text-3xl font-black leading-tight">THE APP IS STILL UP.</h1>
          <p className="mt-3 text-sm font-semibold leading-relaxed text-zinc-400">
            One screen hit an unexpected error, so Ball Knower stopped that screen instead of letting the entire app white-screen.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={this.reload} className="min-h-12 rounded-2xl bg-[var(--bk-team-accent,#d8a93a)] px-4 text-sm font-black text-black">TRY AGAIN</button>
            <button type="button" onClick={this.resetToHome} className="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-black text-white">RETURN HOME</button>
          </div>
          <details className="mt-5 text-xs text-zinc-500">
            <summary className="cursor-pointer font-bold">Crash details</summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-black/40 p-3">{this.state.error.message}</pre>
          </details>
        </div>
      </div>
    );
  }
}
