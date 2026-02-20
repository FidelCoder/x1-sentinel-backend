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

## Current Testnet Deployment

- Network: `X1 EcoChain Testnet (Maculatus)`
- Chain ID: `10778`
- Contract (`X1SentinelRegistry`): `0xB36B20436b1D8f67CFbBF83D79F5C000E823418D`
- Deployment tx: `0x0d8207884f41c67591a08f6df399017999347068cb3d5cf92cc33516f83218a9`

Use this `.env` shape for deployment (do not commit secrets):

```bash
PRIVATE_KEY=
RPC_URL=https://maculatus-rpc.x1eco.com/
CHAIN_NAME="X1 EcoChain Testnet (Maculatus)"
CHAIN_CURRENCY_SYMBOL=X1T
CHAIN_EXPLORER_URL=https://maculatus-scan.x1eco.com/
```
