export type ReportReason = 'Phishing' | 'Scam' | 'RugPull' | 'MaliciousContract' | 'Spam' | 'Other';

export interface SafetyReport {
  id: number;
  reporter: string;
  targetAddress: string;
  nameTag: string | null;
  reason: ReportReason;
  evidence: string;
  timestamp: number;
  upvotes: number;
  downvotes: number;
  resolved: boolean;
}

export interface PrivacyFactors {
  transactionActivity: number;
  balanceExposure: number;
  publicScrutiny: number;
  addressReuse: number;
  isContract: boolean;
}

export type PrivacyGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface PrivacyAnalysis {
  score: number;
  grade: PrivacyGrade;
  factors: PrivacyFactors;
  recommendations: string[];
}

export interface ExternalFlagSource {
  source: string;
  flagged: boolean;
  details: string | null;
}

export interface ExternalFlags {
  scamLists: ExternalFlagSource[];
  totalFlags: number;
}

export interface CheckResult {
  address: string;
  isFlagged: boolean;
  riskScore: number;
  privacyScore: number;
  privacyGrade: PrivacyGrade;
  privacyFactors: PrivacyFactors;
  privacyRecommendations: string[];
  reportCount: number;
  reports: SafetyReport[];
  externalFlags: ExternalFlags;
  mode: 'onchain' | 'demo';
  timestamp: string;
}
