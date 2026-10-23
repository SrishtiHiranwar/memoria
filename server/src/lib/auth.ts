import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { HttpError } from './errors.js';

const claimsSchema = z.object({
  sub: z.string(),
  role: z.enum(['DOCTOR', 'PATIENT']),
  patientId: z.string().nullable(),
});

export type AuthClaims = z.infer<typeof claimsSchema>;

declare global {
  namespace Express {
    interface Request {
      auth?: AuthClaims;
    }
  }
}

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured in production.');
  }
  return 'local-development-only-change-before-deploying';
}

export function issueToken(claims: AuthClaims) {
  return jwt.sign(claims, jwtSecret(), { expiresIn: '12h' });
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const bearer = req.header('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer) return next(new HttpError(401, 'Please sign in to continue.'));

  try {
    const decoded = claimsSchema.parse(jwt.verify(bearer, jwtSecret()));
    req.auth = decoded;
    return next();
  } catch {
    return next(new HttpError(401, 'Your session has expired. Please sign in again.'));
  }
}

export function requireRole(role: AuthClaims['role']) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.auth?.role !== role) {
      return next(new HttpError(403, 'You do not have permission to do that.'));
    }
    return next();
  };
}
