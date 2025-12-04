# Marketplace Curation: Taste as a Moat

## The Core Insight

The WORKWAY marketplace moat isn't just technology—it's **taste**. The best workflows naturally rise; mediocre ones fade. But "taste" is subjective. How do we operationalize it?

**Heideggerian lens**: A workflow with "taste" achieves Zuhandenheit—it recedes from consciousness. The user thinks about their goal, not the tool. Bad workflows force users to think about the workflow itself (Vorhandenheit).

---

## Quality Signals: Operationalizing Taste

### 1. Reliability Metrics (Objective)

| Metric | Description | Weight |
|--------|-------------|--------|
| **Success Rate** | % of executions that complete successfully | High |
| **Error Recovery** | Does it handle errors gracefully? | Medium |
| **Response Time** | P50/P95 execution duration | Medium |
| **Uptime** | % of time the workflow is operational | High |

**Pruning threshold**: Workflows with <85% success rate for 30 days are flagged.

### 2. User Engagement (Behavioral)

| Metric | Description | Weight |
|--------|-------------|--------|
| **Active Installations** | Current number of active users | High |
| **30-Day Retention** | % of users still active after 30 days | Very High |
| **Re-purchase Rate** | For paid workflows, repeat purchases | High |
| **Time-to-Value** | How quickly users see results | Medium |

**Key insight**: Retention is more important than raw installs. A workflow with 100 users and 80% retention beats one with 1000 users and 10% retention.

### 3. Code Quality (Technical Taste)

| Metric | Description | Weight |
|--------|-------------|--------|
| **Zuhandenheit Score** | Uses intent-based SDK patterns | Medium |
| **Error Handling** | Has `onError` handler | Medium |
| **Type Safety** | Proper TypeScript usage | Low |
| **Documentation** | Clear description, examples | Medium |
| **Test Coverage** | Has tests that pass | Low |

**Zuhandenheit Score calculation**:
```typescript
function calculateZuhandenheitScore(code: string): number {
  let score = 50; // Base score

  // Positive signals (tools recede)
  if (code.includes('.for(')) score += 10;           // Intent-based AI
  if (code.includes('ai.synthesize')) score += 10;  // High-level synthesis
  if (code.includes('createDocument')) score += 10; // Template-based docs
  if (code.includes('assigneeByName')) score += 5;  // Human-readable refs
  if (code.includes('humanOnly:')) score += 5;      // Intent parameters

  // Negative signals (tools visible)
  if (code.includes('AIModels.')) score -= 10;      // Explicit model names
  if (code.match(/JSON\.parse.*catch/)) score -= 5; // Manual JSON handling
  if (code.includes('Math.floor(Date.now()')) score -= 5; // Manual timestamps

  return Math.max(0, Math.min(100, score));
}
```

### 4. Community Signals (Social Proof)

| Metric | Description | Weight |
|--------|-------------|--------|
| **Rating** | Average star rating (1-5) | High |
| **Review Count** | Number of reviews | Medium |
| **Fork Count** | Times workflow was forked/modified | Medium |
| **Discussion Activity** | Community engagement | Low |

---

## Curation Mechanisms

### Tier 1: Algorithmic Ranking

Default marketplace sort uses a composite score:

```typescript
function calculateRankingScore(workflow: Workflow): number {
  const weights = {
    successRate: 0.20,
    retention30d: 0.25,
    rating: 0.15,
    activeInstalls: 0.10,
    zuhandenheitScore: 0.10,
    recency: 0.10,
    reviewCount: 0.05,
    developerReputation: 0.05,
  };

  return (
    workflow.successRate * weights.successRate +
    workflow.retention30d * weights.retention30d +
    normalize(workflow.rating, 1, 5) * weights.rating +
    normalize(Math.log(workflow.activeInstalls + 1), 0, 10) * weights.activeInstalls +
    workflow.zuhandenheitScore / 100 * weights.zuhandenheitScore +
    recencyScore(workflow.lastUpdated) * weights.recency +
    normalize(Math.log(workflow.reviewCount + 1), 0, 5) * weights.reviewCount +
    workflow.developer.reputationScore * weights.developerReputation
  );
}
```

### Tier 2: Editorial Curation

**WORKWAY Picks**: Hand-selected workflows that exemplify:
- Zuhandenheit excellence
- Novel use cases
- Exceptional documentation
- Community impact

Displayed prominently on:
- Homepage featured section
- Category landing pages
- "Staff Picks" collection

