# Intro video launch fix

- The cinematic intro now opens on every fresh app load instead of only the first-ever visit.
- Removed the persistent `localStorage` suppression flag that prevented later launches from showing the intro.
- The soundtrack provider is marked intro-active immediately on mount so menu audio does not compete with the cinematic.
- The existing manual "Replay Intro Video" control remains unchanged.
