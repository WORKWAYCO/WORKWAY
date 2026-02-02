/**
 * Workflow Version Command
 *
 * Manage workflow versions for enterprise-grade version control
 *
 * Commands:
 * - workway workflow version list     - List all versions
 * - workway workflow version show     - Show current version
 * - workway workflow version bump     - Bump version number
 * - workway workflow version rollback - Create draft from old version
 */

import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { Logger } from '../../utils/logger.js';
import { createAuthenticatedClient } from '../../utils/auth-client.js';
import { validateWorkflowProject } from '../../utils/workflow-validation.js';
import {
	parseVersion,
	bumpVersion,
	formatVersionDisplay,
	formatVersionFull,
	isValidVersion,
	normalizeVersion,
	type BumpType,
} from '@workwayco/sdk';

interface VersionOptions {
	// Subcommand action
	action?: 'list' | 'show' | 'bump' | 'rollback' | 'pin' | 'deprecate' | 'approve' | 'reject';
	// For bump command
	type?: BumpType;
	// For rollback/deprecate/approve/reject commands
	versionId?: string;
	// For pin command
	installationId?: string;
	reason?: string;
	// For approve command
	autoPublish?: boolean;
}

interface WorkflowVersion {
	id: string;
	integrationId: string;
	versionNumber: number;
	versionSemver?: string;
	notes?: string;
	state: 'draft' | 'published' | 'deprecated';
	createdAt?: number;
	publishedAt?: number;
}

export async function workflowVersionCommand(action: string, options: VersionOptions = {}): Promise<void> {
	// Route to appropriate subcommand
	switch (action) {
		case 'list':
			return versionListCommand();
		case 'show':
			return versionShowCommand();
		case 'bump':
			return versionBumpCommand(options.type);
		case 'rollback':
			return versionRollbackCommand(options.versionId);
		case 'pin':
			return versionPinCommand(options.installationId, options.versionId, options.reason);
		case 'deprecate':
			return versionDeprecateCommand(options.versionId, options.reason);
		case 'approve':
			return versionApproveCommand(options.versionId, options.reason, options.autoPublish);
		case 'reject':
			return versionRejectCommand(options.versionId, options.reason);
		default:
			Logger.error(`Unknown version command: ${action}`);
			Logger.log('');
			Logger.log('Available commands:');
			Logger.listItem('workway workflow version list      - List all versions');
			Logger.listItem('workway workflow version show      - Show current version');
			Logger.listItem('workway workflow version bump      - Bump version number');
			Logger.listItem('workway workflow version rollback  - Create draft from old version');
			Logger.listItem('workway workflow version pin       - Pin installation to specific version');
			Logger.listItem('workway workflow version deprecate - Deprecate a version');
			Logger.listItem('workway workflow version approve   - Approve a pending version');
			Logger.listItem('workway workflow version reject    - Reject a pending version');
			process.exit(1);
	}
}

/**
 * List all versions for the current workflow
 */
async function versionListCommand(): Promise<void> {
	Logger.header('Workflow Versions');

	try {
		const { apiClient, integrationId } = await getWorkflowContext();
		
		if (!integrationId) {
			Logger.error('This workflow has not been published yet');
			Logger.log('');
			Logger.log('💡 Run "workway workflow publish" first to create version history');
			process.exit(1);
		}

		// Fetch versions from API
		const response = await apiClient.getJson(`/integrations/${integrationId}/versions`) as {
			success: boolean;
			versions: WorkflowVersion[];
			total: number;
		};

		if (!response.success || !response.versions) {
			Logger.error('Failed to fetch versions');
			process.exit(1);
		}

		if (response.versions.length === 0) {
			Logger.log('No versions found.');
			Logger.log('');
			Logger.log('💡 Versions are created when you publish with --draft or publish changes');
			return;
		}

		Logger.blank();
		Logger.section('Version History');
		Logger.blank();

		for (const version of response.versions) {
			const displayVersion = formatVersionFull(version.versionNumber, version.versionSemver);
			const stateIcon = getStateIcon(version.state);
			const stateLabel = version.state === 'published' ? chalk.green('(current)') :
			                   version.state === 'draft' ? chalk.yellow('(draft)') :
			                   chalk.gray('(deprecated)');
			
			Logger.log(`${stateIcon} ${displayVersion} ${stateLabel}`);
			
			if (version.notes) {
				Logger.log(`   ${chalk.gray(version.notes)}`);
			}
			
			if (version.publishedAt) {
				const date = new Date(version.publishedAt * 1000);
				Logger.log(`   ${chalk.gray(`Published ${date.toLocaleDateString()}`)}`);
			} else if (version.createdAt) {
				const date = new Date(version.createdAt * 1000);
				Logger.log(`   ${chalk.gray(`Created ${date.toLocaleDateString()}`)}`);
			}
			
			Logger.blank();
		}

		Logger.log(`Total: ${response.total} version(s)`);
	} catch (error: any) {
		handleError(error);
	}
}

