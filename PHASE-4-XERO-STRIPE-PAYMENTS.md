# Tom's Garage Phase 4 — Xero / Stripe / Apple Pay / Tap to Pay Setup

This phase keeps your accounting clean.

## Recommended setup

Use:

- Xero = official invoices, accounting, taxes, payment records
- Stripe through Xero = cards, Apple Pay, Tap to Pay setup
- Website portal = customer dashboard and payment hub
- PayPal = optional backup link

## Workflow for now

1. Create invoice in Xero.
2. Send it to the customer through Xero as normal.
3. Copy the Xero invoice/payment link.
4. Go to Tom's Garage admin dashboard.
5. Add an invoice for the Garage Member.
6. Paste the Xero invoice/payment link into the Payment Link field.
7. Customer sees it in the Garage Member Portal and can click Pay Now.

## Why this is better

This keeps:
- customer portal experience on your website
- accounting records in Xero
- card/Apple Pay/Tap to Pay handled through Stripe/Xero
- PayPal available as an optional backup

## What this patch fixes

- Job History error:
  "Could not embed because more than one relationship was found for repair_records and profiles"

- Payment Records error:
  "Could not embed because more than one relationship was found for invoices and profiles"

The fix loads customers separately instead of asking Supabase to guess which profile relationship to use.

## Upload files

Upload/replace these in GitHub root:

- admin.html
- admin-backend.js
- members.html
- member-backend.js
- payments.html
- PHASE-4-XERO-STRIPE-PAYMENTS.md

Do NOT replace supabase-config.js.
