import { createHash } from 'crypto';
import { isAddress } from 'ethers';
import { env } from '../config/env';
import { AiModelDecision, AiPolicyAction, AiPolicyDecision, AiRiskContext, AiRiskDecision } from '../types/ai';

interface StoredDecisionState {
  byAddress: Map<string, AiRiskDecision[]>;
}

interface OpenAiDecisionResponse {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}

const state: StoredDecisionState = {
  byAddress: new Map<string, AiRiskDecision[]>()
};

const AI_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['riskScore', 'confidence', 'classification', 'summary', 'reasons', 'recommendedActions', 'automation'],
  properties: {
    riskScore: { type: 'number', minimum: 0, maximum: 100 },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    classification: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
    summary: { type: 'string', minLength: 8, maxLength: 280 },
    reasons: {
      type: 'array',
      minItems: 1,
      maxItems: 8,
      items: { type: 'string', minLength: 3, maxLength: 200 }
    },
    recommendedActions: {
      type: 'array',
      minItems: 0,
      maxItems: 8,
      items: { type: 'string', minLength: 3, maxLength: 200 }
    },
    automation: { type: 'string', enum: ['none', 'notify', 'soft_block', 'hard_block', 'manual_review'] }
  }
} as const;

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const normalizeAddress = (address: string): string => {
  if (!isAddress(address)) {
    throw new Error('Invalid address for AI scoring context');
  }
  return address;
};

const stableJson = (input: unknown): string => {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(normalize);
    }

    if (value && typeof value === 'object') {
      const source = value as Record<string, unknown>;
      const keys = Object.keys(source).sort((a, b) => a.localeCompare(b));
      const out: Record<string, unknown> = {};
      for (const key of keys) {
        out[key] = normalize(source[key]);
      }
      return out;
    }

    return value;
  };

  return JSON.stringify(normalize(input));
};

const sha256 = (value: string): string => {
  return createHash('sha256').update(value).digest('hex');
};

const toFinite = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
    .slice(0, 8);
};

const normalizeContext = (input: AiRiskContext): AiRiskContext => {
  return {
    address: normalizeAddress(input.address),
    baseRiskScore: clamp(Math.round(toFinite(input.baseRiskScore, 0)), 0, 100),
    reportCount: clamp(Math.floor(toFinite(input.reportCount, 0)), 0, 100000),
    unresolvedReportCount: clamp(Math.floor(toFinite(input.unresolvedReportCount, 0)), 0, 100000),
    isFlagged: Boolean(input.isFlagged),
    privacyScore: clamp(Math.round(toFinite(input.privacyScore, 0)), 0, 100),
    privacyGrade: input.privacyGrade,
    externalFlagCount: clamp(Math.floor(toFinite(input.externalFlagCount, 0)), 0, 100000),
    depinStatus: input.depinStatus,
    depinHealthScore: clamp(Math.round(toFinite(input.depinHealthScore, 0)), 0, 100),
    depinConfidence: clamp(toFinite(input.depinConfidence, 0), 0, 1),
    topReasons: asStringList(input.topReasons)
  };
};

const classify = (score: number): AiModelDecision['classification'] => {
  if (score >= 85) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
};

const automationFor = (
  classification: AiModelDecision['classification'],
  confidence: number
): AiModelDecision['automation'] => {
  if (classification === 'critical') return confidence >= 0.8 ? 'hard_block' : 'manual_review';
  if (classification === 'high') return confidence >= 0.7 ? 'soft_block' : 'manual_review';
  if (classification === 'medium') return 'notify';
  return 'none';
};

