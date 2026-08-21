import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Bug, CheckCircle2 } from 'lucide-react';
import { createIssueDiagnostic, submitIssueReport, type IssueDiagnostic } from './issueReporting';

interface Props { children: ReactNode }
interface State { error: Error | null; report: IssueDiagnostic | null; reportState: 'idle' | 'sending' | 'sent' }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, report: null, reportState: 'idle' };

  static getDerivedStateFromError(error: Error): State {
    return { error, report: createIssueDiagnostic(error, 'crash'), reportState: 'idle' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ball-knower-ui-crash', error, info.componentStack);
    this.setState({ report: createIssueDiagnostic(error, 'crash', { componentStack: info.componentStack ?? '' }) });
  }

  componentDidMount() {
    window.addEventListener('error', this.onWindowError);
    window.addEventListener('unhandledrejection', this.onUnhandledRejection);
    window.addEventListener('ball-knower:issue', this.onCapturedIssue as EventListener);
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.onWindowError);
    window.removeEventListener('unhandledrejection', this.onUnhandledRejection);
    window.removeEventListener('ball-knower:issue', this.onCapturedIssue as EventListener);
  }

  private onWindowError = (event: ErrorEvent) => this.setState({ report: createIssueDiagnostic(event.error || event.message, 'handled-error'), reportState: 'idle' });
  private onUnhandledRejection = (event: PromiseRejectionEvent) => this.setState({ report: createIssueDiagnostic(event.reason, 'handled-error'), reportState: 'idle' });
  private onCapturedIssue = (event: CustomEvent<IssueDiagnostic>) => this.setState({ report: event.detail, reportState: 'idle' });

  private reportIssue = async () => {
    if (!this.state.report || this.state.reportState === 'sending') return;
    this.setState({ reportState: 'sending' });
    const result = await submitIssueReport(this.state.report);
    if (result.sent) this.setState({ reportState: 'sent' });
    else this.setState({ reportState: 'idle' });
  };

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
    if (!this.state.error) return <>{this.props.children}{this.state.report ? <button type="button" onClick={this.reportIssue} className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[120] flex min-h-11 items-center gap-2 rounded-full border border-red-400/30 bg-[#17191f]/95 px-4 text-[10px] font-black tracking-wider text-red-200 shadow-2xl"><Bug size={15} /> {this.state.reportState === 'sent' ? 'ISSUE SENT' : this.state.reportState === 'sending' ? 'SENDING…' : 'REPORT ISSUE'}</button> : null}</>;

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
          <button type="button" onClick={this.reportIssue} disabled={this.state.reportState === 'sending'} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-400/25 bg-red-400/10 px-4 text-sm font-black text-red-200 disabled:opacity-60">
            {this.state.reportState === 'sent' ? <CheckCircle2 size={17} /> : <Bug size={17} />} {this.state.reportState === 'sent' ? `ISSUE SENT • ${this.state.report?.id}` : this.state.reportState === 'sending' ? 'SENDING REPORT…' : 'REPORT ISSUE'}
          </button>
          <details className="mt-5 text-xs text-zinc-500">
            <summary className="cursor-pointer font-bold">Crash details</summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-black/40 p-3">{this.state.error.message}</pre>
          </details>
        </div>
      </div>
    );
  }
}
