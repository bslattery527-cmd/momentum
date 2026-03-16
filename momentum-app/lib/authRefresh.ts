export function shouldAttemptTokenRefresh(url?: string | null): boolean {
  if (!url) return true;

  try {
    const pathname = url.startsWith('http') ? new URL(url).pathname : url;
    return !/(^|\/)auth\//.test(pathname);
  } catch {
    return !/(^|\/)auth\//.test(url);
  }
}
