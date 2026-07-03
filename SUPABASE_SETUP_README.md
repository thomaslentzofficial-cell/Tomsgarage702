# Tom's Garage v2.0 Backend Starter

This package connects the Garage Member Portal and Admin Dashboard to Supabase.

## Upload these files to GitHub

Upload/replace these in the root of your GitHub repo:

- members.html
- admin.html
- member-backend.js
- admin-backend.js
- supabase-config.js
- supabase-schema.sql
- SUPABASE_SETUP_README.md

Keep all your existing images and pages.

## Step 1 — Create Supabase project

1. Go to Supabase.
2. Create a new project.
3. Open Project Settings → API.
4. Copy:
   - Project URL
   - anon/public key

## Step 2 — Add database schema

1. In Supabase, open SQL Editor.
2. Open `supabase-schema.sql`.
3. Paste the full SQL into Supabase.
4. Run it.

This creates:
- profiles
- vehicles
- repair_records
- invoices
- referrals
- credit_ledger
- role policies
- account creation trigger

## Step 3 — Edit config

Open `supabase-config.js` and replace:

```js
export const SUPABASE_URL = "PASTE_YOUR_SUPABASE_PROJECT_URL_HERE";
export const SUPABASE_ANON_KEY = "PASTE_YOUR_SUPABASE_ANON_PUBLIC_KEY_HERE";
```

with your actual Supabase values.

Then commit the file.

## Step 4 — Create your owner account

1. Go to:
   https://tomsgarage702.com/members.html

2. Create an account using:
   tomsgarage702@gmail.com

3. If Supabase sends a confirmation email, confirm it.

## Step 5 — Promote yourself to owner

After your account exists, go back to Supabase SQL Editor and run:

```sql
update public.profiles
set role = 'owner', full_name = 'Thomas Lentz', phone = '725-252-9073'
where email = 'tomsgarage702@gmail.com';
```

## Step 6 — Test

Test these pages:

- https://tomsgarage702.com/members.html
- https://tomsgarage702.com/admin.html

## Important security note

The anon/public key is safe to use in the browser when Row Level Security is enabled. The SQL in this package enables RLS and adds policies so:
- customers can only see their own vehicles, repairs, invoices, and credits
- admin/owner accounts can manage records
- only owner/admin can update profiles/roles

Never put your Supabase service-role key into the browser.

## Next phase

Phase 4:
- PayPal checkout
- invoice payment buttons
- payment status updates
- deposits and balances
