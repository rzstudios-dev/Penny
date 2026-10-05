# Penny

<!-- impeccable:product-schema 1 -->

## Platform
web

Android app through Capacitor, with a responsive browser app of the same product.

## Users and purpose
People recording personal expenses and income, tracking envelope budgets and reviewing their money habits. The user confirmed the name Penny and wants a simple, cute, warm professional experience.

## Capabilities
First-wallet onboarding; per-wallet currencies; expenses and extra income; daily and monthly recurring income; envelope budgets with scheduled/manual resets; reports; CSV/Excel import; CSV/full backup; format preferences; optional Google/email login; opt-in cloud sync; configurable Android reminders and optional once-per-period tips. Description is required and reusable. Calculator defaults to off.

Free includes one wallet, 10 envelopes, 16 icons, basic reports, budgets, import/export and reminders. Premium includes unlimited wallets/envelopes, all 40 icons, six-month trends, savings rates, custom report dates, weekday spending patterns and largest expenses. US$5/month target through Google Play, no trial, sign-in before purchase or restore. A private server-side promotional code can grant lifetime Premium to a signed-in account; it never uploads financial records or enables sync.

## Non-negotiable constraints

Never connect to the user's existing Supabase. Financial records stay local unless cloud sync is explicitly enabled; sign-in alone never uploads them. No sample ledger in the app. No Premium bottom-navigation tab. Keep the top crown. Compact Home shows envelopes, budget amounts and progress; analytics belong to Reports. The floating plus appears only on Home. Cards and inputs use warm tints, not white. Profile uses single-line links to separate settings pages.

## Evidence and remaining setup

Implementation and isolated tests are in the workspace. No real publisher identity, support email, separate Supabase credentials, Gmail SMTP configuration, Play subscription configuration or signing key has been supplied. These are owner setup items, not evidence of live production behavior. Policies require publisher details and operating-practice review before publication. Native notification delivery and billing need device/Play-track verification. No guarantee of store approval, legal compliance or revenue.

Envelope ownership is scoped to the wallet. First-wallet onboarding creates Food & drinks only; subsequent wallets have no auto-created envelopes. Existing expense history is preserved when upgrading shared legacy groups.
