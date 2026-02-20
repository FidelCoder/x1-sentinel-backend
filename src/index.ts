import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import NodeCache from 'node-cache';
import { env, isChainModeEnabled } from './config/env';
import checkRoutes from './routes/check';
import configRoutes from './routes/config';
import reportRoutes from './routes/reports';

const app = express();
const cache = new NodeCache({ stdTTL: 300 });

const corsOrigin = env.CORS_ORIGIN === '*'
  ? true
  : env.CORS_ORIGIN.split(',').map((item) => item.trim());

app.use(cors({ origin: corsOrigin }));
app.use(express.json());
app.set('cache', cache);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    chainMode: isChainModeEnabled() ? 'onchain' : 'demo',
    chainName: env.CHAIN_NAME,
    timestamp: new Date().toISOString()
  });
});

app.get('/', (_req, res) => {
  res.json({
    name: 'X1 Sentinel API',
    version: '0.1.0',
    endpoints: {
      config: '/api/config',
      check: '/api/check/:address',
      reports: '/api/reports',
      health: '/health'
    }
  });
});

app.use('/api/config', configRoutes);
app.use('/api/check', checkRoutes);
app.use('/api/reports', reportRoutes);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(env.PORT, () => {
  console.log(`X1 Sentinel API listening on http://localhost:${env.PORT}`);
  console.log(`Mode: ${isChainModeEnabled() ? 'onchain' : 'demo'}`);
});

export default app;
