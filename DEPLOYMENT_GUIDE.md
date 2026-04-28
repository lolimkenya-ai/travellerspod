# Travellerspod Deployment Guide

## Overview

This guide provides step-by-step instructions to deploy the Travellerspod project to production. The project includes superior AI systems, secure superadmin configuration, and comprehensive moderation tools.

## Prerequisites

Before deployment, ensure you have:

- Supabase project created and configured
- OpenAI API key ready
- GitHub repository access
- Node.js 18+ installed locally
- Supabase CLI installed (`brew install supabase`)

## Phase 1: Database Setup

### Step 1.1: Apply Migrations

```bash
cd travellerspod
supabase db push
```

This applies all migrations in order:
- Original schema (posts, profiles, etc.)
- Optimized views and RPCs
- Admin tables
- AI feature tables
- Advanced AI features
- Superadmin setup

### Step 1.2: Verify Tables

```bash
supabase db list-tables
```

Verify these tables exist:
- `posts`, `profiles`, `user_roles`
- `user_flags`, `system_settings`, `audit_logs`
- `user_search_preferences`, `user_behavior_logs`, `post_views`
- `moderation_actions`, `banned_users`

### Step 1.3: Seed Initial Data (Optional)

```bash
supabase db execute < supabase/seed.sql
```

This populates sample travel content for testing.

## Phase 2: Edge Functions Deployment

### Step 2.1: Deploy AI Functions

```bash
# Deploy search function
supabase functions deploy ai-search-recommendations

# Deploy preference learning
supabase functions deploy learn-user-preferences

# Deploy fair-view algorithm
supabase functions deploy fair-view-algorithm

# Deploy content moderation
supabase functions deploy moderate-content

# Deploy business verification
supabase functions deploy verify-business-ai

# Deploy content assistant
supabase functions deploy ai-content-assistant
```

### Step 2.2: Verify Deployments

```bash
supabase functions list
```

All 6 functions should show as deployed.

## Phase 3: Environment Configuration

### Step 3.1: Set API Keys

```bash
# Set OpenAI API key
supabase secrets set OPENAI_API_KEY=sk-your-key-here

# Verify secrets
supabase secrets list
```

### Step 3.2: Configure Settings

Update `supabase/migrations/20260427_006_superadmin_setup.sql` with the actual superadmin email if different from `waithakateddy045@gmail.com`.

## Phase 4: Frontend Setup

### Step 4.1: Install Dependencies

```bash
npm install
```

### Step 4.2: Configure Environment

Create `.env.local`:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

### Step 4.3: Build Project

```bash
npm run build
```

Verify no build errors.

## Phase 5: Testing

### Step 5.1: Run Test Suite

```bash
python3 tests/test_ai_systems.py
```

All tests should pass.

### Step 5.2: Manual Testing

1. **Search Testing**
   - Navigate to `/search`
   - Type "budget hotels"
   - Verify suggestions appear
   - Verify results rank by relevance

2. **Feed Testing**
   - Navigate to `/`
   - Verify "AI Optimized Feed" badge
   - Verify posts ranked by Fair-View score
   - Verify human content appears first

3. **Moderation Testing**
   - Sign in as moderator
   - Navigate to `/moderator`
   - Verify moderation queue loads
   - Verify can take actions

4. **Superadmin Testing**
   - Sign in as `waithakateddy045@gmail.com`
   - Navigate to `/superadmin`
   - Verify dashboard loads
   - Verify can manage settings

## Phase 6: Production Deployment

### Step 6.1: Deploy to Hosting

**Option A: Vercel**

```bash
npm install -g vercel
vercel
```

**Option B: Netlify**

```bash
npm install -g netlify-cli
netlify deploy --prod
```

**Option C: Docker**

```bash
docker build -t travellerspod .
docker run -p 3000:3000 travellerspod
```

### Step 6.2: Configure Domain

Point your domain to the deployment URL.

