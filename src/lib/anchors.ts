import { Contract, isAddress } from 'ethers';
import { env, isChainModeEnabled } from '../config/env';
import { getProvider } from './contract';

const AI_DECISION_ANCHOR_ABI = [
  'function decisionCount() external view returns (uint256)',
  'function decisions(uint256) external view returns (address subjectAddress, bytes32 inputHash, bytes32 outputHash, bytes32 modelVersionHash, uint16 riskScoreBps, uint16 confidenceBps, uint8 policyAction, uint64 timestamp, address publisher, string metadataUri)',
  'function getDecisionIdsForAddress(address subjectAddress) external view returns (uint256[] memory)',
  'function anchorDecision(address subjectAddress, bytes32 inputHash, bytes32 outputHash, bytes32 modelVersionHash, uint16 riskScoreBps, uint16 confidenceBps, uint8 policyAction, string metadataUri) external'
];

const DEPIN_ANCHOR_ABI = [
  'function anchorCount() external view returns (uint256)',
  'function anchors(uint256) external view returns (address subjectAddress, bytes32 attestationRoot, uint32 attestationCount, uint16 healthScoreBps, uint16 confidenceBps, uint64 timestamp, address publisher, string metadataUri)',
  'function getAnchorIdsForAddress(address subjectAddress) external view returns (uint256[] memory)',
  'function anchorSubjectTelemetry(address subjectAddress, bytes32 attestationRoot, uint32 attestationCount, uint16 healthScoreBps, uint16 confidenceBps, string metadataUri) external'
];

let aiDecisionAnchorContract: Contract | null = null;
let depinAnchorContract: Contract | null = null;

export const getAiDecisionAnchorContract = (): Contract | null => {
  if (!isChainModeEnabled() || !isAddress(env.AI_DECISION_ANCHOR_ADDRESS)) {
    return null;
  }

  if (!aiDecisionAnchorContract) {
    const provider = getProvider();
    if (!provider) {
      return null;
    }

    aiDecisionAnchorContract = new Contract(env.AI_DECISION_ANCHOR_ADDRESS, AI_DECISION_ANCHOR_ABI, provider);
  }

  return aiDecisionAnchorContract;
};

export const getDepinAnchorContract = (): Contract | null => {
  if (!isChainModeEnabled() || !isAddress(env.DEPIN_ANCHOR_ADDRESS)) {
    return null;
  }

  if (!depinAnchorContract) {
    const provider = getProvider();
    if (!provider) {
      return null;
    }

    depinAnchorContract = new Contract(env.DEPIN_ANCHOR_ADDRESS, DEPIN_ANCHOR_ABI, provider);
  }

  return depinAnchorContract;
};
