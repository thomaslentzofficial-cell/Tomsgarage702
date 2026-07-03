Tom's Garage v2.0.2 Login Fix

This patch fixes the issue where pressing Sign In refreshes the page/jumps back to the top.

Upload/replace these files in GitHub root:
- members.html
- admin.html
- member-backend.js
- admin-backend.js

Do NOT replace supabase-config.js if you already pasted your real Supabase URL/key into it.

After GitHub commits and Vercel redeploys:
1. Open https://tomsgarage702.com/members.html
2. Hard refresh the page:
   - Windows: Ctrl + F5
3. Try creating/signing into the account again.

If it still fails, the page should now show an error message instead of silently reloading.
