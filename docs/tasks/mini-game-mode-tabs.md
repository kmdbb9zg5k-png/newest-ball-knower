# Mini-game mode tabs

All existing Mini Games modes now appear in a persistent top tab bar: Two-Minute Drill, Five-Minute Game, and Combine. Removed the inline game-mode radio group and expandable duplicate mode list. Mode tabs stay available through your-team selection, opponent selection and matchup review. Each playable tab uses the selected mode's explanation and launch URL, preserving saved difficulty and teams. Switching modes returns to the first setup step. Combine has its own clearly marked coming-soon panel with planned drill descriptions and no playable launch action. Reopening uses the last playable mode.

Tabs use tablist/tab/tabpanel roles, selected state, linked IDs, roving keyboard focus, left/right wrap, Home/End, and practical touch targets. Three responsive columns keep every mode visible on small phones without page overflow.

Validation: TypeScript and production build passed, whitespace checks passed. Dedicated browser checks at 320/390/1280 cover all tabs, keyboard navigation/focus, Combine panel, no invalid launch, tabs in opponent/review steps, persisted teams/difficulty, both playable launch URLs and reopen. Existing menu/Solo-navigation checks passed at the same widths. Actual 390px rendering inspected visually. Mobile Chromium emulation; physical iPhone untested. Gameplay engine unchanged. Production verification recorded on the PR.
