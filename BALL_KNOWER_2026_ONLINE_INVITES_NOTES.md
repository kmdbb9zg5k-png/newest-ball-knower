# Online Invites Rebuild
- Replaced local-only invite lookup with Supabase-backed create/join.
- Invite URLs (`?join=BK-...`) now use the cloud join path.
- Added anonymous authenticated identities.
- Added normalized leagues + league-members schema.
- Added Row Level Security and capacity enforcement.
- Added realtime lobby/member refresh.
- Synced roster submission, AI fill, member removal, cap changes and season results.
- Added explicit ONLINE / LOCAL mode UI so local-only codes are never misrepresented.
