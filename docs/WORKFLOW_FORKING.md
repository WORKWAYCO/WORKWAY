# Workflow Forking: Lineage as Value

## The Core Insight

Forking isn't copying—it's **continuation of understanding**. A fork acknowledges that the original workflow achieved Zuhandenheit for some use case, and the forker is extending that understanding to a new context.

**Heideggerian lens**: The original workflow is Vorhanden (present-at-hand) to the forker—they're studying it, understanding it. Through forking and modification, it becomes Zuhanden (ready-to-hand) again—a tool that recedes into their new use case.

---

## Forking Model

### Lineage Tracking

Every workflow maintains its lineage:

```typescript
interface WorkflowLineage {
  id: string;                    // This workflow's ID
  originalId: string | null;     // Root ancestor (null if original)
  parentId: string | null;       // Direct parent (null if original)
  forkDepth: number;             // How many generations from original
  forkCount: number;             // How many times this has been forked
  attributionChain: Attribution[]; // Full lineage for revenue sharing
}

interface Attribution {
  workflowId: string;
  developerId: string;
  developerName: string;
  percentage: number;            // Revenue share percentage
}
```

### Revenue Attribution

Forked workflows share revenue with their lineage:

| Fork Depth | Original Creator | Parent Creator | Fork Creator |
|------------|------------------|----------------|--------------|
| 1 (direct fork) | 15% | — | 85% |
| 2 | 10% | 10% | 80% |
| 3+ | 5% | 5% (each ancestor, max 15% total) | 75%+ |

**Philosophy**: Original creators deserve ongoing recognition. But attribution decays—at some point, the fork has evolved enough to stand on its own.

---

## CLI Commands

### Fork a Workflow

```bash
# Fork from marketplace
workway fork meeting-intelligence

# Fork with new name
workway fork meeting-intelligence --name "sales-call-analyzer"

# Fork from specific version
workway fork meeting-intelligence@1.2.0

# Fork and immediately modify
workway fork meeting-intelligence --modify "Add HubSpot CRM integration"
```

### View Lineage

```bash
# See this workflow's ancestry
workway lineage

# See all forks of a workflow
workway forks meeting-intelligence
```

---

## Implementation

### Database Schema

```sql
-- Workflow lineage tracking
CREATE TABLE workflow_lineage (
  workflow_id UUID PRIMARY KEY REFERENCES workflows(id),
  original_id UUID REFERENCES workflows(id),  -- Root ancestor
  parent_id UUID REFERENCES workflows(id),    -- Direct parent
  fork_depth INTEGER DEFAULT 0,
  forked_at TIMESTAMP,
  fork_reason TEXT,                           -- Why did they fork?
  changes_summary TEXT                        -- What did they change?
);

-- Fork statistics (materialized for performance)
CREATE TABLE workflow_fork_stats (
  workflow_id UUID PRIMARY KEY REFERENCES workflows(id),
  total_forks INTEGER DEFAULT 0,
  direct_forks INTEGER DEFAULT 0,
  active_forks INTEGER DEFAULT 0,            -- Forks with >0 installations
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Attribution chain for revenue sharing
CREATE TABLE workflow_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id),
  ancestor_workflow_id UUID REFERENCES workflows(id),
  ancestor_developer_id UUID REFERENCES developers(id),
  depth INTEGER,                              -- 1 = parent, 2 = grandparent, etc.
  percentage DECIMAL(5,2),                    -- Revenue share percentage
  UNIQUE(workflow_id, ancestor_workflow_id)
);
```

### Fork Service

