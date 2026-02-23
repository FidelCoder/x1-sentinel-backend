import { Response, Router } from 'express';
import {
  DepinError,
  getAddressHealth,
  getDepinEip712Config,
  getNode,
  ingestAttestation,
  listNodes,
  registerNode,
  setNodeActive
} from '../services/depin';
import { SignedDepinAttestation, SignedDepinNodeRegistration } from '../types/depin';

const router = Router();

const toBool = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return fallback;
};

const toInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.floor(parsed);
};

const parseOptionalInt = (value: unknown): number | undefined => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.floor(parsed);
};

const handleError = (res: Response, error: unknown, fallback: string): void => {
  if (error instanceof DepinError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  res.status(500).json({ error: fallback });
};

router.get('/eip712', (_req, res) => {
  res.json(getDepinEip712Config());
});

router.post('/nodes/register', (req, res) => {
  try {
    const payload = req.body as SignedDepinNodeRegistration;
    const node = registerNode(payload);
    return res.status(201).json({
      message: 'Node registered',
      node
    });
  } catch (error) {
    handleError(res, error, 'Failed to register node');
    return;
  }
});

router.get('/nodes', (_req, res) => {
  try {
    const nodes = listNodes();
    return res.json({
      total: nodes.length,
      nodes
    });
  } catch (error) {
    handleError(res, error, 'Failed to list nodes');
    return;
  }
});

router.get('/nodes/:address', (req, res) => {
  try {
    const node = getNode(req.params.address);
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }
    return res.json(node);
  } catch (error) {
    handleError(res, error, 'Failed to fetch node');
    return;
  }
});

router.patch('/nodes/:address', (req, res) => {
  try {
    const active = toBool(req.body?.active, true);
    const node = setNodeActive(req.params.address, active);
    return res.json({
      message: `Node ${active ? 'activated' : 'deactivated'}`,
      node
    });
  } catch (error) {
    handleError(res, error, 'Failed to update node');
    return;
  }
});

router.post('/attest', (req, res) => {
  try {
    const payload = req.body as SignedDepinAttestation;
    const record = ingestAttestation(payload);
    return res.status(201).json({
      message: 'Attestation verified and stored',
      attestation: record
    });
  } catch (error) {
    handleError(res, error, 'Failed to ingest attestation');
    return;
  }
});

router.get('/health/:address', (req, res) => {
  try {
    const windowHours = parseOptionalInt(req.query.windowHours);
    const limit = toInt(req.query.latest, 6);
    const health = getAddressHealth(req.params.address, {
      windowHours,
      latestLimit: limit
    });
    return res.json(health);
  } catch (error) {
    handleError(res, error, 'Failed to compute DePIN health');
    return;
  }
});

export default router;
