# x402 Future Work & Automation

This document outlines proposed automation and infrastructure improvements for the x402 payment protocol.

## Current State

### Manual Deployment Process

Currently, deployment requires manual steps for each component:

1. **Trustless Program** - Manual `anchor build` + `solana program deploy`
2. **Facilitator** - Manual deployment to hosting provider
3. **Website** - May be connected to Vercel (auto-deploy on push)
4. **x402 Package** - Manual `pnpm build` + `npm publish`

### Missing Automation

- No CI/CD pipeline
- No automated testing on PR
- No automated deployment
- No E2E tests in CI

---

## Proposed Automation

### 1. GitHub Actions CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Build packages
        run: pnpm -r build

      - name: Run unit tests
        run: pnpm -r test

      - name: Type check
        run: pnpm -r typecheck

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm -r lint:check
      - run: pnpm -r format:check
```

### 2. E2E Tests in CI (Devnet)

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  e2e-devnet:
    runs-on: ubuntu-latest
    environment: devnet
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Build packages
        run: pnpm -r build

      - name: Run E2E tests
        env:
          SVM_PRIVATE_KEY: ${{ secrets.SVM_PRIVATE_KEY_DEVNET }}
          CROSSMINT_API_KEY: ${{ secrets.CROSSMINT_API_KEY_STAGING }}
          CROSSMINT_WALLET_LOCATOR: ${{ secrets.CROSSMINT_WALLET_LOCATOR }}
          TRUSTLESS_PROGRAM_ID: ${{ secrets.TRUSTLESS_PROGRAM_ID_DEVNET }}
        run: |
          cd test-harness
          npx tsx src/crossmint-tx-test.ts
```

### 3. Facilitator Deployment (Railway/Render)

**Option A: Railway**
```toml
# railway.toml
[build]
builder = "nixpacks"
buildCommand = "cd facilitator && pnpm install && pnpm build"

[deploy]
startCommand = "cd facilitator && pnpm start"
healthcheckPath = "/health"
healthcheckTimeout = 100

[env]
PORT = "3000"
```

**Option B: Docker**
```dockerfile
# facilitator/Dockerfile
FROM node:20-slim

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY facilitator/ ./facilitator/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build
RUN pnpm -r build

WORKDIR /app/facilitator

EXPOSE 3000

CMD ["pnpm", "start"]
```

### 4. Trustless Program Deployment

Solana program deployment should remain manual with verification:

```bash
#!/bin/bash
# scripts/deploy-trustless.sh

set -e

echo "Building trustless program..."
cd trustless
anchor build

echo "Verifying program ID matches..."
DECLARED_ID=$(grep -oP 'declare_id!\("\K[^"]+' programs/trustless/src/lib.rs)
ANCHOR_ID=$(grep -oP 'trustless = "\K[^"]+' Anchor.toml)

if [ "$DECLARED_ID" != "$ANCHOR_ID" ]; then
  echo "ERROR: Program ID mismatch!"
  echo "  lib.rs:     $DECLARED_ID"
  echo "  Anchor.toml: $ANCHOR_ID"
  exit 1
fi

echo "Program ID verified: $DECLARED_ID"

echo "Deploying to devnet..."
solana program deploy \
  --program-id target/deploy/trustless-keypair.json \
  target/deploy/trustless.so \
  --url devnet

echo "Deployment complete!"
```

---