/**
 * Show current version info
 */
async function versionShowCommand(): Promise<void> {
	Logger.header('Current Workflow Version');

	try {
		// Read local config
		const configPath = path.join(process.cwd(), 'workway.config.json');
		const packagePath = path.join(process.cwd(), 'package.json');
		
		let localVersion = '1.0.0';
		
		// Try package.json first
		if (await fs.pathExists(packagePath)) {
			const packageJson = await fs.readJson(packagePath);
			if (packageJson.version) {
				localVersion = packageJson.version;
			}
		}
		
		// Try workway.config.json
		if (await fs.pathExists(configPath)) {
			const config = await fs.readJson(configPath);
			if (config.version) {
				localVersion = config.version;
			}
		}

		Logger.blank();
		Logger.section('Local Version');
		Logger.log(`Version: ${chalk.cyan(localVersion)}`);
		
		const parsed = parseVersion(localVersion);
		if (parsed) {
			Logger.log(`Major: ${parsed.major}, Minor: ${parsed.minor}, Patch: ${parsed.patch}`);
		}

		// Try to get published version info
		try {
			const { apiClient, integrationId } = await getWorkflowContext();
			
			if (integrationId) {
				const response = await apiClient.getJson(`/integrations/${integrationId}/versions`) as {
					success: boolean;
					versions: WorkflowVersion[];
				};

				if (response.success && response.versions?.length > 0) {
					const currentPublished = response.versions.find((v: WorkflowVersion) => v.state === 'published');
					const currentDraft = response.versions.find((v: WorkflowVersion) => v.state === 'draft');

					Logger.blank();
					Logger.section('Published Versions');
					
					if (currentPublished) {
						Logger.log(`Current: ${formatVersionFull(currentPublished.versionNumber, currentPublished.versionSemver)} ${chalk.green('(live)')}`);
					} else {
						Logger.log('No published version yet');
					}

					if (currentDraft) {
						Logger.log(`Draft:   ${formatVersionFull(currentDraft.versionNumber, currentDraft.versionSemver)} ${chalk.yellow('(unpublished)')}`);
					}
				}
			}
		} catch {
			// Ignore errors from API - just show local version
		}

	} catch (error: any) {
		handleError(error);
	}
}

/**
 * Bump version number in local files
 */
async function versionBumpCommand(type?: BumpType): Promise<void> {
	Logger.header('Bump Workflow Version');

	try {
		// Validate we're in a workflow project
		await validateWorkflowProject({
			createHint: '💡 Run "workway workflow init" to create a workflow project',
		});

		const packagePath = path.join(process.cwd(), 'package.json');
		const configPath = path.join(process.cwd(), 'workway.config.json');

		// Get current version
		let currentVersion = '1.0.0';
		let versionSource = 'default';
		
		if (await fs.pathExists(packagePath)) {
			const packageJson = await fs.readJson(packagePath);
			if (packageJson.version) {
				currentVersion = packageJson.version;
				versionSource = 'package.json';
			}
		}

		Logger.blank();
		Logger.log(`Current version: ${chalk.cyan(currentVersion)} (from ${versionSource})`);
		Logger.blank();

		// If no type specified, ask user
		if (!type) {
			const answer = await inquirer.prompt([
				{
					type: 'list',
					name: 'bumpType',
					message: 'Bump type:',
					choices: [
						{ name: `Patch (${currentVersion} → ${bumpVersion(currentVersion, 'patch')}) - Bug fixes`, value: 'patch' },
						{ name: `Minor (${currentVersion} → ${bumpVersion(currentVersion, 'minor')}) - New features`, value: 'minor' },
						{ name: `Major (${currentVersion} → ${bumpVersion(currentVersion, 'major')}) - Breaking changes`, value: 'major' },
					],
					default: 'patch',
				},
			]);
			type = answer.bumpType as BumpType;
		}

		const newVersion = bumpVersion(currentVersion, type);

		// Update package.json
		if (await fs.pathExists(packagePath)) {
			const packageJson = await fs.readJson(packagePath);
			packageJson.version = newVersion;
			await fs.writeJson(packagePath, packageJson, { spaces: 2 });
			Logger.success(`Updated package.json: ${currentVersion} → ${newVersion}`);
		}

		// Update workway.config.json if it has a version field
		if (await fs.pathExists(configPath)) {
			const config = await fs.readJson(configPath);
			if (config.version) {
				config.version = newVersion;
				await fs.writeJson(configPath, config, { spaces: 2 });
				Logger.success(`Updated workway.config.json: ${currentVersion} → ${newVersion}`);
			}
		}

		Logger.blank();
		Logger.success(`Version bumped to ${chalk.cyan(newVersion)}`);
		Logger.blank();
		Logger.log('Next steps:');
		Logger.listItem('Make your changes');
		Logger.listItem('Run "workway workflow publish" to publish the new version');

	} catch (error: any) {
		handleError(error);
	}
}

