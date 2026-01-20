/**
 * Claims - Work stealing and claim management for multi-agent coordination.
 *
 * Prevents duplicate work across agents using time-limited claims.
 * Supports agent registration, heartbeats, and automatic claim expiration.
 */

import type { Agent, Claim } from './types.js';
import { generateId } from './utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Default claim TTL in milliseconds (5 minutes) */
export const DEFAULT_CLAIM_TTL_MS = 5 * 60 * 1000;

/** Default heartbeat interval in milliseconds (1 minute) */
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 60 * 1000;

/** Agent considered dead if no heartbeat for this duration (3 minutes) */
export const AGENT_TIMEOUT_MS = 3 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Storage Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface ClaimsStorage {
  // Agents
  getAgent(id: string): Promise<Agent | null>;
  getAllAgents(): Promise<Agent[]>;
  saveAgent(agent: Agent): Promise<void>;
  deleteAgent(id: string): Promise<void>;

  // Claims
  getClaim(id: string): Promise<Claim | null>;
  getClaimByIssue(issueId: string): Promise<Claim | null>;
  getClaimsByAgent(agentId: string): Promise<Claim[]>;
  getAllClaims(): Promise<Claim[]>;
  saveClaim(claim: Claim): Promise<void>;
  deleteClaim(id: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-Memory Storage
// ─────────────────────────────────────────────────────────────────────────────

export class InMemoryClaimsStorage implements ClaimsStorage {
  private agents = new Map<string, Agent>();
  private claims = new Map<string, Claim>();

  async getAgent(id: string): Promise<Agent | null> {
    return this.agents.get(id) || null;
  }

  async getAllAgents(): Promise<Agent[]> {
    return Array.from(this.agents.values());
  }

  async saveAgent(agent: Agent): Promise<void> {
    this.agents.set(agent.id, agent);
  }

  async deleteAgent(id: string): Promise<void> {
    this.agents.delete(id);
  }

  async getClaim(id: string): Promise<Claim | null> {
    return this.claims.get(id) || null;
  }

  async getClaimByIssue(issueId: string): Promise<Claim | null> {
    for (const claim of this.claims.values()) {
      if (claim.issueId === issueId && claim.active) {
        return claim;
      }
    }
    return null;
  }

  async getClaimsByAgent(agentId: string): Promise<Claim[]> {
    return Array.from(this.claims.values()).filter(
      (c) => c.agentId === agentId && c.active
    );
  }

  async getAllClaims(): Promise<Claim[]> {
    return Array.from(this.claims.values());
  }

  async saveClaim(claim: Claim): Promise<void> {
    this.claims.set(claim.id, claim);
  }

  async deleteClaim(id: string): Promise<void> {
    this.claims.delete(id);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Claims Manager
// ─────────────────────────────────────────────────────────────────────────────

export interface RegisterAgentInput {
  id?: string;
  name: string;
  capabilities: string[];
  maxConcurrent?: number;
}

export interface ClaimIssueInput {
  agentId: string;
  issueId: string;
  ttlMs?: number;
}

export interface ClaimResult {
  success: boolean;
  claim: Claim | null;
  reason?: string;
}

export class ClaimsManager {
  constructor(
    private storage: ClaimsStorage,
    private claimTtlMs = DEFAULT_CLAIM_TTL_MS
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Agent Registration
  // ─────────────────────────────────────────────────────────────────────────

  async registerAgent(input: RegisterAgentInput): Promise<Agent> {
    const now = new Date().toISOString();
    const agent: Agent = {
      id: input.id || generateId('agent'),
      name: input.name,
      capabilities: input.capabilities,
      maxConcurrent: input.maxConcurrent ?? 1,
      status: 'active',
      lastHeartbeat: now,
      registeredAt: now,
    };

    await this.storage.saveAgent(agent);
    return agent;
  }

  async unregisterAgent(agentId: string): Promise<void> {
    // Release all claims held by this agent
    const claims = await this.storage.getClaimsByAgent(agentId);
    for (const claim of claims) {
      await this.releaseClaim(claim.id, agentId);
    }

    await this.storage.deleteAgent(agentId);
  }

  async getAgent(id: string): Promise<Agent | null> {
    return this.storage.getAgent(id);
  }

  async getAllAgents(): Promise<Agent[]> {
    return this.storage.getAllAgents();
  }

  async getActiveAgents(): Promise<Agent[]> {
    const allAgents = await this.storage.getAllAgents();
    const now = Date.now();

    return allAgents.filter((agent) => {
      if (agent.status === 'inactive') return false;
      const lastHeartbeat = new Date(agent.lastHeartbeat).getTime();
      return now - lastHeartbeat < AGENT_TIMEOUT_MS;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Heartbeat
  // ─────────────────────────────────────────────────────────────────────────

  async heartbeat(agentId: string): Promise<Agent | null> {
    const agent = await this.storage.getAgent(agentId);
    if (!agent) return null;

    const updated: Agent = {
      ...agent,
      lastHeartbeat: new Date().toISOString(),
      status: 'active',
    };

    await this.storage.saveAgent(updated);

    // Also extend any active claims
    const claims = await this.storage.getClaimsByAgent(agentId);
    for (const claim of claims) {
      if (claim.active) {
        await this.extendClaim(claim.id, agentId);
      }
    }

    return updated;
  }

  async setAgentStatus(
    agentId: string,
    status: Agent['status']
  ): Promise<Agent | null> {
    const agent = await this.storage.getAgent(agentId);
    if (!agent) return null;

    const updated: Agent = {
      ...agent,
      status,
    };

    await this.storage.saveAgent(updated);
    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Claim Management
  // ─────────────────────────────────────────────────────────────────────────

  async claimIssue(input: ClaimIssueInput): Promise<ClaimResult> {
    const { agentId, issueId, ttlMs = this.claimTtlMs } = input;

    // Verify agent exists and is active
    const agent = await this.storage.getAgent(agentId);
    if (!agent) {
      return { success: false, claim: null, reason: 'Agent not found' };
    }

    if (agent.status === 'inactive') {
      return { success: false, claim: null, reason: 'Agent is inactive' };
    }

    // Check agent heartbeat
    const lastHeartbeat = new Date(agent.lastHeartbeat).getTime();
    if (Date.now() - lastHeartbeat > AGENT_TIMEOUT_MS) {
      return { success: false, claim: null, reason: 'Agent heartbeat expired' };
    }

    // Clean up expired claims first
    await this.cleanupExpiredClaims();

    // Check if issue is already claimed
    const existingClaim = await this.storage.getClaimByIssue(issueId);
    if (existingClaim && existingClaim.active) {
      if (existingClaim.agentId === agentId) {
        // Agent already owns this claim, extend it
        const extended = await this.extendClaim(existingClaim.id, agentId);
        return extended
          ? { success: true, claim: extended }
          : { success: false, claim: null, reason: 'Failed to extend claim' };
      }
      return {
        success: false,
        claim: null,
        reason: `Issue already claimed by ${existingClaim.agentId}`,
      };
    }

    // Check agent's concurrent claim limit
    const agentClaims = await this.storage.getClaimsByAgent(agentId);
    const activeClaims = agentClaims.filter((c) => c.active);
    if (activeClaims.length >= agent.maxConcurrent) {
      return {
        success: false,
        claim: null,
        reason: `Agent at max concurrent claims (${agent.maxConcurrent})`,
      };
    }

    // Create the claim
    const now = new Date();
    const claim: Claim = {
      id: generateId('claim'),
      issueId,
      agentId,
      claimedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      active: true,
    };

    await this.storage.saveClaim(claim);

    // Update agent status to busy if at max concurrent
    if (activeClaims.length + 1 >= agent.maxConcurrent) {
      await this.setAgentStatus(agentId, 'busy');
    }

    return { success: true, claim };
  }

  async releaseClaim(claimId: string, agentId: string): Promise<boolean> {
    const claim = await this.storage.getClaim(claimId);
    if (!claim) return false;

    if (claim.agentId !== agentId) {
      return false; // Can only release own claims
    }

    const released: Claim = {
      ...claim,
      active: false,
    };

    await this.storage.saveClaim(released);

    // Check if agent should be marked active again
    const remainingClaims = await this.storage.getClaimsByAgent(agentId);
    const activeClaims = remainingClaims.filter((c) => c.active && c.id !== claimId);
    const agent = await this.storage.getAgent(agentId);

    if (agent && agent.status === 'busy' && activeClaims.length < agent.maxConcurrent) {
      await this.setAgentStatus(agentId, 'active');
    }

    return true;
  }

  async extendClaim(claimId: string, agentId: string): Promise<Claim | null> {
    const claim = await this.storage.getClaim(claimId);
    if (!claim) return null;

    if (claim.agentId !== agentId) {
      return null; // Can only extend own claims
    }

    if (!claim.active) {
      return null; // Cannot extend inactive claim
    }

    const now = new Date();
    const extended: Claim = {
      ...claim,
      expiresAt: new Date(now.getTime() + this.claimTtlMs).toISOString(),
    };

    await this.storage.saveClaim(extended);
    return extended;
  }

  async getClaim(id: string): Promise<Claim | null> {
    return this.storage.getClaim(id);
  }

  async getClaimByIssue(issueId: string): Promise<Claim | null> {
    await this.cleanupExpiredClaims();
    return this.storage.getClaimByIssue(issueId);
  }

  async getClaimsByAgent(agentId: string): Promise<Claim[]> {
    await this.cleanupExpiredClaims();
    return this.storage.getClaimsByAgent(agentId);
  }

  async getAllClaims(): Promise<Claim[]> {
    await this.cleanupExpiredClaims();
    return this.storage.getAllClaims();
  }

  async getActiveClaims(): Promise<Claim[]> {
    await this.cleanupExpiredClaims();
    const allClaims = await this.storage.getAllClaims();
    return allClaims.filter((c) => c.active);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────────────────

  async cleanupExpiredClaims(): Promise<number> {
    const allClaims = await this.storage.getAllClaims();
    const now = Date.now();
    let cleaned = 0;

    for (const claim of allClaims) {
      if (!claim.active) continue;

      const expiresAt = new Date(claim.expiresAt).getTime();
      if (now > expiresAt) {
        const expired: Claim = {
          ...claim,
          active: false,
        };
        await this.storage.saveClaim(expired);
        cleaned++;

        // Update agent status
        const agent = await this.storage.getAgent(claim.agentId);
        if (agent && agent.status === 'busy') {
          const remainingClaims = await this.storage.getClaimsByAgent(claim.agentId);
          const activeClaims = remainingClaims.filter(
            (c) => c.active && c.id !== claim.id
          );
          if (activeClaims.length < agent.maxConcurrent) {
            await this.setAgentStatus(claim.agentId, 'active');
          }
        }
      }
    }

    return cleaned;
  }

  async cleanupDeadAgents(): Promise<string[]> {
    const allAgents = await this.storage.getAllAgents();
    const now = Date.now();
    const deadAgentIds: string[] = [];

    for (const agent of allAgents) {
      if (agent.status === 'inactive') continue;

      const lastHeartbeat = new Date(agent.lastHeartbeat).getTime();
      if (now - lastHeartbeat > AGENT_TIMEOUT_MS) {
        // Mark agent as inactive
        await this.setAgentStatus(agent.id, 'inactive');

        // Release all their claims
        const claims = await this.storage.getClaimsByAgent(agent.id);
        for (const claim of claims) {
          if (claim.active) {
            const expired: Claim = {
              ...claim,
              active: false,
            };
            await this.storage.saveClaim(expired);
          }
        }

        deadAgentIds.push(agent.id);
      }
    }

    return deadAgentIds;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Statistics
  // ─────────────────────────────────────────────────────────────────────────

  async getStats(): Promise<{
    totalAgents: number;
    activeAgents: number;
    busyAgents: number;
    inactiveAgents: number;
    totalClaims: number;
    activeClaims: number;
  }> {
    const allAgents = await this.storage.getAllAgents();
    const activeAgents = await this.getActiveAgents();
    const allClaims = await this.storage.getAllClaims();

    return {
      totalAgents: allAgents.length,
      activeAgents: activeAgents.filter((a) => a.status === 'active').length,
      busyAgents: activeAgents.filter((a) => a.status === 'busy').length,
      inactiveAgents: allAgents.filter((a) => a.status === 'inactive').length,
      totalClaims: allClaims.length,
      activeClaims: allClaims.filter((c) => c.active).length,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────

  // generateId is now imported from ./utils.js
}
