import { DeviceEventEmitter } from 'react-native';

/**
 * Bridges the axios interceptor, which lives outside React, to the auth state
 * inside it. Fires when a session ends involuntarily.
 */
const SESSION_EXPIRED = 'auth:session-expired';

export const emitSessionExpired = (): void => {
  DeviceEventEmitter.emit(SESSION_EXPIRED);
};

export const onSessionExpired = (handler: () => void) =>
  DeviceEventEmitter.addListener(SESSION_EXPIRED, handler);
