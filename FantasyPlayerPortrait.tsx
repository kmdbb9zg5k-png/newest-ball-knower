import React from "react";
import type { Player } from "./types";
import {
  playerPortraitFallbackUrl,
  playerPortraitUrl,
} from "./playerPortraits";

type FantasyPlayerPortraitProps = {
  player?: Player;
  className?: string;
  decorative?: boolean;
};

export const FantasyPlayerPortrait = ({
  player,
  className = "h-10 w-10 rounded-lg",
  decorative = false,
}: FantasyPlayerPortraitProps) => (
  <div
    className={`relative shrink-0 overflow-hidden border border-white/10 bg-white/5 ${className}`}
  >
    {player ? (
      <img
        src={playerPortraitUrl(player)}
        alt={decorative ? "" : `${player.name} headshot`}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={(event) => {
          const image = event.currentTarget;
          const fallback = playerPortraitFallbackUrl(player);
          if (image.src !== fallback) image.src = fallback;
        }}
        className="h-full w-full object-cover"
      />
    ) : (
      <span className="grid h-full w-full place-items-center text-xs font-black text-zinc-600">
        —
      </span>
    )}
  </div>
);
