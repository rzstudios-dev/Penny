import Icon from "./Icon";
export default function Legal({
  page,
  onDelete,
}: {
  page: "privacy" | "terms" | "about" | "delete";
  onDelete?: () => void;
}) {
  const operator = import.meta.env.VITE_OPERATOR_NAME,
    email = import.meta.env.VITE_SUPPORT_EMAIL,
    country = import.meta.env.VITE_OPERATOR_COUNTRY;
  const pending = !operator || !email;
  return (
    <article className="legal-copy">
      {pending && (
        <div className="notice">
          <Icon name="info" />
          <p>
            Pre-release version. The publisher’s legal name and support contact
            must be completed before public distribution.
          </p>
        </div>
      )}
      <p className="muted">
        Updated 5 October 2026{operator ? ` · Operated by ${operator}` : ""}
        {country ? ` · ${country}` : ""}
      </p>
      {page === "privacy" && (
        <>
          <h3>Your privacy, with care</h3>
          <p>
            Penny helps you record personal income, spending, account names and
            budgets. We do not connect to your bank, access your contacts, track
            your location, show advertisements, or sell personal data.
          </p>
          <h3>What is stored</h3>
          <p>
            On this device, Penny stores transactions, notes, envelope and
            account names, amounts, dates, currency and preferences in the app’s
            local storage. Anyone with access to an unlocked device may be able
            to open the app. These local records are not end-to-end encrypted.
            Device-only use does not send your ledger to our servers.
          </p>
          <h3>Sign-in and optional cloud sync</h3>
          <p>
            Google or email sign-in shares your email address and account
            identifier with our authentication provider, Supabase. Google may
            also provide a profile name. Signing in alone does not upload your
            financial records. Only when you enable Cloud sync in Settings is
            your ledger backed up to Supabase databases, with access rules
            restricting each ledger to its owner. Supabase processes network and
            authentication logs for operation and security. Connections use
            HTTPS; cloud storage uses the provider’s protections. This is not a
            claim of end-to-end encryption.
          </p>
          <h3>Purchases</h3>
          <p>
            Google Play processes subscription payments. We receive purchase
            tokens, subscription status, product identifiers and expiry dates to
            verify membership. We do not receive or store full payment-card
            details. Purchase information can be retained by Google under its
            own policies.
          </p>
          <p>
            Redeeming a Premium code stores lifetime membership status and its
            activation date against your signed-in account. We also store an
            attempt counter and time window to limit repeated guesses. Your
            financial records stay local unless you enable cloud sync.
          </p>
          <h3>Files & notifications</h3>
          <p>
            Imported files are parsed on your device; their original contents
            are not uploaded. Imported transactions join your ledger and are
            synced only if you explicitly enable Cloud sync. Exports are stored
            or shared only where you choose. Local reminders require
            notification permission and follow your chosen frequency. “Never”
            cancels budget and Premium notifications. A separate Weekly sign-in
            reminder setting controls the short backup invitation sent when you
            are signed out. No transaction amounts appear in lock-screen
            reminder text.
          </p>
          <h3>Retention, deletion & your choices</h3>
          <p>
            Records remain until you delete them or your account. You can export
            transactions and a full backup for free in Settings. “Delete account
            & all data” removes your cloud ledger, account, entitlement records
            and this device’s saved ledger. Other devices can retain offline
            copies until you clear them or uninstall the app. Provider backups
            may retain deleted records temporarily under provider retention
            policies. Deletion does not cancel a Google Play subscription;
            cancel it in Google Play first. You may request access, correction
            or deletion using the support contact below. A public deletion page
            is provided with the app’s store listing.
          </p>
          <h3>International processing & children</h3>
          <p>
            Cloud providers may process data outside your country. The publisher
            will publish applicable information about international processing.
            Penny is intended for adults and is not directed to
            children under 13. Do not knowingly enter another person’s sensitive
            information in notes.
          </p>
          <h3>Changes & contact</h3>
          <p>
            Material privacy changes will be disclosed in the app or policy
            before they take effect. Your rights depend on the laws where you
            live and are not limited by this policy.
          </p>
        </>
      )}
      {page === "terms" && (
        <>
          <h3>Welcome to Penny</h3>
          <p>
            By using Penny, you agree to these terms. Penny is a personal
            record-keeping tool. It does not provide investment, legal, tax or
            financial advice, transfer money, or guarantee savings. Keep a
            backup and verify the information you enter.
          </p>
          <h3>Your account & records</h3>
          <p>
            You are responsible for accurate records and keeping access to your
            email, Google account and device secure. Use Penny only lawfully. Do
            not attempt to access others’ data, abuse authentication services or
            bypass subscription verification. You retain ownership of your
            ledger and grant only the permissions needed to operate cloud backup
            when you explicitly enable cloud sync.
          </p>
          <h3>Free and Premium</h3>
          <p>
            The free plan includes up to 10 envelopes, one wallet, envelope
            budgets, basic reports, imports and exports. Premium includes
            unlimited envelopes and wallets, all 40 icons and advanced reports.
            If Premium expires, existing records remain accessible; creating
            extra envelopes and wallets and viewing advanced reports requires
            renewing.
          </p>
          <h3>Monthly subscription</h3>
          <p>
            The target US price is US$5 per month. The Google Play checkout
            displays the final localized price, taxes where applicable, billing
            period and terms before you confirm. Payment is charged through
            Google Play. The subscription renews automatically unless you cancel
            through Google Play before renewal. Cancellation stops future
            renewals; access normally continues until the paid period ends. No
            free trial is offered. Sign-in is required before subscribing.
          </p>
          <h3>Cancellation, refunds & restoration</h3>
          <p>
            A valid promotional code unlocks lifetime Premium for your signed-in
            Penny account for the lifetime of the Penny service, without a
            recurring charge. It does not cancel an existing Google Play
            subscription. Deleting your account also deletes its membership.
            Code availability may change; an already redeemed lifetime grant
            remains attached to that account.
          </p>
          <p>
            Manage or cancel your subscription in Google Play’s Payments &
            subscriptions section. Refund requests follow Google Play’s refund
            process and any mandatory local consumer rights. Restore purchase in
            Penny reconnects a verified subscription to your signed-in account.
            Deleting your Penny account or uninstalling the app does not cancel
            a subscription.
          </p>
          <h3>Availability & changes</h3>
          <p>
            Offline tracking can work without cloud access. Sign-in, backup and
            purchases depend on third-party services and connectivity.
            Reasonable maintenance or updates may interrupt service. Material
            feature or price changes will be disclosed, and subscription changes
            follow Google Play’s rules.
          </p>
          <h3>Limits permitted by law</h3>
          <p>
            We will exercise reasonable care in providing the app. To the extent
            permitted by applicable law, we are not responsible for losses
            caused by incorrect entries, lost devices, third-party outages or
            failure to keep backups. Nothing excludes rights, liability or
            remedies that cannot legally be excluded. Mandatory consumer
            protections in your jurisdiction continue to apply.
          </p>
          <h3>Ending use & disputes</h3>
          <p>
            You may stop using Penny and delete your account at any time. We may
            restrict unlawful or abusive use where necessary, with notice where
            appropriate. Contact support first to resolve a concern. Applicable
            law is the law of Bangladesh, subject to mandatory consumer and
            privacy rights that apply where you live.
          </p>
        </>
      )}
      {page === "about" && (
        <div className="about-content">
          <img src="/assets/penny-bunny.png" alt="Penny bunny mascot" />
          <h3>A little care for your money.</h3>
          <p>
            Penny makes everyday money habits feel a little lighter. Keep track
            of little purchases, plan for bigger things, and give every penny a
            home.
          </p>
          <p>Version 1.0.0 · No ads · Your data stays yours.</p>
          <p>Made for a gentler relationship with money.</p>
        </div>
      )}
      {page === "delete" && (
        <>
          <h3>You’re in control</h3>
          <p>
            You can delete your Penny account and its cloud ledger in the app:
            Profile → Delete account & data. You will confirm by typing
            DELETE. No subscription is required to delete.
          </p>
          <p>
            This removes the account, transactions, envelope and account names,
            settings and our membership record. Temporary service backups and
            Google’s payment records may remain according to those providers’
            policies. Clear offline copies on your other devices too.
          </p>
          <p>
            Cancel your Google Play subscription separately before deletion to
            stop future charges. Export your records first if you want to keep a
            copy.
          </p>
          {onDelete && (
            <button className="button danger" onClick={onDelete}>
              Open deletion controls
            </button>
          )}
          <p>
            If you cannot open the app, contact the publisher using the verified
            support address below. Do not email payment-card details or
            passwords. The publisher will verify account ownership before
            deletion.
          </p>
        </>
      )}
      <div className="legal-contact">
        <strong>Publisher & support</strong>
        <p>{operator || "Publisher identity pending release setup"}</p>
        {email ? (
          <a href={`mailto:${email}`}>{email}</a>
        ) : (
          <p>Support email pending release setup</p>
        )}
        {country && <p>{country}</p>}
      </div>
    </article>
  );
}
