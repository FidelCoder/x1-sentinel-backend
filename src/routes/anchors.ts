import { Router } from 'express';
import { isAddress } from 'ethers';
import { env } from '../config/env';
import { getAiDecisionAnchorContract, getDepinAnchorContract } from '../lib/anchors';

const router = Router();

const HEX_32_REGEX = /^0x[a-fA-F0-9]{64}$/;

const toInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.floor(parsed);
};

const toBps = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.min(10000, Math.round(parsed)));
};

const toStringValue = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const asAddress = (value: unknown, label: string): string => {
  const normalized = toStringValue(value);
  if (!isAddress(normalized)) {
    throw new Error(`Invalid ${label}`);
  }
  return normalized;
};

const asBytes32 = (value: unknown, label: string): string => {
  const normalized = toStringValue(value);
  if (!HEX_32_REGEX.test(normalized)) {
    throw new Error(`${label} must be bytes32 hex`);
  }
  return normalized;
};

const actionToCode = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const numeric = Math.floor(value);
    if (numeric >= 0 && numeric <= 255) {
      return numeric;
    }
  }

  const text = toStringValue(value).toLowerCase();
  if (text === 'allow') return 0;
  if (text === 'warn') return 1;
  if (text === 'challenge') return 2;
  if (text === 'manual_review' || text === 'manual-review') return 3;
  if (text === 'block') return 4;
  return 0;
};

const codeToAction = (value: number): string => {
  if (value === 0) return 'allow';
  if (value === 1) return 'warn';
  if (value === 2) return 'challenge';
  if (value === 3) return 'manual_review';
  if (value === 4) return 'block';
  return `unknown_${value}`;
};

const toPercent = (bps: number): number => {
  return Number((Math.max(0, Math.min(10000, bps)) / 100).toFixed(2));
};

router.get('/config', (_req, res) => {
  const aiContract = getAiDecisionAnchorContract();
  const depinContract = getDepinAnchorContract();

  return res.json({
    aiDecisionAnchorAddress: env.AI_DECISION_ANCHOR_ADDRESS,
    depinAnchorAddress: env.DEPIN_ANCHOR_ADDRESS,
    aiEnabled: Boolean(aiContract),
    depinEnabled: Boolean(depinContract)
  });
});

