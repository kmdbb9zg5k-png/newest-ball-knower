export type ModeHelpContent = {
  title: string;
  summary: string;
  steps: readonly string[];
  sections: readonly { title: string; body: string }[];
};

export const MODE_HELP = {
  home: {
    title: 'Your football hub',
    summary: 'Continue a saved activity, manage a fantasy team, or find something new to play.',
    steps: ['Use Play to explore careers, football and drills.', 'Open Fantasy for your leagues and matchups, or Community for challenges and other members.', 'Use Profile for your identity, progression and account. Explore opens Picks, Ask BK, News and customization.'],
    sections: [{ title: 'Keep your progress', body: 'Guest activities can be saved on this device. Save your profile with an account for supported online and cloud features. Check each mode’s save status before changing devices.' }],
  },
  play: {
    title: 'Find your game',
    summary: 'Choose an ongoing career, a football game, a Combine drill or a quick challenge.',
    steps: ['Open a mode to see its setup and instructions.', 'Continue an existing career or deliberately start a new one.', 'Use that mode’s Back or Exit control to return when you finish.'],
    sections: [{ title: 'Different ways to play', body: 'Careers continue across seasons. Football games and drills have session results. Read the result screen to see whether an attempt is practice, saved locally or verified online.' }, { title: 'Saving and new runs', body: 'Starting a new career can replace that mode’s existing run. Review reset prompts before confirming. Leaving a mode does not automatically finish an active attempt.' }],
  },
  profile: {
    title: 'Your Ball Knower identity',
    summary: 'Your profile brings your name, photo, verified progression and achievements together.',
    steps: ['Edit your name and photo, then save the changes.', 'Open a rating or trophy to understand its progress and requirements.', 'Save with an account to protect supported online progress and manage account settings.'],
    sections: [{ title: 'Ratings and receipts', body: 'Verified progression is calculated from eligible server-confirmed events. A practice score or local career result does not automatically change your verified BK Rating.' }, { title: 'Your appearance', body: 'Profile photos identify your account. Player appearance, clothing and game equipment are managed in customization and career creation.' }],
  },
  customization: {
    title: 'Player customization',
    summary: 'Build your player’s look and preview the clothing and equipment available to that player.',
    steps: ['Select the player and the category you want to change.', 'Preview the item or appearance before applying it.', 'Save and reopen your player to confirm the finished look.'],
    sections: [{ title: 'Items and ownership', body: 'Check the item’s ownership and price before a purchase. A preview does not grant a paid item. Your profile photo and your game character are separate.' }, { title: 'Career identity', body: 'Team uniforms can change with a career’s team. Saved face, number and appearance choices should remain with the same player.' }],
  },
  fantasy: {
    title: 'Fantasy football',
    summary: 'Create or join a league, draft a legal roster and manage your lineup against other teams.',
    steps: ['Review your league settings and draft time before drafting.', 'Use the player list and queue to plan picks while the draft clock runs.', 'Set a valid lineup, review player locks and manage available players, waivers and trades.'],
    sections: [{ title: 'Scoring and player locks', body: 'Your league’s scoring rules determine points. Players lock according to league rules and kickoff times. A locked player cannot be moved to bypass a deadline.' }, { title: 'Data availability', body: 'Projections are estimates. Scores and player information depend on available feeds; read freshness and paused-scoring notices. Missing statistics are not proof of a zero-point performance.' }, { title: 'Online progress', body: 'League actions require an online account and successful server confirmation. If an action fails, review the current roster before retrying.' }],
  },
  picks: {
    title: 'Picks',
    summary: 'Choose a side, review your card and submit eligible picks before kickoff.',
    steps: ['Read both teams, the kickoff time and the published line.', 'Select a team and review Your Picks.', 'Submit the card and check its saved or locked status.'],
    sections: [{ title: 'Lines and grading', body: 'Published lines are snapshots, not continuously changing prices. Picks lock before kickoff and eligible games are graded after results are available. Check the card for pending, final or void status.' }, { title: 'Changes and saving', body: 'Unlocked picks can be changed and resubmitted. Selection alone is not a saved submission. Read the confirmation before leaving.' }],
  },
  community: {
    title: 'Community',
    summary: 'Browse football conversations, find members and compete in challenges.',
    steps: ['Browse public content as a guest.', 'Sign in when you want to post, react or take an account-bound action.', 'Open a challenge to read its rules, play an attempt and compare results.'],
    sections: [{ title: 'Competition results', body: 'A completed attempt must be saved successfully before it can count in an online comparison. Keep a failed result open and use Retry when available.' }, { title: 'Your controls', body: 'Use report, block and mute controls where available to manage your experience. Keep personal account information out of public posts.' }],
  },
  ask: {
    title: 'Ask BK',
    summary: 'Ask a sports question or attach screenshots for a football and fantasy breakdown.',
    steps: ['Type your question or choose a starter prompt.', 'Attach up to five screenshots when a visual breakdown would help.', 'Send the question, then read the answer and any linked sources. You can stop a request or clear the session.'],
    sections: [{ title: 'Current information', body: 'Date-sensitive questions can use current search. Check source dates and confirm time-sensitive injuries, lineups and news. AI answers can be wrong.' }, { title: 'Session privacy', body: 'Ball Knower does not save this conversation as chat history. Messages clear when you leave Ask BK or clear the session. Screenshots are sent for analysis and removed from the visible message data after a successful answer.' }],
  },
  news: {
    title: 'NFL News',
    summary: 'Browse headlines and open the original publisher for the full story.',
    steps: ['Read the headline, publisher and publication time.', 'Open a story to visit its source.', 'Use Refresh to request the latest available feed.'],
    sections: [{ title: 'Feed freshness', body: 'The feed retrieval time and an article’s publication time describe different things. A recently refreshed feed can contain older stories. Availability depends on the news source.' }],
  },
  trivia: {
    title: 'Football challenges',
    summary: 'Choose a challenge and difficulty, answer questions and review your results.',
    steps: ['Read the selected challenge’s rules and timing.', 'Choose an answer before the question or round ends.', 'Review your score and explanations, then replay or return to the challenge list.'],
    sections: [{ title: 'Practice and progression', body: 'Offline practice can retain a score without earning verified XP. Online rewards require an eligible, successfully confirmed result. Check the result screen for the reward actually awarded.' }],
  },
  gm: {
    title: 'Franchise Command',
    summary: 'Manage a fictional football franchise through roster decisions, a season, playoffs and the rookie draft.',
    steps: ['Review your roster, salary cap and weekly game plan.', 'Resolve player meetings and review incoming trade calls before advancing.', 'Play or simulate eligible games, develop players and continue into the next season.'],
    sections: [{ title: 'Important decisions', body: 'GM alerts describe the situation and the consequences of each choice. Close and Decide later preserve the unresolved decision. Reopen it from Front office; required meetings must be resolved before advancing.' }, { title: 'Trades and promises', body: 'Review both players and the roster/cap impact before a trade. Offers can expire when the week advances. Promises are judged against their stated goal and deadline.' }, { title: 'Saving', body: 'This career uses its own saved run. Finish a decision and check the visible outcome before leaving. Starting a new franchise replaces that run after confirmation.' }],
  },
  owner: {
    title: 'Owner career',
    summary: 'Lead a franchise as its owner and balance football ambitions with staff, facilities and finances.',
    steps: ['Create your franchise and review the starting finances.', 'Hire staff and read each investment or weekly decision carefully.', 'Advance the season, review results and inspect the season financial summary.'],
    sections: [{ title: 'Money and decisions', body: 'Some investments spend money immediately while recurring staff costs are settled through the career’s season accounting. Read the displayed cost and budget impact before confirming.' }, { title: 'Continuing your career', body: 'The career continues into later seasons. Check the saved state and season history; an online reward requires separate server confirmation.' }],
  },
  agent: {
    title: 'Player Agent',
    summary: 'Recruit clients, develop relationships and negotiate opportunities through a continuing football calendar.',
    steps: ['Review your clients, reputation and actions remaining.', 'Choose recruiting, client support or negotiations with the current week in mind.', 'Advance the calendar and follow up on contracts and client outcomes.'],
    sections: [{ title: 'Negotiating', body: 'Read the salary, term, team and client response. A counteroffer can improve a deal or end a negotiation. Existing contracts and future agreements affect when another deal is available.' }, { title: 'Calendar and saving', body: 'Actions and cooldowns use the career calendar. The offseason is condensed. Use the saved career and history to continue without creating a different agent.' }],
  },
  'my-player': {
    title: 'My Player',
    summary: 'Create an athlete and shape a football career through preparation, opportunities and performance.',
    steps: ['Choose your position and save your player’s identity and appearance.', 'Complete the available Combine, draft and camp activities.', 'Review weekly opportunities, training and recovery, then follow your season and career stats.'],
    sections: [{ title: 'Choices and opportunities', body: 'Performance and decisions can affect development, relationships and future opportunities. Read the stated stakes before committing to a choice.' }, { title: 'Your saved player', body: 'Career statistics belong to this player. Reopen the existing career to continue; starting a new one is a separate reset.' }],
  },
  combine: {
    title: 'The Combine',
    summary: 'Practice football skills and complete drill sessions using the controls shown for each event.',
    steps: ['Select a drill and read its setup and controls.', 'Complete each rep and use Next Rep to continue.', 'Review the completed session and save or submit an eligible result before leaving.'],
    sections: [{ title: 'Recovery', body: 'If graphics fail, use the drill’s Retry control. Recovery should preserve the current session. Leaving an unfinished attempt is different from completing and saving it.' }, { title: 'Scoring', body: 'Each drill uses its own scoring and attempt rules. A practice result, career result and verified community result can have different progression effects.' }],
  },
  football: {
    title: 'Football',
    summary: 'Choose a team and game format, then control your side through possessions to the final result.',
    steps: ['Select your team, opponent or online match and review the rules.', 'Use the play selection and on-screen controls for the current phase.', 'Finish the game or drive sequence and review the result before a rematch or exit.'],
    sections: [{ title: 'Game and connection status', body: 'Two-minute, five-minute and online drive competitions have different formats. Read the mode’s rules, clock and possession state. Matchmaking may provide an automated opponent when a live match is unavailable.' }, { title: 'Controls and results', body: 'Controls change for offense, defense and kicking. A result must be successfully confirmed to count online. If saving fails, keep the result available and retry rather than replaying the attempt.' }],
  },
} satisfies Record<string, ModeHelpContent>;

export type ModeHelpKey = keyof typeof MODE_HELP;
