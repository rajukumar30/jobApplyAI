import Head from 'next/head';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';

export default function PageLayout({ children, title, subtitle, showBack = true, backHref = '/', backLabel = 'Dashboard' }) {
  return (
    <>
      <Head>
        <title>{title} — JobApply AI</title>
        <meta name="description" content={subtitle || 'AI-powered job application automation'} />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚀</text></svg>" />
      </Head>

      <div className="min-h-screen flex flex-col overflow-x-hidden">
        <SiteHeader
          title={title}
          showBack={showBack}
          backHref={backHref}
          backLabel={backLabel}
        />

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {subtitle && (
            <div className="mb-6 sm:mb-8">
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold text-brand-400">
                {subtitle}
              </p>
            </div>
          )}
          {children}
        </main>

        <SiteFooter />
      </div>
    </>
  );
}
