import { Router } from 'express';
import { isAddress } from 'ethers';
import { demoReports } from '../data/demoReports';
import { getContract } from '../lib/contract';
import { reasonFromCode, reasonToCode } from '../lib/reasons';
import { SafetyReport } from '../types/safety';

const router = Router();

const toInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

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

router.get('/', async (req, res) => {
  try {
    const limit = toInt(req.query.limit, 20);
    const offset = toInt(req.query.offset, 0);
    const contract = getContract();

    if (!contract) {
      const sorted = [...demoReports].sort((a, b) => b.timestamp - a.timestamp);
      const reports = sorted.slice(offset, offset + limit);

      return res.json({
        reports,
        total: sorted.length,
        limit,
        offset,
        source: 'demo'
      });
    }

    const totalReports = Number(await contract.reportCount());
    const start = Math.max(0, totalReports - offset - limit);
    const end = totalReports - offset;
    const reports: SafetyReport[] = [];

    for (let i = end - 1; i >= start; i--) {
      if (i < 0) {
        break;
      }

      const rawReport = await contract.getReport(i);
      reports.push(normalizeReport(i, rawReport));
    }

    return res.json({
      reports,
      total: totalReports,
      limit,
      offset,
      source: 'onchain'
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, -1);
    if (id < 0) {
      return res.status(400).json({ error: 'Invalid report id' });
    }

    const contract = getContract();

    if (!contract) {
      const report = demoReports.find((entry) => entry.id === id);
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }
      return res.json(report);
    }

    const rawReport = await contract.getReport(id);
    return res.json(normalizeReport(id, rawReport));
  } catch {
    return res.status(404).json({ error: 'Report not found' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { targetAddress, nameTag, reason, evidence } = req.body as {
      targetAddress?: string;
      nameTag?: string;
      reason?: string;
      evidence?: string;
    };

    if (!targetAddress || !isAddress(targetAddress)) {
      return res.status(400).json({ error: 'Invalid targetAddress' });
    }

    if (!evidence || evidence.trim().length < 10) {
      return res.status(400).json({ error: 'Evidence must be at least 10 characters' });
    }

    return res.json({
      message: 'Prepare a wallet-signed transaction to submit this report on-chain.',
      method: 'submitReport',
      params: {
        targetAddress,
        nameTag: nameTag?.trim() ?? '',
        reason: reasonToCode(reason ?? 'Other'),
        evidence: evidence.trim()
      }
    });
  } catch {
    return res.status(500).json({ error: 'Failed to prepare report submission' });
  }
});

router.post('/:id/vote', async (req, res) => {
  try {
    const id = toInt(req.params.id, -1);
    const { upvote } = req.body as { upvote?: boolean };

    if (id < 0) {
      return res.status(400).json({ error: 'Invalid report id' });
    }

    if (typeof upvote !== 'boolean') {
      return res.status(400).json({ error: 'upvote must be boolean' });
    }

    const contract = getContract();
    if (!contract) {
      return res.json({
        message: 'Demo mode: prepare wallet transaction for voteOnReport.',
        method: 'voteOnReport',
        params: {
          reportId: id,
          upvote
        }
      });
    }

    const rawReport = await contract.getReport(id);
    if (rawReport.resolved) {
      return res.status(400).json({ error: 'Report already resolved' });
    }

    return res.json({
      message: 'Prepare a wallet-signed transaction to vote on this report.',
      method: 'voteOnReport',
      params: {
        reportId: id,
        upvote
      }
    });
  } catch {
    return res.status(500).json({ error: 'Failed to prepare vote transaction' });
  }
});

router.post('/:id/resolve', async (req, res) => {
  try {
    const id = toInt(req.params.id, -1);
    const { malicious } = req.body as { malicious?: boolean };

    if (id < 0) {
      return res.status(400).json({ error: 'Invalid report id' });
    }

    if (typeof malicious !== 'boolean') {
      return res.status(400).json({ error: 'malicious must be boolean' });
    }

    const contract = getContract();
    if (!contract) {
      return res.json({
        message: 'Demo mode: prepare wallet transaction for resolveReport.',
        method: 'resolveReport',
        params: {
          reportId: id,
          malicious
        }
      });
    }

    const canResolve = Boolean(await contract.canResolve(id, malicious));
    if (!canResolve) {
      return res.status(400).json({
        error: 'Resolution threshold not met for this direction'
      });
    }

    return res.json({
      message: 'Prepare a wallet-signed transaction to resolve this report.',
      method: 'resolveReport',
      params: {
        reportId: id,
        malicious
      }
    });
  } catch {
    return res.status(500).json({ error: 'Failed to prepare resolve transaction' });
  }
});

export default router;
