import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { Partner } from './partners';

export function PartnerCard({ partner, compact = false }: { partner: Partner; compact?: boolean }) {
  return <a
    href={partner.websiteUrl}
    target="_blank"
    rel="noopener noreferrer external"
    aria-label={`Visit ${partner.name} website`}
    className={`group grid w-full min-w-0 items-center gap-4 rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(17,21,28,.96),rgba(7,10,15,.96))] p-4 text-left shadow-[inset_0_1px_rgba(255,255,255,.055),0_18px_48px_rgba(0,0,0,.24)] transition-colors hover:border-[#D9B43B]/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--bk-team-accent)] sm:gap-5 sm:p-5 ${compact ? 'grid-cols-[76px_minmax(0,1fr)] sm:grid-cols-[92px_minmax(0,1fr)_auto]' : 'grid-cols-[88px_minmax(0,1fr)] sm:grid-cols-[112px_minmax(0,1fr)_auto]'}`}
  >
    <span className="aspect-square overflow-hidden rounded-xl border border-white/10 bg-white shadow-[0_10px_28px_rgba(0,0,0,.32)]">
      <img src={partner.logo} alt={`${partner.name} logo`} className="h-full w-full object-contain" loading="lazy" decoding="async" />
    </span>
    <span className="min-w-0">
      <span className="block font-display text-lg font-black uppercase leading-none tracking-[.04em] text-white sm:text-xl">{partner.name}</span>
      <span className="mt-1.5 block text-[9px] font-black uppercase leading-4 tracking-[.1em] text-[#E7C75A] sm:text-[10px]">{partner.partnerType}</span>
      <span className="mt-2 block text-sm font-medium leading-5 text-zinc-400">{partner.description}</span>
      <span className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#D9B43B]/30 bg-[#D9B43B]/8 px-4 text-[10px] font-black uppercase tracking-[.12em] text-[#E7C75A] sm:hidden">Visit Website<ExternalLink className="h-3.5 w-3.5" /></span>
    </span>
    <span className="hidden min-h-11 items-center gap-2 rounded-xl border border-[#D9B43B]/30 bg-[#D9B43B]/8 px-4 text-[10px] font-black uppercase tracking-[.12em] text-[#E7C75A] transition-colors group-hover:bg-[#D9B43B]/14 sm:inline-flex">Visit Website<ExternalLink className="h-3.5 w-3.5" /></span>
  </a>;
}
