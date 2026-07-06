# Tom's Garage v2.0.5 — Portal Polish

Upload/replace these files in your GitHub repo root:

- members.html
- member-backend.js
- admin.html
- admin-backend.js
- PHASE-5-PORTAL-POLISH.md

Do NOT replace supabase-config.js.

## What changed

Member portal:
- Admin button is hidden from normal customers
- Admin button shows only for owner/admin/tech roles
- Added Book Another Service button
- Added better invoice badges
- Added cleaner repair history notes
- Added photo/video upload placeholder
- Kept Xero payment links working

Admin dashboard:
- Added Invite Customer workflow
- Added Add Vehicle workflow
- Added vehicle selector for repair records
- Added Add Repair workflow
- Added Add Xero Invoice / payment link workflow
- Added Add Referral Credit workflow
- Added customer vehicles table

## Test

1. Deploy to Vercel.
2. Sign into members.html as a normal customer and confirm Admin is hidden.
3. Sign into admin.html as owner.
4. Add a vehicle for your customer.
5. Add a repair and select that vehicle.
6. Add a Xero invoice link.
7. Check members.html and confirm the customer sees the vehicle, repair, and invoice.
