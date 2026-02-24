import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../../src/types';
import { createMockEnv } from '../mocks/env';

const state: {
	packs: Record<string, { id: string; tenantId: string; slug: string; name: string; description?: string | null }>;
	rulesByPackId: Record<string, Array<{ toolkitSlug: string; toolSlug?: string | null; ruleType: 'allow' | 'deny' }>>;
	counter: number;
} = {
	packs: {},
	rulesByPackId: {},
	counter: 0,
};

vi.mock('../../src/lib/db', () => {
	return {
		resolveTenantId: vi.fn(async (_env: Env, _userId: string, tenantId?: string) => tenantId || 'tenant_1'),
		ensureToolAccessPack: vi.fn(async (_env: Env, input: any) => {
			const key = `${input.tenantId}:${input.slug}`;
			if (!state.packs[key]) {
				state.counter += 1;
				state.packs[key] = {
					id: `pack_${state.counter}`,
					tenantId: input.tenantId,
					slug: input.slug,
					name: input.name,
					description: input.description || null,
				};
			}
			return {
				...state.packs[key],
				status: 'active',
				createdBy: input.createdBy,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};
		}),
		replaceToolAccessRules: vi.fn(async (_env: Env, input: any) => {
			state.rulesByPackId[input.packId] = [...input.rules];
			return input.rules.length;
		}),
		isToolAllowedForTenant: vi.fn(async (_env: Env, tenantId: string, toolkitSlug: string, toolSlug: string) => {
			const packIds = Object.values(state.packs)
				.filter((pack) => pack.tenantId === tenantId)
				.map((pack) => pack.id);
			const matchingRules = packIds.flatMap((packId) => state.rulesByPackId[packId] || [])
				.filter((rule) => rule.toolkitSlug === toolkitSlug && (!rule.toolSlug || rule.toolSlug === toolSlug));

			if (matchingRules.length === 0) return false;
			if (matchingRules.some((rule) => rule.ruleType === 'deny')) return false;
			return matchingRules.some((rule) => rule.ruleType === 'allow');
		}),
		listToolAccessPacks: vi.fn(async (_env: Env, tenantId: string) => {
			return Object.values(state.packs)
				.filter((pack) => pack.tenantId === tenantId)
				.map((pack) => ({
					id: pack.id,
					tenantId: pack.tenantId,
					name: pack.name,
					slug: pack.slug,
					description: pack.description || null,
					status: 'active',
					createdBy: 'user_1',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				}));
		}),
		appendExecutionLedger: vi.fn(async () => 'hash_1'),
		createDecision: vi.fn(async () => ({
			id: 'dec_1',
			tenantId: 'tenant_1',
			toolSlug: 'noop',
			provider: 'composio',
			userId: 'user_1',
			riskScore: 0,
			status: 'approved',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		})),
		getDecision: vi.fn(async () => null),
		getProviderConnection: vi.fn(async () => null),
		updateDecision: vi.fn(async () => undefined),
		upsertProviderConnection: vi.fn(async () => undefined),
	};
});

import { hubTools } from '../../src/tools/hub';
import { isToolAllowedForTenant } from '../../src/lib/db';

describe('hub construction pack application', () => {
	let env: Env;

	beforeEach(() => {
		state.packs = {};
		state.rulesByPackId = {};
		state.counter = 0;
		env = createMockEnv();
	});

	it('applies construction-core idempotently with explicit allow rules', async () => {
		const first = await hubTools.apply_construction_pack.execute(
			{
				tenant_id: 'tenant_1',
				user_id: 'user_1',
				pack_slug: 'construction-core',
			},
			env
		);

		const second = await hubTools.apply_construction_pack.execute(
			{
				tenant_id: 'tenant_1',
				user_id: 'user_1',
				pack_slug: 'construction-core',
			},
			env
		);

		expect(first.success).toBe(true);
		expect(second.success).toBe(true);
		expect(first.data?.toolkits).toEqual(['notion', 'slack', 'gmail', 'google_drive']);
		expect(second.data?.toolkits).toEqual(['notion', 'slack', 'gmail', 'google_drive']);
		expect(first.data?.rules_applied).toBe(4);
		expect(second.data?.rules_applied).toBe(4);
	});

	it('updates allowlist behavior after pack application', async () => {
		const preApplyNotion = await isToolAllowedForTenant(env, 'tenant_1', 'notion', 'NOTION_QUERY_DATABASE');
		expect(preApplyNotion).toBe(false);

		await hubTools.apply_construction_pack.execute(
			{
				tenant_id: 'tenant_1',
				user_id: 'user_1',
				pack_slug: 'construction-core',
			},
			env
		);

		const notionAllowed = await isToolAllowedForTenant(env, 'tenant_1', 'notion', 'NOTION_QUERY_DATABASE');
		const jiraBeforePmPack = await isToolAllowedForTenant(env, 'tenant_1', 'jira', 'JIRA_CREATE_ISSUE');
		expect(notionAllowed).toBe(true);
		expect(jiraBeforePmPack).toBe(false);

		await hubTools.apply_construction_pack.execute(
			{
				tenant_id: 'tenant_1',
				user_id: 'user_1',
				pack_slug: 'construction-pm',
			},
			env
		);

		const jiraAllowed = await isToolAllowedForTenant(env, 'tenant_1', 'jira', 'JIRA_CREATE_ISSUE');
		expect(jiraAllowed).toBe(true);
	});
});