/**
 * Create a draft from an old version (rollback preparation)
 */
async function versionRollbackCommand(versionId?: string): Promise<void> {
	Logger.header('Rollback to Previous Version');

	try {
		const { apiClient, integrationId } = await getWorkflowContext();
		
		if (!integrationId) {
			Logger.error('This workflow has not been published yet');
			process.exit(1);
		}

		// Fetch versions
		const response = await apiClient.getJson(`/integrations/${integrationId}/versions`) as {
			success: boolean;
			versions: WorkflowVersion[];
		};

		if (!response.success || !response.versions || response.versions.length === 0) {
			Logger.error('No versions found to rollback to');
			process.exit(1);
		}

		// Filter to published/deprecated versions (can't rollback to draft)
		const rollbackableVersions = response.versions.filter(
			(v: WorkflowVersion) => v.state === 'published' || v.state === 'deprecated'
		);

		if (rollbackableVersions.length === 0) {
			Logger.error('No published versions to rollback to');
			process.exit(1);
		}

		Logger.blank();

		// If no versionId specified, show picker
		if (!versionId) {
			const choices = rollbackableVersions.map((v: WorkflowVersion) => ({
				name: `${formatVersionFull(v.versionNumber, v.versionSemver)} - ${v.notes || 'No notes'} ${v.state === 'published' ? chalk.green('(current)') : ''}`,
				value: v.id,
			}));

			const answer = await inquirer.prompt([
				{
					type: 'list',
					name: 'selectedVersion',
					message: 'Select version to rollback to:',
					choices,
				},
			]);
			versionId = answer.selectedVersion;
		}

		// Confirm rollback
		const selectedVersion = rollbackableVersions.find((v: WorkflowVersion) => v.id === versionId);
		if (!selectedVersion) {
			Logger.error('Version not found');
			process.exit(1);
		}

		Logger.log(`This will create a new draft version with the content of ${formatVersionDisplay(selectedVersion.versionNumber)}.`);
		Logger.log('The current published version will remain active until you publish the draft.');
		Logger.blank();

		const confirm = await inquirer.prompt([
			{
				type: 'confirm',
				name: 'proceed',
				message: 'Create draft from this version?',
				default: true,
			},
		]);

		if (!confirm.proceed) {
			Logger.log('Rollback cancelled');
			return;
		}

		// Call restore API
		const restoreResponse = await apiClient.postJson(`/integrations/${integrationId}/versions/${versionId}/restore`, { body: {} }) as {
			success: boolean;
			version: WorkflowVersion;
			message: string;
		};

		if (!restoreResponse.success) {
			Logger.error('Failed to restore version');
			process.exit(1);
		}

		Logger.blank();
		Logger.success(restoreResponse.message);
		Logger.blank();
		Logger.log('Next steps:');
		Logger.listItem('Review the draft version');
		Logger.listItem('Run "workway workflow publish" to make it live');

	} catch (error: any) {
		handleError(error);
	}
}

/**
 * Pin an installation to a specific version
 * Enterprise feature for stability
 */
