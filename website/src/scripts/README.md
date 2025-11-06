# Agent Sync Script

This script listens to Solana program events from the Trustless program and syncs agent data to the PostgreSQL database.

## Events Monitored

The script listens to the following events:

1. **AgentRegistered** - Manual agent registration
2. **AgentAutoCreated** - Lazy agent creation via payment
3. **AgentUpdated** - Agent metadata updates
4. **AgentDeactivated** - Agent deactivation

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file with:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Solana RPC (optional, defaults to devnet)
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
```

### 3. Initialize Database

```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database
npm run db:push
```

## Usage

### Start the Event Listener

```bash
npm run sync:agents
```

The script will:
- Connect to the Solana RPC endpoint
- Listen for program events in real-time
- Automatically sync agent data to PostgreSQL
- Fetch and store metadata JSON from IPFS URLs

### Output

```
🚀 Starting Trustless Program Event Listener...
📡 RPC Endpoint: https://api.devnet.solana.com
📋 Program ID: CtZrqYPSzPipUnxB55hBzCHrQxtBfWPujyrnDBDeWpWe
👂 Listening for events...

📝 AgentRegistered: 7xK8...9mPq
✅ Agent registered in database: 7xK8...9mPq

🤖 AgentAutoCreated: 3nF2...4kLm
✅ Auto-created agent in database: 3nF2...4kLm
```

## Event Handling

### AgentRegistered

When an agent is manually registered:
- Fetches metadata JSON from the provided URI
- Extracts `name` and `description` from metadata
- Creates or updates agent record in database
- Stores full metadata JSON for reference

### AgentAutoCreated

When an agent is auto-created via payment:
- Creates agent with minimal data
- Sets `auto_created: true`
- Agent can later update their metadata

### AgentUpdated

When an agent updates their metadata:
- Fetches new metadata JSON
- Updates agent record with new data
- Preserves reputation and other fields

### AgentDeactivated

When an agent is deactivated:
- Sets `active: false` in database
- Preserves all other agent data

## Database Schema

The script syncs to the `agents` table in the `x402` schema:

```prisma
model Agent {
  id                    String   @id @default(cuid())
  address               String   @unique
  name                  String?
  description           String?
  metadata_uri          String?
  metadata_json         Json?
  active                Boolean  @default(true)
  auto_created          Boolean  @default(false)
  total_weighted_rating Decimal  @default(0)
  total_weight          Decimal  @default(0)
  avg_rating            Float    @default(0)
  last_update           DateTime?
  created_at            DateTime @default(now())
  updated_at            DateTime @updatedAt
  
  @@map("agents")
  @@schema("x402")
}
```

## Error Handling

The script includes error handling for:
- Failed metadata fetches (continues without metadata)
- Database connection issues
- Invalid event data
- Network interruptions

Errors are logged but don't stop the listener.

## Stopping the Script

Press `Ctrl+C` to gracefully shut down:

```
^C
👋 Shutting down event listener...
```

## Production Deployment

For production, consider:

1. **Process Manager**: Use PM2 or systemd
   ```bash
   pm2 start npm --name "agent-sync" -- run sync:agents
   ```

2. **Monitoring**: Add logging service (e.g., Winston, Pino)

3. **Restart Policy**: Auto-restart on failure

4. **Multiple Instances**: Run one instance per environment

5. **Health Checks**: Monitor database connectivity

## Troubleshooting

### "Cannot find module" error
- Run `npm install` to install dependencies
- Ensure `@prisma/client` is generated: `npm run db:generate`

### "Connection refused" error
- Check `DATABASE_URL` in `.env.local`
- Verify PostgreSQL is running
- Ensure `x402` schema exists

### No events received
- Verify program ID is correct
- Check RPC endpoint is accessible
- Ensure program has been deployed
- Test with a manual agent registration

### Metadata fetch fails
- Check IPFS gateway availability
- Verify metadata URI format
- Script continues without metadata (graceful degradation)

## Development

To modify event handling:

1. Edit `src/scripts/sync-agents.ts`
2. Update handler functions
3. Restart the script

No rebuild needed - `tsx` runs TypeScript directly.
