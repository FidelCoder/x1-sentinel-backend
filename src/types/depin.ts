export type DepinNodeType = 'home' | 'edge' | 'validator' | 'sensor' | 'mobile' | 'other';

export type DepinSeverity = 0 | 1 | 2;

export interface DepinNodeRegistration {
  nodeAddress: string;
  nodeType: DepinNodeType;
  region: string;
  metadataUri: string;
  timestamp: number;
  nonce: string;
}

export interface SignedDepinNodeRegistration {
  registration: DepinNodeRegistration;
  signature: string;
  label?: string;
}

export interface DepinNodeRecord {
  nodeAddress: string;
  nodeType: DepinNodeType;
  region: string;
  metadataUri: string;
  label: string | null;
  active: boolean;
  registeredAt: number;
  lastSeenAt: number | null;
}

export interface DepinAttestationPayload {
  nodeAddress: string;
  subjectAddress: string;
  signalType: string;
  severity: DepinSeverity;
  healthScore: number;
  timestamp: number;
  nonce: string;
  payloadUri: string;
}

export interface SignedDepinAttestation {
  attestation: DepinAttestationPayload;
  signature: string;
}

export interface DepinStoredAttestation extends DepinAttestationPayload {
  id: string;
  verifiedAt: number;
  signer: string;
}

export interface DepinEip712Config {
  domain: {
    name: string;
    version: string;
    chainId: number;
  };
  types: {
    nodeRegistration: Array<{ name: string; type: string }>;
    nodeAttestation: Array<{ name: string; type: string }>;
  };
  limits: {
    maxClockSkewSeconds: number;
    maxAttestationAgeSeconds: number;
  };
}

export interface DepinHealthSummary {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  healthScore: number;
  confidence: number;
  latestTimestamp: number | null;
}

export interface DepinHealthResponse {
  address: string;
  windowHours: number;
  generatedAt: string;
  summary: DepinHealthSummary;
  telemetry: {
    totalAttestations: number;
    uniqueNodes: number;
    bySeverity: {
      healthy: number;
      warning: number;
      critical: number;
    };
    bySignalType: Record<string, number>;
  };
  latestAttestations: DepinStoredAttestation[];
}
