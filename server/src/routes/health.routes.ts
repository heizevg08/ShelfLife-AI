import { Router } from 'express';

export function healthRoutes(isReady: () => boolean): Router {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/live', (_req, res) => { res.json({ status: 'alive' }); });
  router.get('/ready', (_req, res) => {
    const ready = isReady();
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready' });
  });
  return router;
}
