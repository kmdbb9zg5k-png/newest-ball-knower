import React, {Component, useEffect, useState, type ErrorInfo, type ReactNode} from 'react';
import {captureHandledError} from './issueReporting';

type Props = {children: ReactNode; onHome?: () => void; overlay?: boolean};

/** Keep navigation and providers mounted when one destination fails to render. */
export class ScreenErrorBoundary extends Component<Props, {error: Error | null}> {
  state: {error: Error | null} = {error: null};
  static getDerivedStateFromError(error: Error) { return {error}; }
  componentDidCatch(error: Error, _info: ErrorInfo) {
    captureHandledError(error, 'A destination failed to render; app navigation remains available.');
  }
  render() {
    if (!this.state.error) return this.props.children;
    return <section className={this.props.overlay?'fixed inset-0 z-[110] overflow-y-auto bg-[#07090d]/95 px-4 py-12':'mx-auto my-8 max-w-xl px-4'} role="alert">
      <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-[#10151d] p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--bk-team-accent)]">Screen unavailable</p>
        <h1 className="mt-3 text-2xl font-black">Let’s get you back in.</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">This screen couldn’t open. Reload to try again, or choose another destination from navigation. Your saved progress stays in place.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {this.props.onHome&&<button type="button" onClick={this.props.onHome} className="min-h-12 rounded-xl bg-[var(--bk-team-accent)] px-5 text-sm font-bold text-[var(--bk-on-accent)]">Return home</button>}
          <button type="button" onClick={()=>window.location.reload()} className="min-h-12 rounded-xl border border-white/20 px-5 text-sm font-bold">Reload app</button>
        </div>
      </div>
    </section>;
  }
}

export function ScreenLoading({onHome}: {onHome?: () => void}) {
  const [slow, setSlow] = useState(false);
  useEffect(()=>{const timer=window.setTimeout(()=>setSlow(true),12_000);return()=>window.clearTimeout(timer);},[]);
  return <section className="mx-auto flex min-h-[45dvh] max-w-xl items-center justify-center px-5 text-center" aria-label="Loading screen">
    <div>
      <div aria-hidden="true" className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[var(--bk-team-accent)]"/>
      <p role="status" className="mt-4 text-sm font-semibold text-zinc-300">{slow?'This is taking longer than usual.':'Loading Ball Knower…'}</p>
      {slow&&<><p className="mt-2 text-sm leading-relaxed text-zinc-400">Check your connection, or reload to try again.</p><div className="mt-5 flex flex-wrap justify-center gap-3">{onHome&&<button type="button" onClick={onHome} className="min-h-11 rounded-xl border border-white/20 px-4 text-sm font-bold">Return home</button>}<button type="button" onClick={()=>window.location.reload()} className="min-h-11 rounded-xl border border-white/20 px-4 text-sm font-bold">Reload app</button></div></>}
    </div>
  </section>;
}
