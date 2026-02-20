import { ReportReason } from '../types/safety';

const REASON_LABELS: ReportReason[] = [
  'Phishing',
  'Scam',
  'RugPull',
  'MaliciousContract',
  'Spam',
  'Other'
];

export const reasonFromCode = (code: number): ReportReason => {
  return REASON_LABELS[code] ?? 'Other';
};

export const reasonToCode = (reason: string): number => {
  const normalized = reason.trim();
  const code = REASON_LABELS.indexOf(normalized as ReportReason);
  return code >= 0 ? code : 5;
};
