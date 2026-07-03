/**
 * Extracts <PLAN> and <CODE> blocks from the raw LLM response.
 * Direct port of the parsing logic in get_agent.py's generate_video_pipeline().
 */
export function parseResponse(response: string): {
  plan: string;
  code: string;
} {
  if (!response) return { plan: "", code: "" };

  let plan = "";
  let code = "";

  // 1. First, check if there is a <CODE> tag anywhere in the response.
  const codeTagMatch = response.match(/<CODE>/i);

  if (codeTagMatch && codeTagMatch.index !== undefined) {
    // Everything before the <CODE> tag belongs to the plan part
    const beforeCode = response.slice(0, codeTagMatch.index);
    
    const planMatch = beforeCode.match(/<PLAN>([\s\S]*?)(?:<\/PLAN>|$)/i);
    if (planMatch) {
      plan = planMatch[1].trim();
    } else {
      plan = beforeCode.replace(/<\/?PLAN>/ig, "").trim();
    }

    // Everything after <CODE> is our code candidate
    const afterCode = response.slice(codeTagMatch.index + codeTagMatch[0].length);
    
    // If there is a closing </CODE> tag, slice up to it
    const closeCodeMatch = afterCode.match(/<\/CODE>/i);
    if (closeCodeMatch && closeCodeMatch.index !== undefined) {
      code = afterCode.slice(0, closeCodeMatch.index);
    } else {
      code = afterCode;
    }
  } else {
    // 2. If no <CODE> tag is present, check if there's a markdown python fence
    const mdMatch = response.match(/```(?:python)?\s*([\s\S]*?)(?:```|$)/i);
    if (mdMatch) {
      code = mdMatch[1];
      if (mdMatch.index !== undefined && mdMatch.index > 0) {
        const beforeFence = response.slice(0, mdMatch.index);
        const planMatch = beforeFence.match(/<PLAN>([\s\S]*?)(?:<\/PLAN>|$)/i);
        plan = planMatch ? planMatch[1].trim() : beforeFence.replace(/<\/?PLAN>/ig, "").trim();
      }
    } else {
      // 3. Fallback: if there is a <PLAN>...</PLAN> tag, treat everything after </PLAN> as code
      const planCloseMatch = response.match(/<\/PLAN>/i);
      if (planCloseMatch && planCloseMatch.index !== undefined) {
        const beforePlanClose = response.slice(0, planCloseMatch.index);
        const planStartMatch = beforePlanClose.match(/<PLAN>([\s\S]*)/i);
        plan = planStartMatch ? planStartMatch[1].trim() : beforePlanClose.trim();
        code = response.slice(planCloseMatch.index + planCloseMatch[0].length);
      } else {
        code = response;
      }
    }
  }

  // Clean up code: strip any markdown fences wrapped around the code block
  code = code.replace(/^```(?:python)?\s*/i, "").replace(/```\s*$/i, "").trim();

  // Strip literal XML tags without multiline swallowing
  code = code.replace(/<\/?(?:PLAN|CODE)>/ig, "").trim();

  return { plan: plan.trim(), code: code.trim() };
}
