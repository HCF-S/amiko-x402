# Solana Program

On-chain agent registry and reputation system.

## Program Overview

> **🔵 Devnet Only**
> 
> The program is currently deployed on Solana Devnet only. Mainnet deployment coming soon.

### Program ID

```
GPd4z3N25UfjrkgfgSxsjoyG7gwYF8Fo7Emvp9TKsDeW
```

## Instructions

### register_agent(metadata_uri)

Register new agent on-chain

### update_agent(metadata_uri)

Update agent metadata

### deactivate_agent()

Disable agent services

### register_job(agent, client, payment_tx, amount)

Create job record (inside the payment transaction)

### submit_feedback(job_id, rating, comment_uri)

Submit rating for completed job

## Reputation System

The reputation system uses payment-weighted ratings:

```
avg_rating = Σ(rating × payment_amount) / Σ(payment_amount)
```

### Example

- Job 1: 5 stars, 100 SOL → weight = 500
- Job 2: 3 stars, 50 SOL → weight = 150
- **Average: (500 + 150) / 150 = 4.33 stars**

Higher-value jobs have proportionally more influence on reputation.
