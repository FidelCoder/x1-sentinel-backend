import { TypedDataField, getAddress, isAddress, verifyTypedData } from 'ethers';
import { env } from '../config/env';
import {
  DepinAttestationPayload,
  DepinEip712Config,
  DepinHealthResponse,
  DepinNodeRecord,
  DepinNodeRegistration,
  DepinNodeType,
  DepinSeverity,
  DepinStoredAttestation,
  SignedDepinAttestation,
  SignedDepinNodeRegistration
} from '../types/depin';

const NODE_TYPES: DepinNodeType[] = ['home', 'edge', 'validator', 'sensor', 'mobile', 'other'];

const REGISTRATION_FIELDS: TypedDataField[] = [
  { name: 'nodeAddress', type: 'address' },
  { name: 'nodeType', type: 'string' },
  { name: 'region', type: 'string' },
  { name: 'metadataUri', type: 'string' },
  { name: 'timestamp', type: 'uint64' },
  { name: 'nonce', type: 'string' }
];

const ATTESTATION_FIELDS: TypedDataField[] = [
  { name: 'nodeAddress', type: 'address' },
  { name: 'subjectAddress', type: 'address' },
  { name: 'signalType', type: 'string' },
  { name: 'severity', type: 'uint8' },
  { name: 'healthScore', type: 'uint16' },
  { name: 'timestamp', type: 'uint64' },
  { name: 'nonce', type: 'string' },
  { name: 'payloadUri', type: 'string' }
];

const REGISTRATION_TYPES: Record<string, TypedDataField[]> = {
  NodeRegistration: REGISTRATION_FIELDS
};

const ATTESTATION_TYPES: Record<string, TypedDataField[]> = {
  NodeAttestation: ATTESTATION_FIELDS
};

interface DepinDomain {
  name: string;
  version: string;
  chainId: number;
}

interface NonceRecord {
  usedAt: number;
}

interface HealthQueryOptions {
  windowHours?: number;
  latestLimit?: number;
}

interface ValidationOptions {
  maxAgeSeconds?: number;
}

const nodeRegistry = new Map<string, DepinNodeRecord>();
const attestationsBySubject = new Map<string, DepinStoredAttestation[]>();
const attestationsByNode = new Map<string, DepinStoredAttestation[]>();
const nonceRegistry = new Map<string, NonceRecord>();

let attestationSequence = 0;

export class DepinError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'DepinError';
    this.statusCode = statusCode;
  }
}

const getDomain = (): DepinDomain => ({
  name: env.DEPIN_EIP712_DOMAIN_NAME,
  version: env.DEPIN_EIP712_DOMAIN_VERSION,
  chainId: env.CHAIN_ID
});

const normalizeAddress = (value: string, label: string): string => {
  if (!isAddress(value)) {
    throw new DepinError(`Invalid ${label}`);
  }
  return getAddress(value);
};

const normalizeNonce = (value: string): string => {
  const nonce = value.trim();
  if (nonce.length < 4 || nonce.length > 128) {
    throw new DepinError('nonce must be 4-128 characters');
  }
  return nonce;
};

const assertTimestamp = (timestamp: number, opts?: ValidationOptions): void => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    throw new DepinError('Invalid timestamp');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const skew = Math.abs(nowSec - Math.floor(timestamp));

  if (skew > env.DEPIN_MAX_CLOCK_SKEW_SECONDS && timestamp > nowSec) {
    throw new DepinError('timestamp is too far in the future');
  }

  const maxAgeSeconds = opts?.maxAgeSeconds ?? env.DEPIN_MAX_ATTESTATION_AGE_SECONDS;
  if (nowSec - timestamp > maxAgeSeconds) {
    throw new DepinError('timestamp is too old');
  }
};

const assertSignature = (label: string, signature: string): void => {
  if (typeof signature !== 'string' || signature.length < 20) {
    throw new DepinError(`${label} signature is missing or invalid`);
  }
};

