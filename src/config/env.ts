import dotenv from 'dotenv';

dotenv.config();

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: toNumber(process.env.PORT, 4010),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',
  CHAIN_NAME: process.env.CHAIN_NAME ?? 'X1 EcoChain',
  CHAIN_ID: toNumber(process.env.CHAIN_ID, 0),
  CHAIN_CURRENCY_SYMBOL: process.env.CHAIN_CURRENCY_SYMBOL ?? 'X1',
  CHAIN_EXPLORER_URL: process.env.CHAIN_EXPLORER_URL ?? '',
  RPC_URL: process.env.RPC_URL ?? '',
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS ?? ''
} as const;

export const isChainModeEnabled = (): boolean => {
  return env.RPC_URL.length > 0 && env.CONTRACT_ADDRESS.length > 0;
};