```typescript
// packages/api/src/services/fork.ts

export class ForkService {
  /**
   * Fork a workflow
   */
  async forkWorkflow(options: {
    sourceWorkflowId: string;
    developerId: string;
    newName?: string;
    reason?: string;
  }): Promise<ForkResult> {
    const source = await this.getWorkflow(options.sourceWorkflowId);

    // Check if source allows forking
    if (!source.allowForks) {
      throw new Error('This workflow does not allow forking');
    }

    // Get lineage from source
    const sourceLineage = await this.getLineage(source.id);
    const newDepth = sourceLineage.forkDepth + 1;

    // Create new workflow
    const forked = await this.createWorkflow({
      name: options.newName || `${source.name} (Fork)`,
      description: source.description,
      code: source.code,
      developerId: options.developerId,
      visibility: 'private', // Forks start private
    });

    // Create lineage record
    await this.createLineage({
      workflowId: forked.id,
      originalId: sourceLineage.originalId || source.id,
      parentId: source.id,
      forkDepth: newDepth,
      forkReason: options.reason,
    });

    // Calculate and store attribution chain
    await this.calculateAttribution(forked.id, source.id, newDepth);

    // Increment fork count on source
    await this.incrementForkCount(source.id);

    return {
      workflow: forked,
      lineage: await this.getLineage(forked.id),
      attribution: await this.getAttribution(forked.id),
    };
  }

  /**
   * Calculate revenue attribution for a forked workflow
   */
  private async calculateAttribution(
    workflowId: string,
    parentId: string,
    depth: number
  ): Promise<void> {
    const attributions: Attribution[] = [];

    // Get parent's attribution chain
    const parentAttribution = await this.getAttribution(parentId);

    if (depth === 1) {
      // Direct fork: parent gets 15%
      const parent = await this.getWorkflow(parentId);
      attributions.push({
        ancestorWorkflowId: parentId,
        ancestorDeveloperId: parent.developerId,
        depth: 1,
        percentage: 15,
      });
    } else if (depth === 2) {
      // Second-level fork: original 10%, parent 10%
      const parent = await this.getWorkflow(parentId);
      const original = await this.getWorkflow(
        parentAttribution.find(a => a.depth === 1)?.ancestorWorkflowId!
      );

      attributions.push(
        { ancestorWorkflowId: original.id, ancestorDeveloperId: original.developerId, depth: 2, percentage: 10 },
        { ancestorWorkflowId: parentId, ancestorDeveloperId: parent.developerId, depth: 1, percentage: 10 }
      );
    } else {
      // Deep forks: cap total attribution at 25%
      const totalCap = 25;
      const perAncestor = Math.min(5, totalCap / Math.min(depth, 5));

      // Attribute to each ancestor up to 5 levels
      let currentId = parentId;
      for (let d = 1; d <= Math.min(depth, 5); d++) {
        const workflow = await this.getWorkflow(currentId);
        attributions.push({
          ancestorWorkflowId: currentId,
          ancestorDeveloperId: workflow.developerId,
          depth: d,
          percentage: perAncestor,
        });

        const lineage = await this.getLineage(currentId);
        if (!lineage.parentId) break;
        currentId = lineage.parentId;
      }
    }

    // Store attributions
    for (const attr of attributions) {
      await this.db.insert('workflow_attribution', {
        workflowId,
        ...attr,
      });
    }
  }

  /**
   * Get lineage tree for a workflow
   */
  async getLineageTree(workflowId: string): Promise<LineageTree> {
    const workflow = await this.getWorkflow(workflowId);
    const lineage = await this.getLineage(workflowId);

    // Get ancestors
    const ancestors: WorkflowSummary[] = [];
    let currentId = lineage.parentId;
    while (currentId) {
      const ancestor = await this.getWorkflow(currentId);
      ancestors.unshift(ancestor);
      const ancestorLineage = await this.getLineage(currentId);
      currentId = ancestorLineage.parentId;
    }

    // Get direct forks
    const forks = await this.getDirectForks(workflowId);

    return {
      workflow,
      ancestors,
      forks,
      totalForks: await this.getTotalForkCount(workflowId),
      activeForks: await this.getActiveForkCount(workflowId),
    };
  }
}
```

### CLI Implementation