const heuristicDecision = (context: AiRiskContext): AiModelDecision => {
  let score = context.baseRiskScore * 0.5;
  score += (100 - context.privacyScore) * 0.18;
  score += Math.min(context.externalFlagCount * 12, 24);
  score += Math.min(context.unresolvedReportCount * 4, 20);
  score += context.isFlagged ? 12 : 0;

  if (context.depinStatus === 'critical') score += 18;
  else if (context.depinStatus === 'warning') score += 9;
  else if (context.depinStatus === 'healthy') score -= 5;

  score += (100 - context.depinHealthScore) * 0.12 * context.depinConfidence;
  score = clamp(Math.round(score), 0, 100);

  const classification = classify(score);

  const confidenceBase = 0.34
    + Math.min(context.unresolvedReportCount / 12, 1) * 0.2
    + Math.min(context.externalFlagCount / 4, 1) * 0.15
    + context.depinConfidence * 0.2
    + (context.isFlagged ? 0.12 : 0);
  const confidence = Number(clamp(confidenceBase, 0.2, 0.98).toFixed(2));

  const reasons: string[] = [];
  if (context.unresolvedReportCount > 0) {
    reasons.push(`${context.unresolvedReportCount} unresolved community report(s).`);
  }
  if (context.externalFlagCount > 0) {
    reasons.push(`${context.externalFlagCount} external intel source(s) raised flags.`);
  }
  if (context.privacyScore < 70) {
    reasons.push(`Low privacy score (${context.privacyScore}/100) increases exposure risk.`);
  }
  if (context.depinStatus !== 'unknown') {
    reasons.push(
      `DePIN telemetry status is ${context.depinStatus} with health ${context.depinHealthScore}/100 (confidence ${Math.round(
        context.depinConfidence * 100
      )}%).`
    );
  }
  if (context.topReasons.length > 0) {
    reasons.push(`Recent report reasons: ${context.topReasons.slice(0, 3).join(', ')}.`);
  }
  if (!reasons.length) {
    reasons.push('No high-confidence adverse signals were detected in the current window.');
  }

  const recommendedActions: string[] = [];
  if (classification === 'critical' || classification === 'high') {
    recommendedActions.push('Require manual reviewer approval for sensitive flows.');
    recommendedActions.push('Add temporary wallet interaction challenges for high-value actions.');
  } else if (classification === 'medium') {
    recommendedActions.push('Display contextual warnings before user confirmations.');
    recommendedActions.push('Increase telemetry sampling frequency for this address.');
  } else {
    recommendedActions.push('Continue monitoring with routine health polling.');
  }

  const summary =
    classification === 'critical'
      ? 'High-confidence malicious risk profile detected.'
      : classification === 'high'
        ? 'Elevated risk profile detected from aggregated onchain and telemetry signals.'
        : classification === 'medium'
          ? 'Moderate risk profile detected; caution and monitoring are advised.'
          : 'Low current risk profile with no dominant threat signal.';

  return {
    riskScore: score,
    confidence,
    classification,
    summary,
    reasons: reasons.slice(0, 6),
    recommendedActions: recommendedActions.slice(0, 6),
    automation: automationFor(classification, confidence)
  };
};

const coerceString = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const validateModelDecision = (value: unknown): AiModelDecision => {
  const input = value as Partial<AiModelDecision>;

  const riskScore = clamp(Math.round(toFinite(input.riskScore, NaN)), 0, 100);
  const confidence = clamp(toFinite(input.confidence, NaN), 0, 1);
  const classification = coerceString(input.classification) as AiModelDecision['classification'];
  const summary = coerceString(input.summary);
  const reasons = asStringList(input.reasons);
  const recommendedActions = asStringList(input.recommendedActions);
  const automation = coerceString(input.automation) as AiModelDecision['automation'];

  if (!Number.isFinite(riskScore)) throw new Error('Invalid model output: riskScore');
  if (!Number.isFinite(confidence)) throw new Error('Invalid model output: confidence');
  if (!['low', 'medium', 'high', 'critical'].includes(classification)) {
    throw new Error('Invalid model output: classification');
  }
  if (summary.length < 8) throw new Error('Invalid model output: summary');
  if (reasons.length < 1) throw new Error('Invalid model output: reasons');
  if (!['none', 'notify', 'soft_block', 'hard_block', 'manual_review'].includes(automation)) {
    throw new Error('Invalid model output: automation');
  }

  return {
    riskScore,
    confidence: Number(confidence.toFixed(2)),
    classification,
    summary,
    reasons,
    recommendedActions,
    automation
  };
};

const extractOpenAiText = (payload: OpenAiDecisionResponse): string | null => {
  if (typeof payload.output_text === 'string' && payload.output_text.trim().length > 0) {
    return payload.output_text.trim();
  }

  if (!Array.isArray(payload.output)) {
    return null;
  }

  for (const item of payload.output) {
    if (!Array.isArray(item.content)) {
      continue;
    }
    for (const part of item.content) {
      if (typeof part.text === 'string' && part.text.trim().length > 0) {
        return part.text.trim();
      }
    }
  }

  return null;
};

