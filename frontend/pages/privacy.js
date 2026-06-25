import PageLayout from '../components/layout/PageLayout';

const LAST_UPDATED = 'June 25, 2026';
const CONTACT_EMAIL = 'rajukumar2k04@gmail.com';

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-white mb-3">{title}</h2>
      <div className="space-y-3 text-sm text-slate-300 leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <PageLayout title="Privacy Policy" showBack backHref="/" backLabel="Home">
      <div className="max-w-3xl mx-auto">
        <div className="page-hero">
          <h1>Privacy Policy</h1>
          <p>Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="glass-card p-6 md:p-8">
          <Section title="1. Introduction">
            <p>
              JobApply AI (&quot;JobApply AI&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) provides an
              AI-powered tool that helps users analyze job postings, match and tailor resumes, generate
              application emails, and send those emails from the user&apos;s own Google account. This Privacy
              Policy explains what information we collect, how we use it, and the choices you have. By using
              JobApply AI, you agree to the practices described here.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <p>We collect only the information needed to provide the service:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-white">Account information</strong> — when you sign in with Google,
                we receive your name, email address, profile picture, and Google account identifier (UID).
              </li>
              <li>
                <strong className="text-white">Resumes you upload</strong> — the PDF files and the text/data
                parsed from them.
              </li>
              <li>
                <strong className="text-white">Job and application data</strong> — job descriptions or links
                you provide, generated email drafts, recruiter email addresses you enter, and a history of
                applications you send.
              </li>
              <li>
                <strong className="text-white">LinkedIn connection data</strong> — if you choose to upload a
                LinkedIn connections export, we process it to identify recruiter contacts.
              </li>
              <li>
                <strong className="text-white">Gmail authorization</strong> — if you grant Gmail access, we
                store an OAuth token that lets us send email on your behalf.
              </li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>To authenticate you and maintain your account.</li>
              <li>To analyze job postings and match, score, and tailor your resumes using AI.</li>
              <li>To generate personalized application emails.</li>
              <li>To send application emails from your Google account, only when you click Send.</li>
              <li>To keep a history of the applications you have sent.</li>
            </ul>
          </Section>

          <Section title="4. Google User Data and Limited Use">
            <p>
              JobApply AI requests the <code className="bg-navy-900/60 px-1.5 py-0.5 rounded text-brand-400">
              https://www.googleapis.com/auth/gmail.send</code> scope. We use this access solely to send the
              application emails that you compose and explicitly choose to send. We do{' '}
              <strong className="text-white">not</strong> read, search, or access the contents of your mailbox,
              and we do not send any email without your direct action.
            </p>
            <p>
              JobApply AI&apos;s use and transfer of information received from Google APIs adheres to the{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-400 underline"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements. We do not use Google user data for advertising, we do
              not sell it, and we do not transfer it to third parties except as necessary to provide the
              service, comply with law, or with your consent.
            </p>
          </Section>

          <Section title="5. How We Share Information">
            <p>We do not sell your personal information. We share data only with service providers that help us operate:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-white">Google</strong> — for sign-in, the Gemini AI models that
                process job and resume text, and the Gmail API used to send your emails.
              </li>
              <li>
                <strong className="text-white">Firebase (Google)</strong> — for authentication and storing
                your account data, application history, and integration tokens.
              </li>
              <li>
                <strong className="text-white">Supabase</strong> — for storing your resume files and metadata.
              </li>
            </ul>
            <p>We may also disclose information if required by law or to protect our rights and users.</p>
          </Section>

          <Section title="6. Data Storage and Security">
            <p>
              Your data is stored in secured cloud services (Firebase and Supabase) and is scoped to your
              account so that other users cannot access it. OAuth tokens are stored securely and used only to
              perform actions you request. We use industry-standard safeguards, but no method of transmission
              or storage is completely secure.
            </p>
          </Section>

          <Section title="7. Data Retention and Deletion">
            <p>
              We retain your information for as long as your account is active. You can:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Delete individual resumes and application records from within the app.</li>
              <li>Disconnect Gmail at any time, which revokes our access to send email on your behalf.</li>
              <li>
                Revoke access directly from your Google Account at{' '}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-400 underline"
                >
                  myaccount.google.com/permissions
                </a>
                .
              </li>
              <li>
                Request full deletion of your account and associated data by emailing us at{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-400 underline">{CONTACT_EMAIL}</a>.
              </li>
            </ul>
          </Section>

          <Section title="8. Your Rights">
            <p>
              Depending on your location, you may have rights to access, correct, or delete your personal
              data, and to withdraw consent. To exercise these rights, contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-400 underline">{CONTACT_EMAIL}</a>.
            </p>
          </Section>

          <Section title="9. Children's Privacy">
            <p>
              JobApply AI is not intended for use by anyone under the age of 16, and we do not knowingly
              collect personal information from children.
            </p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. We will update the &quot;Last updated&quot;
              date above when we do. Continued use of the service after changes constitutes acceptance of the
              revised policy.
            </p>
          </Section>

          <Section title="11. Contact Us">
            <p>
              If you have questions about this Privacy Policy, contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-400 underline">{CONTACT_EMAIL}</a>.
            </p>
          </Section>
        </div>
      </div>
    </PageLayout>
  );
}
