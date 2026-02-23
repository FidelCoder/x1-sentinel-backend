export type AiRiskClassification = 'low' | 'medium' | 'high' | 'critical';

export type AiAutomationAction = 'none' | 'notify' | 'soft_block' | 'hard_block' | 'manual_review';

export type AiPolicyAction = 'allow' | 'warn' | 'challenge' | 'manual_review' | 'block';

export interface AiModelDecision {
  riskScore: number;
  confidence: number;
  classification: AiRiskClassification;
  summary: string;
  reasons: string[];
  recommendedActions: string[];
  automation: AiAutomationAction;
}

export interface AiPolicyDecision {
  action: AiPolicyAction;
  autoExecute: boolean;
  reasons: string[];
}

export interface AiDecisionArtifacts {
  inputHash: string;
  outputHash: string;
  modelVersionHash: string;
  modelProvider: 'heuristic' | 'openai';
  modelName: string;
  modelVersion: string;
  generatedAt: string;
}

export interface AiRiskDecision {
  address: string;
  model: AiModelDecision;
  policy: AiPolicyDecision;
  artifacts: AiDecisionArtifacts;
}

export interface AiRiskContext {
  address: string;
  baseRiskScore: number;
  reportCount: number;
  unresolvedReportCount: number;
  isFlagged: boolean;
  privacyScore: number;
  privacyGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  externalFlagCount: number;
  depinStatus: 'healthy' | 'warning' | 'critical' | 'unknown';
  depinHealthScore: number;
  depinConfidence: number;
  topReasons: string[];
}