**Criteria for WORKWAY Picks**:
1. ≥95% success rate
2. ≥70% 30-day retention
3. ≥80 Zuhandenheit score
4. ≥4.5 star rating with ≥10 reviews
5. Editorial review confirms quality

### Tier 3: Developer Verification

**Verified Developer** badge for developers who:
- Have ≥3 published workflows
- Average ≥90% success rate across workflows
- ≥50% 30-day retention average
- No policy violations
- Complete Stripe Connect setup

Benefits:
- Badge on profile and workflows
- Higher ranking weight
- Access to beta features
- Priority support

---

## Pruning Mechanisms

### Automated Pruning

| Condition | Action | Timeline |
|-----------|--------|----------|
| Success rate <70% for 14 days | Warning email | Immediate |
| Success rate <70% for 30 days | Unlisted (hidden from search) | Day 30 |
| Success rate <50% for 7 days | Unlisted | Immediate |
| No updates for 12 months | "Legacy" label | 12 months |
| No updates for 18 months | Unlisted | 18 months |
| Zero installations for 6 months | Archived | 6 months |

### Manual Pruning

**Reasons for removal**:
1. Policy violations (spam, malware, abuse)
2. Intellectual property claims
3. Developer request
4. Persistent low quality despite warnings

**Appeal process**:
1. Developer receives removal notice with reason
2. 14-day window to address issues
3. Review by trust & safety team
4. Final decision communicated

---

## Developer Reputation System

### Reputation Score (0-100)

```typescript
interface DeveloperReputation {
  score: number;  // 0-100
  tier: 'new' | 'established' | 'trusted' | 'expert';
  badges: string[];
}

function calculateDeveloperReputation(developer: Developer): DeveloperReputation {
  let score = 0;

  // Workflow performance (40 points max)
  const avgSuccessRate = average(developer.workflows.map(w => w.successRate));
  score += avgSuccessRate * 0.4;

  // User satisfaction (30 points max)
  const avgRating = average(developer.workflows.map(w => w.rating));
  score += (avgRating / 5) * 30;

  // Engagement (20 points max)
  const totalInstalls = sum(developer.workflows.map(w => w.activeInstalls));
  score += Math.min(20, Math.log10(totalInstalls + 1) * 5);

  // Longevity (10 points max)
  const monthsActive = monthsSince(developer.joinedAt);
  score += Math.min(10, monthsActive / 6);

  // Penalties
  if (developer.violations > 0) score -= developer.violations * 10;

  return {
    score: Math.max(0, Math.min(100, score)),
    tier: getTier(score),
    badges: getBadges(developer),
  };
}

function getTier(score: number): string {
  if (score >= 90) return 'expert';
  if (score >= 70) return 'trusted';
  if (score >= 40) return 'established';
  return 'new';
}
```

### Reputation Tiers

| Tier | Score | Benefits |
|------|-------|----------|
| **New** | 0-39 | Basic listing, standard support |
| **Established** | 40-69 | Higher visibility, analytics dashboard |
| **Trusted** | 70-89 | Verified badge, priority support, beta access |
| **Expert** | 90-100 | Featured placement, WORKWAY partnership, revenue share boost |

---

## Lifecycle of a Workflow

```
┌─────────────┐
│  SUBMITTED  │ → Initial review (automated + manual)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   LISTED    │ → Visible in marketplace
└──────┬──────┘
       │
       ├─── High quality ──→ ┌─────────────┐
       │                     │  FEATURED   │ → WORKWAY Pick
       │                     └─────────────┘
       │
       ├─── Declining ─────→ ┌─────────────┐
       │                     │  WARNING    │ → Developer notified
       │                     └──────┬──────┘
       │                            │
       │                            ▼
       │                     ┌─────────────┐
       │                     │  UNLISTED   │ → Hidden from search
       │                     └──────┬──────┘
       │                            │
       │                            ▼
       └─── Inactive ──────→ ┌─────────────┐
                             │  ARCHIVED   │ → Removed from marketplace
                             └─────────────┘
```

---

## Implementation: Curation Service

