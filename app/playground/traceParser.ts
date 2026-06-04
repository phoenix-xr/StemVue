// traceParser.ts — Equation Data & Step Concepts Parser
// Parses the <EQUATION_DATA> and <STEP_CONCEPTS> JSON blocks from LLM output.

export interface EquationData {
  step_number: number;
  equation_latex: string;
  hover_text: string;
}

export interface StepConcept {
  step_number: number;
  concept: string;
  search_query: string;
}

/**
 * Extract and parse the <EQUATION_DATA> JSON array from the full response.
 */
export function parseEquationData(fullResponse: string): EquationData[] {
  const match = fullResponse.match(/<EQUATION_DATA>\s*([\s\S]*?)\s*<\/EQUATION_DATA>/i);
  if (!match) return [];

  try {
    const parsed = JSON.parse(fixBackslashes(match[1]));
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    console.warn('Failed to parse EQUATION_DATA JSON:', e);
  }

  return [];
}

/**
 * Build a lookup map from normalized LaTeX → EquationData for DOM matching.
 */
export function buildEquationMap(data: EquationData[]): Map<string, EquationData> {
  const map = new Map<string, EquationData>();

  for (const eq of data) {
    const normalized = eq.equation_latex.replace(/\s+/g, ' ').trim();
    map.set(normalized, eq);

    const stripped = eq.equation_latex.replace(/\s/g, '');
    map.set(stripped, eq);
  }

  return map;
}

/**
 * Extract and parse the <STEP_CONCEPTS> JSON array from the full response.
 * Returns a Map of step_number → StepConcept for quick lookup.
 */
export function parseStepConcepts(fullResponse: string): Map<number, StepConcept> {
  const map = new Map<number, StepConcept>();
  const match = fullResponse.match(/<STEP_CONCEPTS>\s*([\s\S]*?)\s*<\/STEP_CONCEPTS>/i);
  if (!match) return map;

  try {
    const parsed = JSON.parse(fixBackslashes(match[1]));
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (entry.step_number != null && entry.search_query) {
          map.set(entry.step_number, entry);
        }
      }
    }
  } catch (e) {
    console.warn('Failed to parse STEP_CONCEPTS JSON:', e);
  }

  return map;
}

/**
 * Fix lone LaTeX backslashes in raw JSON strings so JSON.parse doesn't choke.
 */
function fixBackslashes(raw: string): string {
  const validJsonEscapes = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);
  let fixed = '';
  let i = 0;

  while (i < raw.length) {
    if (raw[i] === '\\') {
      const next = raw[i + 1];
      if (next === '\\') {
        fixed += '\\\\';
        i += 2;
      } else if (next && validJsonEscapes.has(next)) {
        fixed += '\\' + next;
        i += 2;
      } else {
        fixed += '\\\\';
        i += 1;
      }
    } else {
      fixed += raw[i];
      i += 1;
    }
  }

  return fixed;
}
