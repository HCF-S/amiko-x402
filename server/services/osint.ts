import { Client } from "twitter-api-sdk";
import { generateObject } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { z } from "zod";

// Twitter data types
export interface TwitterUserData {
  id: string;
  name: string;
  username: string;
  description?: string;
  location?: string;
  url?: string;
  verified?: boolean;
  followers_count: number;
  following_count: number;
  tweet_count: number;
  created_at: string;
  profile_image_url?: string;
}

export interface TwitterTweetData {
  id: string;
  text: string;
  created_at: string;
  public_metrics?: {
    retweet_count: number;
    like_count: number;
    reply_count: number;
    quote_count?: number;
  };
}

// Zod schema for OSINT response validation
export const osintResponseSchema = z.object({
  factual_profile: z.object({
    display_name: z.string(),
    real_name: z.string(),
    likely_profession: z.string(),
    likely_location: z.string(),
    bio: z.string(),
    website: z.string(),
    verified: z.boolean(),
    account_created: z.string(),
    associated_links: z.array(z.string()),
    summary: z.string(),
    confidence_score: z.number().min(0).max(1),
    followers: z.number(),
    following: z.number(),
    posts_count: z.number(),
  }),
  personality_analysis: z.object({
    openness: z.object({
      score: z.enum(["High", "Medium", "Low"]),
      justification: z.string(),
    }),
    conscientiousness: z.object({
      score: z.enum(["High", "Medium", "Low"]),
      justification: z.string(),
    }),
    extraversion: z.object({
      score: z.enum(["High", "Medium", "Low"]),
      justification: z.string(),
    }),
    agreeableness: z.object({
      score: z.enum(["High", "Medium", "Low"]),
      justification: z.string(),
    }),
    neuroticism: z.object({
      score: z.enum(["High", "Medium", "Low"]),
      justification: z.string(),
    }),
  }),
  behavioral_insights: z.object({
    communication_style: z.string(),
    interests: z.array(z.string()),
    posting_patterns: z.string(),
    engagement_behavior: z.string(),
    emotional_moments: z.string(),
    current_life_chapter: z.string(),
    memorable_character_summary: z.string(),
  }),
});

export type OsintProfile = z.infer<typeof osintResponseSchema>;

// Initialize Twitter API client
function getTwitterClient(): Client | null {
  const bearerToken = process.env.X_API_BEARER_TOKEN;
  if (!bearerToken) {
    console.error("X_API_BEARER_TOKEN not configured");
    return null;
  }
  return new Client(bearerToken);
}

// Validate and clean Twitter username
export function validateUsername(username: unknown): string {
  if (typeof username !== "string") {
    throw new Error("Username must be a string");
  }

  const trimmed = username.trim();
  if (!trimmed) {
    throw new Error("Username cannot be empty");
  }

  // Remove @ symbols and validate Twitter username format
  const cleaned = trimmed.replace(/^@+/, "");
  const twitterUsernameRegex = /^[a-zA-Z0-9_]{1,15}$/;

  if (!twitterUsernameRegex.test(cleaned)) {
    throw new Error("Invalid Twitter username format");
  }

  return cleaned;
}

// Fetch comprehensive user data from X API
async function fetchTwitterUserData(username: string): Promise<{
  user: TwitterUserData | null;
  tweets: TwitterTweetData[];
}> {
  const client = getTwitterClient();
  if (!client) {
    throw new Error("Twitter API client not configured - X_API_BEARER_TOKEN is missing");
  }

  try {
    // Fetch user information with metrics
    const userResponse = await client.users.findUserByUsername(username, {
      "user.fields": [
        "created_at",
        "description",
        "location",
        "public_metrics",
        "url",
        "verified",
        "profile_image_url",
      ],
    });

    if (!userResponse.data) {
      return { user: null, tweets: [] };
    }

    const userData = userResponse.data;
    const metrics = userData.public_metrics;

    const user: TwitterUserData = {
      id: userData.id!,
      name: userData.name!,
      username: userData.username!,
      description: userData.description,
      location: userData.location,
      url: userData.url,
      verified: userData.verified || false,
      followers_count: metrics?.followers_count || 0,
      following_count: metrics?.following_count || 0,
      tweet_count: metrics?.tweet_count || 0,
      created_at: userData.created_at || "",
      profile_image_url: userData.profile_image_url,
    };

    // Fetch recent tweets
    const tweetsResponse = await client.tweets.usersIdTweets(userData.id!, {
      max_results: 10,
      exclude: ["retweets", "replies"],
      "tweet.fields": ["created_at", "public_metrics"],
    });

    const tweets: TwitterTweetData[] =
      tweetsResponse.data?.map((tweet: any) => ({
        id: tweet.id!,
        text: tweet.text!,
        created_at: tweet.created_at || "",
        public_metrics: tweet.public_metrics,
      })) || [];

    return { user, tweets };
  } catch (error: any) {
    // Handle Twitter API specific errors
    if (error.status === 401) {
      throw new Error("Twitter API authentication failed - X_API_BEARER_TOKEN is invalid or expired");
    }
    if (error.status === 429) {
      throw new Error("Twitter API rate limit exceeded - please try again later");
    }
    if (error.status === 404) {
      throw new Error(`Twitter user @${username} not found`);
    }
    
    console.error("Error fetching Twitter data:", error);
    throw new Error(`Failed to fetch Twitter data: ${error.message || "Unknown error"}`);
  }
}

