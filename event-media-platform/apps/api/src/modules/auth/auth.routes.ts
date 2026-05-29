import { Router } from 'express';
import { authLimiter } from '../../middleware/rateLimit.js';
import { requireAuth } from '../../middleware/auth.js';
import {
  forgotPassword,
  googleAuthCallback,
  googleAuthStart,
  login,
  logoutHandler,
  me,
  refresh,
  register,
  resetPassword,
  verifyEmail,
} from './auth.controller.js';

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/google', authLimiter, googleAuthStart);
router.get('/google/callback', googleAuthCallback);
router.post('/refresh', refresh);
router.post('/logout', logoutHandler);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.get('/verify-email', verifyEmail);
router.get('/me', requireAuth, me);

export default router;
