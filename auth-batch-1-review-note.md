# Batch 1 auth review scope

This branch is intentionally limited to authentication/identity behavior.

- Guest sessions use a real Supabase anonymous user UUID.
- Email upgrade uses Supabase `updateUser()` so a guest can preserve that UUID after manual linking is enabled.
- Google and Apple remain disabled until provider credentials are configured.
- The visible account profile is synchronized from the active Supabase auth user.
- Sign out calls Supabase Auth and then starts a fresh guest session.
- No database RLS, league rules, Solo Mode, navigation destinations, soundtrack, intro, team themes, News, Fantasy, Sportsbook, Hall of Fame, Draft, or Simulation logic is intentionally changed.