```typescript
// packages/cli/src/commands/workflow/fork.ts

export async function forkCommand(workflowIdentifier?: string): Promise<void> {
  Logger.header('Fork Workflow');
  Logger.blank();

  // Get workflow to fork
  let targetId = workflowIdentifier;
  if (!targetId) {
    const answer = await inquirer.prompt([{
      type: 'input',
      name: 'workflow',
      message: 'Workflow to fork (name or ID):',
      validate: (input) => input.length > 0 || 'Please enter a workflow name or ID',
    }]);
    targetId = answer.workflow;
  }

  // Fetch workflow details
  const spinner = Logger.spinner('Fetching workflow...');
  const workflow = await api.getWorkflow(targetId);
  spinner.succeed(`Found: ${workflow.name}`);
  Logger.blank();

  // Show workflow info
  Logger.info('Original Workflow:');
  Logger.log(`  Name: ${workflow.name}`);
  Logger.log(`  Developer: ${workflow.developer.name}`);
  Logger.log(`  Installations: ${workflow.activeInstalls}`);
  Logger.log(`  Rating: ${workflow.rating} (${workflow.reviewCount} reviews)`);

  // Check if already forked
  const lineage = workflow.lineage;
  if (lineage?.forkDepth > 0) {
    Logger.blank();
    Logger.warn('Note: This is already a fork');
    Logger.log(`  Original: ${lineage.originalName}`);
    Logger.log(`  Fork depth: ${lineage.forkDepth}`);
  }
  Logger.blank();

  // Get fork options
  const options = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Name for your fork:',
      default: `${workflow.name} (My Version)`,
    },
    {
      type: 'input',
      name: 'reason',
      message: 'Why are you forking? (helps the community):',
      default: '',
    },
  ]);

  // Show attribution info
  Logger.blank();
  Logger.info('Revenue Attribution:');
  const depth = (lineage?.forkDepth || 0) + 1;
  if (depth === 1) {
    Logger.log(`  ${workflow.developer.name}: 15%`);
    Logger.log(`  You: 85%`);
  } else if (depth === 2) {
    Logger.log(`  Original creator: 10%`);
    Logger.log(`  ${workflow.developer.name}: 10%`);
    Logger.log(`  You: 80%`);
  } else {
    Logger.log(`  Ancestors (shared): ~${Math.min(25, depth * 5)}%`);
    Logger.log(`  You: ~${Math.max(75, 100 - depth * 5)}%`);
  }
  Logger.blank();

  // Confirm
  const confirm = await inquirer.prompt([{
    type: 'confirm',
    name: 'proceed',
    message: 'Create this fork?',
    default: true,
  }]);

  if (!confirm.proceed) {
    Logger.warn('Fork cancelled');
    return;
  }

  // Create fork
  const forkSpinner = Logger.spinner('Creating fork...');
  const result = await api.forkWorkflow({
    workflowId: workflow.id,
    name: options.name,
    reason: options.reason,
  });
  forkSpinner.succeed('Fork created!');
  Logger.blank();

  // Download to local
  const downloadSpinner = Logger.spinner('Downloading workflow...');
  await downloadWorkflow(result.workflow.id);
  downloadSpinner.succeed('Downloaded to ./workflow.ts');
  Logger.blank();

  Logger.success('Fork complete!');
  Logger.log('');
  Logger.log('Next steps:');
  Logger.log('  1. Edit workflow.ts to customize');
  Logger.log('  2. Run `workway workflow test` to verify');
  Logger.log('  3. Run `workway workflow publish` when ready');
}
```

---

## Community Features

### Fork Visibility

Forkers can choose visibility:

| Visibility | Description |
|------------|-------------|
| **Private** | Only you can see/use (default for forks) |
| **Unlisted** | Anyone with link can use, not in search |
| **Public** | Listed in marketplace with lineage shown |

### Fork Discovery

On a workflow's marketplace page:

```
┌─────────────────────────────────────────────────────────────┐
│ Meeting Intelligence                                        │
│ by Alex Chen • ★★★★★ 4.8 (127 reviews)                     │
│                                                             │
│ [Install]  [Fork]  [View Code]                             │
├─────────────────────────────────────────────────────────────┤
│ 🔀 23 forks                                                 │
│                                                             │
│ Popular forks:                                              │
│   • Sales Call Analyzer by Sarah M. (★★★★☆ 4.2)           │
│     "Added HubSpot CRM and pipeline tracking"              │
│   • Engineering Standup Bot by DevTeam (★★★★★ 4.9)        │
│     "Optimized for async engineering standups"             │
│   • Customer Success Calls by CSM Pro (★★★★☆ 4.5)         │
│     "Added sentiment analysis and churn signals"           │
└─────────────────────────────────────────────────────────────┘
```

