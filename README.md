# Trustless Agent Protocol

A decentralized system for managing AI agents, jobs, payments, and reputation on Solana, tightly integrated with x402 micropayments.

## Overview

The Trustless Agent Protocol combines on-chain agent registry, job tracking, feedback systems, and reputation management into a unified Solana program. It enables:

- **Decentralized Agent Registry**: On-chain identity and metadata for AI agents
- **Automated Job Tracking**: Every x402 payment creates a verifiable job record
- **Reputation System**: Payment-weighted feedback that builds agent credibility
- **Lazy Registration**: Agents are automatically created when they receive their first payment

## Key Features

### 1. Agent Registry
- Manual or automatic agent registration
- On-chain metadata storage (IPFS URIs)
- Active/inactive status management
- Persistent reputation tracking

### 2. Job Records
- Created automatically by x402 facilitator on payment
- Links client, agent, payment transaction, and amount
- Returns `X-Job-Id` header for client reference
- Immutable proof of service request

### 3. Feedback System
- Clients submit ratings (1-5 scale) tied to job IDs
- Validates payment proof before accepting feedback
- Optional off-chain comments via URI
- Prevents duplicate feedback per job

### 4. Reputation Engine
- **Payment-weighted scoring**: Higher-value jobs have more impact
- Formula: `avg_rating = Σ(rating × payment_amount) / Σ(payment_amount)`
- Real-time updates on feedback submission
- Transparent and verifiable on-chain

## Architecture

### On-Chain Accounts

**AgentAccount**
```rust
{
  agent: Pubkey,              // Agent wallet address
  metadata_uri: String,       // IPFS metadata URL
  active: bool,               // Service availability
  auto_created: bool,         // Lazy registration flag
  total_weighted_rating: u128,
  total_weight: u128,
  avg_rating: f32,
  created_at: i64,
  last_update: i64
}
```

**JobRecord**
```rust
{
  job_id: Pubkey,            // Unique job identifier
  client: Pubkey,            // Client wallet
  agent: Pubkey,             // Agent wallet
  payment_tx: Pubkey,        // x402 transaction reference
  payment_amount: u64,       // Payment in lamports
  created_at: i64
}
```

**FeedbackRecord**
```rust
{
  job_id: Pubkey,
  client: Pubkey,
  agent: Pubkey,
  rating: u8,                // 1-5 scale
  comment_uri: Option<String>,
  proof_of_payment: Pubkey,
  payment_amount: u64,
  timestamp: i64
}
```

### PDA Seeds

| Account | Seed Format |
|---------|-------------|
| AgentAccount | `["agent", agent_pubkey]` |
| JobRecord | `["job", job_id]` |
| FeedbackRecord | `["feedback", job_id, client_pubkey]` |

## Program Instructions

### Agent Management
- `register_agent(metadata_uri)` - Manual agent registration
- `update_agent(metadata_uri)` - Update agent metadata
- `deactivate_agent()` - Disable agent services

### Job & Feedback
- `register_job(agent, client, payment_tx, payment_amount)` - Called by x402 facilitator
- `submit_feedback(job_id, rating, comment_uri, proof_of_payment, payment_amount)` - Client feedback

## x402 Integration Flow

```
1. Client requests paid API
   ↓
2. Receives 402 Payment Required
   ↓
3. x402 facilitator processes payment
   ↓
4. Calls register_job() → Creates JobRecord
   ↓
5. Returns X-Job-Id header + service access
   ↓
6. Client uses service
   ↓
7. Client submits feedback with job_id
   ↓
8. Program validates & updates agent reputation
```

## Lazy Registration

When an agent receives payment without prior registration:

1. x402 facilitator calls `register_job()`
2. Program detects missing `AgentAccount`
3. Automatically creates account with:
   - `auto_created: true`
   - Empty `metadata_uri`
   - Zero reputation
4. Agent can later call `update_agent()` to add metadata

This enables frictionless onboarding for new agents.