## Infrastructure Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PRODUCTION ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────┐  │
│   │   GitHub    │────>│  GitHub     │────>│  Deployments            │  │
│   │   Push      │     │  Actions    │     │                         │  │
│   └─────────────┘     └─────────────┘     │  ┌─────────────────┐   │  │
│                             │              │  │ Vercel (website)│   │  │
│                             │              │  └─────────────────┘   │  │
│                             │              │                         │  │
│                             │              │  ┌─────────────────┐   │  │
│                             │              │  │ Railway/Render  │   │  │
│                             │              │  │ (facilitator)   │   │  │
│                             │              │  └─────────────────┘   │  │
│                             │              │                         │  │
│                             │              │  ┌─────────────────┐   │  │
│                             │              │  │ npm registry    │   │  │
│                             │              │  │ (x402 package)  │   │  │
│                             │              │  └─────────────────┘   │  │
│                             │              └─────────────────────────┘  │
│                             │                                           │
│                             v                                           │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                    E2E Tests (Devnet)                           │  │
│   │  - Crossmint non-trustless payment                              │  │
│   │  - Crossmint trustless payment                                  │  │
│   │  - Non-Crossmint flows                                          │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                    Solana Programs (Manual)                     │  │
│   │  Devnet:  5Rp6HM2R1eT6cp3aMHesEDcaXMtCJY3fmRBB1RmoSic3          │  │
│   │  Mainnet: TBD                                                   │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Environment Variables

### Facilitator (Production)

| Variable | Description | Required |
|----------|-------------|----------|
| `SVM_PRIVATE_KEY` | Base58 Solana private key for facilitator | Yes |
| `EVM_PRIVATE_KEY` | Hex EVM private key (for Base) | Optional |
| `CROSSMINT_API_KEY` | Crossmint API key | Yes |
| `CROSSMINT_API_BASE_URL` | Crossmint API URL | Yes |
| `TRUSTLESS_PROGRAM_ID` | Deployed trustless program | Yes |
| `AMIKO_PLATFORM_API_URL` | Platform API for wallet lookup | Yes |
| `USE_MAINNET` | Set to "true" for mainnet | No |
| `PORT` | Server port | No (default: 3000) |

### GitHub Secrets (for CI)

| Secret | Environment | Description |
|--------|-------------|-------------|
| `SVM_PRIVATE_KEY_DEVNET` | devnet | Test facilitator key |
| `CROSSMINT_API_KEY_STAGING` | devnet | Crossmint staging key |
| `CROSSMINT_WALLET_LOCATOR` | devnet | Test wallet locator |
| `TRUSTLESS_PROGRAM_ID_DEVNET` | devnet | Devnet program ID |

---

## Testing Strategy

### Unit Tests (CI - Every PR)
- Run on every push/PR
- Mocked dependencies
- Fast feedback loop
- Location: `packages/x402/src/**/*.test.ts`

### E2E Tests (CI - Main branch)
- Run on merge to main
- Real Crossmint API (staging)
- Real Solana devnet
- Catches Crossmint wrapper issues
- Location: `test-harness/src/`

### Manual E2E Tests (Pre-deploy)
- Run before mainnet deployment
- Full flow verification
- Location: `test-harness/src/crossmint-tx-test.ts`

---

## Hardcoded Constants

### Crossmint Smart Wallet Address

```rust
// trustless/programs/trustless/src/lib.rs
const CROSSMINT_SMART_WALLET: &str = "SMRTzfY6DfH5ik3TKiyLFfXexV8uSG3d2UksSCYdunG";
```

**Why hardcoded:** On-chain programs cannot access environment variables at runtime. This address is essentially immutable (like a program ID). If Crossmint changes their smart wallet, a program redeploy would be required anyway.

**Security consideration:** Making this configurable via instruction argument would be a security risk - callers could pass a malicious wrapper address.

---

## Priority Implementation Order

1. **High Priority**
   - [ ] Add GitHub Actions CI for unit tests
   - [ ] Add deployment script with program ID verification
   - [ ] Document deployment process

2. **Medium Priority**
   - [ ] Add E2E tests to CI (requires secrets setup)
   - [ ] Set up Railway/Render for facilitator
   - [ ] Add health check endpoint to facilitator

3. **Low Priority**
   - [ ] Add npm publish workflow
   - [ ] Add Slack/Discord notifications for failures
   - [ ] Add deployment previews for PRs