const callOpenAiDecision = async (context: AiRiskContext): Promise<AiModelDecision> => {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY missing');
  }

  const endpoint = `${env.AI_OPENAI_BASE_URL.replace(/\/$/, '')}/responses`;
  const promptContext = {
    schemaVersion: '1.0',
    context
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: env.AI_OPENAI_MODEL,
      temperature: 0.1,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: [
                'You are an onchain safety model.',
                'Return only JSON matching the provided schema.',
                'Use concise, evidence-backed explanations.',
                'Do not include markdown.'
              ].join(' ')
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify(promptContext)
            }
          ]
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'x1_sentinel_ai_risk_decision',
          schema: AI_OUTPUT_SCHEMA,
          strict: true
        }
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI scoring failed (${response.status}): ${body.slice(0, 240)}`);
  }

  const payload = (await response.json()) as OpenAiDecisionResponse;
  const text = extractOpenAiText(payload);

  if (!text) {
    throw new Error('OpenAI scoring failed: empty model output');
  }

  const parsed = JSON.parse(text) as unknown;
  return validateModelDecision(parsed);
};

const stepUpAction = (action: AiPolicyAction): AiPolicyAction => {
  if (action === 'allow') return 'warn';
  if (action === 'warn') return 'challenge';
  if (action === 'challenge') return 'manual_review';
  if (action === 'manual_review') return 'block';
  return 'block';
};

const buildPolicy = (context: AiRiskContext, model: AiModelDecision): AiPolicyDecision => {
  const reasons: string[] = [];
  let action: AiPolicyAction = 'allow';

  if (model.riskScore >= env.AI_POLICY_WARN_THRESHOLD || model.classification === 'medium') {
    action = 'warn';
    reasons.push('Risk exceeds warning threshold.');
  }

  if (model.riskScore >= env.AI_POLICY_CHALLENGE_THRESHOLD || model.classification === 'high') {
    action = 'challenge';
    reasons.push('Risk exceeds challenge threshold.');
  }

  if (model.riskScore >= env.AI_POLICY_BLOCK_THRESHOLD || model.classification === 'critical') {
    action = 'block';
    reasons.push('Risk exceeds block threshold.');
  }

  if (context.depinStatus === 'critical') {
    action = stepUpAction(action);
    reasons.push('DePIN status is critical.');
  } else if (context.depinStatus === 'warning' && action === 'allow') {
    action = 'warn';
    reasons.push('DePIN status is warning.');
  }

  if (model.confidence < env.AI_POLICY_MIN_AUTOMATION_CONFIDENCE && action !== 'allow') {
    action = action === 'block' ? 'manual_review' : stepUpAction(action);
    reasons.push('Confidence below automation threshold.');
  }

  const autoExecute =
    action === 'allow' || action === 'warn'
      ? true
      : model.confidence >= env.AI_POLICY_MIN_AUTOMATION_CONFIDENCE && action === 'challenge';

  return {
    action,
    autoExecute,
    reasons: reasons.length ? reasons : ['No policy escalation triggered.']
  };
};

const storeDecision = (decision: AiRiskDecision): void => {
  const key = decision.address.toLowerCase();
  const list = state.byAddress.get(key) ?? [];
  list.unshift(decision);
  if (list.length > env.AI_DECISION_RETENTION) {
    list.length = env.AI_DECISION_RETENTION;
  }
  state.byAddress.set(key, list);
};

export const listRecentAiDecisions = (address: string, limit = 10): AiRiskDecision[] => {
  const key = normalizeAddress(address).toLowerCase();
  const safeLimit = clamp(Math.floor(limit), 1, 50);
  const list = state.byAddress.get(key) ?? [];
  return list.slice(0, safeLimit);
};

export const getAiConfig = (): {
  mode: 'heuristic' | 'openai';
  model: string;
  policy: {
    warnThreshold: number;
    challengeThreshold: number;
    blockThreshold: number;
    minAutomationConfidence: number;
  };
} => ({
  mode: env.AI_SCORING_MODE,
  model: env.AI_SCORING_MODE === 'openai' ? env.AI_OPENAI_MODEL : 'x1-heuristic-risk-v1',
  policy: {
    warnThreshold: env.AI_POLICY_WARN_THRESHOLD,
    challengeThreshold: env.AI_POLICY_CHALLENGE_THRESHOLD,
    blockThreshold: env.AI_POLICY_BLOCK_THRESHOLD,
    minAutomationConfidence: env.AI_POLICY_MIN_AUTOMATION_CONFIDENCE
  }
});

export const scoreRiskContext = async (rawContext: AiRiskContext): Promise<AiRiskDecision> => {
  const context = normalizeContext(rawContext);
  const inputHash = `0x${sha256(stableJson(context))}`;

  let model = heuristicDecision(context);
  let modelProvider: AiRiskDecision['artifacts']['modelProvider'] = 'heuristic';
  let modelName = 'x1-heuristic-risk-v1';

  if (env.AI_SCORING_MODE === 'openai') {
    try {
      model = await callOpenAiDecision(context);
      modelProvider = 'openai';
      modelName = env.AI_OPENAI_MODEL;
    } catch (error) {
      model = heuristicDecision(context);
      modelProvider = 'heuristic';
      modelName = 'x1-heuristic-risk-v1-fallback';
      const detail = error instanceof Error ? error.message : 'openai_fallback';
      model.reasons = [...model.reasons, `Provider fallback: ${detail.slice(0, 120)}`].slice(0, 8);
    }
  }

  const policy = buildPolicy(context, model);
  const outputHash = `0x${sha256(stableJson(model))}`;
  const generatedAt = new Date().toISOString();
  const modelVersion = `${modelProvider}:${modelName}`;
  const modelVersionHash = `0x${sha256(modelVersion)}`;

  const decision: AiRiskDecision = {
    address: context.address,
    model,
    policy,
    artifacts: {
      inputHash,
      outputHash,
      modelVersionHash,
      modelProvider,
      modelName,
      modelVersion,
      generatedAt
    }
  };

  storeDecision(decision);
  return decision;
};
