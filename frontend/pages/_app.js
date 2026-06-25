import '../styles/globals.css';
import { AppProvider, useApp } from '../lib/AppContext';
import { installAuthInterceptor } from '../lib/authenticatedAxios';

installAuthInterceptor();

function Toast() {
  const { toast, clearToast } = useApp();
  if (!toast) return null;
  const cls = toast.type === 'success' ? 'toast-success' : toast.type === 'error' ? 'toast-error' : 'toast-info';
  return (
    <div className={cls}>
      <span>{toast.message}</span>
      <button onClick={clearToast} className="ml-2 opacity-60 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  );
}

function AppShell({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <Toast />
    </>
  );
}

export default function App({ Component, pageProps }) {
  return (
    <AppProvider>
      <AppShell Component={Component} pageProps={pageProps} />
    </AppProvider>
  );
}
