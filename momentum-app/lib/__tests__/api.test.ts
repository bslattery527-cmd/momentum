import { shouldAttemptTokenRefresh } from '../authRefresh';

describe('shouldAttemptTokenRefresh', () => {
  it('skips refresh for auth routes so login errors stay on the form', () => {
    expect(shouldAttemptTokenRefresh('/auth/login')).toBe(false);
    expect(shouldAttemptTokenRefresh('auth/register')).toBe(false);
    expect(shouldAttemptTokenRefresh('https://api.example.com/api/v1/auth/google')).toBe(false);
  });

  it('allows refresh for non-auth app routes', () => {
    expect(shouldAttemptTokenRefresh('/users/me')).toBe(true);
    expect(shouldAttemptTokenRefresh('/logs/log-1/reactions')).toBe(true);
  });
});