### Attribution Display

Forked workflows show lineage:

```
┌─────────────────────────────────────────────────────────────┐
│ Sales Call Analyzer                                         │
│ by Sarah M.                                                 │
│                                                             │
│ 🔀 Forked from Meeting Intelligence by Alex Chen           │
│    └─ Changed: Added HubSpot CRM, pipeline tracking        │
├─────────────────────────────────────────────────────────────┤
│ Revenue flows to:                                           │
│   Alex Chen (original): 15%                                │
│   Sarah M. (this fork): 85%                                │
└─────────────────────────────────────────────────────────────┘
```

---

## Fork Etiquette

### Good Fork Practices

1. **Credit the original** - Lineage is automatic, but add thanks in description
2. **Document changes** - Explain what you modified and why
3. **Maintain quality** - Don't publish broken forks
4. **Contribute back** - If you fix bugs, consider PR to original

### Fork Policies

- **License inheritance**: Forks inherit original's license
- **No circumvention**: Can't fork to remove attribution
- **Quality standards**: Forks must meet same marketplace quality bar
- **Trademark respect**: Can't imply original author's endorsement

---

## Metrics & Analytics

### For Original Creators

```
Your Workflow: Meeting Intelligence

Fork Analytics (last 30 days):
  • New forks: 12
  • Active forks: 18 (of 23 total)
  • Fork revenue: $127.50 (from 15% attribution)

Top fork improvements:
  • HubSpot integration (5 forks adopted)
  • Async mode (3 forks adopted)
  • Spanish translation (2 forks adopted)

Consider incorporating:
  → HubSpot integration is popular - add to original?
```

### For the Ecosystem

- **Fork success rate**: Are forks becoming successful?
- **Attribution flow**: How much revenue flows to original creators?
- **Innovation velocity**: Are forks adding novel capabilities?

---

## Market Safety: Is Forking Safe for WORKWAY?

### The Concern

Forking could theoretically:
- Commoditize original work (race to bottom)
- Let clones capture all value
- Flood marketplace with low-quality variants
- Enable large players to "embrace, extend, extinguish"

### Why It's Actually Safe

**1. Attribution is Platform-Enforced**

```
┌─────────────────────────────────────────────────────────────┐
│ Revenue Flow (Automatic, Cannot Be Disabled)               │
│                                                             │
│   User pays $1.00 for fork execution                       │
│   ├─ WORKWAY platform fee: $0.20                           │
│   ├─ Original creator: $0.12 (15% of $0.80)                │
│   └─ Fork creator: $0.68 (85% of $0.80)                    │
│                                                             │
│   Fork success = Original success                           │
└─────────────────────────────────────────────────────────────┘
```

- Revenue sharing happens at Stripe payout level
- Cannot be circumvented by fork creators
- Attempting to strip attribution = ban + legal action

**2. Originals Gain from Fork Success**

| Scenario | Original Creator Outcome |
|----------|-------------------------|
| Fork fails | No change |
| Fork succeeds modestly | Passive income stream |
| Fork becomes massive | Substantial ongoing revenue |
| Multiple forks succeed | Compounding returns |

The original creator **cannot lose** from forking. They only gain.

**3. Fork Count is Social Proof**

```
┌─────────────────────────────────────────────────────────────┐
│ Meeting Intelligence        ★★★★★ 4.8                      │
│ by Alex Chen                                                │
│                                                             │
│ 🔀 47 forks                 ← This signals value            │
│ 📦 1,234 installations                                      │
│                                                             │
│ "The workflow that spawned an entire category"              │
└─────────────────────────────────────────────────────────────┘
```

High fork count = market validation that this is foundational work.

**4. Quality Bar Prevents Flooding**

