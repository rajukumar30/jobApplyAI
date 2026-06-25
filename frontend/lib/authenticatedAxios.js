import axios from 'axios';
import { auth } from './firebase';

let interceptorInstalled = false;

export function installAuthInterceptor() {
  if (interceptorInstalled) return;
  interceptorInstalled = true;

  axios.interceptors.request.use(async (config) => {
    const user = auth.currentUser;
    if (!user) return config;

    const token = await user.getIdToken();
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
}

export async function buildAuthenticatedUrl(url) {
  const user = auth.currentUser;
  if (!user) throw new Error('Authentication required.');

  const token = await user.getIdToken();
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}authToken=${encodeURIComponent(token)}`;
}
