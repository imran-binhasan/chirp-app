// No imports or exports: this must stay a global declaration file.

declare namespace Express {
  interface Request {
    /** Set by the authenticate middleware. */
    user?: { id: string };
  }

  interface Locals {
    requestId: string;
  }
}
