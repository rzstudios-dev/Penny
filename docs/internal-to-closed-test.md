# Penny: internal test to closed beta

This is the release gate for `app.penny.expenses`. Internal testing is a small, private Play track. The beta for this launch is **closed testing**; open testing is available only after Play grants production access to this developer account.

## Start the internal test

Google permits internal testing before the full app setup is complete. The signed version 1 bundle is already saved as an internal release **draft**. Back up the Android upload key, add trusted Android users on the Internal testing Testers tab, preview and roll out the draft, then share its Play opt-in link. Start with local-first flows even if live sign-in or billing is still being configured. The internal track does not count toward the 14-day closed-test requirement.

## Complete for full internal sign-in and billing tests

- Verify Supabase custom SMTP delivers both new-user and returning-user codes. Confirm the Google provider, new-user signup setting, and Google OAuth audience. Add internal test Google accounts as OAuth test users while the consent screen is in Testing.
- Finish the Google Payments merchant account, then create and activate `penny_premium` with a paid monthly base plan at the intended US$5 price and **no trial or introductory offer**. Configure the Android Publisher API service account only in Supabase Edge Function secrets. Never put it in the app bundle or Git.
- Add a Play **license tester** before testing the subscription so Google offers test payment methods. Internal testers who are not license testers can be charged for in-app purchases.

## Internal test: install from Play

Have testers install through the Play opt-in link. Record the installed version and Android version for every result. Do not use a sideloaded build to sign off Play Billing.

Must-pass checks on the Play-installed app:

1. Fresh install: complete or skip onboarding, create the first wallet, and confirm only its Food & Drinks envelope exists. Create another wallet and confirm it starts without envelopes.
2. Signed out: add income and expenses, close and reopen the app, and confirm the ledger remains local. Cloud sync must remain off by default.
3. New Google user: use a Google account that has never used Penny. Confirm it signs in, creates its Penny account automatically, returns to the app rather than localhost, and leaves local data in place. Repeat from a cold app start. Sign out and sign back in.
4. New and returning email users: request and verify a code, check delivery and resend, and confirm the Android callback returns to Penny. Try an invalid or expired code.
5. Cloud sync: explicitly opt in, sync between two devices, test an offline edit and reconnection, turn sync off, and check account switching and deletion. No ledger should upload merely because a user signed in.
6. Premium: confirm the free category and wallet limits; purchase the paid monthly plan with a license tester; verify advanced reports and unlimited items; restore after reinstall; test cancellation, expiry/refund and a different signed-in account. A pending or failed purchase must not unlock Premium. Check the displayed price and renewal terms before the purchase sheet.
7. Money flows: test budgets crossing zero, scheduled monthly and yearly income, category/wallet currency, decimal and date settings, CSV/Excel import, and CSV backup with real device files.
8. Device behavior: test notifications and their opt-out controls, a small and large Android screen, large text, TalkBack labels, offline startup, and background/foreground return. Check for crashes and blocked buttons.
9. Account deletion: verify the in-app flow removes Penny cloud data and entitlement, signs out, and does not erase data belonging to the other app in the shared Supabase project. Confirm the public deletion page works.

Fix any release-blocking result and upload a new bundle with a higher version code. Re-test the changed flow and its neighbors before closed testing.

## Closed beta and production gate

Complete Play's app setup, including reviewer sign-in, content rating, target audience and Data safety declarations. Upload the refreshed store images. Create a Closed testing track and add at least 12 reachable testers. Testers moving from Internal must opt out of that track before joining Closed. Each must opt in to Closed and remain opted in continuously for at least 14 days. Collect feedback and resolve significant defects during the period. Internal testing alone does **not** satisfy this production-access requirement. After the closed test, apply for production access in Play Console and answer its testing and readiness questions. Google may require more testing. Only after approval should the final build, listing, country availability, pricing, legal pages and declarations be reviewed for production rollout.

For worldwide launch, obtain a region-by-region privacy, consumer and tax review before enabling every country. A passing test suite does not establish legal compliance everywhere.

Official references: [Play testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465), [testing tracks](https://support.google.com/googleplay/android-developer/answer/9845334), [release rollout](https://support.google.com/googleplay/android-developer/answer/9859348), [Play Billing testing](https://developer.android.com/google/play/billing/test).
