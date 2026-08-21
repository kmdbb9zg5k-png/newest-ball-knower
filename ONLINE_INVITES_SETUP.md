# Ball Knower — Turn On Real Online Invites

The code is now cloud-ready. Cross-device invite codes become active once one Supabase project is connected.

## One-time setup
1. Create/open a Supabase project.
2. In Supabase SQL Editor, run `supabase/ball_knower.sql`.
3. In Supabase Authentication settings, enable **Anonymous Sign-Ins**.
4. Copy your Supabase Project URL and publishable key.
5. Add these environment variables to the deployment:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
6. Redeploy/rebuild the app.

Use `.env.example` as the template. Do NOT put a Supabase service-role key in the browser app.

## What works after configuration
- Create a league on Device A.
- Copy `BK-XXXXXX` or the `?join=` invite link.
- Open it on Device B.
- Device B finds the same league from the cloud and joins it.
- New members appear in open lobbies through Supabase Realtime.
- Submitted rosters sync to the shared league.
- Commissioner cap changes, AI fills, member removals, and season results sync.

## Identity
The build automatically creates a Supabase anonymous authenticated session for guests. That gives every device/user a unique secure backend identity without forcing registration. Real Google/Apple authentication can be connected later without replacing the league tables.

## Offline fallback
The official Ball Knower build includes its public project URL and publishable key as a safe fallback, so Vercel remains connected even if its Vite variables are missing. Environment variables override those defaults for forks and staging projects. Authorization still comes from Supabase Auth and row-level security; no service-role credential belongs in the browser bundle.
