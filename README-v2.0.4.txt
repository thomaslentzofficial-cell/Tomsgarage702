Tom's Garage v2.0.4 — Xero / Stripe / Payments Foundation

Upload/replace these files in your GitHub repo root:

- admin.html
- admin-backend.js
- members.html
- member-backend.js
- payments.html
- PHASE-4-XERO-STRIPE-PAYMENTS.md

Do NOT replace supabase-config.js.

What changed:
- Fixed Job History Supabase relationship error
- Fixed Payment Records Supabase relationship error
- Added Xero-first payment link wording
- Added manual invoice payment link workflow
- Added Payments page
- Prepped structure for Stripe / Apple Pay / Tap to Pay through Xero
- Keeps PayPal as optional backup link

Morning test:
1. Wait for Vercel deploy.
2. Open admin.html.
3. Confirm Job History no longer shows the relationship error.
4. Add a test invoice with a fake payment link.
5. Open members.html.
6. Confirm invoice shows in the customer portal.
