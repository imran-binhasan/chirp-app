// Ambient augmentation of Express types — intentionally no imports/exports
// so this file is treated as a global declaration file.

declare namespace Express {
  interface Request {
    /** Set by the authenticate middleware after the access token is verified. */
    user?: { id: string };
  }

  interface Locals {
    /** Correlation id assigned by the requestId middleware. */
    requestId: string;
  }
}
