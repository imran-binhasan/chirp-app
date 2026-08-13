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

/**
 * Argon2id hash of a throwaway value, computed once at startup.
 *
 * Login verifies against this when no user matches, so the "unknown user" and
 * "wrong password" paths cost the same wall-clock time. Without it, a fast
 * rejection reveals which accounts exist (timing-based user enumeration).
 */
const dummyHashPromise = argon2.hash('argon2-timing-equalizer');

export const wasteVerificationTime = async (): Promise<void> => {
  try {
    await argon2.verify(await dummyHashPromise, 'not-the-password');
  } catch {
    // Result is irrelevant — this exists purely to burn equivalent CPU time.
  }
};
