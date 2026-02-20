import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

interface DeploymentManifest {
  chainName?: string;
  chainId?: number | string;
  chainCurrencySymbol?: string;
  chainExplorerUrl?: string;
  rpcUrl?: string;
  contractAddress?: string;
}

const loadDeploymentManifest = (): DeploymentManifest => {
  const configuredPath = process.env.DEPLOYMENT_MANIFEST_PATH;
  if (!configuredPath) {
    return {};
  }

  const manifestPath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(process.cwd(), configuredPath);

  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    return JSON.parse(raw) as DeploymentManifest;
  } catch {
    return {};
  }
};

const deploymentManifest = loadDeploymentManifest();

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: toNumber(process.env.PORT, 4010),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',
  CHAIN_NAME: process.env.CHAIN_NAME ?? deploymentManifest.chainName ?? 'X1 EcoChain',
  CHAIN_ID: toNumber(
    process.env.CHAIN_ID ?? (deploymentManifest.chainId?.toString() ?? ''),
    0
  ),
  CHAIN_CURRENCY_SYMBOL: process.env.CHAIN_CURRENCY_SYMBOL ?? deploymentManifest.chainCurrencySymbol ?? 'X1',
  CHAIN_EXPLORER_URL: process.env.CHAIN_EXPLORER_URL ?? deploymentManifest.chainExplorerUrl ?? '',
  RPC_URL: process.env.RPC_URL ?? deploymentManifest.rpcUrl ?? '',
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS ?? deploymentManifest.contractAddress ?? ''
} as const;

export const isChainModeEnabled = (): boolean => {
  return env.RPC_URL.length > 0 && env.CONTRACT_ADDRESS.length > 0;
};
