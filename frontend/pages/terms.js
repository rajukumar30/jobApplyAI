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

export default function TermsOfServicePage() {
  return (
    <PageLayout title="Terms of Service" showBack backHref="/" backLabel="Home">
      <div className="max-w-3xl mx-auto">
        <div className="page-hero">
          <h1>Terms of Service</h1>
          <p>Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="glass-card p-6 md:p-8">
          <Section title="1. Acceptance of Terms">
            <p>
              These Terms of Service (&quot;Terms&quot;) govern your access to and use of JobApply AI (the
              &quot;Service&quot;). By accessing or using the Service, you agree to be bound by these Terms and
              by our{' '}
              <a href="/privacy" className="text-brand-400 underline">Privacy Policy</a>. If you do not agree,
              do not use the Service.
            </p>
          </Section>

          <Section title="2. Description of the Service">
            <p>
              JobApply AI helps users analyze job postings, match and tailor resumes using AI, generate
              personalized application emails, and send those emails from the user&apos;s own Google account
              via the Gmail API. The Service relies on third-party providers including Google (sign-in, Gemini
              AI, Gmail API), Firebase, and Supabase.
            </p>
          </Section>

          <Section title="3. Eligibility and Accounts">
            <p>
              You must be at least 16 years old and able to form a binding contract to use the Service. You
              sign in using your Google account and are responsible for maintaining the security of that
              account. You are responsible for all activity that occurs under your account.
            </p>
          </Section>

          <Section title="4. Acceptable Use">
            <p>You agree that you will not:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Send spam, bulk unsolicited messages, or any email that violates anti-spam laws (such as the CAN-SPAM Act or GDPR).</li>
              <li>Use the Service to harass, deceive, impersonate, or harm others.</li>
              <li>Upload content you do not have the right to use, or that infringes others&apos; rights.</li>
              <li>Violate the terms of any third-party platform, including Google, Gmail, or LinkedIn.</li>
              <li>Attempt to disrupt, reverse engineer, or gain unauthorized access to the Service.</li>
            </ul>
            <p>
              You are solely responsible for the content of the emails you send and for ensuring your outreach
              complies with all applicable laws and platform policies.
            </p>
          </Section>

          <Section title="5. Gmail Sending">
            <p>
              When you connect Gmail, you authorize JobApply AI to send emails from your account using the{' '}
              <code className="bg-navy-900/60 px-1.5 py-0.5 rounded text-brand-400">gmail.send</code> scope.
              Emails are only sent when you explicitly choose to send them. You may revoke this access at any
              time from within the app or from your{' '}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-400 underline"
              >
                Google Account permissions
              </a>
              .
            </p>
          </Section>

          <Section title="6. AI-Generated Content">
            <p>
              The Service uses AI to generate resume content and email drafts. AI output may be inaccurate or
              incomplete. You are responsible for reviewing and editing all generated content before sending.
              JobApply AI does not guarantee any particular outcome, including job interviews or offers.
            </p>
          </Section>

          <Section title="7. Intellectual Property">
            <p>
              You retain ownership of the content you upload (such as your resumes). You grant us a limited
              license to process and store that content solely to provide the Service. All software, design,
              and other materials that make up the Service remain the property of JobApply AI.
            </p>
          </Section>

          <Section title="8. Third-Party Services">
            <p>
              The Service integrates with third-party services that have their own terms and privacy policies.
              Your use of those services through JobApply AI is subject to their respective terms, and we are
              not responsible for their practices.
            </p>
          </Section>

          <Section title="9. Disclaimer of Warranties">
            <p>
              The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any
              kind, whether express or implied, including fitness for a particular purpose and
              non-infringement. We do not warrant that the Service will be uninterrupted, secure, or
              error-free.
            </p>
          </Section>

          <Section title="10. Limitation of Liability">
            <p>
              To the maximum extent permitted by law, JobApply AI and its operators will not be liable for any
              indirect, incidental, special, consequential, or punitive damages, or any loss of data, profits,
              or goodwill, arising from your use of the Service.
            </p>
          </Section>

          <Section title="11. Termination">
            <p>
              You may stop using the Service at any time and request deletion of your data. We may suspend or
              terminate access if you violate these Terms or use the Service in a way that could cause harm or
              legal liability.
            </p>
          </Section>

          <Section title="12. Changes to These Terms">
            <p>
              We may modify these Terms from time to time. We will update the &quot;Last updated&quot; date
              above when we do. Continued use of the Service after changes constitutes acceptance of the
              revised Terms.
            </p>
          </Section>

          <Section title="13. Contact Us">
            <p>
              If you have questions about these Terms, contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-400 underline">{CONTACT_EMAIL}</a>.
            </p>
          </Section>
        </div>
      </div>
    </PageLayout>
  );
}
