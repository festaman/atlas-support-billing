# Atlas Support Billing

React/Vite + Supabase billing app for Atlas Support.

## Current features

- Email/password sign in with Supabase Auth
- Customer management
- Billing frequencies: Immediate, Weekly, Monthly, On demand
- Quotes and invoices with free-form line items
- Accepted quotes can be converted into linked draft invoices
- Unbilled Work queue for labor/material/other charges
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
