# X1 Sentinel Backend

Standalone TypeScript API for risk checks, community reporting, and safety telemetry.

## Features

- Address risk checks (`/api/check/:address`)
- Recent report feed (`/api/reports`)
- Report submission payload prep (`POST /api/reports`)
- Automatic fallback to demo mode when chain config is not set

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

Server runs at `http://localhost:4010` by default.

## Environment

- `PORT`: API port
- `CORS_ORIGIN`: allowed origin(s), comma-separated
- `CHAIN_NAME`: label exposed in `/health`
- `RPC_URL`: EVM RPC endpoint (optional)
- `CONTRACT_ADDRESS`: deployed registry contract (optional)

If `RPC_URL` and `CONTRACT_ADDRESS` are missing, API serves demo-safe fallback data so UI prototyping is unblocked.

## Endpoints

- `GET /health`
- `GET /api/check/:address`
- `GET /api/reports?limit=10&offset=0`
- `GET /api/reports/:id`
- `POST /api/reports`
