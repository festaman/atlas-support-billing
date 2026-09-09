# Atlas Support Billing

A lightweight billing app connected to the Atlas Support Supabase project.

## Included
- Email/password authentication
- First-run business onboarding
- Customer management
- Quotes and invoices
- Free-form labor/material/goods line items
- Automatic totals, tax, and discounts
- Automatic quote/invoice numbering from Supabase
- Print / Save as PDF invoice layout
- Business/payment settings
- Atlas Support logo and black/white styling

## Run locally

1. Install Node.js 20+
2. Open a terminal in this folder
3. Run:
   npm install
   npm run dev
4. Open the address Vite prints (normally http://localhost:5173)

## First use
Create an account on the login screen. The first account can create the Atlas Support business record and becomes the owner through the database trigger.

## Production
Build with:
   npm run build

The `dist` folder can be deployed to Vercel, Netlify, Cloudflare Pages, or another static host.
