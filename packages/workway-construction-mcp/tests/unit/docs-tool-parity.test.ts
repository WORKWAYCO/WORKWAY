import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { allTools } from '../../src/tools';

const WORKWAY_TOOL_TOKEN_PATTERN = /\bworkway_[a-z0-9_]+\b/g;
const MCP_DOCS_DIR = path.resolve(
  process.cwd(),
  '../../../workway-platform/apps/web/src/routes/docs/mcp'
);

function collectDocFiles(): string[] {
  if (!fs.existsSync(MCP_DOCS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(MCP_DOCS_DIR)
    .filter((fileName) => fileName.endsWith('.tsx'))
    .map((fileName) => path.join(MCP_DOCS_DIR, fileName));
}

describe('MCP docs tool parity', () => {
  it('references only tools present in the construction MCP registry', () => {
    const docFiles = collectDocFiles();
    expect(docFiles.length).toBeGreaterThan(0);

    const referenced = new Map<string, Set<string>>();
    for (const docFile of docFiles) {
      const source = fs.readFileSync(docFile, 'utf8');
      for (const match of source.matchAll(WORKWAY_TOOL_TOKEN_PATTERN)) {
        const toolName = match[0];
        if (!referenced.has(toolName)) {
          referenced.set(toolName, new Set());
        }
        referenced.get(toolName)!.add(path.basename(docFile));
      }
    }

    const registeredToolNames = new Set<string>(
      Object.values(allTools)
        .map((tool: any) => tool?.name)
        .filter((name): name is string => typeof name === 'string')
    );

    const missing = Array.from(referenced.entries())
      .filter(([toolName]) => !registeredToolNames.has(toolName))
      .map(([toolName, files]) => `${toolName} (docs: ${Array.from(files).sort().join(', ')})`)
      .sort();

    expect(missing).toEqual([]);
  });
});