const assertStringLength = (label: string, value: string, max: number): string => {
  const normalized = value.trim();
  if (!normalized.length) {
    throw new DepinError(`${label} is required`);
  }
  if (normalized.length > max) {
    throw new DepinError(`${label} is too long (max ${max})`);
  }
  return normalized;
};

const assertOptionalStringLength = (value: unknown, max: number): string => {
  if (typeof value !== 'string') {
    return '';
  }
  const normalized = value.trim();
  if (normalized.length > max) {
    throw new DepinError(`value is too long (max ${max})`);
  }
  return normalized;
};

const assertNodeType = (value: string): DepinNodeType => {
  if (!NODE_TYPES.includes(value as DepinNodeType)) {
    throw new DepinError(`Unsupported nodeType. Allowed: ${NODE_TYPES.join(', ')}`);
  }
  return value as DepinNodeType;
};

const assertSeverity = (value: number): DepinSeverity => {
  if (![0, 1, 2].includes(value)) {
    throw new DepinError('severity must be 0 (healthy), 1 (warning), or 2 (critical)');
  }
  return value as DepinSeverity;
};

const assertHealthScore = (value: number): number => {
  if (!Number.isFinite(value)) {
    throw new DepinError('healthScore must be numeric');
  }
  const score = Math.floor(value);
  if (score < 0 || score > 100) {
    throw new DepinError('healthScore must be between 0 and 100');
  }
  return score;
};

const pushWithTrim = <T>(map: Map<string, T[]>, key: string, value: T): void => {
  const existing = map.get(key) ?? [];
  existing.push(value);
  map.set(key, existing);
};

const pruneNonceRegistry = (): void => {
  const cutoff = Date.now() - env.DEPIN_NONCE_RETENTION_SECONDS * 1000;
  for (const [key, value] of nonceRegistry.entries()) {
    if (value.usedAt < cutoff) {
      nonceRegistry.delete(key);
    }
  }
};

const consumeNonce = (scope: string, nonce: string): void => {
  pruneNonceRegistry();
  const key = `${scope}:${nonce}`;
  if (nonceRegistry.has(key)) {
    throw new DepinError('Nonce already used (replay blocked)', 409);
  }
  nonceRegistry.set(key, { usedAt: Date.now() });
};

const pruneAttestations = (values: DepinStoredAttestation[]): DepinStoredAttestation[] => {
  const cutoff = Date.now() - env.DEPIN_ATTESTATION_RETENTION_SECONDS * 1000;
  return values.filter((entry) => entry.verifiedAt >= cutoff);
};

const maybePruneAddressStore = (map: Map<string, DepinStoredAttestation[]>, key: string): void => {
  const values = map.get(key);
  if (!values) {
    return;
  }
  map.set(key, pruneAttestations(values));
};

const updateNodeLastSeen = (nodeAddress: string, timestampMs: number): void => {
  const record = nodeRegistry.get(nodeAddress);
  if (!record) {
    return;
  }

  const nextLastSeen = record.lastSeenAt ? Math.max(record.lastSeenAt, timestampMs) : timestampMs;
  nodeRegistry.set(nodeAddress, { ...record, lastSeenAt: nextLastSeen });
};

const asRegistrationPayload = (input: DepinNodeRegistration): DepinNodeRegistration => {
  const nodeAddress = normalizeAddress(input.nodeAddress, 'registration.nodeAddress');
  const nodeType = assertNodeType(assertStringLength('registration.nodeType', input.nodeType, 32).toLowerCase());
  const region = assertStringLength('registration.region', input.region, 64);
  const metadataUri = assertOptionalStringLength(input.metadataUri, 512);
  const timestamp = Math.floor(input.timestamp);
  assertTimestamp(timestamp, { maxAgeSeconds: env.DEPIN_MAX_REGISTRATION_AGE_SECONDS });
  const nonce = normalizeNonce(input.nonce);

  return {
    nodeAddress,
    nodeType,
    region,
    metadataUri,
    timestamp,
    nonce
  };
};

