# X1 Sentinel Backend

Standalone TypeScript API for risk checks, community reporting, and safety telemetry.

## Features

- Address risk checks (`/api/check/:address`)
- Recent report feed (`/api/reports`)
- Report submission payload prep (`POST /api/reports`)
- Agentic AI risk scoring with policy guardrails (`/api/ai`)
- Onchain anchor preparation + reads for AI and DePIN artifacts (`/api/anchors`)
- DePIN node registry + signed attestation ingestion (`/api/depin`)
- DePIN health projection endpoint (`GET /api/depin/health/:address`)
- Automatic fallback to demo mode when chain config is not set

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

Server runs at `http://localhost:4010` by default.

## Deploy to Vercel

1. Import this repo in Vercel.
2. Keep root directory as `./`.
3. Set runtime environment variables from `.env.example` (at minimum: `RPC_URL`, `CONTRACT_ADDRESS`, `AI_DECISION_ANCHOR_ADDRESS`, `DEPIN_ANCHOR_ADDRESS`, and chain metadata).
4. Deploy. The backend uses `vercel.json` to route all paths to `api/index.ts`.

## Environment

- `PORT`: API port
- `CORS_ORIGIN`: allowed origin(s), comma-separated
- `CHAIN_NAME`: label exposed in `/health`
- `CHAIN_ID`: target EVM chain id
- `CHAIN_CURRENCY_SYMBOL`: native token symbol
- `CHAIN_EXPLORER_URL`: optional explorer base URL
- `DEPLOYMENT_MANIFEST_PATH`: optional local path to deployment manifest (`latest.json`)
- `RPC_URL`: EVM RPC endpoint (optional)
- `CONTRACT_ADDRESS`: deployed registry contract (optional)
- `AI_DECISION_ANCHOR_ADDRESS`: deployed `X1SentinelAIDecisionAnchor` contract address
- `DEPIN_ANCHOR_ADDRESS`: deployed `X1SentinelDepinAnchor` contract address
- `DEPIN_EIP712_DOMAIN_NAME`: EIP-712 domain name for DePIN signatures
- `DEPIN_EIP712_DOMAIN_VERSION`: EIP-712 domain version for DePIN signatures
- `DEPIN_MAX_CLOCK_SKEW_SECONDS`: max allowed future/past skew for signed payload timestamps
- `DEPIN_MAX_ATTESTATION_AGE_SECONDS`: max age for accepted attestation timestamps
- `DEPIN_MAX_REGISTRATION_AGE_SECONDS`: max age for accepted node registration timestamps
- `DEPIN_NONCE_RETENTION_SECONDS`: replay-protection nonce retention horizon
- `DEPIN_ATTESTATION_RETENTION_SECONDS`: in-memory attestation retention horizon
- `DEPIN_HEALTH_WINDOW_HOURS`: default lookback for `/api/depin/health/:address`
- `DEPIN_REQUIRE_NODE_REGISTRATION`: require node registry membership before attestation ingest
- `AI_SCORING_MODE`: `heuristic` (local) or `openai` (LLM-backed decisioning)
- `AI_OPENAI_BASE_URL`: OpenAI API base URL for scoring mode `openai`
- `AI_OPENAI_MODEL`: OpenAI model name used for decisioning
- `OPENAI_API_KEY`: OpenAI API key (required when `AI_SCORING_MODE=openai`)
- `AI_POLICY_WARN_THRESHOLD`: score threshold for warning policy
- `AI_POLICY_CHALLENGE_THRESHOLD`: score threshold for challenge policy
- `AI_POLICY_BLOCK_THRESHOLD`: score threshold for block policy
- `AI_POLICY_MIN_AUTOMATION_CONFIDENCE`: minimum confidence to auto-execute elevated policy actions
- `AI_DECISION_RETENTION`: per-address in-memory AI decision history size

If `RPC_URL` and `CONTRACT_ADDRESS` are missing, API serves demo-safe fallback data so UI prototyping is unblocked.

Default manifest path in `.env.example` points to `./contracts/deployments/latest.json`.

## Contracts (In Repo)

