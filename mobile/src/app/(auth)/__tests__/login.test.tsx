import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../login';
import { authApi } from '../../../api/endpoints';
import { ApiError } from '../../../api/errors';
import { useAuth } from '../../../store/AuthContext';

jest.mock('../../../api/endpoints', () => ({
  authApi: { login: jest.fn() },
}));

const mockLogin = jest.fn();
jest.mock('../../../store/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const login = authApi.login as jest.MockedFunction<typeof authApi.login>;
const { __mockRouter } = jest.requireMock('expo-router') as {
  __mockRouter: { replace: jest.Mock; push: jest.Mock };
};

const authResponse = {
  user: {
    id: 'u1',
    username: 'jane',
    email: 'jane@example.com',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  tokens: {
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    accessTokenExpiresIn: 900,
    refreshTokenExpiresIn: 2592000,
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({
    login: mockLogin,
    logout: jest.fn(),
    user: null,
    loading: false,
  });
});

describe('LoginScreen', () => {
  it('keeps submit disabled until both fields are filled', async () => {
    await render(<LoginScreen />);

    const submit = screen.getByTestId('submit-button');
    expect(submit.props.accessibilityState.disabled).toBe(true);

    await fireEvent.changeText(screen.getByTestId('field-identifier'), 'jane');
    await fireEvent.changeText(screen.getByTestId('field-password'), 'password1');

    await waitFor(() => expect(submit.props.accessibilityState.disabled).toBe(false));
  });

  it('signs in and routes to the feed', async () => {
    login.mockResolvedValue(authResponse);
    await render(<LoginScreen />);

    await fireEvent.changeText(screen.getByTestId('field-identifier'), 'jane');
    await fireEvent.changeText(screen.getByTestId('field-password'), 'password1');
    await waitFor(() =>
      expect(screen.getByTestId('submit-button').props.accessibilityState.disabled).toBe(false),
    );
    await fireEvent.press(screen.getByTestId('submit-button'));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({ identifier: 'jane', password: 'password1' }),
    );
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('access-1', 'refresh-1', authResponse.user));
    expect(__mockRouter.replace).toHaveBeenCalledWith('/(main)/feed');
  });

  it('shows the server message when credentials are wrong', async () => {
    login.mockRejectedValue(
      new ApiError({ message: 'Invalid credentials', code: 'UNAUTHORIZED', status: 401 }),
    );
    await render(<LoginScreen />);

    await fireEvent.changeText(screen.getByTestId('field-identifier'), 'jane');
    await fireEvent.changeText(screen.getByTestId('field-password'), 'wrongpass');
    await waitFor(() =>
      expect(screen.getByTestId('submit-button').props.accessibilityState.disabled).toBe(false),
    );
    await fireEvent.press(screen.getByTestId('submit-button'));

    expect(await screen.findByTestId('form-error')).toBeTruthy();
    expect(screen.getByText('Invalid credentials')).toBeTruthy();
    expect(__mockRouter.replace).not.toHaveBeenCalled();
  });

  it('offers a route to signup', async () => {
    await render(<LoginScreen />);

    await fireEvent.press(screen.getByLabelText('Sign up'));

    expect(__mockRouter.push).toHaveBeenCalledWith('/(auth)/signup');
  });
});
