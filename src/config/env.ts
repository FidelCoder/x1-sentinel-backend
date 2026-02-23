import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
};

const toScoringMode = (value: string | undefined): 'heuristic' | 'openai' => {
  if (value?.trim().toLowerCase() === 'openai') {
    return 'openai';
  }
  return 'heuristic';
};

interface DeploymentManifest {
  chainName?: string;
  chainId?: number | string;
  chainCurrencySymbol?: string;
  chainExplorerUrl?: string;
  rpcUrl?: string;
  contractAddress?: string;
  aiDecisionAnchorAddress?: string;
  depinAnchorAddress?: string;
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
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS ?? deploymentManifest.contractAddress ?? '',
  AI_DECISION_ANCHOR_ADDRESS:
    process.env.AI_DECISION_ANCHOR_ADDRESS ?? deploymentManifest.aiDecisionAnchorAddress ?? '',
  DEPIN_ANCHOR_ADDRESS: process.env.DEPIN_ANCHOR_ADDRESS ?? deploymentManifest.depinAnchorAddress ?? '',
  DEPIN_EIP712_DOMAIN_NAME: process.env.DEPIN_EIP712_DOMAIN_NAME ?? 'X1SentinelDePIN',
  DEPIN_EIP712_DOMAIN_VERSION: process.env.DEPIN_EIP712_DOMAIN_VERSION ?? '1',
  DEPIN_MAX_CLOCK_SKEW_SECONDS: toNumber(process.env.DEPIN_MAX_CLOCK_SKEW_SECONDS, 300),
  DEPIN_MAX_ATTESTATION_AGE_SECONDS: toNumber(process.env.DEPIN_MAX_ATTESTATION_AGE_SECONDS, 86400),
  DEPIN_MAX_REGISTRATION_AGE_SECONDS: toNumber(process.env.DEPIN_MAX_REGISTRATION_AGE_SECONDS, 259200),
  DEPIN_NONCE_RETENTION_SECONDS: toNumber(process.env.DEPIN_NONCE_RETENTION_SECONDS, 604800),
  DEPIN_ATTESTATION_RETENTION_SECONDS: toNumber(process.env.DEPIN_ATTESTATION_RETENTION_SECONDS, 1209600),
  DEPIN_HEALTH_WINDOW_HOURS: toNumber(process.env.DEPIN_HEALTH_WINDOW_HOURS, 24),
  DEPIN_REQUIRE_NODE_REGISTRATION: toBoolean(process.env.DEPIN_REQUIRE_NODE_REGISTRATION, true),
  AI_SCORING_MODE: toScoringMode(process.env.AI_SCORING_MODE),
  AI_OPENAI_BASE_URL: process.env.AI_OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
  AI_OPENAI_MODEL: process.env.AI_OPENAI_MODEL ?? 'gpt-4.1-mini',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
  AI_POLICY_WARN_THRESHOLD: toNumber(process.env.AI_POLICY_WARN_THRESHOLD, 50),
  AI_POLICY_CHALLENGE_THRESHOLD: toNumber(process.env.AI_POLICY_CHALLENGE_THRESHOLD, 70),
  AI_POLICY_BLOCK_THRESHOLD: toNumber(process.env.AI_POLICY_BLOCK_THRESHOLD, 88),
  AI_POLICY_MIN_AUTOMATION_CONFIDENCE: toNumber(process.env.AI_POLICY_MIN_AUTOMATION_CONFIDENCE, 0.72),
  AI_DECISION_RETENTION: toNumber(process.env.AI_DECISION_RETENTION, 400)
} as const;

export const isChainModeEnabled = (): boolean => {
  return env.RPC_URL.length > 0 && env.CONTRACT_ADDRESS.length > 0;
};