```typescript
// packages/api/src/services/curation.ts

export class CurationService {
  /**
   * Calculate workflow quality score
   */
  async calculateQualityScore(workflowId: string): Promise<QualityScore> {
    const workflow = await this.getWorkflow(workflowId);
    const metrics = await this.getMetrics(workflowId);

    return {
      overall: this.calculateOverallScore(workflow, metrics),
      reliability: metrics.successRate,
      engagement: this.calculateEngagementScore(metrics),
      codeQuality: await this.analyzeCodeQuality(workflow.code),
      community: this.calculateCommunityScore(workflow),
    };
  }

  /**
   * Run daily curation job
   */
  async runDailyCuration(): Promise<CurationResult> {
    const workflows = await this.getAllActiveWorkflows();

    const results = {
      featured: [] as string[],
      warned: [] as string[],
      unlisted: [] as string[],
      archived: [] as string[],
    };

    for (const workflow of workflows) {
      const score = await this.calculateQualityScore(workflow.id);

      // Feature high-quality workflows
      if (this.shouldFeature(workflow, score)) {
        await this.featureWorkflow(workflow.id);
        results.featured.push(workflow.id);
      }

      // Warn declining workflows
      if (this.shouldWarn(workflow, score)) {
        await this.warnDeveloper(workflow.developerId, workflow.id);
        results.warned.push(workflow.id);
      }

      // Unlist poor-quality workflows
      if (this.shouldUnlist(workflow, score)) {
        await this.unlistWorkflow(workflow.id);
        results.unlisted.push(workflow.id);
      }

      // Archive abandoned workflows
      if (this.shouldArchive(workflow)) {
        await this.archiveWorkflow(workflow.id);
        results.archived.push(workflow.id);
      }
    }

    return results;
  }

  private shouldFeature(workflow: Workflow, score: QualityScore): boolean {
    return (
      score.reliability >= 0.95 &&
      score.engagement >= 0.70 &&
      score.codeQuality >= 80 &&
      workflow.rating >= 4.5 &&
      workflow.reviewCount >= 10 &&
      !workflow.isFeatured
    );
  }

  private shouldWarn(workflow: Workflow, score: QualityScore): boolean {
    return (
      score.reliability < 0.70 &&
      workflow.status === 'listed' &&
      !workflow.hasRecentWarning
    );
  }

  private shouldUnlist(workflow: Workflow, score: QualityScore): boolean {
    return (
      (score.reliability < 0.70 && workflow.daysSinceWarning >= 30) ||
      (score.reliability < 0.50)
    );
  }

  private shouldArchive(workflow: Workflow): boolean {
    return (
      workflow.activeInstalls === 0 &&
      workflow.daysSinceLastInstall >= 180
    );
  }
}
```

---

## Database Schema

```sql
-- Workflow quality metrics (updated daily)
CREATE TABLE workflow_quality_scores (
  workflow_id UUID PRIMARY KEY REFERENCES workflows(id),
  overall_score DECIMAL(5,2),
  reliability_score DECIMAL(5,2),
  engagement_score DECIMAL(5,2),
  code_quality_score DECIMAL(5,2),
  community_score DECIMAL(5,2),
  zuhandenheit_score INTEGER,
  calculated_at TIMESTAMP DEFAULT NOW()
);

-- Developer reputation
CREATE TABLE developer_reputation (
  developer_id UUID PRIMARY KEY REFERENCES developers(id),
  score DECIMAL(5,2),
  tier VARCHAR(20),
  badges JSONB,
  violations INTEGER DEFAULT 0,
  calculated_at TIMESTAMP DEFAULT NOW()
);

-- Curation events
CREATE TABLE curation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id),
  event_type VARCHAR(50), -- 'featured', 'warned', 'unlisted', 'archived'
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Workflow status history
CREATE TABLE workflow_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id),
  old_status VARCHAR(20),
  new_status VARCHAR(20),
  reason TEXT,
  changed_at TIMESTAMP DEFAULT NOW()
);
```

---

## Summary: Taste as Algorithm + Human Judgment

| Layer | Mechanism | What it catches |
|-------|-----------|-----------------|
| **Automated** | Success rate, retention | Broken or abandoned workflows |
| **Algorithmic** | Composite ranking score | Surfaces quality organically |
| **Editorial** | WORKWAY Picks | Showcases exemplary taste |
| **Community** | Reviews, forks, discussions | Validates real-world value |
| **Developer** | Reputation tiers | Rewards consistent quality |

The marketplace moat is **earned through taste**:
- Workflows that achieve Zuhandenheit rise
- Developers who consistently ship quality gain reputation
- The community validates what actually works

*Weniger, aber besser. Fewer workflows, but better ones.*
