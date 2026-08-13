import { cert, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { env } from '../config/env';
import { logger } from './logger';

let firebaseApp: App | null = null;

/**
 * Lazily initialised on first use — the API must boot (and tests must pass)
 * even when Firebase credentials are not configured. Callers must check
 * `env.firebaseConfigured` first.
 */
export function getFirebaseMessaging(): Messaging {
  if (!env.firebaseConfigured) {
    throw new Error('Firebase is not configured');
  }
  if (!firebaseApp) {
    firebaseApp = initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        // Service-account JSON stores the key with literal "\n" escapes.
        privateKey: env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      }),
    });
    logger.info('Firebase Admin initialised — push notifications enabled');
  }
  return getMessaging(firebaseApp);
}
