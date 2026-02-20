# X1 Sentinel Contracts

Foundry package for deploying and testing `X1SentinelRegistry`.

## Setup

```bash
forge install foundry-rs/forge-std --no-commit
cp .env.example .env
```

## Test

```bash
forge test -vvv
```

## Deploy

```bash
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

After deployment, `deployments/latest.json` is generated for backend/frontend wiring.
