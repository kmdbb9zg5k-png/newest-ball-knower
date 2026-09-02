# Ball Knower Fantasy vs. Yahoo Fantasy

Internal competitive scorecard — audited 2026-09-02 UTC against Ball Knower production `main` at `224b9809b16fc68b546fbb7e8e8adcd78d38c140`.

## Method

This is a product-depth audit, not a feature-checkbox inventory. Each verdict considers shipped behavior, server authority, failure recovery, mobile usability, intelligence depth, configurability, and production evidence. A local component, schema field, or static source assertion does not establish parity by itself.

Yahoo evidence was refreshed from Yahoo's current product/help surfaces and current mobile-store listing:

- [Yahoo Fantasy Football](https://football.fantasysports.yahoo.com/)
- [Yahoo Fantasy Football Help](https://help.yahoo.com/kb/fantasy-football)
- [Overview of Yahoo Fantasy drafting](https://help.yahoo.com/kb/fantasy-football/overview-drafting-yahoo-fantasy-sln22670.html)
- [Yahoo roster and lineup management](https://help.yahoo.com/kb/fantasy-football/roster-lineup-management-yahoo-fantasy-sln22673.html)
- [Overview of Yahoo Fantasy scoring](https://help.yahoo.com/kb/fantasy-football/overview-scoring-yahoo-fantasy-sln6868.html)
- [Yahoo keeper-league setup](https://help.yahoo.com/kb/fantasy-football/set-keeper-league-sln6111.html)
- [Yahoo Fantasy Plus & Ultra](https://fantasysports.yahoo.com/lp/plus)
- [Yahoo Fantasy Plus overview](https://help.yahoo.com/kb/overview-yahoo-fantasy-sln35629.html)
- [Yahoo Fantasy Sports mobile listing](https://play.google.com/store/apps/details?id=com.yahoo.mobile.client.android.fantasyfootball)
- [Yahoo Fantasy archive help](https://fantasysports.yahoo.com/profile_help)
- [Yahoo scoring-dispute help](https://help.yahoo.com/kb/SLN6137.html)

Verdicts mean:

- **Ball Knower better** — Ball Knower has a materially deeper shipped workflow or differentiator, with executable evidence.
- **Parity** — both products satisfy the core job; neither has a clearly proven controllable advantage at this audit point.
- **Yahoo still better** — Yahoo has greater depth, usability, configuration, data, mobile delivery, or demonstrated operational maturity.
- **Intentionally different** — Ball Knower rejects the Yahoo pattern for a documented product reason and supplies a stronger alternative.
- **Not relevant** — the capability does not advance this product. Raw installed-user/network size is tracked here, not treated as controllable parity work.

## Current competitive verdict

Ball Knower is **not yet objectively better than Yahoo in every controllable category**. It already has credible advantages in transaction workflow depth, CPU managers, league intelligence, rivalries/awards, and draft recovery. Yahoo still leads the largest set of categories because of mature mobile delivery, longitudinal reliability, research/news depth, draft preparation, keeper support, notification delivery, and commissioner breadth.

The release program therefore remains active. “Yahoo parity” tests in the repository are regression gates for specific contracts; they are not a declaration of overall competitive parity.

## 41-category scorecard

| # | Category | Current Yahoo benchmark | Ball Knower shipped evidence | Verdict | Gap that still matters |
|---:|---|---|---|---|---|
| 1 | Core fantasy experience | Mature create/join/draft/manage/matchup/season loop across web and native apps. | Standard QB/RB/WR/TE/FLEX/K/DST leagues, 15-player default, real drafts, lineups, matchups, transactions, playoffs, history. | **Parity** | Ball Knower still needs a full real-season operational cycle before claiming a reliability advantage. |
| 2 | Live scoring | Real-time matchup scoring, scoring corrections, and a long operating history; Yahoo documents correction/dispute handling. | Authoritative minute worker, provider dedupe, idempotent upserts, custom scoring, D/ST, sticky finals, correction propagation architecture. PR #178 fixed a real production failure. | **Yahoo still better** | Prove full Thursday–Monday operation, postponements, midnight boundaries, and late corrections during the 2026 season. |
| 3 | Reliability | Large-scale, multi-season operating history and dedicated support paths. | Full hardening suite plus rollback-only production smoke; scoring, draft recovery, and transaction fixes deployed. | **Yahoo still better** | Ball Knower has strong controls but insufficient longitudinal production evidence and no completed physical-device matrix. |
| 4 | Draft room | Live/autopick draft types, pre-ranks, queue, search/filtering, established multi-device experience. | Live snake, autopick, search, position filter, queue, favorites, Do Not Draft, roster overview, reconnect state, CPU picks. | **Yahoo still better** | No live pick grades, tier filters, player compare, position-run alerts, or projected availability UI yet. |
| 5 | Draft intelligence | Fantasy Plus advertises Draft Scout recommendations, league-tailored draft tools, rankings, tiers, and analysis. | Projection/rank/ADP display and all-team post-draft reports with construction/value explanations. | **Yahoo still better** | Ball Knower advice is mainly post-draft; it needs live, league-relative recommendations and value grades per pick. |
| 6 | Mock drafting | Live mock rooms against managers plus current draft ecosystem. | Safe private league-specific deterministic full mock that cannot mutate real state. | **Yahoo still better** | Mock is not interactive and lacks fast mode, simulate-to-next-pick, strategy comparison, and learned manager tendencies. |
| 7 | Pre-draft preparation | Pre-draft rankings plus premium draft kits, expert tiers, and current analysis. | Persistent queue, favorites, Do Not Draft, and pre-rank preferences in the live-draft backend. | **Yahoo still better** | Needs draggable personal rankings/tiers, sleepers, notes, strategy, acceptable reaches, and import/export. |
| 8 | Player research | Integrated player news, rankings, research assistant, advanced/premium analysis. | Projection rankings, weekly projection context, schedules, game logs, D/ST rankings, contextual player cards. | **Yahoo still better** | Usage, opportunity, weather, news, floor/ceiling, boom/bust, ROS, and playoff-strength data are not comprehensively sourced. |
| 9 | Player detail pages | Deep current player news, matchup context, stats, research, and broad mobile maturity. | Shared detail route with headshot, overview, 2025/2026 logs, position-specific stat rows, projection and schedule. | **Yahoo still better** | Live injury/news, trend chart, rank movement, sourced usage, ROS value, and complete playoff outlook remain incomplete. |
| 10 | Lineup management | Mature roster editing plus premium lineup optimization. | Starter/bench separation, weekly projections, locked-player protection, Optimize Lineup, validation, sticky Save Changes. | **Parity** | Ball Knower should add reviewed change sets and reasons before claiming superiority. |
| 11 | Start/sit assistance | Fantasy Plus markets lineup optimization and Research Assistant recommendations. | Projection-aware optimizer and matchup/player context. | **Yahoo still better** | No dedicated WHY flow with projected gain, floor, ceiling, usage, weather, risk, and confidence. |
| 12 | Weekly matchups | Live matchup score/projection experience with swipeable mobile matchups. | Score, projected totals, live/scheduled/final states, opponent browsing, week persistence, playoff matchups. | **Parity** | Ball Knower lacks the requested leverage/swing/timeline explanations. |
| 13 | Live matchup intelligence | Real-time scores and live projections in the mobile product. | Authoritative player rows with live/completed status and projections. | **Yahoo still better** | No HOW DO I WIN, WHY AM I LOSING, remaining-player leverage, probabilistic thresholds, or win-path narrative. |
| 14 | Free agency | Mature player pool, search/filter, add/drop and ownership workflows. | Full Add Players redesign, search, rank/weekly sorts, standard-position and D/ST handling, custom drop sheet, instant/waiver modes. | **Parity** | Add trend/ownership/watch intelligence and prove concurrency under real traffic. |
| 15 | Waivers | Priority and FAAB workflows with mature weekly operation. | Atomic server worker, advisory locking, rolling/continuous modes, conditional fallback groups, ownership checks, idempotent receipts. | **Ball Knower better** | Workflow depth is ahead, but a 2026 live waiver cycle is still required to prove the reliability claim. |
| 16 | FAAB | FAAB bidding and result workflows. | Server-authorized budgets, atomic award/debit, conditional claims, commissioner priority tools. | **Parity** | FAAB advisor, competitive bid range, and market simulation are not shipped. |
| 17 | Trades | Proposals, review/veto, and established league workflows. | Opponent roster → Trade For, unequal 1–3 player packages, roster cuts, counters, private threads, CPU decisions, commissioner/league-vote review, deadline and lock enforcement. | **Ball Knower better** | Intelligence around the deal remains behind even though the transaction workflow is deeper. |
| 18 | Trade research | Fantasy Plus markets trade analysis and player research. | A basic analyzer and fantasy-value helpers exist; legal-package validation is strong. | **Yahoo still better** | The normal fantasy analyzer still needs ROS points, weekly starter delta, depth, schedule, injury risk, replacements, partner matching, and suggested offers. |
| 19 | Commissioner tools | Mature commissioner console, roster/scoring/draft/keeper management and support documentation. | Advanced settings, schedule editor, waiver priority, trade review/vote, offline import, season finalize/reset, visible override audit. | **Yahoo still better** | No safely unified co-commissioner model; customization breadth and operational polish remain lower. |
| 20 | League customization | Broad roster, scoring, draft, keeper, schedule and playoff configuration. | 6–16 teams, draft types, scoring modes, waiver/trade options, schedule/playoff settings, constrained roster depth. | **Yahoo still better** | Superflex, optional IDP, keepers, median results, doubleheaders, rivalry weeks, and richer roster controls are absent. |
| 21 | Scoring customization | Multiple scoring types and broad stat-category controls. | Standard/half-PPR/PPR plus custom passing, rushing, receiving, kicking, fumble and D/ST weights applied to live actuals. | **Yahoo still better** | UI exposes only part of the stored scoring contract; bonuses, first downs, TE premium, returns, and exhaustive live-source validation are missing. |
| 22 | Playoff customization | Mature playoff configuration and operating history. | 4/6/8 teams, byes, points/H2H/division-winner seeding, NFL Week 18 calendar guard, score-derived champion. | **Yahoo still better** | Requested 7-team field, reseeding toggle, championship-length, consolation controls, and broader scenario tests are missing. |
| 23 | League formats | Redraft, keeper and multiple draft formats. | Redraft, live snake, autopick, offline import, safe mock, and the unique Draft Order Game. Auction is explicitly gated until safe. | **Yahoo still better** | Keeper and durable dynasty architectures are not shipped; a unique format does not erase that gap. |
| 24 | Notifications | Current mobile listing advertises customizable game-start, scoring, roster-news and trade alerts. | In-app event persistence plus draft, trade, waiver, matchup and lineup generation/receipts; owner-scoped Draft/Roster/Transactions/League controls now create independent in-app and push eligibility decisions. | **Yahoo still better** | Native device-token registration, actual push delivery, deep links, and physical-device validation remain incomplete. |
| 25 | League chat/social | Established league chat inside a mature mobile ecosystem. | League chat, commissioner posts, manager DMs, trade threads, Trading Block, scoped stale-response protection. | **Parity** | Reactions, comments on feed items, polls, moderation, preference tuning, and native push remain incomplete. |
| 26 | League history | Yahoo archive exposes former teams, standings, playoffs, schedules and settings. | Season archive/reset and league records/owner reputation foundations. | **Yahoo still better** | Multi-season browsing depth, persistent rivalry moments, complete records and keeper continuity need expansion. |
| 27 | Power rankings | Basic fantasy standings/content ecosystem. | Multi-factor rankings use record, scoring, differential, roster projection, construction, explanations and movement. | **Ball Knower better** | Add recent form, injuries, opponent adjustment, schedule strength and persistent weekly snapshots to widen the lead. |
| 28 | Weekly storytelling | Yahoo provides broad editorial fantasy content but not the same league-specific universe depth. | Data-derived league headlines, upsets, streaks, trade movement, rivalry context, awards and record updates. | **Ball Knower better** | It is not yet a complete finalized-week recap with all requested headline categories and projection/playoff movement. |
| 29 | Awards | No comparable deep automatic league-specific awards system is established in the audited Yahoo surfaces. | Awards, achievements, owner reputation, All-BK concepts and championship badges. | **Ball Knower better** | Normal-fantasy awards must always use actual/projection data; Draft Order Game OVR awards must remain visibly separate. |
| 30 | Rivalry systems | No comparable persistent rivalry product is established in the audited Yahoo surfaces. | Head-to-head series, rivalry heat/labels, storyline integration and repeated-matchup tracking. | **Ball Knower better** | Add average score, largest/closest win, streaks, playoff/title meetings, trophies and notable moments. |
| 31 | Shareable content | Mature mobile sharing ecosystem and league visibility. | Privacy-sanitized spectator view/link and draft-order sharing. | **Yahoo still better** | Branded matchup/lineup/draft-grade/trade/waiver/bracket/standings cards are not shipped. |
| 32 | Mobile UX | Native apps, customizable alerts, large daily mobile usage, and years of device coverage. | Compact black/gold responsive system, safe-area CSS, sheets, sticky actions and 375/390/430 browser QA. | **Yahoo still better** | Real iPhone, Dynamic Island, keyboard, background/foreground, push, landscape and two-device verification is still manual and incomplete. |
| 33 | AI assistance | Yahoo Plus has Research Assistant and recommendation features. | No league-aware AI GM is currently shipped. Deterministic recommendation primitives exist. | **Yahoo still better** | Build the grounded AI GM only after data-source coverage and trust gates are ready. |
| 34 | CPU/AI managers | Yahoo season-long leagues are human-manager centered. | CPU drafting, clock recovery, lineup/transaction hooks, trade accept/reject logic and archetypes exist. | **Ball Knower better** | Expand waiver/FAAB/bye/playoff behavior and validate personality differences without hidden information. |
| 35 | League onboarding | Highly mature public/private create/join flows, help and installed base. | Create/join, private codes, public matchmaking, draft-order explanations and advanced settings disclosure. | **Yahoo still better** | Guided onboarding, recovery/help content, invitation polish and real-device notification setup are behind. |
| 36 | Draft recovery | Mature reconnect/autopick behavior. | Persisted authoritative clocks, worker recovery, stale/same-player race rejection, quarantine validation, member-triggered safe resume and audit history. | **Ball Knower better** | Physical multi-device and lossy-network verification remains required; do not call that part complete yet. |
| 37 | Transaction integrity | Mature production operation. | Server-authorized atomic RPCs, row/advisory locks, stale ownership rechecks, deadlines, roster guards, idempotent workers and live rollback smoke. | **Parity** | Architecture is strong; Yahoo retains the longitudinal evidence advantage until Ball Knower completes real high-concurrency weeks. |
| 38 | Data quality | Broad current news, injury, roster and scoring ecosystem. | Canonical player IDs, special D/ST handling, provider dedupe, explicit 2025/2026 history sources and identity regression tests. | **Yahoo still better** | Source registry, freshness/confidence UI, comprehensive current injuries/news/usage and live season validation are incomplete. |
| 39 | Injury/news integration | Integrated roster news and alerts in the mobile product. | League injury records and player history/news placeholders; deterministic injury simulations exist for game modes. | **Yahoo still better** | Normal fantasy needs a sourced real-NFL injury/practice/news feed with cadence, fallback and watch notifications. |
| 40 | Fantasy postseason | Mature playoff brackets and season completion. | Score-driven playoffs, byes, corrected-score inputs, champion derivation, archive and next-season reset. | **Yahoo still better** | Missing 7-team/reseeding/consolation/championship-length options and full live postseason operational proof. |
| 41 | Long-term league retention | Keepers, archive, recurring leagues, content and large network effects. | Draft Order Game, CPU managers, owner reputation, power rankings, stories, awards, rivalries, records and wider football universe. | **Yahoo still better** | Keeper/dynasty continuity, richer multi-season history, social feed and notification delivery are necessary to convert differentiation into proven retention. |

## Intentionally different product decisions

| Yahoo pattern or market convention | Ball Knower decision | Reason |
|---|---|---|
| Random/commissioner order as the normal ceiling | Keep Game, Random, and Commissioner; make Draft Order Game a first-class option. | Competition for draft position is a Ball Knower differentiator. Its 20-player/full-football roster and salary rules must never leak into normal fantasy. |
| Expose every advanced format during ordinary setup | Keep normal leagues focused on QB/RB/WR/TE/FLEX/K/DST; gate IDP/dynasty/auction until each has a safe dedicated architecture. | Complexity without reliable lifecycle support is not parity. |
| Installed-network scale as a superiority claim | Mark raw installed-user/network size **not relevant** to the controllable product score. | Ball Knower should optimize per-user engagement and league quality, not pretend to match Yahoo's distribution instantly. |

## Production trust evidence completed in this program

- PR [#178](https://github.com/kmdbb9zg5k-png/newest-ball-knower/pull/178): removed null generated lineup IDs from bulk PostgREST upserts, deduplicated provider snapshots, and kept finals sticky while allowing later stat corrections.
- PR [#179](https://github.com/kmdbb9zg5k-png/newest-ball-knower/pull/179): added authenticated, idempotent, structurally validated recovery for quarantined live drafts with a visible league audit event.
- PR [#180](https://github.com/kmdbb9zg5k-png/newest-ball-knower/pull/180): removed unnecessary anonymous access to private league tables and made commissioner waiver, schedule, offline-draft, approval and veto actions auditable.
- Full local hardening, TypeScript, build, migration syntax, and rollback-only production fantasy smoke passed after each relevant change.
- The live smoke covers a 10-team/150-pick draft, draft recovery retry, lineup save, injury idempotency, commissioner-reviewed atomic trade, continuous waiver award, score finalization/notification idempotency, playoffs, archive, reset, and rollback.

## Unresolved Phase A release risks

1. Physical iPhone/Dynamic Island/push/background/two-device testing is not complete and cannot be closed by browser emulation.
2. The 2026 NFL season has not yet provided a full real Thursday–Monday scoring/correction cycle for longitudinal proof.
3. Fifteen legacy pre-standard-roster leagues retain overlapping 20-player Draft Order Game/build rosters. That overlap is valid outside normal fantasy ownership: the current audit found zero duplicate player pairs in completed live-draft rosters and zero duplicate picks in active ledgers. Do not destructively “dedupe” the football-game rosters.
4. Eight legacy active draft rooms remain quarantined until a member opens one and the new recovery validator approves its ledger. This is deliberate; they should not be blindly advanced.
5. Native push transport still requires app-shell device-token registration, deep links, provider delivery receipts, and physical delivery verification. Category preferences and independent delivery flags are ready but are not delivery proof.
6. The primary production JavaScript bundle remains about 1.53 MB minified; route-level code splitting is a performance follow-up.

## Next execution order

1. Finish Phase A with real-device testing, native notification transport, direct authorization integration tests, and production monitoring through live NFL traffic.
2. Build source-owned injury/news/usage/weather data contracts before exposing advanced recommendations.
3. Ship start/sit explanations, matchup win paths, playoff simulations, FAAB guidance and trade impact from those reliable inputs.
4. Upgrade the live draft with pick grades, runs, advisor, tiers/compare, and availability probability; then deepen personalized mocks and the pre-draft kit.
5. Close commissioner gaps: richer scoring/rosters/playoffs, keepers, median/doubleheaders, and only then isolated advanced formats.
6. Expand stories, records, rivalries, feed/reactions/polls and branded privacy-safe share cards.
7. Build the grounded league-aware AI GM after the underlying facts, freshness labels, and action authorization are trustworthy.
