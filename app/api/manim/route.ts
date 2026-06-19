import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const ai = new GoogleGenAI({ 
  project: process.env.VERTEX_AI_PROJECT_ID!, 
  location: 'asia-south1',
  vertexai: true
});

const SYSTEM_PROMPT = `You are a Manim animation expert. Given a math/physics concept, generate a Python Manim script that creates a clear, educational animation.

RULES:
1. Output ONLY valid Python Manim code — no markdown, no explanation, no \`\`\` fences.
2. Use standard Manim Community imports: \`from manim import *\`
3. Create ONE Scene class named "MainScene" that extends Scene.
4. Keep the animation simple but visually clear:
   - Use MathTex for equations
   - Use Text for labels
   - Use basic geometry (Circle, Square, Arrow, Line)
   - Use standard animations: Create, Write, FadeIn, FadeOut, Transform, ReplacementTransform
5. Use self.play() for animations and self.wait() for pauses.
6. Do NOT use VoiceoverScene, manim_voiceover, or any external plugins.
7. Do NOT use custom helper functions — only standard Manim API.
8. Keep the scene under 30 seconds total (6-8 animation steps max).
9. Use colors: BLUE, RED, GREEN, YELLOW, WHITE, PINK, ORANGE, PURPLE.
10. Position elements clearly using UP, DOWN, LEFT, RIGHT, ORIGIN.

Example output:
from manim import *

class MainScene(Scene):
    def construct(self):
        title = Text("Pythagorean Theorem", font_size=36)
        self.play(Write(title))
        self.wait(1)
        self.play(FadeOut(title))
        
        eq = MathTex(r"a^2 + b^2 = c^2")
        self.play(Write(eq))
        self.wait(2)
`;

/**
 * POST /api/manim
 * Body: { prompt: string }
 * Returns: { pythonCode: string, tsCode: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });
    }

    // Step 1: LLM generates Python Manim code
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: `Create a Manim animation for: ${prompt}`,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.3,
      },
    });

    let pythonCode = result.text?.trim() || '';

    // Strip markdown fences if LLM wraps them anyway
    pythonCode = pythonCode.replace(/^```python\s*/i, '').replace(/```\s*$/i, '').trim();

    if (!pythonCode.includes('class') || !pythonCode.includes('construct')) {
      return NextResponse.json(
        { error: 'LLM did not generate valid Manim code', pythonCode },
        { status: 422 }
      );
    }

    // Step 2: Convert Python → TypeScript via py2ts.cjs
    const tmpId = randomUUID();
    const tmpDir = join(tmpdir(), 'manim-convert');
    mkdirSync(tmpDir, { recursive: true });
    const pyFile = join(tmpDir, `${tmpId}.py`);
    const tsFile = join(tmpDir, `${tmpId}.ts`);

    try {
      writeFileSync(pyFile, pythonCode, 'utf-8');

      const converterPath = join(process.cwd(), 'tools', 'py2ts.cjs');
      execSync(`node "${converterPath}" "${pyFile}" "${tsFile}"`, {
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let tsCode = readFileSync(tsFile, 'utf-8');

      // Fix the import path for browser usage: '../src/index.ts' → 'manim-web'
      tsCode = tsCode.replace(
        /from\s+['"]\.\.\/src\/index\.ts['"]/g,
        "from 'manim-web'"
      );

      return NextResponse.json({ pythonCode, tsCode });
    } finally {
      // Cleanup temp files
      try { unlinkSync(pyFile); } catch {}
      try { unlinkSync(tsFile); } catch {}
    }
  } catch (error: any) {
    console.error('[Manim API Error]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
