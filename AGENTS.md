# Ball Knower — Codex QA / Engineering Rules

This repository powers Ball Knower. Treat the current product behavior as intentional unless a task explicitly asks for a redesign.

## Primary role
Act as a second engineer and QA reviewer. Find regressions, broken flows, stale data, mobile issues, and risky code before they reach production. Prefer small, targeted fixes over broad rewrites.

## GitHub-visible handoff is required
Every Codex task for this repository must leave its result in GitHub so the owner and other maintainers can inspect it without copying output from the Codex task UI.

For tasks that change code:
- Work on a dedicated branch, never directly on `main` unless the task explicitly says otherwise.
- Push the branch to `kmdbb9zg5k-png/newest-ball-knower`.
- Open a pull request against `main` before considering the task complete.
- Put the task summary, files changed, tests/build results, remaining risks, and any manual steps in the PR body or a PR comment.
- If an existing PR already owns the task, update that PR branch and leave a PR comment summarizing the new work instead of opening a duplicate PR.

For audit/review tasks with no code changes:
- Leave the findings in a GitHub-visible location tied to the repository, preferably a comment on the relevant pull request or issue.
- If there is no relevant PR/issue and GitHub write access is available, create a focused GitHub issue containing the findings.

Do not treat a commit that exists only inside a temporary Codex checkout as a completed handoff. A local-only branch, local-only commit SHA, or Codex-only final message is not sufficient.

If GitHub push/PR/comment creation is blocked by missing credentials or environment limitations, state `GITHUB HANDOFF BLOCKED` clearly in the final task result and explain exactly what failed. Do not imply that the work is visible in GitHub when it is not.

## Do not remove or silently replace existing features
Preserve all currently supported destinations and flows, including:
- Overview / Home
- Solo Mode / Road to the Super Bowl
- NFL News
- Fantasy
- Sportsbook
- Hall of Fame
- League Lobby
- Draft Board
- Simulation / Results
- Intro video
- Favorite-team setup and all 32 NFL team themes
- Soundtrack controls and real uploaded soundtrack files
- Authentication / account controls

If a feature appears broken, fix it. Do not delete it as a shortcut.

## Mobile-first regression checks
The owner frequently tests on iPhone and Chromebook. Every UI change must be checked for small-screen behavior.

Verify:
- No important tab or button disappears on mobile.
- Horizontal navigation remains usable and scrollable.
- Safe-area padding is respected on iPhone.
- Use dynamic viewport units where appropriate (`100dvh` rather than relying only on `100vh`).
- Modals, dropdowns, draft lists, and team selection remain reachable without a mouse.
- Avoid layouts that require hover.
- Touch targets should be practical on phones.

## Favorite-team rules
- Support all 32 NFL teams.
- Preserve the cinematic team selector.
- Keep multiple neighboring teams visible in the selector; do not regress it into a flat single-logo picker.
- Selected-team branding may carry through the rest of the app via logo/colors/background treatment.
- Do not hard-code behavior for only one team.

## Intro and soundtrack rules
- Intended sequence for first-time/team-setup flow: intro video -> favorite-team setup -> main app.
- Do not add a mandatory manual "Play Intro" gate.
- On iOS, autoplay restrictions must fail through gracefully rather than trapping the user.
- Music should not play underneath the intro or favorite-team setup unless explicitly requested.
- Use the real soundtrack returned by the media API; do not replace uploaded songs with generated placeholder synth tracks.
- Track auto-advance must work after the Blob playlist loads.
- Do not re-add tracks intentionally excluded from rotation.
- Clean display titles: do not expose filename junk such as `(1)`, `(2)`, `remastered`, version suffixes, or file extensions.

## NFL data quality
Do not assume old roster/team/salary data is acceptable. The product is intended to reflect the current 2026 NFL season.

When modifying player data or logic:
- Watch for retired players or players on outdated teams.
- Preserve complete 32-team coverage.
- Do not silently label data as verified unless the underlying data actually supports that claim.
- Keep salary-cap logic internally consistent.

## Solo Mode checks
Always regression-test Solo Mode after changes that touch shared player data, roster rules, simulation, storage, navigation, or context providers.

Check:
- Player add/remove behavior updates immediately.
- Draft filters do not show already-selected starters or bench players.
- Salary-cap enforcement works.
- Legal roster requirements are enforced.
- 17 regular-season games work.
- Playoff progression and Super Bowl flow work.
- Saved/restored runs do not crash.
- New Run resets state cleanly.

## League / draft checks
Verify:
- Create League opens and completes.
- Join League works with a valid code.
- League navigation survives refresh/state changes.
- Lobby member counts and status are coherent.
- Draft Board loads and roster count updates.
- Salary cap cannot be exceeded.
- Submission/results navigation does not strand the user.

## News / Fantasy / Sportsbook
These are intentional product destinations. Do not remove them because an API is unavailable or a response fails. Provide graceful empty/error states instead.

## Change discipline
Before editing:
1. Identify the root cause.
2. Check whether the same component/state is reused elsewhere.
3. Prefer the smallest safe change.

After editing:
1. Run the available build/type checks.
2. Review the diff for accidental feature removal.
3. Specifically re-check mobile navigation and shared app state.
4. Report what changed, what was tested, and any remaining uncertainty.

## Production claims
Never claim a fix is live solely because code was written. A production claim requires a successful deployment/build status and, when practical, a verification of the affected route/behavior.

## Review behavior
When the task is an audit/review, report findings first with severity and affected files. Do not make large product changes unless explicitly asked. For obvious, low-risk bugs, propose the smallest patch.

## Product direction
Ball Knower should feel polished, cinematic, football-focused, and simple to use. Preserve existing working functionality while improving reliability. Avoid unnecessary rewrites or generic template styling.
