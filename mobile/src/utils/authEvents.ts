import { DeviceEventEmitter } from 'react-native';

/**
 * Bridges the axios interceptor (outside React) to the auth state (inside it).
 * Fired when a session ends involuntarily — refresh failed or was revoked.
 */
const SESSION_EXPIRED = 'auth:session-expired';

export const emitSessionExpired = (): void => {
  DeviceEventEmitter.emit(SESSION_EXPIRED);
};

export const onSessionExpired = (handler: () => void) =>
  DeviceEventEmitter.addListener(SESSION_EXPIRED, handler);
