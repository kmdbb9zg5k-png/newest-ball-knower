import React from 'react';
import { ArrowLeft, Handshake } from 'lucide-react';
import { PartnerCard } from './PartnerCard';
import { partnerSections } from './partners';

export function PartnersPage({ onBack }: { onBack: () => void }) {
  return <div className="mx-auto w-full max-w-5xl pb-[calc(2rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-4 sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pt-7">
    <button onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-4 text-[10px] font-black uppercase tracking-wider text-zinc-300"><ArrowLeft className="h-4 w-4" />Back to Home</button>
    <header className="mt-5 border-b border-white/10 pb-5">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.22em] text-[#E7C75A]"><Handshake className="h-4 w-4" />Ball Knower Network</div>
      <h1 className="mt-2 font-display text-4xl font-black uppercase tracking-tight text-white sm:text-5xl">Our Partners</h1>
      <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-zinc-400">The media and technology organizations helping support the Ball Knower football experience.</p>
    </header>
    <div className="mt-5 space-y-7">
      {partnerSections.map(section=><section key={section.id} aria-labelledby={`partners-${section.id}`}>
        <h2 id={`partners-${section.id}`} className="mb-3 px-1 text-[9px] font-black uppercase tracking-[.2em] text-[#E7C75A]">{section.label}</h2>
        <div className="space-y-3">{section.partners.map(partner => <PartnerCard key={partner.name} partner={partner} />)}</div>
      </section>)}
    </div>
  </div>;
}
