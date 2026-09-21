# Atlas Support Billing

React/Vite + Supabase billing app for Atlas Support.

## Current features

- Email/password sign in with Supabase Auth
- Pending new-user approval and team role management
- Customer management
- Quotes and invoices with free-form line items
- Accepted quotes can be converted into linked draft invoices
- Master billing that consolidates unpaid invoices into a new master invoice
- Automatic document numbering and totals in Supabase
- Printable/PDF quote and invoice layout
- Dashboard recent documents open with a click
- Google Workspace email delivery for invoices and quotes
- Editable invoice and quote email templates in Company Settings
- PDF attachment on outgoing invoice/quote email
- Optional CC-to-self default
- Email send history on each document
- Successful sends automatically change Draft documents to Sent
- Resend support from the same Email button

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

## Google Workspace email setup

The app sends through the Gmail API using the Google Workspace mailbox connected from **Settings → Google Workspace email**.

The Supabase Edge Function `google-workspace-email` requires these Supabase Function secrets:

```text
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_REDIRECT_URI=https://billing.atlassupport.tech/
```

In Google Cloud:

1. Enable the **Gmail API**.
2. Configure the Google Auth consent screen. For an Atlas Support-only app, an **Internal** audience is appropriate if available for your Workspace organization.
3. Create an **OAuth 2.0 Client ID** of type **Web application**.
4. Add this Authorized redirect URI exactly:

```text
https://billing.atlassupport.tech/
```

5. Add the Client ID and Client Secret to Supabase Edge Function secrets.
6. Open the billing app, go to **Settings**, and click **Connect Google Workspace**.
7. Sign in to the Workspace mailbox you want documents sent from and approve Gmail send access.

The refresh token is stored encrypted with Supabase Vault. The browser never receives the Google client secret or refresh token.

## Email template fields

These placeholders can be used in invoice and quote subject/body templates:

- `{business_name}`
- `{customer_name}`
- `{contact_name}`
- `{document_number}`
- `{document_type}`
- `{total}`
- `{issue_date}`
- `{due_date}`
- `{valid_until}`

Templates only prefill the compose window; the message can still be edited before sending.

## Deploying updates

Commit and push changes to the connected GitHub repository. Vercel will automatically build and deploy the `main` branch.

## Master billing workflow

For customers billed on demand, create normal invoices as work is completed. When you are ready to send one combined bill, open the customer and choose **Create Master Bill**. The app creates a new invoice containing one line for each unpaid invoice, using the exact final amount from that invoice. The original unpaid invoice records are then deleted. A full JSON snapshot of their metadata and line items is stored on the master invoice in `consolidated_sources` for traceability. Paid and void invoices are never included.
