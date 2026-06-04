/**
 * Extracts <PLAN> and <CODE> blocks from the raw LLM response.
 * Direct port of the parsing logic in get_agent.py's generate_video_pipeline().
 */
export function parseResponse(response: string): {
  plan: string;
  code: string;
} {
  let plan = "";
  let code = response; // fallback: treat the whole thing as code

  // Extract <PLAN> block
  if (response.includes("<PLAN>") && response.includes("</PLAN>")) {
    plan = response.split("<PLAN>")[1].split("</PLAN>")[0].trim();
  }

  // Extract <CODE> block
  if (response.includes("<CODE>") && response.includes("</CODE>")) {
    code = response.split("<CODE>")[1].split("</CODE>")[0].trim();
  } else {
    // Fallback parsing for markdown fences
    if (code.includes("```python")) {
      code = code.split("```python")[1].split("```")[0].trim();
    }
    if (code.startsWith("```")) {
      code = code.slice(3);
    }
    if (code.endsWith("```")) {
      code = code.slice(0, -3);
    }
  }

  return { plan: plan.trim(), code: code.trim() };
}
