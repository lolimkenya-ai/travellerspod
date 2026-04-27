import math

def calculate_fair_view_score(post, user_preferences, max_views):
    score = 0
    
    # 1. Human-created content boost (40 points max)
    human_boost = 0 if post.get('is_ai_generated') else 40
    score += human_boost
    
    # 2. View distribution (30 points max)
    view_score = max(0, 30 * (1 - post.get('views_count', 0) / (max_views + 1)))
    score += view_score
    
    # 3. Quality metrics (20 points max)
    engagement_rate = (post.get('likes_count', 0) + post.get('comments_count', 0) * 2) / (post.get('views_count', 0) + 1)
    quality_score = min(20, engagement_rate * 100)
    score += quality_score
    
    # 4. Recency bonus (10 points max)
    # Simplified for test
    recency_score = 10 
    score += recency_score
    
    # 5. User preference alignment
    preference_multiplier = 1
    matched_preferences = 0
    for pref, weight in user_preferences.items():
        if pref.lower() in post.get('caption', '').lower():
            matched_preferences += weight * 0.1
            
    preference_multiplier = 1 + min(matched_preferences, 0.5)
    
    return score * preference_multiplier

# Test cases
posts = [
    {'id': 1, 'caption': 'Budget hotel in Nairobi', 'is_ai_generated': False, 'views_count': 10, 'likes_count': 5, 'comments_count': 1},
    {'id': 2, 'caption': 'AI generated travel tips', 'is_ai_generated': True, 'views_count': 100, 'likes_count': 20, 'comments_count': 5},
    {'id': 3, 'caption': 'Luxury safari experience', 'is_ai_generated': False, 'views_count': 5, 'likes_count': 2, 'comments_count': 0}
]

user_prefs = {'budget': 2.0, 'nairobi': 1.5}
max_views = 100

print("Testing Fair-View Algorithm Logic:")
for p in posts:
    score = calculate_fair_view_score(p, user_prefs, max_views)
    print(f"Post {p['id']} ({'Human' if not p['is_ai_generated'] else 'AI'}): Score = {score:.2f}")
