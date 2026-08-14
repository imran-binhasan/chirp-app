import argon2 from 'argon2';

// argon2.hash() defaults to argon2id with OWASP-recommended memory/time parameters.
export const hashPassword = (plain: string): Promise<string> => argon2.hash(plain);

export const verifyPassword = async (hash: string, plain: string): Promise<boolean> => {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // Malformed hash etc. — treat as a failed verification, never throw.
    return false;
  }
};

const dummyHashPromise = argon2.hash('argon2-timing-equalizer');

/**
 * Burns the same CPU time a real verify would. Login calls this when no user
 * matches, so a fast rejection cannot reveal which accounts exist.
 */
export const wasteVerificationTime = async (): Promise<void> => {
  try {
    await argon2.verify(await dummyHashPromise, 'not-the-password');
  } catch {
    // Intentionally empty.
  }
};
