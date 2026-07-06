# Tom's Garage v2.0.6 — Phase 6 Service Requests + Uploads

## Step 1 — Run SQL first

Before uploading the website files, go to Supabase SQL Editor and run:

- supabase-phase-6-service-requests.sql

This creates:
- service_requests table
- private service-media storage bucket
- storage policies for customer uploads
- admin access to view uploaded media
- signed media links in the portal/admin

## Step 2 — Upload files to GitHub

Upload/replace these files in your GitHub repo root:

- members.html
- member-backend.js
- admin.html
- admin-backend.js
- supabase-phase-6-service-requests.sql
- PHASE-6-SERVICE-REQUESTS-UPLOADS.md

Do NOT replace supabase-config.js.

## What changed

Customer portal:
- logged-in service request form
- vehicle selector
- request type
- urgency
- details
- photo/video uploads
- submitted requests table
- signed media links
- vehicle/invoice/repair history remains intact

Admin dashboard:
- service request dashboard
- customer name display
- vehicle display
- media links
- request status dropdown
- status updates save to Supabase
- existing invoice, repair, vehicle, and credit workflows remain

## Test flow

1. Run SQL.
2. Upload files.
3. Wait for Vercel.
4. Open members.html as a customer.
5. Submit a request with one photo.
6. Open admin.html as owner.
7. Confirm the request shows.
8. Click the uploaded media link.
9. Change request status to Reviewing or Scheduled.
10. Refresh customer portal and confirm status changed.

## Upload limits

The SQL sets service media upload limit to 100MB per file and allows:
- JPG
- PNG
- WEBP
- GIF
- MP4
- MOV / QuickTime
- WEBM
