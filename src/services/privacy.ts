import { JsonRpcProvider, formatEther } from 'ethers';
import { PrivacyAnalysis } from '../types/safety';

const gradeFromScore = (score: number): PrivacyAnalysis['grade'] => {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
};

export const calculatePrivacyScore = async (
  address: string,
  reportCount: number,
  provider: JsonRpcProvider | null
): Promise<PrivacyAnalysis> => {
  let txCount = 0;
  let balanceEth = 0;
  let isContract = false;

  if (provider) {
    try {
      txCount = await provider.getTransactionCount(address);
      const balance = await provider.getBalance(address);
      balanceEth = Number(formatEther(balance));
      const code = await provider.getCode(address);
      isContract = code !== '0x';
    } catch {
      txCount = 0;
      balanceEth = 0;
      isContract = false;
    }
  }

  const addressReuse = Math.min(100, Math.round(txCount * 1.2));
  let score = 100;

  if (txCount > 1000) score -= 30;
  else if (txCount > 500) score -= 25;
  else if (txCount > 100) score -= 20;
  else if (txCount > 25) score -= 15;
  else if (txCount > 0) score -= 8;

  if (balanceEth > 100) score -= 25;
  else if (balanceEth > 10) score -= 18;
  else if (balanceEth > 1) score -= 12;
  else if (balanceEth > 0.1) score -= 6;

  if (reportCount > 10) score -= 25;
  else if (reportCount > 5) score -= 18;
  else if (reportCount > 2) score -= 12;
  else if (reportCount > 0) score -= 6;

  if (isContract) {
    score -= 8;
  }

  score = Math.max(0, Math.min(100, score));

  const recommendations: string[] = [];

  if (txCount > 50) {
    recommendations.push('Rotate operational wallets for sensitive flows.');
  }

  if (balanceEth > 1) {
    recommendations.push('Segment treasury and hot-wallet balances by risk profile.');
  }

  if (reportCount > 0) {
    recommendations.push('Move critical operations to a clean address until reports are resolved.');
  }

  if (score < 70) {
    recommendations.push('Adopt role-specific wallets to reduce exposure blast radius.');
  }

  return {
    score,
    grade: gradeFromScore(score),
    factors: {
      transactionActivity: txCount,
      balanceExposure: balanceEth,
      publicScrutiny: reportCount,
      addressReuse,
      isContract
    },
    recommendations
  };
};
