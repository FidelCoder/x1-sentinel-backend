import app from './app';
import { env, isChainModeEnabled } from './config/env';

app.listen(env.PORT, () => {
  console.log(`X1 Sentinel API listening on http://localhost:${env.PORT}`);
  console.log(`Mode: ${isChainModeEnabled() ? 'onchain' : 'demo'}`);
});
