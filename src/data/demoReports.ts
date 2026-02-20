import { SafetyReport } from '../types/safety';

const now = Date.now();

export const demoReports: SafetyReport[] = [
  {
    id: 2,
    reporter: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    targetAddress: '0x111111111117dC0aa78b770fA6A738034120C302',
    nameTag: 'router-honeypot',
    reason: 'Phishing',
    evidence: 'Users reported cloned swap interface redirecting approvals.',
    timestamp: now - 1000 * 60 * 30,
    upvotes: 8,
    downvotes: 1,
    resolved: false,
    malicious: false,
    resolvedBy: '0x0000000000000000000000000000000000000000',
    resolvedAt: 0
  },
  {
    id: 1,
    reporter: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    targetAddress: '0x22222222222A7f2f2D0efA7D2A6fD6b88E59f6a9',
    nameTag: 'fake-airdrop',
    reason: 'Scam',
    evidence: 'Airdrop page asks for approval then drains token balances.',
    timestamp: now - 1000 * 60 * 90,
    upvotes: 5,
    downvotes: 0,
    resolved: false,
    malicious: false,
    resolvedBy: '0x0000000000000000000000000000000000000000',
    resolvedAt: 0
  },
  {
    id: 0,
    reporter: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    targetAddress: '0x33333333333b3f5A6b8Afb5f76D2f21C90eCeA31',
    nameTag: null,
    reason: 'Spam',
    evidence: 'Repeated dust transactions tied to fake support inbox links.',
    timestamp: now - 1000 * 60 * 180,
    upvotes: 2,
    downvotes: 3,
    resolved: false,
    malicious: false,
    resolvedBy: '0x0000000000000000000000000000000000000000',
    resolvedAt: 0
  }
];
