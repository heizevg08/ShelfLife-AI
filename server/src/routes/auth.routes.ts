import { Router } from 'express';
import type { AuthService } from '../services/auth';
import { authenticate } from '../middleware/auth.middleware';

export function authRoutes(auth: AuthService) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.post('/login', async (req, res) => { res.json(await auth.login(req.body)); });
  router.get('/me', authenticate(auth), (_req, res) => { res.json({ user: res.locals.user }); });
  return router;
}