// Main OSINT analysis function
export async function analyzeTwitterProfile(
  twitterHandle: string
): Promise<OsintProfile> {
  const startTime = Date.now();

  // Validate and clean the Twitter handle
  const cleanHandle = validateUsername(twitterHandle);

  // Fetch comprehensive Twitter data
  const { user: twitterUser, tweets: recentTweets } =
    await fetchTwitterUserData(cleanHandle);

  if (!twitterUser) {
    throw new Error(`Twitter user @${cleanHandle} not found`);
  }

  // Check for Groq API key
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    throw new Error("GROQ_API_KEY not configured");
  }

  // Enhanced prompts inspired by Grok's storytelling style
  const systemPrompt =
    "You are a master digital storyteller and behavioral analyst. Your mission: create CHARACTER PROFILES that read like compelling short stories. " +
    "Study this example of excellent profiling: 'Mars, a tech-savvy coder with a knack for Rust and a love for dogs, mourns a lost friend while humorously navigating life's chaos.' " +
    "Notice how it weaves together: technical skills + personal interests + emotional depth + personality quirks + current life context. " +
    "Create profiles that are HUMAN, SPECIFIC, and EMOTIONALLY RESONANT. Use concrete details, paint vivid scenes, capture their essence in memorable phrases. " +
    "Don't just analyze - tell their story. Make each profile so engaging that people remember it and feel like they 'know' this person.";

  const userPrompt =
    `Analyze the Twitter user '${cleanHandle}' based on their verified profile data and recent tweets. ` +
    `
VERIFIED TWITTER PROFILE DATA:
- Display Name: ${twitterUser.name}
- Username: @${twitterUser.username}
- Bio: ${twitterUser.description || "No bio provided"}
- Location: ${twitterUser.location || "Not specified"}
- Website: ${twitterUser.url || "None"}
- Verified: ${twitterUser.verified ? "Yes" : "No"}
- Account Created: ${twitterUser.created_at}
- Followers: ${twitterUser.followers_count.toLocaleString()}
- Following: ${twitterUser.following_count.toLocaleString()}
- Total Tweets: ${twitterUser.tweet_count.toLocaleString()}
` +
    (recentTweets.length > 0
      ? `

RECENT TWEETS DATA:
Here are their ${recentTweets.length} most recent original tweets:

${recentTweets
  .map(
    (tweet, index) => `
Tweet ${index + 1} (${tweet.created_at}):
"${tweet.text}"
${tweet.public_metrics ? `Engagement: ${tweet.public_metrics.like_count} likes, ${tweet.public_metrics.retweet_count} retweets, ${tweet.public_metrics.reply_count} replies` : ""}
`,
  )
  .join("\n")}

Use this tweet content for personality analysis and behavioral insights.
`
      : "No recent original tweets available.") +
    `
STORYTELLING APPROACH (Like Grok's Style):
- Weave together technical skills + personal interests + emotional depth + personality quirks
- Use specific, concrete details (not "interested in technology" but "tinkering with Pi 4b and ESP32")
- Capture emotional moments and current life context
- Create memorable, human phrases that stick in people's minds
- Tell their story - don't just list traits
- Make it feel like you're introducing a fascinating friend
- Use humor, warmth, and genuine insight

Provide a detailed, captivating analysis.`;

  // Use AI SDK's generateObject with Groq
  const groq = createGroq({ apiKey: groqApiKey });
  const { object: osintProfile } = await generateObject({
    model: groq("llama-3.3-70b-versatile"),
    system: systemPrompt,
    prompt: userPrompt,
    schema: osintResponseSchema,
    temperature: 0.2,
  });

  const duration = Date.now() - startTime;
  console.log(`OSINT analysis completed in ${duration}ms for @${cleanHandle}`);

  return osintProfile;
}
