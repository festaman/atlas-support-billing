# Atlas Support Billing

React/Vite + Supabase billing app for Atlas Support.

## Current features

- Email/password sign in with Supabase Auth
- Customer management
- Billing frequencies: Immediate, Weekly, Monthly, On demand
- Quotes and invoices with free-form line items
- Accepted quotes can be converted into linked draft invoices
- Master Billing queue for labor/material/other charges
- Bill Now creates one draft invoice from all currently unbilled work for a customer
- Automatic document numbering and totals in Supabase
- Printable/PDF quote and invoice layout
- Business settings

## Local development

```bash
npm install
npm run dev
```

## Environment variables

Create a local `.env` file containing:

```text
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

`.env` is ignored by Git and should not be committed.

## Deploying updates

Commit and push changes to the connected GitHub repository. Vercel will automatically build and deploy the `main` branch.


## Master billing workflow

For customers billed on demand, create normal invoices as work is completed. When you are ready to send one combined bill, open the customer and choose **Create Master Bill**. The app creates a new invoice containing one line for each unpaid invoice, using the exact final amount from that invoice. The original unpaid invoice records are then deleted. A full JSON snapshot of their metadata and line items is stored on the master invoice in `consolidated_sources` for traceability. Paid and void invoices are never included.


## Pending new-user access
Newly registered users are automatically assigned the `new_user` role on first authenticated app load. They see an approval message and cannot access business data until an Owner or Admin assigns an active role from the Team page.

- Pending team additions by email: admins can add a user before signup; the selected role is applied on first login.
- Team removal: removes app access immediately while preserving the authentication account for possible re-approval later.