Foundry contract package is located at `contracts/`.

```bash
cd contracts
forge install foundry-rs/forge-std --no-commit
cp .env.example .env
forge test -vvv
```

## Current Testnet Deployment

- Network: `X1 EcoChain Testnet (Maculatus)`
- Chain ID: `10778`
- RPC: `https://maculatus-rpc.x1eco.com/`
- Explorer: `https://maculatus-scan.x1eco.com/`
- Contract (`X1SentinelRegistry`): `0x5C4Be8d3fF603cba1A25dB2D269B4219c72F6855`
- Contract (`X1SentinelAIDecisionAnchor`): `0x19CA137e578A81B9FBD0f7ca5D77468e238e4646`
- Contract (`X1SentinelDepinAnchor`): `0x331Fdd4a93D9779030de8B086B4dfa21be11c6E2`
- Registry deploy tx: `0x65c2bac2c2c5a01660147b90291fff5d72dd25eae29e87fe51a8fee47f7bf6be`
- AI anchor deploy tx: `0x0685da0d98c092482b67e450f4d4bfa1ad88e0e3974c58425ff32c96e3b1c853`
- DePIN anchor deploy tx: `0x7c0dca95a35ec9700de98856437cad4cf7834f09773e4ea5808a1ffa6326d0a1`

Backend env values should align with:

```bash
CHAIN_ID=10778
RPC_URL=https://maculatus-rpc.x1eco.com/
CONTRACT_ADDRESS=0x5C4Be8d3fF603cba1A25dB2D269B4219c72F6855
DEPLOYMENT_MANIFEST_PATH=./contracts/deployments/latest.json
AI_DECISION_ANCHOR_ADDRESS=0x19CA137e578A81B9FBD0f7ca5D77468e238e4646
DEPIN_ANCHOR_ADDRESS=0x331Fdd4a93D9779030de8B086B4dfa21be11c6E2
```

## Endpoints

- `GET /health`
- `GET /api/config`
- `GET /api/check/:address`
- `GET /api/reports?limit=10&offset=0`
- `GET /api/reports/:id`
- `POST /api/reports`
- `POST /api/reports/:id/vote`
- `POST /api/reports/:id/resolve`
- `GET /api/ai/config`
- `POST /api/ai/score`
- `GET /api/ai/decisions/:address?limit=10`
- `GET /api/anchors/config`
- `POST /api/anchors/ai/prepare`
- `POST /api/anchors/depin/prepare`
- `GET /api/anchors/ai/:address?limit=10`
- `GET /api/anchors/depin/:address?limit=10`
- `GET /api/depin/eip712`
- `POST /api/depin/nodes/register`
- `GET /api/depin/nodes`
- `GET /api/depin/nodes/:address`
- `PATCH /api/depin/nodes/:address` (`{ "active": true|false }`)
- `POST /api/depin/attest`
- `GET /api/depin/health/:address?windowHours=24&latest=6`

## DePIN Signing Flow (EIP-712)

1. Fetch signing schema with `GET /api/depin/eip712`.
2. Register node with `POST /api/depin/nodes/register` (signed `NodeRegistration` payload).
3. Submit telemetry with `POST /api/depin/attest` (signed `NodeAttestation` payload).
4. Query computed health using `GET /api/depin/health/:address`.

## AI Decision Flow

1. Aggregate context from onchain reports, privacy analysis, external flags, and DePIN health.
2. Score with `/api/ai/score` (heuristic by default, optional OpenAI model).
3. Apply deterministic policy guardrails (`allow`, `warn`, `challenge`, `manual_review`, `block`).
4. Persist decision artifacts in memory (`inputHash`, `outputHash`, `modelVersion`, `generatedAt`).

## Anchor Flow

1. Generate AI or DePIN artifacts in backend services (`/api/check`, `/api/ai/score`, `/api/depin/health`).
2. Call `/api/anchors/*/prepare` to receive wallet-ready contract method + params.
3. Submit transaction from authorized publisher wallet.
4. Query anchored records using `/api/anchors/ai/:address` or `/api/anchors/depin/:address`.
