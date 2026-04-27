# Advanced AI System Documentation

## Overview

This document describes the advanced AI and machine learning systems integrated into Travellerspod, including intelligent search, adaptive preference learning, and the Fair-View content distribution algorithm.

## Table of Contents

1. [AI-Powered Search](#ai-powered-search)
2. [Adaptive Preference Learning](#adaptive-preference-learning)
3. [Fair-View Algorithm](#fair-view-algorithm)
4. [AI Settings & Optimization](#ai-settings--optimization)
5. [Performance Metrics](#performance-metrics)
6. [Implementation Guide](#implementation-guide)

---

## AI-Powered Search

### Overview

The AI-powered search system provides intelligent, context-aware search results that improve with user interaction. It combines semantic understanding with user preference matching.

### Features

**1. Real-Time Search Population**
- Searches both posts and business profiles simultaneously
- Ranks results by relevance score (0-100)
- Matches against title, description, tags, and categories
- Execution time: <500ms for most queries

**2. Smart Suggestions**
- Generates 5 contextually relevant search suggestions
- Uses GPT-4-mini to understand user intent
- Suggests specific destinations, accommodation types, activities, budget ranges
- Helps users refine their search

**3. User Preference Integration**
- Boosts results matching user's historical preferences
- Learns from past searches and interactions
- Personalizes ranking based on engagement style
- Applies multiplier boost (up to 1.5x) for preference matches

### Search Ranking Algorithm

```
Final Score = (Base Relevance Score) × (Preference Multiplier)

Base Relevance Score = 
  + Title Matches × 30 points
  + Description Matches × 15 points
  + Tag Matches × 20 points
  + Preference Boost × 10 points

Preference Multiplier = 1 + min(matched_preferences × 0.1, 0.5)
```

### API Reference

**Endpoint:** `supabase.functions.invoke("ai-search-recommendations")`

**Request:**
```json
{
  "query": "budget hotels in Nairobi",
  "userId": "uuid",
  "filters": {
    "priceRange": [50, 200],
    "location": "Nairobi",
    "businessType": "accommodation"
  },
  "limit": 20,
  "offset": 0
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "uuid",
      "type": "business",
      "title": "Budget Hotel Name",
      "description": "Affordable accommodation...",
      "relevanceScore": 92,
      "matchedFields": ["title", "tags"],
      "userPreferenceMatch": 0.85,
      "metadata": { ... }
    }
  ],
  "suggestions": [
    "cheap hotels Nairobi",
    "budget accommodation Kenya",
    "affordable lodging Nairobi"
  ],
  "userPreferences": { ... },
  "executionTime": 245
}
```

### Usage Example

```typescript
const { search, results, suggestions, loading } = useAISearch();

// Perform search
await search("budget hotels", {
  priceRange: [50, 200],
  location: "Nairobi"
});

// Results are automatically ranked by relevance
results.forEach(result => {
  console.log(`${result.title} - Score: ${result.relevanceScore}`);
});
```

---

## Adaptive Preference Learning

### Overview

The system learns user preferences through behavioral analysis. Every interaction (view, like, comment, share, save) contributes to building a personalized preference profile.

### Learning Mechanism

**1. Behavior Tracking**
- Tracks all user interactions: view, like, share, scroll_past, comment, save
- Records engagement duration (time spent viewing)
- Captures scroll depth (percentage of content viewed)
- Stores post metadata (category, tags, business type, location, price range)

**2. Preference Extraction**
- Extracts keywords from post metadata
- Applies action-based weights:
  - View: 1x weight
  - Like: 3x weight
  - Comment: 4x weight
  - Share: 5x weight
  - Save: 4x weight
  - Scroll Past: -0.5x weight (negative signal)

**3. Preference Decay**
- Old preferences decay over time (95% per day)
- Favors recent behavior for freshness
- Prevents outdated preferences from dominating

**4. Exponential Moving Average**
- New preferences merged with existing ones
- Learning rate: 0.3 (30% weight to new data)
- Formula: `new_value = old_value × 0.7 + new_data × 0.3`

**5. Engagement Style Detection**
- Identifies user's primary engagement mode
- Styles: likes, comments, shares, saves, mixed
- Detected from recent 100 interactions
- Used to personalize recommendations

### Preference Profile Example

```json
{
  "category:safari": 2.5,
  "category:beach": 1.8,
  "business:lodge": 3.2,
  "business:hotel": 2.1,
  "location:Kenya": 2.8,
  "location:Tanzania": 1.5,
  "tag:luxury": 2.0,
  "tag:budget": 1.2,
  "engagement_style": "likes"
}
```

### API Reference

**Endpoint:** `supabase.functions.invoke("learn-user-preferences")`

**Request:**
```json
{
  "userId": "uuid",
  "postId": "uuid",
  "action": "like",
  "duration": 5000,
  "scrollDepth": 85,
  "postMetadata": {
    "category": "safari",
    "businessType": "lodge",
    "location": "Kenya",
    "priceRange": [150, 300],
    "tags": ["luxury", "wildlife"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "preferences": { ... },
  "engagementStyle": "likes",
  "preferencesUpdated": 5
}
```

### Usage Example

```typescript
const { recordBehavior, preferences, engagementStyle } = usePreferenceLearning();

// Record a like action
await recordBehavior(postId, "like", {
  duration: 5000,
  scrollDepth: 85,
  postMetadata: {
    category: "safari",
    businessType: "lodge",
    location: "Kenya"
  }
});

// Preferences are automatically updated
console.log("User preferences:", preferences);
console.log("Engagement style:", engagementStyle);
```

---

## Fair-View Algorithm

### Overview

The Fair-View algorithm ensures equitable content distribution while maintaining quality. It prioritizes human-created content, ensures all content gets viewed, and boosts underexposed posts.

### Core Principles

1. **Human Content Priority** - 40 points max
2. **View Distribution** - 30 points max (lower views = higher score)
3. **Quality Metrics** - 20 points max (engagement rate)
4. **Recency** - 10 points max (newer content preferred)
5. **User Preferences** - Multiplier boost (up to 1.5x)

### Fair-View Score Calculation

```
Score = (Human Boost + View Score + Quality Score + Recency Score) × Preference Multiplier

Human Boost = is_human_created ? 40 : 0

View Score = 30 × (1 - current_views / max_views)
  // Lower views = higher score

Quality Score = min(20, engagement_rate × 100)
  // engagement_rate = (likes + comments×2) / views

Recency Score = 10 × exp(-age_in_hours / 24)
  // Exponential decay over 24 hours

Preference Multiplier = 1 + min(matched_preferences × 0.1, 0.5)
  // Max 50% boost for preference matches
```

### Feed Distribution Strategy

**Feed Composition (per request):**
- 80% Unviewed content (priority)
- 15% Low-view content (boost)
- 5% Promoted content (ads/broadcasts, max 1 per session)

**Unviewed Content Priority:**
- User hasn't seen this post before
- Sorted by Fair-View score
- Ensures all content gets initial exposure

**Low-View Content Boost:**
- Posts with <50 views
- Prevents content from being buried
- Gives second chance to quality posts

**Promoted Content Limits:**
- Maximum 3 promoted items per day
- Prevents ad fatigue
- Ensures organic content dominates

### Example Feed Composition

```
Feed of 20 posts:
├── 16 posts (80%) - Unviewed content
│   ├── Human-created posts (prioritized)
│   ├── Sorted by Fair-View score
│   └── Personalized by user preferences
├── 3 posts (15%) - Low-view content
│   ├── Quality posts with <50 views
│   ├── Deserving of more exposure
│   └── Boosted by algorithm
└── 1 post (5%) - Promoted
    ├── Ad or broadcast content
    └── Limited to 3 per day
```

### API Reference

**Endpoint:** `supabase.functions.invoke("fair-view-algorithm")`

**Request:**
```json
{
  "userId": "uuid",
  "limit": 20,
  "offset": 0,
  "category": "safari",
  "userPreferences": {
    "category:safari": 2.5,
    "location:Kenya": 2.8
  }
}
```

**Response:**
```json
{
  "posts": [ ... ],
  "totalCount": 20,
  "algorithmVersion": "fair-view-v1",
  "distributionBreakdown": {
    "unviewed": 16,
    "lowView": 3,
    "promoted": 1
  }
}
```

### Usage Example

```typescript
const { loadFeed, posts, distribution, recordPostView } = useFairViewFeed();

// Load feed with preferences
await loadFeed("safari", userPreferences);

// Record view when user sees post
posts.forEach(post => {
  const viewInfo = await recordPostView(post.id);
  console.log(`First view: ${viewInfo.is_first_view}`);
});

// Check distribution
console.log("Feed distribution:", distribution);
// Output: { unviewed: 16, lowView: 3, promoted: 1 }
```

---

## AI Settings & Optimization

### Performance Optimization

**1. Query Optimization**
- Indexed searches on caption, display_name, nametag
- Indexed behavior logs by user, post, action
- Indexed post views by user and post
- Batch operations where possible

**2. Caching Strategy**
- User preferences cached in browser
- Search results cached for 5 minutes
- Trending topics cached for 1 hour
- Feed impressions logged asynchronously

**3. Execution Time Targets**
- Search: <500ms
- Preference learning: <100ms
- Feed generation: <800ms
- Preference insights: <300ms

**4. Database Indexes**
```sql
-- Search performance
CREATE INDEX idx_posts_caption ON posts USING GIN (caption);
CREATE INDEX idx_profiles_name ON profiles USING GIN (display_name);

-- Behavior tracking
CREATE INDEX idx_behavior_user_created ON user_behavior_logs(user_id, created_at DESC);
CREATE INDEX idx_behavior_action ON user_behavior_logs(action);

-- Feed generation
CREATE INDEX idx_post_views_user ON post_views(user_id);
CREATE INDEX idx_posts_views_count ON posts(views_count DESC);
```

### AI Model Settings

**Search & Recommendations:**
- Model: gpt-4-mini
- Temperature: 0.6 (balanced creativity)
- Max tokens: 150
- Cost: ~$0.0001 per request

**Content Moderation:**
- Model: text-moderation-latest (free)
- Model: gpt-4-mini for spam
- Temperature: 0.3 (conservative)
- Max tokens: 200

**Preference Learning:**
- Learning rate: 0.3 (30% weight to new data)
- Decay factor: 0.95 (per day)
- Noise threshold: 0.1 (remove weak signals)

**Fair-View Algorithm:**
- Human boost: 40 points
- View decay: exponential
- Preference multiplier: up to 1.5x
- Recency half-life: 24 hours

### Tuning Parameters

All parameters are configurable via the admin dashboard:

```typescript
// Example: Adjust learning rate
await supabase
  .from("ai_settings")
  .update({ learning_rate: 0.4 })
  .eq("setting_name", "preference_learning_rate");

// Example: Adjust human content boost
await supabase
  .from("ai_settings")
  .update({ human_content_boost: 50 })
  .eq("setting_name", "fair_view_human_boost");
```

---

## Performance Metrics

### Key Metrics to Monitor

**1. Search Performance**
- Average execution time
- Results per query
- Click-through rate
- Search satisfaction (user feedback)

**2. Preference Learning**
- Preferences updated per user
- Engagement style distribution
- Preference decay rate
- Learning effectiveness

**3. Feed Algorithm**
- Distribution breakdown (unviewed/low-view/promoted)
- Average Fair-View score
- Content diversity
- User satisfaction

**4. System Health**
- Error rates
- API latency
- Database query times
- Cost per operation

### Admin Dashboard Queries

```typescript
// Get algorithm performance
const { metrics } = useAlgorithmMetrics(7);
console.log(metrics);
// Output:
// {
//   algorithm_version: "fair-view-v1",
//   total_impressions: 50000,
//   avg_posts_per_feed: 20,
//   unviewed_percentage: 0.78,
//   human_content_percentage: 0.82,
//   promoted_percentage: 0.05
// }

// Get trending search topics
const { topics } = useTrendingSearchTopics(7);
topics.forEach(topic => {
  console.log(`${topic.query}: ${topic.search_count} searches`);
});

// Get user preference insights
const { insights } = usePreferenceInsights();
console.log(insights);
// Output:
// {
//   top_categories: ["safari", "beach", "hiking"],
//   top_locations: ["Kenya", "Tanzania", "Uganda"],
//   top_business_types: ["lodge", "hotel", "tour_operator"],
//   engagement_style: "likes",
//   preference_strength: 0.85
// }
```

---

## Implementation Guide

### Step 1: Deploy Edge Functions

```bash
# Deploy search function
supabase functions deploy ai-search-recommendations

# Deploy preference learning
supabase functions deploy learn-user-preferences

# Deploy fair-view algorithm
supabase functions deploy fair-view-algorithm
```

### Step 2: Apply Database Migrations

```bash
# Apply advanced AI features migration
supabase db push 20260427_005_advanced_ai_features.sql
```

### Step 3: Integrate Frontend Hooks

```typescript
// In your search component
import { useDebouncedSearch } from "@/hooks/useAdvancedAI";

export function SearchComponent() {
  const { query, setQuery, results, suggestions, loading } = useDebouncedSearch(300);

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
      />
      {suggestions.map(s => <div key={s}>{s}</div>)}
      {results.map(r => <div key={r.id}>{r.title}</div>)}
    </div>
  );
}
```

### Step 4: Implement Behavior Tracking

```typescript
// In your feed component
import { usePreferenceLearning, useFairViewFeed } from "@/hooks/useAdvancedAI";

export function FeedComponent() {
  const { loadFeed, posts, recordPostView } = useFairViewFeed();
  const { recordBehavior } = usePreferenceLearning();

  useEffect(() => {
    loadFeed();
  }, []);

  const handlePostView = async (post) => {
    await recordPostView(post.id);
    await recordBehavior(post.id, "view", {
      duration: 3000,
      scrollDepth: 75,
      postMetadata: {
        category: post.category,
        businessType: post.businessType,
        location: post.location
      }
    });
  };

  return (
    <div>
      {posts.map(post => (
        <PostCard
          key={post.id}
          post={post}
          onView={() => handlePostView(post)}
        />
      ))}
    </div>
  );
}
```

### Step 5: Monitor Performance

```typescript
// In admin dashboard
import { useAlgorithmMetrics, useTrendingSearchTopics } from "@/hooks/useAdvancedAI";

export function AdminDashboard() {
  const { metrics, fetchMetrics } = useAlgorithmMetrics(7);
  const { topics, fetchTrending } = useTrendingSearchTopics(7);

  useEffect(() => {
    fetchMetrics();
    fetchTrending();
  }, []);

  return (
    <div>
      <h2>Algorithm Performance</h2>
      <p>Unviewed: {metrics?.unviewed_percentage}%</p>
      <p>Human Content: {metrics?.human_content_percentage}%</p>

      <h2>Trending Searches</h2>
      {topics.map(t => <div key={t.query}>{t.query}</div>)}
    </div>
  );
}
```

---

## Troubleshooting

### Issue: Search is slow

**Solutions:**
- Check database indexes are created
- Monitor query execution time
- Consider caching frequent queries
- Increase timeout limits

### Issue: Preferences not updating

**Solutions:**
- Verify behavior logs are being created
- Check user_search_preferences table
- Ensure learning rate is appropriate
- Monitor decay factor

### Issue: Feed distribution is unbalanced

**Solutions:**
- Adjust unviewed/low-view/promoted percentages
- Check Fair-View score calculation
- Verify human content detection
- Monitor content quality metrics

### Issue: High API costs

**Solutions:**
- Monitor token usage
- Implement caching
- Batch operations
- Use cheaper models where appropriate

---

## Future Enhancements

1. **Collaborative Filtering** - Recommend based on similar users
2. **Content-Based Filtering** - Recommend similar posts
3. **Hybrid Recommendations** - Combine multiple approaches
4. **A/B Testing Framework** - Test algorithm variations
5. **Real-time Personalization** - Instant preference updates
6. **Multi-language Support** - Search in Swahili, French
7. **Image Recognition** - Analyze visual content
8. **Sentiment Analysis** - Understand post sentiment
9. **Trend Prediction** - Forecast trending topics
10. **User Segmentation** - Group users by behavior

---

## Summary

The Advanced AI System provides:

✅ **Intelligent Search** - Context-aware, personalized results
✅ **Adaptive Learning** - Learns from every user interaction
✅ **Fair Distribution** - Equitable content visibility
✅ **Human-First** - Prioritizes human-created content
✅ **Performance** - Optimized for speed and scalability
✅ **Transparency** - Explainable algorithm decisions
✅ **Fairness** - Prevents content from being buried
✅ **Personalization** - Tailored to individual preferences

All features are production-ready and fully documented.
