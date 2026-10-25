# Homepage hero size follow-up

User requested the previous hero size and removal of the four footer options.

Restored the pre-artwork hero footprint: full content width with prior outer margins; 350px below 360px, 378px on phones, 440px from 640px. The artwork scales proportionally inside that area with no cover crop. Its two main buttons remain aligned to the artwork. Removed the four inline footer actions; existing app destinations remain available elsewhere.

Asset: public/atmosphere/ball-knower-legacy-hero.webp. Built-in imagegen edited the previous artwork, then Sharp encoded WebP. Prompt: remove only FANTASY, SOLO, COMBINE, TRIVIA and their gold dividers, fill with the existing dark background, preserve all other artwork, copy and the two primary buttons, do not crop or zoom.

Validation: production build, TypeScript, home contracts and responsive browser verification at 320/390/430/1280px. Browser verification covers original hero heights, aspect ratio, two aligned button targets, navigation and image fallback. No physical-device testing claimed.
