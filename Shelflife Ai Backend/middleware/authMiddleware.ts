import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";

type AuthenticatedRequest = Request & { user?: any };

const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET ?? "") as {
      id?: string;
    };

    if (!decoded.id) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Invalid token payload" });
    }

    const user = await User.findById(decoded.id).select("-passwordHash");
    if (!user || !user.isActive) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Account not found or disabled" });
    }

    req.user = user;
    return next();
  } catch {
    return res
      .status(401)
      .json({ message: "Unauthorized: Invalid or expired token" });
  }
};

const authorize = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "Forbidden: Insufficient permissions" });
    }
    return next();
  };
};

export { authenticate, authorize };

