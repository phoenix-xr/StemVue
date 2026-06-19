/**
 * Extracts <PLAN> and <CODE> blocks from the raw LLM response.
 * Direct port of the parsing logic in get_agent.py's generate_video_pipeline().
 */
export function parseResponse(response: string): {
  plan: string;
  code: string;
} {
  let plan = "";
  let code = response;

  // 1. Aggressively extract the PLAN block if it exists
  const planMatch = response.match(/<PLAN>([\s\S]*?)(?:<\/PLAN>|$)/i);
  if (planMatch) {
    plan = planMatch[1].trim();
    // Strip the entire PLAN block from the code fallback so it NEVER compiles as Python
    code = code.replace(planMatch[0], "").trim();
  }

  // 2. Try to extract the CODE block
  const codeMatch = code.match(/<CODE>([\s\S]*?)(?:<\/CODE>|$)/i);
  if (codeMatch) {
    code = codeMatch[1].trim();
  } else {
    // 3. Fallback: look for markdown python fences
    const mdMatch = code.match(/```(?:python)?\s*([\s\S]*?)(?:```|$)/i);
    if (mdMatch) {
      code = mdMatch[1].trim();
    }
  }

  // Final cleanup: strip any lingering markdown fences inside the extracted code
  code = code.replace(/^```(?:python)?\s*/i, "").replace(/```\s*$/i, "").trim();

  // Safety net: if <PLAN> or <CODE> tags are still somehow at the top of the code, remove them
  code = code.replace(/<\/?(?:PLAN|CODE)>[\s\S]*?(?:<\/?(?:PLAN|CODE)>|$)/ig, "").trim();

  return { plan, code };
}