Forks must meet the same quality standards:
- ≥85% success rate
- Pass automated validation
- Meet code quality thresholds
- Subject to same quality support triggers

Low-effort forks move to "Needs Work" status just like any other workflow—with support to improve.

**5. Network Effects Favor Originals**

- Reviews/ratings: Original has head start
- SEO: Original indexed first
- Trust: "Official" vs "Fork" signaling
- Updates: Original often has better maintenance

**6. The Alternative is Worse**

Without forking:
- Developers reinvent similar workflows from scratch
- No attribution to original inspirations
- Fragmented ecosystem with redundant work
- Innovation silos instead of building on each other

### Preventing Abuse

| Abuse Vector | Prevention |
|--------------|------------|
| Strip attribution | Technical: Code-level enforcement |
| Undercut on price | Economic: Still paying 15% to original |
| Quality flooding | Curation: Same quality bar applies |
| Trademark abuse | Policy: No implying endorsement |
| Clone farming | Detection: Similarity analysis flags clones |

---

## Duplicate Prevention: Clone Detection System

### The Problem

Without detection, bad actors could:
- Mass-submit slight variations of popular workflows
- Create clones that appear original (bypassing attribution)
- Flood the marketplace with low-value noise

### Similarity Analysis Pipeline

```typescript
// packages/api/src/services/duplicate-detection.ts

export class DuplicateDetectionService {
  /**
   * Analyze new workflow for duplicates at publish time
   */
  async checkForDuplicates(workflow: Workflow): Promise<DuplicateCheckResult> {
    const [codeSim, semanticSim, signatureMatch] = await Promise.all([
      this.analyzeCodeSimilarity(workflow),
      this.analyzeSemanticSimilarity(workflow),
      this.checkSignatureMatch(workflow),
    ]);

    return this.evaluateResults(codeSim, semanticSim, signatureMatch);
  }

  /**
   * AST-based code similarity (structure, not strings)
   */
  private async analyzeCodeSimilarity(workflow: Workflow): Promise<SimilarityScore> {
    // Parse to AST
    const ast = parseTypeScript(workflow.code);

    // Extract structural features
    const features = {
      importPattern: extractImports(ast),
      functionSignatures: extractFunctions(ast),
      integrationCalls: extractIntegrationUsage(ast),
      triggerType: extractTriggerType(ast),
      controlFlow: extractControlFlowGraph(ast),
    };

    // Compare against existing workflows
    const candidates = await this.getCandidateWorkflows(features);

    return this.calculateStructuralSimilarity(features, candidates);
  }

  /**
   * Semantic similarity (what it does, not how)
   */
  private async analyzeSemanticSimilarity(workflow: Workflow): Promise<SimilarityScore> {
    // Generate embedding from description + code comments
    const embedding = await this.generateEmbedding(
      workflow.description + ' ' + extractComments(workflow.code)
    );

    // Vector search for similar workflows
    const similar = await this.vectorSearch(embedding, { topK: 10 });

    return {
      score: similar[0]?.score ?? 0,
      matches: similar,
    };
  }

  /**
   * Signature match (exact structural fingerprint)
   */
  private async checkSignatureMatch(workflow: Workflow): Promise<SignatureMatch> {
    const signature = this.generateSignature(workflow);

    // Signature = hash of (integrations + trigger + input schema)
    // This catches direct clones even with cosmetic changes

    const matches = await this.findBySignature(signature);

    return {
      hasExactMatch: matches.length > 0,
      matches,
    };
  }
}
```

### Detection Thresholds

| Score | Action |
|-------|--------|
| **>95% code similarity** | Block: Likely direct clone |
| **>85% code similarity** | Prompt: Suggest forking instead |
| **>90% semantic similarity** | Review: May be legitimate variation |
| **Signature match** | Block: Exact structural duplicate |

### Fork-First UX at Publish