async function versionPinCommand(
	installationId?: string,
	versionId?: string,
	reason?: string
): Promise<void> {
	Logger.header('Pin Installation to Version');

	try {
		const { apiClient, integrationId } = await getWorkflowContext();

		if (!integrationId) {
			Logger.error('This workflow has not been published yet');
			process.exit(1);
		}

		// Get user's installations for this workflow
		const installationsResponse = await apiClient.getJson(`/installations?integrationId=${integrationId}`) as {
			success: boolean;
			installations: Array<{
				id: string;
				instanceName?: string;
				status: string;
				installedAt: number;
			}>;
		};

		if (!installationsResponse.success || !installationsResponse.installations?.length) {
			Logger.error('No installations found for this workflow');
			process.exit(1);
		}

		// If no installation specified, let user pick
		if (!installationId) {
			type InstallationItem = { id: string; instanceName?: string; status: string; installedAt: number };
			const choices = installationsResponse.installations.map((inst: InstallationItem) => ({
				name: inst.instanceName 
					? `${inst.instanceName} (${inst.status})` 
					: `Installation ${inst.id.slice(-8)} (${inst.status})`,
				value: inst.id,
			}));

			const answer = await inquirer.prompt([
				{
					type: 'list',
					name: 'selectedInstallation',
					message: 'Select installation to pin:',
					choices,
				},
			]);
			installationId = answer.selectedInstallation;
		}

		// Fetch versions
		const versionsResponse = await apiClient.getJson(`/integrations/${integrationId}/versions`) as {
			success: boolean;
			versions: WorkflowVersion[];
		};

		if (!versionsResponse.success || !versionsResponse.versions?.length) {
			Logger.error('No versions found for this workflow');
			process.exit(1);
		}

		// Get current version info for the installation
		const versionInfoResponse = await apiClient.getJson(`/installations/${installationId}/version-info`) as {
			success: boolean;
			versionInfo: {
				isPinned: boolean;
				currentVersion?: { id: string; versionNumber: number };
				pinnedVersion?: { id: string; versionNumber: number };
			};
		};

		Logger.blank();
		
		if (versionInfoResponse.success && versionInfoResponse.versionInfo?.isPinned) {
			Logger.log(`Currently pinned to: ${formatVersionDisplay(versionInfoResponse.versionInfo.pinnedVersion?.versionNumber || 0)}`);
		} else {
			Logger.log('Currently using: latest version (not pinned)');
		}

		Logger.blank();

		// If no version specified, let user pick or unpin
		if (!versionId) {
			const publishedVersions = versionsResponse.versions.filter((v: WorkflowVersion) => v.state === 'published' || v.state === 'deprecated');
			
			const choices = [
				{ 
					name: chalk.yellow('⚡ Use latest version (unpin)'), 
					value: '__unpin__' 
				},
				...publishedVersions.map((v: WorkflowVersion) => ({
					name: `${formatVersionFull(v.versionNumber, v.versionSemver)} - ${v.notes || 'No notes'} ${v.state === 'published' ? chalk.green('(current)') : ''}`,
					value: v.id,
				})),
			];

			const answer = await inquirer.prompt([
				{
					type: 'list',
					name: 'selectedVersion',
					message: 'Pin to which version?',
					choices,
				},
			]);
			versionId = answer.selectedVersion === '__unpin__' ? undefined : answer.selectedVersion;
		}

		// Get reason if pinning (not unpinning)
		if (versionId && !reason) {
			const reasonAnswer = await inquirer.prompt([
				{
					type: 'input',
					name: 'reason',
					message: 'Reason for pinning (helps with auditing):',
					default: '',
				},
			]);
			reason = reasonAnswer.reason;
		}

		// Make the API call
		const pinResponse = await apiClient.postJson(`/installations/${installationId}/pin-version`, {
			body: {
				versionId: versionId || null,
				reason: reason || null,
			}
		}) as {
			success: boolean;
			message: string;
		};

		if (!pinResponse.success) {
			Logger.error('Failed to update version pinning');
			process.exit(1);
		}

		Logger.blank();
		Logger.success(pinResponse.message);
		
		if (versionId) {
			Logger.blank();
			Logger.info('This installation will stay on this version even when new versions are published.');
			Logger.log('Use "workway workflow version pin" again to change or unpin.');
		}

	} catch (error: any) {
		handleError(error);
	}
}

/**
 * Deprecate a version
 */