const asAttestationPayload = (input: DepinAttestationPayload): DepinAttestationPayload => {
  const nodeAddress = normalizeAddress(input.nodeAddress, 'attestation.nodeAddress');
  const subjectAddress = normalizeAddress(input.subjectAddress, 'attestation.subjectAddress');
  const signalType = assertStringLength('attestation.signalType', input.signalType, 64).toLowerCase();
  const severity = assertSeverity(Number(input.severity));
  const healthScore = assertHealthScore(Number(input.healthScore));
  const timestamp = Math.floor(Number(input.timestamp));
  assertTimestamp(timestamp);
  const nonce = normalizeNonce(input.nonce);
  const payloadUri = assertOptionalStringLength(input.payloadUri, 512);

  return {
    nodeAddress,
    subjectAddress,
    signalType,
    severity,
    healthScore,
    timestamp,
    nonce,
    payloadUri
  };
};

const verifyNodeRegistrationSignature = (
  registration: DepinNodeRegistration,
  signature: string
): string => {
  const recovered = verifyTypedData(getDomain(), REGISTRATION_TYPES, registration, signature);
  return normalizeAddress(recovered, 'registration signature');
};

const verifyAttestationSignature = (attestation: DepinAttestationPayload, signature: string): string => {
  const recovered = verifyTypedData(getDomain(), ATTESTATION_TYPES, attestation, signature);
  return normalizeAddress(recovered, 'attestation signature');
};

const buildAttestationId = (subjectAddress: string, timestamp: number): string => {
  attestationSequence += 1;
  return `att_${subjectAddress.slice(2, 8).toLowerCase()}_${timestamp}_${attestationSequence}`;
};

const severityBucket = (severity: DepinSeverity): 'healthy' | 'warning' | 'critical' => {
  if (severity === 0) return 'healthy';
  if (severity === 1) return 'warning';
  return 'critical';
};

export const getDepinEip712Config = (): DepinEip712Config => ({
  domain: getDomain(),
  types: {
    nodeRegistration: REGISTRATION_FIELDS.map((entry) => ({ ...entry })),
    nodeAttestation: ATTESTATION_FIELDS.map((entry) => ({ ...entry }))
  },
  limits: {
    maxClockSkewSeconds: env.DEPIN_MAX_CLOCK_SKEW_SECONDS,
    maxAttestationAgeSeconds: env.DEPIN_MAX_ATTESTATION_AGE_SECONDS
  }
});

export const registerNode = (input: SignedDepinNodeRegistration): DepinNodeRecord => {
  if (!input || typeof input !== 'object') {
    throw new DepinError('Invalid request body');
  }

  const signature = input.signature;
  assertSignature('Registration', signature);

  const registration = asRegistrationPayload(input.registration);
  const signer = verifyNodeRegistrationSignature(registration, signature);
  if (signer !== registration.nodeAddress) {
    throw new DepinError('Registration signature does not match nodeAddress', 401);
  }

  consumeNonce(`register:${registration.nodeAddress}`, registration.nonce);

  const label = typeof input.label === 'string' ? input.label.trim() : '';
  const record: DepinNodeRecord = {
    nodeAddress: registration.nodeAddress,
    nodeType: registration.nodeType,
    region: registration.region,
    metadataUri: registration.metadataUri,
    label: label.length ? label.slice(0, 120) : null,
    active: true,
    registeredAt: registration.timestamp * 1000,
    lastSeenAt: null
  };

  nodeRegistry.set(record.nodeAddress, record);
  return record;
};

export const listNodes = (): DepinNodeRecord[] => {
  return Array.from(nodeRegistry.values()).sort((a, b) => b.registeredAt - a.registeredAt);
};

export const getNode = (address: string): DepinNodeRecord | null => {
  const normalized = normalizeAddress(address, 'node address');
  return nodeRegistry.get(normalized) ?? null;
};

export const setNodeActive = (address: string, active: boolean): DepinNodeRecord => {
  const normalized = normalizeAddress(address, 'node address');
  const existing = nodeRegistry.get(normalized);
  if (!existing) {
    throw new DepinError('Node not found', 404);
  }

  const next = { ...existing, active };
  nodeRegistry.set(normalized, next);
  return next;
};