router.post('/ai/prepare', (req, res) => {
  try {
    if (!isAddress(env.AI_DECISION_ANCHOR_ADDRESS)) {
      return res.status(400).json({ error: 'AI decision anchor address is not configured' });
    }

    const subjectAddress = asAddress(
      req.body?.subjectAddress ?? req.body?.address ?? req.body?.aiDecision?.address,
      'subjectAddress'
    );

    const inputHash = asBytes32(
      req.body?.inputHash ?? req.body?.aiDecision?.artifacts?.inputHash,
      'inputHash'
    );
    const outputHash = asBytes32(
      req.body?.outputHash ?? req.body?.aiDecision?.artifacts?.outputHash,
      'outputHash'
    );

    const modelVersionHash = asBytes32(
      req.body?.modelVersionHash ??
        req.body?.aiDecision?.modelVersionHash ??
        req.body?.aiDecision?.artifacts?.modelVersionHash ??
        req.body?.aiDecision?.artifacts?.modelHash,
      'modelVersionHash'
    );

    const riskScore = Number(
      req.body?.riskScore ?? req.body?.aiDecision?.model?.riskScore ?? req.body?.aiDecision?.riskScore ?? 0
    );
    const confidence = Number(
      req.body?.confidence ?? req.body?.aiDecision?.model?.confidence ?? req.body?.aiDecision?.confidence ?? 0
    );
    const policyAction = actionToCode(
      req.body?.policyAction ?? req.body?.aiDecision?.policy?.action ?? req.body?.aiDecision?.policyAction
    );

    const riskScoreBps = toBps(riskScore * 100, 0);
    const confidenceBps = toBps(confidence * 10000, 0);
    const metadataUri = toStringValue(req.body?.metadataUri ?? req.body?.aiDecision?.metadataUri);

    return res.json({
      message: 'Prepare a wallet-signed transaction to anchor this AI decision.',
      contractAddress: env.AI_DECISION_ANCHOR_ADDRESS,
      method: 'anchorDecision',
      params: {
        subjectAddress,
        inputHash,
        outputHash,
        modelVersionHash,
        riskScoreBps,
        confidenceBps,
        policyAction,
        metadataUri
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to prepare AI decision anchor transaction';
    return res.status(400).json({ error: message });
  }
});

router.post('/depin/prepare', (req, res) => {
  try {
    if (!isAddress(env.DEPIN_ANCHOR_ADDRESS)) {
      return res.status(400).json({ error: 'DePIN anchor address is not configured' });
    }

    const subjectAddress = asAddress(req.body?.subjectAddress ?? req.body?.address, 'subjectAddress');
    const attestationRoot = asBytes32(req.body?.attestationRoot ?? req.body?.root, 'attestationRoot');
    const attestationCount = Math.max(0, Math.min(1_000_000, toInt(req.body?.attestationCount, 0)));
    const healthScore = Number(req.body?.healthScore ?? 0);
    const confidence = Number(req.body?.confidence ?? 0);
    const healthScoreBps = toBps(healthScore * 100, 0);
    const confidenceBps = toBps(confidence * 10000, 0);
    const metadataUri = toStringValue(req.body?.metadataUri);

    return res.json({
      message: 'Prepare a wallet-signed transaction to anchor DePIN telemetry.',
      contractAddress: env.DEPIN_ANCHOR_ADDRESS,
      method: 'anchorSubjectTelemetry',
      params: {
        subjectAddress,
        attestationRoot,
        attestationCount,
        healthScoreBps,
        confidenceBps,
        metadataUri
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to prepare DePIN anchor transaction';
    return res.status(400).json({ error: message });
  }
});

router.get('/ai/:address', async (req, res) => {
  try {
    const subjectAddress = asAddress(req.params.address, 'address');
    const contract = getAiDecisionAnchorContract();
    if (!contract) {
      return res.status(400).json({ error: 'AI decision anchor contract is unavailable' });
    }

    const limit = Math.max(1, Math.min(50, toInt(req.query.limit, 10)));
    const ids = (await contract.getDecisionIdsForAddress(subjectAddress)) as bigint[];
    const selected = ids.slice(Math.max(0, ids.length - limit)).reverse();
    const decisions: Array<Record<string, unknown>> = [];

    for (const id of selected) {
      const raw = await contract.decisions(id);
      decisions.push({
        decisionId: Number(id),
        subjectAddress: raw.subjectAddress,
        inputHash: raw.inputHash,
        outputHash: raw.outputHash,
        modelVersionHash: raw.modelVersionHash,
        riskScore: toPercent(Number(raw.riskScoreBps)),
        confidence: Number((Number(raw.confidenceBps) / 10000).toFixed(4)),
        policyAction: codeToAction(Number(raw.policyAction)),
        timestamp: Number(raw.timestamp) * 1000,
        publisher: raw.publisher,
        metadataUri: raw.metadataUri
      });
    }

    return res.json({
      address: subjectAddress,
      total: ids.length,
      decisions
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch AI anchors';
    return res.status(500).json({ error: message });
  }
});

router.get('/depin/:address', async (req, res) => {
  try {
    const subjectAddress = asAddress(req.params.address, 'address');
    const contract = getDepinAnchorContract();
    if (!contract) {
      return res.status(400).json({ error: 'DePIN anchor contract is unavailable' });
    }

    const limit = Math.max(1, Math.min(50, toInt(req.query.limit, 10)));
    const ids = (await contract.getAnchorIdsForAddress(subjectAddress)) as bigint[];
    const selected = ids.slice(Math.max(0, ids.length - limit)).reverse();
    const anchors: Array<Record<string, unknown>> = [];

    for (const id of selected) {
      const raw = await contract.anchors(id);
      anchors.push({
        anchorId: Number(id),
        subjectAddress: raw.subjectAddress,
        attestationRoot: raw.attestationRoot,
        attestationCount: Number(raw.attestationCount),
        healthScore: toPercent(Number(raw.healthScoreBps)),
        confidence: Number((Number(raw.confidenceBps) / 10000).toFixed(4)),
        timestamp: Number(raw.timestamp) * 1000,
        publisher: raw.publisher,
        metadataUri: raw.metadataUri
      });
    }

    return res.json({
      address: subjectAddress,
      total: ids.length,
      anchors
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch DePIN anchors';
    return res.status(500).json({ error: message });
  }
});

export default router;