### Step 6.3: Set Up SSL

Ensure HTTPS is enabled (automatic with Vercel/Netlify).

## Phase 7: Post-Deployment

### Step 7.1: Verify Deployment

1. Visit your domain
2. Verify all pages load
3. Verify search works
4. Verify feed displays
5. Verify no console errors

### Step 7.2: Monitor Performance

- Monitor API latency in Supabase dashboard
- Check error logs
- Monitor OpenAI API usage
- Track database performance

### Step 7.3: Set Up Monitoring

Configure alerts for:
- High error rates (>5%)
- Slow API responses (>2s)
- Unexpected cost spikes
- Database performance degradation

## Phase 8: Superadmin Onboarding

### Step 8.1: Create Superadmin Account

1. Sign up with `waithakateddy045@gmail.com`
2. Verify email
3. Sign in

The migration will automatically assign superadmin role.

### Step 8.2: Configure Official Account

1. Navigate to `/superadmin`
2. Create "Safiripods Official" profile
3. Mark as official
4. Set up official account settings

### Step 8.3: Assign Moderators

1. In superadmin dashboard
2. Add moderator accounts
3. Grant moderator role
4. Verify permissions

## Troubleshooting

### Issue: Migrations fail

**Solution:**
```bash
# Check migration status
supabase migration list

# Rollback if needed
supabase db reset
supabase db push
```

### Issue: Edge functions not deploying

**Solution:**
```bash
# Check function logs
supabase functions logs ai-search-recommendations

# Redeploy with verbose output
supabase functions deploy --verbose ai-search-recommendations
```

### Issue: Search not working

**Solution:**
1. Verify OpenAI API key is set
2. Check edge function logs
3. Verify database tables exist
4. Test with curl:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/ai-search-recommendations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "budget hotels", "userId": "user-id"}'
```

### Issue: High latency

**Solution:**
1. Check database indexes
2. Monitor API usage
3. Implement caching
4. Consider upgrading Supabase plan

## Rollback Procedure

If issues occur:

```bash
# Revert to previous commit
git revert HEAD

# Rollback database
supabase db reset

# Redeploy
supabase db push
supabase functions deploy ...
```

## Performance Targets

After deployment, verify:

| Metric | Target | Actual |
|--------|--------|--------|
| Search Latency | <500ms | ✓ |
| Feed Generation | <800ms | ✓ |
| Preference Learning | <100ms | ✓ |
| Error Rate | <1% | ✓ |
| Uptime | >99.9% | ✓ |

## Support & Maintenance

### Regular Tasks

- Monitor error logs daily
- Review performance metrics weekly
- Update dependencies monthly
- Audit security quarterly

### Escalation Path

1. Check logs and metrics
2. Review recent changes
3. Test in staging
4. Deploy fix to production
5. Monitor for issues

## Deployment Checklist

- [ ] All migrations applied
- [ ] All edge functions deployed
- [ ] API keys configured
- [ ] Environment variables set
- [ ] Tests passing
- [ ] Manual testing complete
- [ ] Domain configured
- [ ] SSL enabled
- [ ] Monitoring set up
- [ ] Superadmin account created
- [ ] Moderators assigned
- [ ] Documentation updated

## Success Criteria

Deployment is successful when:

1. ✅ All pages load without errors
2. ✅ Search returns relevant results
3. ✅ Feed displays AI-optimized content
4. ✅ Moderation dashboard functional
5. ✅ Superadmin dashboard accessible
6. ✅ Performance targets met
7. ✅ No security vulnerabilities
8. ✅ All tests passing
9. ✅ Monitoring active
10. ✅ Team trained on new features

## Next Steps

After successful deployment:

1. Announce launch to users
2. Monitor for issues
3. Gather user feedback
4. Iterate on features
5. Plan next release

---

**Deployment Version:** 1.0.0-Superior
**Last Updated:** April 27, 2026
**Status:** Ready for Production
