# SatoshiDuell

Real-time Bitcoin quiz duels with Lightning payments, arena matches, and tournaments.

## Features

- Duels, arena mode, and tournaments
- Lightning invoices and payouts via LNbits
- Supabase-backed profiles, games, questions, and storage
- Question localization (de/en/es) by question IDs
- Tournament deadlines, history, and winner tokens
- Sharing and social flows (Nostr support)

## Tech Stack

- React + Vite
- Tailwind CSS
- Supabase (DB, Storage, Edge Functions)
- LNbits (Invoices + Withdraw links)

## Project Structure

```
satoshiduell-build/
├── src/
│   ├── components/
│   ├── hooks/
│   ├── services/
│   ├── utils/
│   ├── views/
│   ├── App.jsx
│   └── main.jsx
├── public/
├── supabase/
│   └── functions/
├── index.html
├── package.json
└── vite.config.js
```

## Requirements

- Node.js 18+
- Supabase project
- LNbits instance

## Environment Variables

Create a `.env` file in `satoshiduell-build/`.

**Client-side (Vite):**

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
VITE_LNBITS_URL=https://your-lnbits.tld
VITE_LNBITS_INVOICE_KEY=...
VITE_DONATION_LN_ADDRESS=you@lnaddress
```

**Supabase Edge Function secrets (server-side):**

```
LNBITS_URL=https://your-lnbits.tld
LNBITS_ADMIN_KEY=...
CRON_SECRET=... (only if using finalize-tournaments)
```

Notes:
- Do **not** expose `LNBITS_ADMIN_KEY` in the client.
- `LNBITS_URL` is required both client-side (invoices) and server-side (withdraw links).

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Supabase Edge Functions

This project ships with:

- `finalize-tournaments`: cron-driven tournament finalization
- `create-withdraw-link`: creates LNbits withdraw links using the admin key

Deploy (requires Supabase CLI and access token):

```bash
npx supabase functions deploy create-withdraw-link --project-ref <ref>
npx supabase functions deploy finalize-tournaments --project-ref <ref>
```

Function configuration:

- `create-withdraw-link` uses `verify_jwt = false` (public call from client)

## Vercel Deployment

No special manifest is required for Vercel.

Set the Vite env vars in Vercel and use the default build settings:

- Build command: `npm run build`
- Output directory: `dist`

If you want, you can add a `vercel.json` to lock these settings, but it is optional.

## Sounds

Place these files in `public/`:

- `click.mp3`
- `correct.mp3`
- `wrong.mp3`
- `tick.mp3`

## Troubleshooting

- QR code not loading: check Edge Function logs and secrets.
- 401 on Edge Function: ensure JWT verification is disabled and function is deployed.

## License

MIT
