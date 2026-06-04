/**
 * TypeScript port of python_exp/response_fixers.py AND fix_latex_syntax.py.
 *
 * Applies all post-processing heuristics to the generated Manim code
 * before sending it to the render server.
 */

/* ── From response_fixers.py ── */

/** Removes leftover markdown code fences from LLM generation. */
function removeMarkdownFences(code: string): string {
  code = code.trim();
  if (code.startsWith("```python")) {
    code = code.slice(9);
  } else if (code.startsWith("```")) {
    code = code.slice(3);
  }
  code = code.trim();
  if (code.endsWith("```")) {
    code = code.slice(0, -3);
  }
  return code.trim();
}

/**
 * Ensures all Tex/MathTex string arguments use raw string prefixes (r"...")
 * so LaTeX backslashes survive Python's string parser.
 */
function fixRawStrings(code: string): string {
  // Match Tex(", MathTex(", Text(" where the opening quote is NOT preceded by r
  const pattern = /((?:MathTex|Tex|Text)\(\s*)(?!r)(["'])/g;
  let fixed = code.replace(pattern, '$1r$2');

  // Fix LLM double-escaping inside raw strings (e.g., r"\\text{...}" -> r"\text{...}")
  fixed = fixed.replace(/\\\\([a-zA-Z]+)/g, '\\$1');

  return fixed;
}

/* ── From fix_latex_syntax.py ── */

/** Fixes common LaTeX syntax errors that crash Manim's DVI compilation. */
function fixLatexSyntax(code: string): string {
  // 1. Fix .get_text() -> .get_tex()
  code = code.replace(/\.get_text\(/g, '.get_tex(');

  // 2. Replace bare Tex() calls with MathTex()
  code = code.replace(/\bTex\(/g, 'MathTex(');

  // 3. Fix outdated ManimGL syntax 'start_point' / 'end_point' to modern ManimCE 'start' / 'end'
  code = code.replace(/start_point\s*=/g, 'start=');
  code = code.replace(/end_point\s*=/g, 'end=');

  // 4. Fix LLM class hallucinations where it assumes `self.objects` exists. Map to `self.mobjects`.
  code = code.replace(/self\.objects/g, 'self.mobjects');

  // 3. Ensure the mandatory VizLearnScene import is present and path is resolved
  const sysPathFix = "import sys, os\nsys.path.append(os.path.abspath('.'))\n";

  // 5. Remove any hallucinated VizLearnScene imports before we securely inject the correct one
  code = code.replace(/^.*import\s+VizLearnScene.*$/gm, '');

  if (!code.includes("from manim import *")) {
    code = "from manim import *\n" + code;
  }

  // Inject the mandatory VizLearnScene import and path resolution
  code = code.replace(
    "from manim import *",
    "from manim import *\n" + sysPathFix + "from vizlearn_base import VizLearnScene\n"
  );

  return code;
}

/* ── Combined pipeline ── */

/**
 * Runs all code fixers in sequence. This is the single function
 * that the generate route calls before sending code to the render server.
 */
export function fixGeneratedCode(rawCode: string): string {
  let code = removeMarkdownFences(rawCode);
  code = fixRawStrings(code);
  code = fixLatexSyntax(code);
  return code;
}
