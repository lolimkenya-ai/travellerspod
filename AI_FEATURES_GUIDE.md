# AI Features Integration Guide

## Overview

This document outlines the AI and LLM capabilities integrated into Travellerspod using OpenAI's API. These features enhance content moderation, business verification, and user experience.

## Table of Contents

1. [AI Features Overview](#ai-features-overview)
2. [Edge Functions](#edge-functions)
3. [Frontend Hooks](#frontend-hooks)
4. [Database Schema](#database-schema)
5. [API Reference](#api-reference)
6. [Usage Examples](#usage-examples)
7. [Rate Limiting](#rate-limiting)
8. [Cost Estimation](#cost-estimation)

---

## AI Features Overview

### 1. Content Moderation
**Purpose:** Automatically detect and flag policy violations in user-generated content.

**Capabilities:**
- Detects sexual content, hate speech, harassment, violence
- Identifies spam patterns and suspicious behavior
- Provides confidence scores and detailed reasoning
- Auto-flags or removes content based on severity

**Models Used:**
- OpenAI Moderation API (text-moderation-latest)
- GPT-4-mini for spam pattern analysis

### 2. Business Verification
**Purpose:** Intelligently verify business legitimacy and assess fraud risk.

**Capabilities:**
- Analyzes business details for credibility
- Checks website reputation and SSL status
- Assesses registry presence (TRA, KATA, KATO)
- Provides risk level assessment (low/medium/high)
- Generates findings and recommendations

**Models Used:**
- GPT-4-mini for business analysis

### 3. Content Assistant
**Purpose:** Help users create engaging content with AI suggestions.

**Capabilities:**
- Generate social media captions
- Suggest travel tips for destinations
- Generate relevant hashtags
- Create business descriptions
- Support multiple tones (casual, professional, funny, inspirational)

**Models Used:**
- GPT-4-mini for content generation

---

## Edge Functions

### 1. moderate-content

**Location:** `supabase/functions/moderate-content/index.ts`

**Purpose:** Analyze post content for policy violations.

**Request:**
```json
{
  "postId": "uuid",
  "caption": "string",
  "mediaType": "string (optional)"
}
```

**Response:**
```json
{
  "postId": "uuid",
  "action": "approve|flag|remove",
  "flagged": boolean,
  "reasons": ["reason1", "reason2"],
  "confidence": 0.95,
  "spamScore": 0.2,
  "categories": {
    "sexual": false,
    "hate": false,
    "harassment": false,
    "self_harm": false,
    "sexual_minors": false,
    "violence": false,
    "violence_graphic": false
  }
}
```

**Error Handling:**
- Returns `action: "approve"` if moderation service is unavailable
- Logs all errors for debugging
- Stores results in `content_moderation_logs` table

### 2. verify-business-ai

**Location:** `supabase/functions/verify-business-ai/index.ts`

**Purpose:** Perform AI-powered business verification.

**Request:**
```json
{
  "profileId": "uuid"
}
```

**Response:**
```json
{
  "id": "uuid",
  "riskLevel": "low|medium|high|unknown",
  "credibilityScore": 75,
  "findings": ["finding1", "finding2"],
  "recommendations": ["rec1", "rec2"],
  "summary": "Business appears legitimate...",
  "websiteReputation": {
    "isActive": true,
    "hasSSL": true,
    "reputationScore": 85
  }
}
```

**Authorization:** Requires `admin` or `super_admin` role

### 3. ai-content-assistant

**Location:** `supabase/functions/ai-content-assistant/index.ts`

**Purpose:** Generate AI content suggestions.

**Request:**
```json
{
  "type": "caption|tips|hashtags|description",
  "context": "string",
  "tone": "casual|professional|funny|inspirational (optional)",
  "length": "short|medium|long (optional)"
}
```

**Response:**
```json
{
  "type": "caption",
  "content": "string or array",
  "suggestions": ["suggestion1", "suggestion2"],
  "confidence": 0.85
}
```

---

## Frontend Hooks

### useAIAssistant

**Purpose:** Access AI content generation features.

```typescript
const {
  loading,
  error,
  rateLimitInfo,
  generateCaption,
  generateTravelTips,
  generateHashtags,
  generateDescription,
} = useAIAssistant();

// Generate a caption
const caption = await generateCaption(
  "Beautiful sunset at Mount Kilimanjaro",
  "inspirational",
  "medium"
);

// Generate travel tips
const tips = await generateTravelTips("Zanzibar", "budget");

// Generate hashtags
const hashtags = await generateHashtags("Safari adventure in Serengeti");

// Generate business description
const description = await generateDescription(
  "Safari Lodge",
  "Accommodation",
  "Luxury tents, guided tours, wildlife viewing"
);
```

### useContentModeration

**Purpose:** Moderate user-generated content.

```typescript
const { loading, error, moderateContent } = useContentModeration();

const result = await moderateContent(
  postId,
  "Check out this amazing travel deal!",
  "image"
);

// Result includes:
// - action: "approve" | "flag" | "remove"
// - flagged: boolean
// - reasons: string[]
// - confidence: number
```

### useBusinessVerification

**Purpose:** Verify business legitimacy (admin only).

```typescript
const { loading, error, verifyBusiness } = useBusinessVerification();

const result = await verifyBusiness(profileId);

// Result includes:
// - riskLevel: "low" | "medium" | "high"
// - credibilityScore: number
// - findings: string[]
// - recommendations: string[]
```

### useAIUsageStats

**Purpose:** Track AI feature usage.

```typescript
const { stats, loading, fetchStats } = useAIUsageStats(30);

await fetchStats();

// Stats include:
// - feature_type: string
// - usage_count: number
// - total_tokens: number
// - estimated_cost: number
```

### useModerationStats

**Purpose:** Get moderation statistics (admin only).

```typescript
const { stats, loading, fetchStats } = useModerationStats(30);

await fetchStats();

// Stats include:
// - total_reviewed: number
// - flagged_count: number
// - removed_count: number
// - flag_rate: number
// - top_reason: string
```

---

## Database Schema

### content_moderation_logs

Stores all content moderation results.

```sql
CREATE TABLE content_moderation_logs (
  id UUID PRIMARY KEY,
  post_id UUID NOT NULL,
  moderation_result JSONB,
  recommended_action TEXT,
  reasons TEXT[],
  confidence NUMERIC(3, 2),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  final_action TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### verification_ai_reviews

Stores AI verification results for businesses.

```sql
CREATE TABLE verification_ai_reviews (
  id UUID PRIMARY KEY,
  profile_id UUID NOT NULL,
  summary TEXT,
  risk_level TEXT,
  findings TEXT[],
  sources JSONB,
  credibility_score NUMERIC(3, 1),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  final_decision TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### ai_usage_logs

Tracks AI feature usage for billing and analytics.

```sql
CREATE TABLE ai_usage_logs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  feature_type TEXT,
  tokens_used INT,
  cost_usd NUMERIC(10, 4),
  status TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ
);
```

### ai_feature_settings

Configurable settings for AI features.

```sql
CREATE TABLE ai_feature_settings (
  id UUID PRIMARY KEY,
  feature_name TEXT UNIQUE,
  enabled BOOLEAN,
  model TEXT,
  temperature NUMERIC(3, 2),
  max_tokens INT,
  rate_limit_per_user INT,
  rate_limit_window_hours INT,
  cost_per_1k_tokens NUMERIC(10, 6),
  description TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
);
```

---

## API Reference

### RPC Functions

#### get_ai_usage_stats(_user_id, _days)

Get AI usage statistics for a user.

**Parameters:**
- `_user_id` (UUID): User ID
- `_days` (INT): Number of days to look back (default: 30)

**Returns:**
```typescript
{
  feature_type: string,
  usage_count: number,
  total_tokens: number,
  estimated_cost: number
}[]
```

#### check_ai_rate_limit(_user_id, _feature)

Check if user has exceeded rate limit for a feature.

**Parameters:**
- `_user_id` (UUID): User ID
- `_feature` (TEXT): Feature name (caption, tips, hashtags, description)

**Returns:**
```typescript
{
  allowed: boolean,
  remaining_calls: number,
  reset_at: timestamp
}
```

#### get_moderation_stats(_days)

Get moderation statistics (admin only).

**Parameters:**
- `_days` (INT): Number of days to look back (default: 30)

**Returns:**
```typescript
{
  total_reviewed: number,
  flagged_count: number,
  removed_count: number,
  flag_rate: number,
  top_reason: string
}
```

---

## Usage Examples

### Example 1: Auto-Moderate Post on Creation

```typescript
// In post creation handler
const { moderateContent } = useContentModeration();

const result = await moderateContent(postId, caption, mediaType);

if (result.action === "remove") {
  // Auto-remove the post
  await supabase.from("posts").update({ removed_at: now() }).eq("id", postId);
  toast.error("Post violates community guidelines");
} else if (result.action === "flag") {
  // Flag for review
  await supabase.from("content_reports").insert({
    post_id: postId,
    reason: "automated_moderation",
    details: result,
  });
  toast.warning("Post flagged for review");
}
```

### Example 2: Assist User with Caption

```typescript
// In post composer
const { generateCaption, loading } = useAIAssistant();

const handleGenerateCaption = async () => {
  const caption = await generateCaption(
    "I just visited the Serengeti",
    "inspirational",
    "medium"
  );
  setCaption(caption);
};

return (
  <button onClick={handleGenerateCaption} disabled={loading}>
    {loading ? "Generating..." : "✨ Generate Caption"}
  </button>
);
```

### Example 3: Verify Business (Admin)

```typescript
// In admin verification page
const { verifyBusiness, loading } = useBusinessVerification();

const handleVerify = async (profileId) => {
  const result = await verifyBusiness(profileId);

  if (result.riskLevel === "low") {
    await approveVerification(profileId);
  } else if (result.riskLevel === "high") {
    await rejectVerification(profileId, result.findings);
  } else {
    // Mark for manual review
    await flagForManualReview(profileId, result);
  }
};
```

### Example 4: Display AI Usage Dashboard

```typescript
// In user settings
const { stats, fetchStats } = useAIUsageStats(30);

useEffect(() => {
  fetchStats();
}, []);

return (
  <div>
    {stats?.map((stat) => (
      <div key={stat.feature_type}>
        <h3>{stat.feature_type}</h3>
        <p>Usage: {stat.usage_count}</p>
        <p>Tokens: {stat.total_tokens}</p>
        <p>Cost: ${stat.estimated_cost}</p>
      </div>
    ))}
  </div>
);
```

---

## Rate Limiting

### Default Rate Limits

| Feature | Limit | Window |
|---------|-------|--------|
| Caption Generation | 100 | 24 hours |
| Travel Tips | 100 | 24 hours |
| Hashtag Generation | 100 | 24 hours |
| Description Generation | 50 | 24 hours |
| Content Moderation | Unlimited | N/A |
| Business Verification | 50 | 24 hours |

### Customizing Rate Limits

Update via superadmin dashboard:

```typescript
await supabase
  .from("ai_feature_settings")
  .update({
    rate_limit_per_user: 200,
    rate_limit_window_hours: 12,
  })
  .eq("feature_name", "caption");
```

---

## Cost Estimation

### OpenAI Pricing (as of April 2026)

| Model | Input | Output |
|-------|-------|--------|
| GPT-4-mini | $0.00015/1K tokens | $0.0006/1K tokens |
| text-moderation-latest | Free | Free |

### Estimated Monthly Costs

Assuming 1,000 active users with average usage:

- Caption Generation (50 uses/user): ~$7.50
- Travel Tips (30 uses/user): ~$4.50
- Hashtags (40 uses/user): ~$6.00
- Business Verification (5 uses/user): ~$3.75
- Content Moderation (unlimited): Free

**Total Estimated Monthly Cost: ~$22/month**

### Cost Tracking

Monitor costs via:

```typescript
const { stats } = useAIUsageStats(30);
const totalCost = stats.reduce((sum, s) => sum + s.estimated_cost, 0);
```

---

## Troubleshooting

### Issue: "AI key not configured"

**Solution:** Ensure `OPENAI_API_KEY` is set in Supabase environment variables.

### Issue: Rate limit exceeded

**Solution:** Wait for the reset time or upgrade plan for higher limits.

### Issue: Moderation returning "unknown" risk level

**Solution:** This happens when AI service is unavailable. Content is approved by default for safety.

### Issue: Slow verification results

**Solution:** Verification involves multiple checks. Consider implementing async processing with webhooks.

---

## Future Enhancements

1. **Image Analysis:** Detect inappropriate images using vision models
2. **Multi-language Support:** Support content moderation in Swahili, French
3. **Custom Models:** Fine-tune models on historical moderation data
4. **Webhooks:** Real-time notifications for flagged content
5. **Batch Processing:** Process multiple items efficiently
6. **Caching:** Cache common queries for faster responses
7. **Analytics Dashboard:** Detailed AI usage analytics
8. **A/B Testing:** Test different AI models and parameters

---

## Support & Monitoring

### Monitoring Dashboard

Track AI feature health:

```typescript
// Get system-wide AI stats
const { data: stats } = await supabase.rpc("get_system_ai_statistics");

// Monitor error rates
const { data: errors } = await supabase
  .from("ai_usage_logs")
  .select("*")
  .eq("status", "failed")
  .gte("created_at", now() - "1 day");
```

### Logging

All AI operations are logged in:
- `ai_usage_logs` - Usage tracking
- `content_moderation_logs` - Moderation results
- `verification_ai_reviews` - Verification results
- Supabase Edge Function logs

---

## Security Considerations

1. **API Key Protection:** OPENAI_API_KEY stored in Supabase secrets
2. **Rate Limiting:** Prevents abuse and cost overruns
3. **Authorization:** Admin-only functions require proper roles
4. **Data Privacy:** Content not stored on OpenAI servers (using API, not training)
5. **Audit Logging:** All AI decisions logged for compliance

---

## Contact & Support

For issues or questions about AI features:
1. Check this guide for troubleshooting
2. Review Supabase Edge Function logs
3. Contact the development team
4. Submit issues on GitHub
