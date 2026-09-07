import {BroadcastStage,BroadcastMasthead,BroadcastMotionControl} from './BroadcastScene';
import React from 'react';
import { ArrowLeft, Handshake } from 'lucide-react';
import { PartnerCard } from './PartnerCard';
import { partnerSections } from './partners';

export function PartnersPage({ onBack }: { onBack: () => void }) {
  return <BroadcastStage scene="studio" page="partners" className="mx-auto w-full max-w-5xl pb-[calc(2rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-4 sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pt-7">
    <button onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-4 text-[10px] font-black uppercase tracking-wider text-zinc-300"><ArrowLeft className="h-4 w-4" />Back to Home</button>
    <BroadcastMasthead eyebrow="Ball Knower network" title="Our Partners" subtitle="The media and technology organizations supporting the experience." compact/>
    <div className="mt-5 space-y-7">
      {partnerSections.map(section=><section key={section.id} aria-labelledby={`partners-${section.id}`}>
        <h2 id={`partners-${section.id}`} className="mb-3 px-1 text-[9px] font-black uppercase tracking-[.2em] text-[#E7C75A]">{section.label}</h2>
        <div className="space-y-3">{section.partners.map(partner => <PartnerCard key={partner.name} partner={partner} />)}</div>
      </section>)}
    </div>
  </BroadcastStage>;
}
