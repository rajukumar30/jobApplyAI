import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/5 py-5 sm:py-6 mt-auto safe-bottom">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center space-y-2">
        <p className="text-xs text-slate-600">
          JobApply AI · Powered by Google Gemini · Gmail API
        </p>
        <p className="text-xs text-slate-600 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <Link href="/privacy" className="hover:text-slate-400 transition-colors">
            Privacy Policy
          </Link>
          <span className="text-slate-700 hidden xs:inline">·</span>
          <Link href="/terms" className="hover:text-slate-400 transition-colors">
            Terms of Service
          </Link>
        </p>
      </div>
    </footer>
  );
}
