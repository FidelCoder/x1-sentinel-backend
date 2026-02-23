import { Router } from 'express';
import { isAddress } from 'ethers';
import { getAiConfig, listRecentAiDecisions, scoreRiskContext } from '../services/ai';
import { AiRiskContext } from '../types/ai';

const router = Router();

const toNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
};

const toList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0)
    .slice(0, 8);
};

const toPrivacyGrade = (value: unknown): AiRiskContext['privacyGrade'] => {
  if (value === 'A' || value === 'B' || value === 'C' || value === 'D' || value === 'F') {
    return value;
  }
  return 'C';
};

const toDepinStatus = (value: unknown): AiRiskContext['depinStatus'] => {
  if (value === 'healthy' || value === 'warning' || value === 'critical' || value === 'unknown') {
    return value;
  }
  return 'unknown';
};

router.get('/config', (_req, res) => {
  return res.json(getAiConfig());
});

router.post('/score', async (req, res) => {
  try {
    const address = typeof req.body?.address === 'string' ? req.body.address : '';
    if (!isAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const context: AiRiskContext = {
      address,
      baseRiskScore: toNumber(req.body?.baseRiskScore ?? req.body?.riskScore, 0),
      reportCount: Math.max(0, Math.floor(toNumber(req.body?.reportCount, 0))),
      unresolvedReportCount: Math.max(0, Math.floor(toNumber(req.body?.unresolvedReportCount, 0))),
      isFlagged: Boolean(req.body?.isFlagged),
      privacyScore: toNumber(req.body?.privacyScore, 0),
      privacyGrade: toPrivacyGrade(req.body?.privacyGrade),
      externalFlagCount: Math.max(0, Math.floor(toNumber(req.body?.externalFlagCount, 0))),
      depinStatus: toDepinStatus(req.body?.depinStatus),
      depinHealthScore: toNumber(req.body?.depinHealthScore, 0),
      depinConfidence: toNumber(req.body?.depinConfidence, 0),
      topReasons: toList(req.body?.topReasons)
    };

    const decision = await scoreRiskContext(context);
    return res.status(201).json(decision);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to score AI risk';
    return res.status(500).json({ error: message });
  }
});

router.get('/decisions/:address', (req, res) => {
  try {
    const { address } = req.params;
    if (!isAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const limit = Math.max(1, Math.min(50, Math.floor(toNumber(req.query.limit, 10))));
    const decisions = listRecentAiDecisions(address, limit);
    return res.json({
      address,
      total: decisions.length,
      decisions
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch decisions';
    return res.status(500).json({ error: message });
  }
});

export default router;
