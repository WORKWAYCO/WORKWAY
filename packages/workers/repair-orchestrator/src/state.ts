/**
 * Repair State Management
 *
 * Manages the lifecycle of error repair sessions.
 */

export interface NormalizedError {
  id: string;
  fingerprint: string;
  level: 'error' | 'fatal' | 'warning';
  message: string;
  stack: string | null;
  context: {
    url?: string;
    user_id?: string;
    request_id?: string;
    worker?: string;
    [key: string]: unknown;
  };
  source: string;
  repo: string;
  received_at: string;
}

export interface Diagnosis {
  root_cause: string;
  confidence: 'high' | 'medium' | 'low';
  affected_files: string[];
  related_code: {
    file: string;
    start_line: number;
    end_line: number;
    snippet: string;
  }[];
  suggested_approach: string;
  risk_assessment: 'low' | 'medium' | 'high';
  similar_past_errors?: string[];
}

export interface Fix {
  branch: string;
  commits: {
    sha: string;
    message: string;
    files_changed: string[];
  }[];
  test_results: {
    passed: number;
    failed: number;
    skipped: number;
    duration_ms: number;
  };
  changes_summary: string;
}

export type RepairStatus =
  | 'pending'
  | 'diagnosing'
  | 'fixing'
  | 'pr_created'
  | 'approved'
  | 'deployed'
  | 'failed';

export interface RepairState {
  id: string;
  error_fingerprint: string;
  status: RepairStatus;
  repo: string;
  error: NormalizedError;
  diagnosis?: Diagnosis;
  fix?: Fix;
  pr_url?: string;
  beads_issue?: string;
  created_at: string;
  updated_at: string;
  attempts: number;
  failure_reason?: string;
}

/**
 * Rate Limiting State
 * Tracks repairs per repo per hour
 */
export interface RateLimitState {
  repo: string;
  hour_window: string; // ISO timestamp rounded to hour
  repair_count: number;
}

export class RepairStateManager {
  constructor(private storage: DurableObjectStorage) {}

  /**
   * Check if error is duplicate within time window
   */
  async isDuplicate(fingerprint: string, windowMs = 3600000): Promise<boolean> {
    const key = `fingerprint:${fingerprint}`;
    const existing = await this.storage.get<RepairState>(key);

    if (!existing) return false;

    const age = Date.now() - new Date(existing.created_at).getTime();
    return age < windowMs;
  }

  /**
   * Check if repo has exceeded rate limit
   */
  async isRateLimited(repo: string, maxPerHour = 10): Promise<boolean> {
    const now = new Date();
    const hourWindow = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours()
    ).toISOString();

    const key = `ratelimit:${repo}:${hourWindow}`;
    const limit = await this.storage.get<RateLimitState>(key);

    if (!limit) return false;
    return limit.repair_count >= maxPerHour;
  }

  /**
   * Increment rate limit counter
   */
  async incrementRateLimit(repo: string): Promise<void> {
    const now = new Date();
    const hourWindow = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours()
    ).toISOString();

    const key = `ratelimit:${repo}:${hourWindow}`;
    const existing = await this.storage.get<RateLimitState>(key);

    const state: RateLimitState = {
      repo,
      hour_window: hourWindow,
      repair_count: (existing?.repair_count || 0) + 1,
    };

    await this.storage.put(key, state);
  }

  /**
   * Create new repair state
   */
  async createRepair(error: NormalizedError): Promise<RepairState> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const state: RepairState = {
      id,
      error_fingerprint: error.fingerprint,
      status: 'pending',
      repo: error.repo,
      error,
      created_at: now,
      updated_at: now,
      attempts: 0,
    };

    // Store by ID and fingerprint
    await this.storage.put(`repair:${id}`, state);
    await this.storage.put(`fingerprint:${error.fingerprint}`, state);

    return state;
  }

  /**
   * Update repair state
   */
  async updateRepair(
    id: string,
    updates: Partial<Omit<RepairState, 'id' | 'created_at'>>
  ): Promise<RepairState | null> {
    const state = await this.storage.get<RepairState>(`repair:${id}`);
    if (!state) return null;

    const updated: RepairState = {
      ...state,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await this.storage.put(`repair:${id}`, updated);
    await this.storage.put(`fingerprint:${state.error_fingerprint}`, updated);

    return updated;
  }

  /**
   * Get repair state by ID
   */
  async getRepair(id: string): Promise<RepairState | null> {
    return (await this.storage.get<RepairState>(`repair:${id}`)) || null;
  }

  /**
   * Get repair state by fingerprint
   */
  async getRepairByFingerprint(fingerprint: string): Promise<RepairState | null> {
    return (await this.storage.get<RepairState>(`fingerprint:${fingerprint}`)) || null;
  }

  /**
   * List all active repairs
   */
  async listActiveRepairs(): Promise<RepairState[]> {
    const repairs: RepairState[] = [];
    const list = await this.storage.list<RepairState>({ prefix: 'repair:' });

    for (const [_, state] of list) {
      if (state.status !== 'deployed' && state.status !== 'failed') {
        repairs.push(state);
      }
    }

    return repairs;
  }

  /**
   * Get repair statistics
   */
  async getStats(): Promise<{
    total: number;
    by_status: Record<RepairStatus, number>;
    by_repo: Record<string, number>;
  }> {
    const stats = {
      total: 0,
      by_status: {} as Record<RepairStatus, number>,
      by_repo: {} as Record<string, number>,
    };

    const list = await this.storage.list<RepairState>({ prefix: 'repair:' });

    for (const [_, state] of list) {
      stats.total++;
      stats.by_status[state.status] = (stats.by_status[state.status] || 0) + 1;
      stats.by_repo[state.repo] = (stats.by_repo[state.repo] || 0) + 1;
    }

    return stats;
  }
}
