import { act } from '@testing-library/react-native';

const mockSaveRefreshToken = jest.fn();
const mockGetRefreshToken = jest.fn();
const mockDeleteRefreshToken = jest.fn();
const mockApiPost = jest.fn();
const mockApiGet = jest.fn();

jest.mock('@/lib/auth', () => ({
  saveRefreshToken: (...args: unknown[]) => mockSaveRefreshToken(...args),
  getRefreshToken: (...args: unknown[]) => mockGetRefreshToken(...args),
  deleteRefreshToken: (...args: unknown[]) => mockDeleteRefreshToken(...args),
}));

jest.mock('@/lib/api', () => ({
  api: {
    post: (...args: unknown[]) => mockApiPost(...args),
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}));

const getAuthStore = () => require('../authStore').useAuthStore as typeof import('../authStore').useAuthStore;

describe('authStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const useAuthStore = getAuthStore();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,
      hasCompletedOnboarding: false,
    });
  });

  it('marks onboarding complete when a logged-in user already has a bio', async () => {
    await act(async () => {
      const useAuthStore = getAuthStore();
      await useAuthStore.getState().login(
        {
          id: 'user-1',
          email: 'alex@example.com',
          display_name: 'Alex',
          username: 'alex',
          avatar_url: null,
          bio: 'Working in public',
          goal_category: null,
          created_at: '2026-03-15T10:00:00.000Z',
        } as any,
        'access-token',
        'refresh-token',
      );
    });

    expect(mockSaveRefreshToken).toHaveBeenCalledWith('refresh-token');
    const useAuthStore = getAuthStore();
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      isLoading: false,
      hasCompletedOnboarding: true,
      accessToken: 'access-token',
    });
  });

  it('hydrates via refresh token and loads the current user', async () => {
    mockGetRefreshToken.mockResolvedValue('refresh-token');
    mockApiPost.mockResolvedValue({ data: { access_token: 'new-access', refresh_token: 'new-refresh' } });
    mockApiGet.mockResolvedValue({
      data: {
        id: 'user-1',
        email: 'alex@example.com',
        display_name: 'Alex',
        username: 'alex',
        avatar_url: null,
        bio: 'Back again',
        goal_category: null,
        created_at: '2026-03-15T10:00:00.000Z',
      },
    });

    await act(async () => {
      const useAuthStore = getAuthStore();
      await useAuthStore.getState().hydrate();
    });

    const useAuthStore = getAuthStore();
    expect(mockApiPost).toHaveBeenCalledWith('/auth/refresh', { refresh_token: 'refresh-token' });
    expect(mockApiGet).toHaveBeenCalledWith('/users/me');
    expect(mockSaveRefreshToken).toHaveBeenCalledWith('new-refresh');
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      isLoading: false,
      accessToken: 'new-access',
      hasCompletedOnboarding: true,
    });
  });

  it('clears local auth state on logout', async () => {
    const useAuthStore = getAuthStore();
    useAuthStore.setState({
      user: { id: 'user-1' } as any,
      accessToken: 'token',
      isAuthenticated: true,
      isLoading: false,
      hasCompletedOnboarding: true,
    });

    await act(async () => {
      const useAuthStore = getAuthStore();
      await useAuthStore.getState().logout();
    });

    const nextAuthStore = getAuthStore();
    expect(mockDeleteRefreshToken).toHaveBeenCalled();
    expect(nextAuthStore.getState()).toMatchObject({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      hasCompletedOnboarding: false,
    });
  });
});
