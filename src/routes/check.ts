import { Router } from 'express';
import { isAddress } from 'ethers';
import NodeCache from 'node-cache';
import { demoReports } from '../data/demoReports';
import { getContract, getProvider } from '../lib/contract';
import { reasonFromCode } from '../lib/reasons';
import { scoreRiskContext } from '../services/ai';
import { getAddressHealth } from '../services/depin';
import { aggregateExternalData } from '../services/external';
import { calculatePrivacyScore } from '../services/privacy';
import { CheckResult, SafetyReport } from '../types/safety';

const router = Router();

const normalizeReport = (id: number, raw: any): SafetyReport => {
  return {
    id,
    reporter: raw.reporter,
    targetAddress: raw.targetAddress,
    nameTag: raw.nameTag || raw.ensName || null,
    reason: reasonFromCode(Number(raw.reason)),
    evidence: raw.evidence,
    timestamp: Number(raw.timestamp) * 1000,
    upvotes: Number(raw.upvotes),
    downvotes: Number(raw.downvotes),
    resolved: Boolean(raw.resolved),
    malicious: Boolean(raw.malicious),
    resolvedBy: raw.resolvedBy ?? '0x0000000000000000000000000000000000000000',
    resolvedAt: Number(raw.resolvedAt ?? 0) * 1000
  };
};

const scoreFromReports = (reports: SafetyReport[]): number => {
  if (reports.length === 0) {
    return 0;
  }

  const activeReports = reports.filter((report) => !(report.resolved && !report.malicious));
  const totalUpvotes = activeReports.reduce((sum, report) => sum + report.upvotes, 0);
  const totalDownvotes = activeReports.reduce((sum, report) => sum + report.downvotes, 0);

  if (totalUpvotes === 0) {
    return 0;
  }

  const netVotes = Math.max(0, totalUpvotes - totalDownvotes);
  const score = Math.round((netVotes * 100) / (activeReports.length + 1));
  return Math.min(100, score);
};

const isFlaggedFromReports = (reports: SafetyReport[]): boolean => {
  return reports.some((report) => {
    if (report.resolved) {
      return report.malicious;
    }
    return report.upvotes >= 3 && report.upvotes > report.downvotes;
  });
};

const topReasons = (reports: SafetyReport[]): string[] => {
  const counts = new Map<string, number>();

  for (const report of reports) {
    counts.set(report.reason, (counts.get(report.reason) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason]) => reason);
};

router.get('/:address', async (req, res) => {
  try {
    const { address } = req.params;

    if (!isAddress(address)) {
      return res.status(400).json({ error: 'Invalid EVM address' });
    }

    const cache = req.app.get('cache') as NodeCache;
    const cacheKey = `check:${address.toLowerCase()}`;
    const cached = cache.get<CheckResult>(cacheKey);

    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const contract = getContract();
    const provider = getProvider();
    let reports: SafetyReport[] = [];
    let isFlagged = false;
    let riskScore = 0;
    let mode: 'onchain' | 'demo' = 'demo';

    if (contract) {
      mode = 'onchain';

      const [flagged, reportIds] = (await contract.checkAddress(address)) as [boolean, bigint[]];
      isFlagged = Boolean(flagged);
      riskScore = Number(await contract.calculateRiskScore(address));

      for (const reportId of reportIds) {
        const numericId = Number(reportId);
        const raw = await contract.reports(reportId);
        reports.push(normalizeReport(numericId, raw));
      }
    } else {
      reports = demoReports.filter((report) => report.targetAddress.toLowerCase() === address.toLowerCase());
      isFlagged = isFlaggedFromReports(reports);
      riskScore = scoreFromReports(reports);
    }

    const privacy = await calculatePrivacyScore(address, reports.length, provider);
    const externalFlags = await aggregateExternalData(address);
    const unresolvedReportCount = reports.filter((report) => !report.resolved).length;
    const depinHealth = getAddressHealth(address);
    const aiDecision = await scoreRiskContext({
      address,
      baseRiskScore: riskScore,
      reportCount: reports.length,
      unresolvedReportCount,
      isFlagged,
      privacyScore: privacy.score,
      privacyGrade: privacy.grade,
      externalFlagCount: externalFlags.totalFlags,
      depinStatus: depinHealth.summary.status,
      depinHealthScore: depinHealth.summary.healthScore,
      depinConfidence: depinHealth.summary.confidence,
      topReasons: topReasons(reports)
    });

    const result: CheckResult = {
      address,
      isFlagged,
      riskScore,
      unresolvedReportCount,
      privacyScore: privacy.score,
      privacyGrade: privacy.grade,
      privacyFactors: privacy.factors,
      privacyRecommendations: privacy.recommendations,
      reportCount: reports.length,
      reports,
      externalFlags,
      depinHealth,
      aiDecision,
      mode,
      timestamp: new Date().toISOString()
    };

    cache.set(cacheKey, result, 300);
    return res.json(result);
  } catch {
    return res.status(500).json({ error: 'Failed to evaluate address' });
  }
});

export default router;
