import { Contract, JsonRpcProvider, isAddress } from 'ethers';
import { env, isChainModeEnabled } from '../config/env';

const SAFETY_REGISTRY_ABI = [
  'function checkAddress(address _address) external view returns (bool isFlagged, uint256[] memory reportIds)',
  'function calculateRiskScore(address _address) external view returns (uint256 score)',
  'function reports(uint256 _reportId) external view returns (address reporter, address targetAddress, string nameTag, uint8 reason, string evidence, uint256 timestamp, uint256 upvotes, uint256 downvotes, bool resolved, bool malicious, address resolvedBy, uint256 resolvedAt)',
  'function reportCount() external view returns (uint256)',
  'function voteOnReport(uint256 _reportId, bool _upvote) external',
  'function resolveReport(uint256 _reportId, bool _malicious) external',
  'function canResolve(uint256 _reportId, bool _malicious) external view returns (bool)'
];

let provider: JsonRpcProvider | null = null;
let contract: Contract | null = null;

export const getProvider = (): JsonRpcProvider | null => {
  if (!isChainModeEnabled()) {
    return null;
  }

  if (!provider) {
    provider = new JsonRpcProvider(env.RPC_URL);
  }

  return provider;
};

export const getContract = (): Contract | null => {
  if (!isChainModeEnabled() || !isAddress(env.CONTRACT_ADDRESS)) {
    return null;
  }

  if (!contract) {
    const rpcProvider = getProvider();
    if (!rpcProvider) {
      return null;
    }

    contract = new Contract(env.CONTRACT_ADDRESS, SAFETY_REGISTRY_ABI, rpcProvider);
  }

  return contract;
};