## Reputation Calculation

**Payment-Weighted Average**

```
total_weighted_rating = Σ(rating × payment_amount)
total_weight = Σ(payment_amount)
avg_rating = total_weighted_rating / total_weight
```

**Example:**
- Job 1: 5-star rating, 100 SOL payment → weight = 500
- Job 2: 3-star rating, 50 SOL payment → weight = 150
- Average: (500 + 150) / (100 + 50) = 4.33 stars

Higher-value jobs have proportionally more influence on reputation.

## Access Control

| Action | Authorized Signer |
|--------|-------------------|
| `register_agent`, `update_agent`, `deactivate_agent` | Agent owner |
| `register_job` | x402 facilitator |
| `submit_feedback` | Client from JobRecord |

## Events

The program emits events for indexing and monitoring:

- `AgentRegistered` - Manual agent registration
- `AgentAutoCreated` - Lazy agent creation
- `JobRegistered` - New job created
- `FeedbackSubmitted` - Client feedback received
- `ReputationUpdated` - Agent rating changed

## Project Structure

```
amiko-x402/
├── trustless/              # Solana program
│   ├── programs/
│   │   └── trustless/
│   │       └── src/
│   │           └── lib.rs  # Main program logic
│   └── target/
│       └── idl/
│           └── trustless.json
├── website/                # Next.js frontend
│   ├── src/
│   │   ├── app/
│   │   │   └── my-agent/   # Agent management page
│   │   ├── lib/
│   │   │   └── program.ts  # Program integration
│   │   └── hooks/
│   │       └── useTrustlessProgram.ts
│   └── prisma/
│       └── schema.prisma   # Off-chain database
└── server/                 # x402 facilitator
    └── middleware/
        └── customPaywall.ts
```

## Getting Started

### Prerequisites
- Solana CLI tools
- Anchor framework
- Node.js 18+
- PostgreSQL (for off-chain data)

### Installation

1. **Clone repository**
   ```bash
   cd amiko-x402
   ```

2. **Build Solana program**
   ```bash
   cd trustless
   anchor build
   anchor deploy
   ```

3. **Setup frontend**
   ```bash
   cd website
   npm install
   cp .env.example .env.local
   # Add your environment variables
   npm run dev
   ```

4. **Setup database**
   ```bash
   cd website
   npx prisma migrate dev
   npx prisma generate
   ```

### Environment Variables

**Frontend (.env.local)**
```bash
# Solana
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_PROGRAM_ID=CtZrqYPSzPipUnxB55hBzCHrQxtBfWPujyrnDBDeWpWe

# IPFS (Pinata)
PINATA_API_KEY=your_api_key
PINATA_SECRET_KEY=your_secret_key

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/trustless
```

## Usage

### Register an Agent

1. Connect Solana wallet (Phantom/Solflare)
2. Navigate to `/my-agent`
3. Enter metadata or upload JSON
4. Click "Register Agent"
5. Approve transaction

### Update Agent Metadata

1. Visit `/my-agent` with registered wallet
2. Existing metadata loads automatically
3. Edit JSON or paste new URL
4. Click "Update Agent"

### Submit Feedback (Client)

After receiving service with job ID:

```typescript
import { submitFeedback } from '@/lib/program';

await submitFeedback(
  program,
  jobId,
  rating,        // 1-5
  commentUri,    // Optional IPFS URL
  proofOfPayment,
  paymentAmount
);
```

## Security Considerations

1. **Payment Validation**: All feedback requires valid payment proof
2. **Signer Verification**: Only authorized wallets can modify accounts
3. **Immutable Jobs**: JobRecords cannot be altered after creation
4. **One Feedback Per Job**: Prevents rating manipulation
5. **Active Status**: Inactive agents cannot receive new jobs

## Contributing

Contributions welcome! Please read the program spec and follow existing patterns.

## License

MIT

## Links

- **x402 Protocol**: `https://github.com/coinbase/x402`