async function versionDeprecateCommand(versionId?: string, reason?: string): Promise<void> {
	Logger.header('Deprecate Version');

	try {
		const { apiClient, integrationId } = await getWorkflowContext();

		if (!integrationId) {
			Logger.error('This workflow has not been published yet');
			process.exit(1);
		}

		// Fetch versions
		const versionsResponse = await apiClient.getJson(`/integrations/${integrationId}/versions`) as {
			success: boolean;
			versions: WorkflowVersion[];
		};

		if (!versionsResponse.success || !versionsResponse.versions?.length) {
			Logger.error('No versions found');
			process.exit(1);
		}

		// Filter to published versions only
		const publishedVersions = versionsResponse.versions.filter((v: WorkflowVersion) => v.state === 'published');

		if (publishedVersions.length === 0) {
			Logger.error('No published versions to deprecate');
			process.exit(1);
		}

		Logger.blank();

		// If no version specified, let user pick
		if (!versionId) {
			const choices = publishedVersions.map((v: WorkflowVersion) => ({
				name: `${formatVersionFull(v.versionNumber, v.versionSemver)} - ${v.notes || 'No notes'}`,
				value: v.id,
			}));

			const answer = await inquirer.prompt([
				{
					type: 'list',
					name: 'selectedVersion',
					message: 'Select version to deprecate:',
					choices,
				},
			]);
			versionId = answer.selectedVersion;
		}

		// Get reason
		if (!reason) {
			const reasonAnswer = await inquirer.prompt([
				{
					type: 'input',
					name: 'reason',
					message: 'Reason for deprecation:',
					default: '',
				},
			]);
			reason = reasonAnswer.reason;
		}

		// Confirm
		const selectedVersion = versionsResponse.versions.find((v: WorkflowVersion) => v.id === versionId);
		Logger.blank();
		Logger.log(`This will deprecate version ${formatVersionDisplay(selectedVersion?.versionNumber || 0)}.`);
		Logger.log(chalk.yellow('Users pinned to this version will see a deprecation warning.'));
		Logger.blank();

		const confirm = await inquirer.prompt([
			{
				type: 'confirm',
				name: 'proceed',
				message: 'Proceed with deprecation?',
				default: false,
			},
		]);

		if (!confirm.proceed) {
			Logger.log('Deprecation cancelled');
			return;
		}

		// Call API
		const response = await apiClient.postJson(`/integrations/${integrationId}/versions/${versionId}/deprecate`, {
			body: { reason }
		}) as {
			success: boolean;
			message: string;
			affectedInstallations: number;
		};

		if (!response.success) {
			Logger.error('Failed to deprecate version');
			process.exit(1);
		}

		Logger.blank();
		Logger.success(response.message);

		if (response.affectedInstallations > 0) {
			Logger.warn(`${response.affectedInstallations} installation(s) are pinned to this version.`);
			Logger.log('Consider migrating them with: workway workflow version migrate');
		}

	} catch (error: any) {
		handleError(error);
	}
}

/**
 * Approve a pending version
 */
async function versionApproveCommand(versionId?: string, notes?: string, autoPublish?: boolean): Promise<void> {
	Logger.header('Approve Version');

	try {
		const { apiClient, integrationId } = await getWorkflowContext();

		if (!integrationId) {
			Logger.error('This workflow has not been published yet');
			process.exit(1);
		}

		// Fetch pending approvals
		const approvalsResponse = await apiClient.getJson(`/integrations/${integrationId}/versions/pending-approvals`) as {
			success: boolean;
			pendingApprovals: Array<{
				approval: { id: string; requestedBy: string; requestedAt: number; requestNotes: string };
				version: { id: string; versionNumber: number; versionSemver: string; notes: string };
			}>;
		};

		if (!approvalsResponse.success || !approvalsResponse.pendingApprovals?.length) {
			Logger.log('No pending approvals found');
			return;
		}

		Logger.blank();

		// If no version specified, let user pick
		if (!versionId) {
			type PendingApproval = {
				approval: { id: string; requestedBy: string; requestedAt: number; requestNotes: string };
				version: { id: string; versionNumber: number; versionSemver: string; notes: string };
			};
			const choices = approvalsResponse.pendingApprovals.map((pa: PendingApproval) => ({
				name: `${formatVersionFull(pa.version.versionNumber, pa.version.versionSemver)} - ${pa.version.notes || 'No notes'} (requested ${new Date(pa.approval.requestedAt * 1000).toLocaleDateString()})`,
				value: pa.version.id,
			}));

			const answer = await inquirer.prompt([
				{
					type: 'list',
					name: 'selectedVersion',
					message: 'Select version to approve:',
					choices,
				},
			]);
			versionId = answer.selectedVersion;
		}

		// Ask about auto-publish if not specified
		if (autoPublish === undefined) {
			const publishAnswer = await inquirer.prompt([
				{
					type: 'confirm',
					name: 'autoPublish',
					message: 'Also publish this version immediately?',
					default: true,
				},
			]);
			autoPublish = publishAnswer.autoPublish;
		}

		// Get approval notes
		if (!notes) {
			const notesAnswer = await inquirer.prompt([
				{
					type: 'input',
					name: 'notes',
					message: 'Approval notes (optional):',
					default: '',
				},
			]);
			notes = notesAnswer.notes;
		}

		// Call API
		const response = await apiClient.postJson(`/integrations/${integrationId}/versions/${versionId}/approve`, {
			body: { notes, autoPublish }
		}) as {
			success: boolean;
			message: string;
		};

		if (!response.success) {
			Logger.error('Failed to approve version');
			process.exit(1);
		}

		Logger.blank();
		Logger.success(response.message);

	} catch (error: any) {
		handleError(error);
	}
}