When similarity detected:

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️  Similar Workflows Detected                              │
│                                                             │
│ Your workflow shares 87% similarity with:                   │
│                                                             │
│   Meeting Intelligence by Alex Chen                         │
│   ├─ 1,234 installations  ★★★★★ 4.8                        │
│   ├─ Same integrations: zoom, notion, linear, slack        │
│   └─ Same trigger: zoom.recording.completed                │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Why Fork Instead?                                       │ │
│ │                                                         │ │
│ │ • Build on proven foundation (1,234 users validated)   │ │
│ │ • Inherit reviews and trust signals                    │ │
│ │ • Automatic attribution (you keep 85%)                 │ │
│ │ • Clear lineage for users                              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Fork Meeting Intelligence]  [Publish as Original →]       │
└─────────────────────────────────────────────────────────────┘
```

### "Publish as Original" Requirements

If developer insists on publishing as original despite similarity:

```typescript
interface OriginalPublishJustification {
  // Must provide at least 2 of these
  novelIntegration?: string;      // "Adds HubSpot CRM (not in similar)"
  differentTrigger?: string;      // "Uses schedule, not webhook"
  uniqueLogic?: string;           // "Implements custom sentiment analysis"
  differentAudience?: string;     // "Designed for legal teams, not engineering"

  // Required
  explanation: string;            // Free-form justification
  acknowledgesSimilar: boolean;   // "I understand similar workflows exist"
}
```

### Clone Farming Detection

Automated signals that trigger manual review:

```typescript
const cloneFarmingSignals = {
  // Account-level
  newAccount: account.ageInDays < 14,
  bulkSubmissions: account.submissionsLast7Days > 5,
  highRejectionRate: account.rejectedWorkflows / account.totalSubmissions > 0.5,

  // Workflow-level
  genericName: /workflow|automation|bot/i.test(workflow.name),
  minimalDescription: workflow.description.length < 50,
  noCustomization: workflow.code.includes('// TODO') || workflow.code.includes('CHANGE_ME'),

  // Pattern-level
  sameCategoryFlood: await this.checkCategoryFlood(account, workflow.category),
  crossAccountSimilarity: await this.checkCrossAccountDuplicates(workflow),
};

// If 3+ signals, flag for manual review
// If 5+ signals, auto-reject with appeal option
```

### Database Schema Addition

```sql
-- Workflow similarity index
CREATE TABLE workflow_similarity (
  workflow_id UUID REFERENCES workflows(id),
  similar_workflow_id UUID REFERENCES workflows(id),
  code_similarity DECIMAL(5,4),      -- 0.0000 to 1.0000
  semantic_similarity DECIMAL(5,4),
  signature_match BOOLEAN,
  detected_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (workflow_id, similar_workflow_id)
);

-- Workflow signatures for fast clone detection
CREATE TABLE workflow_signatures (
  workflow_id UUID PRIMARY KEY REFERENCES workflows(id),
  structural_hash VARCHAR(64),       -- Hash of AST structure
  integration_hash VARCHAR(64),      -- Hash of integrations used
  trigger_hash VARCHAR(64),          -- Hash of trigger config
  embedding VECTOR(1536),            -- Semantic embedding
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_structural_hash ON workflow_signatures(structural_hash);
CREATE INDEX idx_integration_hash ON workflow_signatures(integration_hash);
```

### Outcome: Healthy Ecosystem

With duplicate detection:
- **Originals are protected** from trivial clones
- **Legitimate variations** are guided to fork (with attribution)
- **Clone farmers** are blocked from polluting marketplace
- **Users find quality** instead of wading through duplicates

### Economic Alignment

The key insight: **fork success IS original success**.

```
Original creator mental model:
  ❌ "Someone forked my work and might steal my users"
  ✅ "Someone validated my work and will pay me forever"
```

This transforms the creator relationship from **zero-sum competition** to **positive-sum ecosystem building**.

---

## Summary

Forking transforms the marketplace from a **collection of islands** into a **living ecosystem**:

- **Original creators** get ongoing attribution and learn from forks
- **Forkers** build on proven foundations without starting from scratch
- **Users** benefit from specialized variants for their use case
- **Community** evolves workflows through distributed innovation

*Weniger, aber besser. Fewer original ideas, but better evolution.*
