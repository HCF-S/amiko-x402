# OSINT Service

Analyzes Twitter/X profiles using AI to generate comprehensive personality profiles.

## Features

- **Twitter Data Fetching**: Retrieves user profile and recent tweets via Twitter API
- **AI Analysis**: Uses Groq's LLM to analyze personality traits and behavioral patterns
- **Structured Output**: Returns validated JSON with factual profile, personality analysis, and behavioral insights

## Configuration

Required environment variables:

```bash
# Twitter/X API Bearer Token
X_API_BEARER_TOKEN="your_twitter_bearer_token"

# Groq API Key for AI analysis
GROQ_API_KEY="your_groq_api_key"
```

## Usage

```typescript
import { analyzeTwitterProfile } from './services/osint.js';

try {
  const profile = await analyzeTwitterProfile('username');
  console.log(profile);
} catch (error) {
  console.error('Analysis failed:', error);
}
```

## Response Schema

```typescript
{
  factual_profile: {
    display_name: string;
    real_name: string;
    likely_profession: string;
    likely_location: string;
    bio: string;
    website: string;
    verified: boolean;
    account_created: string;
    associated_links: string[];
    summary: string;
    confidence_score: number; // 0-1
    followers: number;
    following: number;
    posts_count: number;
  };
  personality_analysis: {
    openness: { score: "High" | "Medium" | "Low"; justification: string };
    conscientiousness: { score: "High" | "Medium" | "Low"; justification: string };
    extraversion: { score: "High" | "Medium" | "Low"; justification: string };
    agreeableness: { score: "High" | "Medium" | "Low"; justification: string };
    neuroticism: { score: "High" | "Medium" | "Low"; justification: string };
  };
  behavioral_insights: {
    communication_style: string;
    interests: string[];
    posting_patterns: string;
    engagement_behavior: string;
    emotional_moments: string;
    current_life_chapter: string;
    memorable_character_summary: string;
  };
}
```

## Integration with x402

The OSINT service is integrated with x402 payment middleware in the routes:

- `POST /osint/:handle` - Solana Mainnet ($1.00)
- `POST /solana-devnet/osint/:handle` - Solana Devnet ($1.00)
- `POST /base/osint/:handle` - Base Mainnet ($1.00)
- `POST /base-sepolia/osint/:handle` - Base Sepolia ($1.00)

All endpoints require payment before analysis is performed.

## Error Handling

The service handles various error scenarios:

- Missing API keys
- Invalid Twitter usernames
- Twitter user not found
- API rate limits
- AI generation failures

All errors are caught and returned with appropriate error messages.