/**
 * Reject a pending version
 */
async function versionRejectCommand(versionId?: string, reason?: string): Promise<void> {
	Logger.header('Reject Version');

	try {
		const { apiClient, integrationId } = await getWorkflowContext();

		if (!integrationId) {
			Logger.error('This workflow has not been published yet');
			process.exit(1);
		}

		// Fetch pending approvals
		const approvalsResponse = await apiClient.getJson(`/integrations/${integrationId}/versions/pending-approvals`) as {
			success: boolean;
			pendingApprovals: Array<{
				approval: { id: string };
				version: { id: string; versionNumber: number; versionSemver: string; notes: string };
			}>;
		};

		if (!approvalsResponse.success || !approvalsResponse.pendingApprovals?.length) {
			Logger.log('No pending approvals found');
			return;
		}

		Logger.blank();

		// If no version specified, let user pick
		if (!versionId) {
			type PendingApprovalReject = {
				approval: { id: string };
				version: { id: string; versionNumber: number; versionSemver: string; notes: string };
			};
			const choices = approvalsResponse.pendingApprovals.map((pa: PendingApprovalReject) => ({
				name: `${formatVersionFull(pa.version.versionNumber, pa.version.versionSemver)} - ${pa.version.notes || 'No notes'}`,
				value: pa.version.id,
			}));

			const answer = await inquirer.prompt([
				{
					type: 'list',
					name: 'selectedVersion',
					message: 'Select version to reject:',
					choices,
				},
			]);
			versionId = answer.selectedVersion;
		}

		// Get rejection reason
		if (!reason) {
			const reasonAnswer = await inquirer.prompt([
				{
					type: 'input',
					name: 'reason',
					message: 'Rejection reason (required):',
					validate: (input: string) => input.trim().length > 0 || 'Please provide a reason',
				},
			]);
			reason = reasonAnswer.reason;
		}

		// Call API
		const response = await apiClient.postJson(`/integrations/${integrationId}/versions/${versionId}/reject`, {
			body: { notes: reason }
		}) as {
			success: boolean;
			message: string;
		};

		if (!response.success) {
			Logger.error('Failed to reject version');
			process.exit(1);
		}

		Logger.blank();
		Logger.success(response.message);

	} catch (error: any) {
		handleError(error);
	}
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get authenticated client and integration ID from config
 */
async function getWorkflowContext(): Promise<{
	apiClient: any;
	integrationId: string | null;
}> {
	const { apiClient } = await createAuthenticatedClient({
		errorMessage: 'You must be logged in to manage versions',
		hint: 'Run: workway login',
	});

	// Try to get integration ID from config
	const configPath = path.join(process.cwd(), 'workway.config.json');
	let integrationId: string | null = null;

	if (await fs.pathExists(configPath)) {
		const config = await fs.readJson(configPath);
		integrationId = config.integrationId || null;
	}

	return { apiClient, integrationId };
}

/**
 * Get icon for version state
 */
function getStateIcon(state: string): string {
	switch (state) {
		case 'published':
			return chalk.green('●');
		case 'draft':
			return chalk.yellow('○');
		case 'deprecated':
			return chalk.gray('○');
		default:
			return '○';
	}
}

/**
 * Handle errors consistently
 */
function handleError(error: any): never {
	if (error.response?.status === 404) {
		Logger.error('Workflow not found. Make sure you\'re in the correct directory.');
	} else if (error.response?.status === 403) {
		Logger.error('You don\'t have permission to manage this workflow.');
	} else {
		Logger.error(`Error: ${error.message || 'Unknown error'}`);
	}
	process.exit(1);
}

export default workflowVersionCommand;
