import React from 'react';
import { Database, ExternalLink } from 'lucide-react';
import type { Partner } from './partners';

export function PartnerCard({ partner, compact = false }: { partner: Partner; compact?: boolean }) {
  if (compact) return <a
    href={partner.websiteUrl}
    target="_blank"
    rel="noopener noreferrer external"
    aria-label={`Visit ${partner.name} website`}
    className="group grid w-full min-w-0 grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/10 bg-[linear-gradient(145deg,rgba(17,21,28,.94),rgba(7,10,15,.94))] p-3 text-left shadow-[inset_0_1px_rgba(255,255,255,.045),0_12px_32px_rgba(0,0,0,.20)] transition-colors hover:border-[#D9B43B]/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--bk-team-accent)]"
  >
    <span className={`grid h-14 w-14 place-items-center overflow-hidden rounded-lg border border-white/10 shadow-[0_8px_20px_rgba(0,0,0,.28)] ${partner.logo ? 'bg-white' : 'bg-[#111820] text-[#E7C75A]'}`}>
      {partner.logo?<img src={partner.logo} alt={`${partner.name} logo`} className="h-full w-full object-contain" loading="lazy" decoding="async" />:<Database aria-hidden="true" className="h-6 w-6" />}
    </span>
    <span className="min-w-0">
      <span className="block font-display text-sm font-black uppercase leading-4 tracking-[.035em] text-white">{partner.name}</span>
      <span className="mt-0.5 block text-[8px] font-black uppercase leading-3 tracking-[.08em] text-[#E7C75A]">{partner.partnerType}</span>
      <span className="mt-1 block truncate text-xs font-medium leading-4 text-zinc-500">{partner.description}</span>
    </span>
    <span className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#D9B43B]/25 bg-[#D9B43B]/7 px-2.5 text-[9px] font-black uppercase tracking-[.08em] text-[#E7C75A] transition-colors group-hover:bg-[#D9B43B]/13">Visit <span className="hidden min-[390px]:inline">Website</span><ExternalLink className="h-3 w-3" /></span>
  </a>;

  return <a
    href={partner.websiteUrl}
    target="_blank"
    rel="noopener noreferrer external"
    aria-label={`Visit ${partner.name} website`}
    className="group grid w-full min-w-0 grid-cols-[88px_minmax(0,1fr)] items-center gap-4 rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(17,21,28,.96),rgba(7,10,15,.96))] p-4 text-left shadow-[inset_0_1px_rgba(255,255,255,.055),0_18px_48px_rgba(0,0,0,.24)] transition-colors hover:border-[#D9B43B]/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--bk-team-accent)] sm:grid-cols-[112px_minmax(0,1fr)_auto] sm:gap-5 sm:p-5"
  >
    <span className={`grid aspect-square place-items-center overflow-hidden rounded-xl border border-white/10 shadow-[0_10px_28px_rgba(0,0,0,.32)] ${partner.logo ? 'bg-white' : 'bg-[#111820] text-[#E7C75A]'}`}>
      {partner.logo?<img src={partner.logo} alt={`${partner.name} logo`} className="h-full w-full object-contain" loading="lazy" decoding="async" />:<Database aria-hidden="true" className="h-9 w-9" />}
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
