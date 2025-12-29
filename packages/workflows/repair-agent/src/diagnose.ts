/**
 * Diagnosis Step
 *
 * Uses Claude API to diagnose error and identify root cause.
 */

export interface DiagnosisInput {
  error: {
    message: string;
    stack: string | null;
    context: Record<string, unknown>;
    repo: string;
  };
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

const DIAGNOSIS_PROMPT = `You are diagnosing a production error. Your goal is to identify the root cause
and suggest a fix approach.

ERROR:
{error_message}

STACK TRACE:
{stack_trace}

CONTEXT:
{context}

RELEVANT CODE:
{code_snippets}

Provide your diagnosis in the following JSON format:
{
  "root_cause": "Clear explanation of what caused this error",
  "confidence": "high|medium|low",
  "affected_files": ["list", "of", "files"],
  "related_code": [
    {
      "file": "path/to/file.ts",
      "start_line": 10,
      "end_line": 20,
      "snippet": "code snippet here"
    }
  ],
  "suggested_approach": "How to fix this",
  "risk_assessment": "low|medium|high"
}

Be specific. Reference line numbers. Explain WHY not just WHAT.`;

export async function diagnose(
  input: DiagnosisInput,
  anthropicApiKey: string
): Promise<Diagnosis> {
  // Extract relevant code files from stack trace
  const codeSnippets = await fetchRelevantCode(input.error);

  // Prepare prompt
  const prompt = DIAGNOSIS_PROMPT.replace('{error_message}', input.error.message)
    .replace('{stack_trace}', input.error.stack || 'No stack trace available')
    .replace('{context}', JSON.stringify(input.error.context, null, 2))
    .replace('{code_snippets}', codeSnippets);

  // Call Claude API
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  const content = result.content[0].text;

  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to extract JSON diagnosis from Claude response');
  }

  const diagnosis = JSON.parse(jsonMatch[0]) as Diagnosis;
  return diagnosis;
}

/**
 * Fetch relevant code snippets from stack trace
 */
async function fetchRelevantCode(error: {
  stack: string | null;
  repo: string;
}): Promise<string> {
  if (!error.stack) {
    return 'No stack trace available';
  }

  // Parse stack trace to extract file paths and line numbers
  const fileMatches = error.stack.matchAll(/at .+ \((.+):(\d+):(\d+)\)/g);
  const files: Array<{ path: string; line: number }> = [];

  for (const match of fileMatches) {
    const [_, path, line] = match;
    files.push({ path, line: parseInt(line, 10) });
  }

  if (files.length === 0) {
    return 'No files found in stack trace';
  }

  // Fetch code snippets (in production, use GitHub API)
  // For now, return placeholder
  const snippets = files
    .slice(0, 3) // Limit to top 3 files
    .map(
      (f) => `
File: ${f.path}
Line: ${f.line}
(Code snippet would be fetched from GitHub API here)
`
    )
    .join('\n---\n');

  return snippets;
}
