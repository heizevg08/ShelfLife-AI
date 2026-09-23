import { IUser } from "../models/User";

// Extends Express's Request type so req.user (attached by authMiddleware)
// is recognized everywhere without needing `as any` casts.
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export {};
