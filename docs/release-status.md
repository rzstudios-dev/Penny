# Penny release status — 12 November 2026

Penny is **not ready for a public Play rollout yet**. Its local build and Penny-only backend are prepared; the live sign-in, purchase, store and legal checks below remain.

## Verified

- 62 unit and database tests pass. The browser suite has 22 passing flows after updating two stale assertions. The web build and Android sync pass.
- Android targets API 36 and builds a signed release App Bundle at `android/app/build/outputs/bundle/release/app-release.aab`. The upload key and signing settings are local and ignored by Git. Back them up securely before the first upload.
- The package ID `app.penny.expenses` was reported available by Play Console. The app creation form is filled as a free app named Penny.
- Four `penny_` database migrations and four `penny-` Edge Functions are live in project `vcfalijtdakuyyfbdghy`. Penny tables have row-level security. Deleting a Penny account cascades to Penny data without deleting a shared Supabase Auth identity or other app data.
- The public privacy, terms and deletion URLs exist. Updated privacy and deletion text is prepared in Google Sites but must be published after publisher review.

## Must finish before public release

1. **Play app creation:** The publisher must review and accept the Play App Signing terms and export compliance declaration on the prepared Chrome tab. Those are legal certifications. Complete the app creation and preserve package ID `app.penny.expenses`.
2. **Authentication:** Sign in to the Supabase Dashboard. Configure and test custom SMTP and both OTP templates, Google OAuth, allowed redirect URLs, and new-user signup. Test email and Google login on a Play-installed Android build.
3. **Billing:** Create `penny_premium` with a paid monthly auto-renewing base plan, no trial, and the intended regional prices. Set a server-only Google Play service account with the minimum permissions needed for verification, and configure Edge Function secrets. Test purchase, cancellation, expiry, restore and account switch through a Play test track.
4. **Store forms:** Complete store description, category, contact, icon/feature graphic/screenshots, target audience, content rating, ads, Data safety, account deletion, financial features and government/other required declarations. Match each answer to the final app and provider configuration. Use the published privacy and deletion URLs.
5. **Live data flows:** Test sync opt-in and off, two-device conflicts, account deletion, exports/imports, notifications, subscription and local persistence on real Android devices. Confirm Google Sites text is public and consistent with the final build.
6. **Testing gate:** This is a personal Play developer account with no app yet. If it was created after 13 November 2023, Google requires 12 opted-in closed testers for 14 continuous days before production access. Follow the actual Console gate.
7. **Worldwide launch:** Review privacy, consumer, subscription, tax, marketing and cross-border data obligations for every country offered. Google Play policies and this repository cannot certify worldwide legal compliance. Restrict availability where requirements cannot yet be met.

Keep the upload key and password backed up outside this public repository. Rotate the database and Gmail credentials shared during development before launch. Do not paste their replacements into source, chat, or `VITE_` variables.

Sources: [target API](https://support.google.com/googleplay/android-developer/answer/11926878), [subscriptions and financial features](https://support.google.com/googleplay/android-developer/answer/18265346), [account deletion](https://support.google.com/googleplay/android-developer/answer/13327111), [personal-account testing](https://support.google.com/googleplay/android-developer/answer/14151465).
