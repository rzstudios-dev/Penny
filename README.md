# Penny

Penny is a warm, compact expense tracker for Android and the web. It uses **wallets** for currencies and **envelopes** for spending budgets. The first wallet starts with one Food & drinks envelope; every later wallet starts empty. A bunny mascot, gentle motion and short tips keep the experience friendly without crowding the home screen.

**Local first:** income, expenses and preferences are saved on the device. Signing in does not upload financial data. The user must explicitly enable cloud sync before a ledger is sent to Supabase.

## What is included

- Wallets with their own currencies, envelope budgets and monthly progress; quick expense and income entry, saved titles, optional notes and recurring income.
- Transactions, basic reports, CSV/Excel import, CSV and full backup export, date and decimal preferences, local reminders and optional spending tips.
- Email OTP and Google sign-in. An email address is automatically registered when first verified.
- Free plan: one wallet, 10 envelopes and 16 icons. Premium: unlimited wallets and envelopes, 40 icons and advanced reports.
- Google Play monthly subscription integration, purchase verification, restore, and a server-only lifetime Premium code. No trial is configured.
- In-app privacy, terms and account-deletion screens, with [Google Sites copy](legal/) for public pages.

## Run locally

Requires Node.js, npm and (for Android) Android Studio/JDK 21.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with your **public** Supabase project URL and publishable key to enable sign-in. Never put a database password, Gmail app password, service-role key, Play service-account JSON, or lifetime code in a `VITE_` variable. Local tracking works without a cloud key.

```sh
npm test
npm run build
npm run android:sync
npm run release:check
```

The tests include an isolated in-memory PostgreSQL database for row-level security and ledger validation. They do not prove that a hosted project is configured. Browser flows can be run with `npm run test:e2e` while the development server is running.

## Backend and release

The target Supabase project is `vcfalijtdakuyyfbdghy`. Database objects are isolated with `penny_` names and a `penny_private` schema, so this project can also host other apps. SQL migrations live in [supabase/migrations](supabase/migrations); Edge Functions use `penny-` slugs. Apply these only to the intended project after checking its existing schema. Production needs the project publishable key, custom SMTP and OTP templates, Google OAuth, deployed functions, Google Play subscription and a signed Android App Bundle.

[SETUP.md](SETUP.md) has the release procedure and remaining live-service checks. The published [Privacy Policy](https://sites.google.com/view/penny-rzstudios/privacy-policy), [Terms and Conditions](https://sites.google.com/view/penny-rzstudios/terms-conditions), and [Account Deletion](https://sites.google.com/view/penny-rzstudios/account-deletion) pages are linked from the app. [Homepage copy](legal/site-homepage.md) is ready for the site's Home page.

## Security and licensing notes

All ledger tables have row-level security. Purchase tokens and code-attempt records are in `penny_private`; only trusted service code can verify or grant Premium. App data is local unless cloud sync is enabled. Build artifacts, local configuration, keystores and service-account files are ignored by Git.

The Penny mascot was generated with OpenAI image generation; its prompt is in [docs/mascot-prompt.md](docs/mascot-prompt.md). The UI uses self-hosted Nunito and DM Sans fonts and Phosphor icons.