export const ingestAttestation = (input: SignedDepinAttestation): DepinStoredAttestation => {
  if (!input || typeof input !== 'object') {
    throw new DepinError('Invalid request body');
  }

  assertSignature('Attestation', input.signature);
  const attestation = asAttestationPayload(input.attestation);
  const node = nodeRegistry.get(attestation.nodeAddress);

  if (env.DEPIN_REQUIRE_NODE_REGISTRATION && !node) {
    throw new DepinError('Node is not registered', 404);
  }

  if (node && !node.active) {
    throw new DepinError('Node is currently inactive', 403);
  }

  const signer = verifyAttestationSignature(attestation, input.signature);
  if (signer !== attestation.nodeAddress) {
    throw new DepinError('Attestation signature does not match nodeAddress', 401);
  }

  consumeNonce(`attest:${attestation.nodeAddress}`, attestation.nonce);

  maybePruneAddressStore(attestationsBySubject, attestation.subjectAddress);
  maybePruneAddressStore(attestationsByNode, attestation.nodeAddress);

  const record: DepinStoredAttestation = {
    ...attestation,
    id: buildAttestationId(attestation.subjectAddress, attestation.timestamp),
    signer,
    verifiedAt: Date.now()
  };

  pushWithTrim(attestationsBySubject, attestation.subjectAddress, record);
  pushWithTrim(attestationsByNode, attestation.nodeAddress, record);
  updateNodeLastSeen(attestation.nodeAddress, record.timestamp * 1000);

  return record;
};

export const getAddressHealth = (address: string, opts?: HealthQueryOptions): DepinHealthResponse => {
  const normalizedAddress = normalizeAddress(address, 'address');
  const requestedWindow = opts?.windowHours ?? env.DEPIN_HEALTH_WINDOW_HOURS;
  const windowHours = Math.max(1, Math.min(168, Math.floor(requestedWindow)));
  const latestLimit = Math.max(1, Math.min(20, Math.floor(opts?.latestLimit ?? 6)));
  const windowMs = windowHours * 60 * 60 * 1000;
  const cutoff = Date.now() - windowMs;

  maybePruneAddressStore(attestationsBySubject, normalizedAddress);

  const all = attestationsBySubject.get(normalizedAddress) ?? [];
  const windowed = all.filter((entry) => entry.timestamp * 1000 >= cutoff);
  const sorted = [...windowed].sort((a, b) => b.timestamp - a.timestamp);
  const latest = sorted.slice(0, latestLimit);

  const severity = {
    healthy: 0,
    warning: 0,
    critical: 0
  };
  const bySignalType: Record<string, number> = {};
  const nodes = new Set<string>();

  let scoreTotal = 0;
  let latestTimestamp: number | null = null;

  for (const item of windowed) {
    severity[severityBucket(item.severity)] += 1;
    bySignalType[item.signalType] = (bySignalType[item.signalType] ?? 0) + 1;
    nodes.add(item.nodeAddress);
    scoreTotal += item.healthScore;
    if (latestTimestamp === null || item.timestamp > latestTimestamp) {
      latestTimestamp = item.timestamp;
    }
  }

  const total = windowed.length;
  const avgScore = total > 0 ? Math.round(scoreTotal / total) : 0;
  const confidenceRaw = Math.min(1, (nodes.size / 5) * 0.6 + Math.min(total / 20, 1) * 0.4);
  const confidence = Number(confidenceRaw.toFixed(2));

  let status: DepinHealthResponse['summary']['status'] = 'unknown';
  if (total > 0) {
    if (severity.critical >= 2 || avgScore < 45) status = 'critical';
    else if (severity.warning > severity.healthy || avgScore < 75) status = 'warning';
    else status = 'healthy';
  }

  return {
    address: normalizedAddress,
    windowHours,
    generatedAt: new Date().toISOString(),
    summary: {
      status,
      healthScore: avgScore,
      confidence,
      latestTimestamp
    },
    telemetry: {
      totalAttestations: total,
      uniqueNodes: nodes.size,
      bySeverity: severity,
      bySignalType
    },
    latestAttestations: latest
  };
};
