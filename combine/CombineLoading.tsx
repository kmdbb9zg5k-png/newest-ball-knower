import React from 'react';
import './CombineLoading.css';

type Props = { error?: string; onBack: () => void; onRetry: () => void };

export default function CombineLoading({ error, onBack, onRetry }: Props) {
  const failed = Boolean(error);
  return <section className="bk-combine-loading" role="dialog" aria-modal="true" aria-label={failed ? 'Combine unavailable' : 'Preparing Combine'}>
    <div className="bk-combine-loading-scene" aria-hidden="true"><div className="bk-combine-loading-lanes"/><div className="bk-combine-loading-floodlights"/></div>
    <div className="bk-combine-loading-card">
      <div className="bk-combine-loading-brand"><span className="bk-combine-loading-monogram">B<span>K</span></span><span>THE COMBINE</span></div>
      <div className="bk-combine-loading-rule" aria-hidden="true"/>
      <h2>{failed ? 'COMBINE UNAVAILABLE' : 'PREPARING COMBINE'}</h2>
      <p className="bk-combine-loading-subtitle" role="status">{error || 'Setting the track…'}</p>
      {!failed && <>
        <div className="bk-combine-loading-progress" role="progressbar" aria-label="Loading combine" aria-valuetext="Preparing combine"><span/></div>
        <p className="bk-combine-loading-caption">Preparing your 40-yard dash experience</p>
        <div className="bk-combine-loading-steps" aria-label="Combine preparation">
          <div><i className="bk-combine-loading-check" aria-hidden="true">✓</i><span>Initializing speed lane</span></div>
          <div className="bk-combine-loading-active"><i className="bk-combine-loading-spinner" aria-hidden="true"/><strong>Loading drills & athlete</strong></div>
          <div><i className="bk-combine-loading-pending" aria-hidden="true"/><span>Finalizing environment</span></div>
        </div>
      </>}
      <div className="bk-combine-loading-actions">
        <button type="button" className="bk-combine-loading-back" onClick={onBack}><span aria-hidden="true">←</span> BACK</button>
        {failed && <button type="button" className="bk-combine-loading-retry" onClick={onRetry}>RETRY DRILL</button>}
      </div>
    </div>
  </section>;
}
