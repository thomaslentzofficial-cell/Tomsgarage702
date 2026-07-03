Tom's Garage v2.0.3 Browser Script Login Fix

This version fixes silent button failures by changing from JavaScript module imports to normal browser scripts.

Upload/replace these files in GitHub root:
- members.html
- admin.html
- member-backend.js
- admin-backend.js
- supabase-config.js

IMPORTANT:
This version replaces supabase-config.js, so after uploading you must edit it again and paste:

window.TG_SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
window.TG_SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";

After Vercel redeploys:
1. Open https://tomsgarage702.com/members.html
2. Press Ctrl + F5
3. The message box should say:
   Backend script loaded. Checking Supabase config...
   Supabase config found. Ready to sign in or create account.

If you see "Backend config missing," the config file still has placeholders.
