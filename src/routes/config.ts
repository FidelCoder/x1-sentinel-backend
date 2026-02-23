import { Router } from 'express';
import { env, isChainModeEnabled } from '../config/env';
import { ChainConfig } from '../types/safety';

const router = Router();

router.get('/', (_req, res) => {
  const payload: ChainConfig = {
    chainName: env.CHAIN_NAME,
    chainId: env.CHAIN_ID,
    chainCurrencySymbol: env.CHAIN_CURRENCY_SYMBOL,
    chainExplorerUrl: env.CHAIN_EXPLORER_URL,
    rpcUrl: env.RPC_URL,
    contractAddress: env.CONTRACT_ADDRESS,
    aiDecisionAnchorAddress: env.AI_DECISION_ANCHOR_ADDRESS,
    depinAnchorAddress: env.DEPIN_ANCHOR_ADDRESS,
    mode: isChainModeEnabled() ? 'onchain' : 'demo'
  };

  return res.json(payload);
});

export default router;
