import type { RequestHandler, Response } from 'express';
import type { UserRole } from '@golden-hour/shared';
import { AppError } from '../lib/errors';
import type { ActionContext, AuthUser } from '../modules/auth/auth.types';

export const requireAuth: RequestHandler = (_req, res, next) => {
  next(res.locals.user ? undefined : new AppError('UNAUTHENTICATED', 'Please sign in.'));
};

/** 401 without a session, 403 when the role is not allowed. Server-side; UI hiding is not a control. */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (_req, res, next) => {
    const user = res.locals.user;
    if (!user) return next(new AppError('UNAUTHENTICATED', 'Please sign in.'));
    if (!roles.includes(user.role)) return next(new AppError('FORBIDDEN', 'Your account does not have access to this.'));
    next();
  };
}

/** The signed-in user; use only behind requireAuth/requireRole. */
export function currentUser(res: Response): AuthUser {
  const user = res.locals.user;
  if (!user) throw new AppError('UNAUTHENTICATED', 'Please sign in.');
  return user;
}

export function actionContext(res: Response): ActionContext {
  return { user: currentUser(res), requestId: res.locals.requestId };
}
