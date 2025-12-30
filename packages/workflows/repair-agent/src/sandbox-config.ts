/**
 * Cloudflare Sandbox Configuration
 *
 * Repository-specific test execution configurations.
 */

export interface RepoConfig {
  /**
   * Name of the repository
   */
  name: string;

  /**
   * Default branch to test against
   */
  defaultBranch: string;

  /**
   * Package manager to use (npm, pnpm, yarn)
   */
  packageManager: 'npm' | 'pnpm' | 'yarn';

  /**
   * Install command (runs before tests)
   */
  installCommand: string;

  /**
   * Test command to execute
   */
  testCommand: string;

  /**
   * Build command (optional, runs before tests)
   */
  buildCommand?: string;

  /**
   * Working directory for monorepo packages
   */
  workingDirectory?: string;

  /**
   * Environment variables needed for tests
   */
  envVars?: Record<string, string>;

  /**
   * Timeout in milliseconds (default: 300000 = 5 minutes)
   */
  timeoutMs?: number;
}

/**
 * Repository-specific configurations
 */
export const REPO_CONFIGS: Record<string, RepoConfig> = {
  'workway-platform': {
    name: 'workway-platform',
    defaultBranch: 'main',
    packageManager: 'pnpm',
    installCommand: 'pnpm install --frozen-lockfile',
    testCommand: 'pnpm test',
    timeoutMs: 600000, // 10 minutes for full platform tests
  },

  Cloudflare: {
    name: 'Cloudflare',
    defaultBranch: 'main',
    packageManager: 'pnpm',
    installCommand: 'pnpm install --frozen-lockfile',
    testCommand: 'pnpm test',
    timeoutMs: 300000, // 5 minutes
  },

  // Package-specific configurations (for targeted testing)
  'workway-platform/apps/api': {
    name: 'workway-platform',
    defaultBranch: 'main',
    packageManager: 'pnpm',
    installCommand: 'pnpm install --frozen-lockfile',
    testCommand: 'pnpm test --filter=api',
    workingDirectory: 'apps/api',
    timeoutMs: 180000, // 3 minutes
  },

  'workway-platform/apps/web': {
    name: 'workway-platform',
    defaultBranch: 'main',
    packageManager: 'pnpm',
    installCommand: 'pnpm install --frozen-lockfile',
    testCommand: 'pnpm test --filter=web',
    workingDirectory: 'apps/web',
    timeoutMs: 180000,
  },

  'Cloudflare/packages/sdk': {
    name: 'Cloudflare',
    defaultBranch: 'main',
    packageManager: 'pnpm',
    installCommand: 'pnpm install --frozen-lockfile',
    testCommand: 'pnpm test --filter=@workwayco/sdk',
    workingDirectory: 'packages/sdk',
    timeoutMs: 120000, // 2 minutes
  },

  'Cloudflare/packages/workflows': {
    name: 'Cloudflare',
    defaultBranch: 'main',
    packageManager: 'pnpm',
    installCommand: 'pnpm install --frozen-lockfile',
    testCommand: 'pnpm test --filter=workflows',
    workingDirectory: 'packages/workflows',
    timeoutMs: 120000,
  },
};

/**
 * Get repository configuration
 *
 * @param repoName - Repository name or package path
 * @returns Repository configuration
 */
export function getRepoConfig(repoName: string): RepoConfig {
  // Try exact match first
  if (REPO_CONFIGS[repoName]) {
    return REPO_CONFIGS[repoName];
  }

  // Try extracting base repo name from package path
  const baseRepo = repoName.split('/')[0];
  if (REPO_CONFIGS[baseRepo]) {
    return REPO_CONFIGS[baseRepo];
  }

  // Fallback to generic configuration
  console.warn(`No specific config found for ${repoName}, using defaults`);
  return {
    name: repoName,
    defaultBranch: 'main',
    packageManager: 'pnpm',
    installCommand: 'pnpm install --frozen-lockfile',
    testCommand: 'pnpm test',
    timeoutMs: 300000,
  };
}

/**
 * Infer package-specific configuration from affected files
 *
 * @param repo - Base repository name
 * @param affectedFiles - List of files modified
 * @returns Package-specific config if applicable
 */
export function inferPackageConfig(
  repo: string,
  affectedFiles: string[]
): RepoConfig {
  // Check if all files are in a specific package
  const packages = new Set(
    affectedFiles
      .map((file) => {
        // Extract package path (e.g., "apps/api" from "apps/api/src/routes/teams.ts")
        const match = file.match(/^(apps|packages)\/([^/]+)/);
        return match ? `${match[1]}/${match[2]}` : null;
      })
      .filter(Boolean)
  );

  // If all changes are in a single package, use package-specific config
  if (packages.size === 1) {
    const packagePath = Array.from(packages)[0];
    const fullPath = `${repo}/${packagePath}`;
    if (REPO_CONFIGS[fullPath]) {
      console.log(`Using package-specific config for ${fullPath}`);
      return REPO_CONFIGS[fullPath];
    }
  }

  // Otherwise, use repo-level config
  return getRepoConfig(repo);
}
