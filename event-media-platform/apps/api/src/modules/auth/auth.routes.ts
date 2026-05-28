import { Router } from 'express';
import { authLimiter } from '../../middleware/rateLimit.js';
import { requireAuth } from '../../middleware/auth.js';
import {
  forgotPassword,
  login,
  logoutHandler,
  me,
  refresh,
  register,
  resetPassword,
} from './auth.controller.js';

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logoutHandler);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.get('/me', requireAuth, me);

export default router;
