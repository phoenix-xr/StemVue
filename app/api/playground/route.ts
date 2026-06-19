import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ 
  project: process.env.VERTEX_AI_PROJECT_ID!, 
  location: 'asia-south1',
  vertexai: true
});

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "No prompt provided" }, { status: 400 });
    }

    const systemInstruction = `
You are a math tutor AI. Solve the given problem with detailed steps.

OUTPUT FORMAT: Exactly THREE blocks:

1. <SOLUTION> block: 
**Solution Roadmap** — draw a brief text roadmap to explain the upcoming mathematical strategy (numbered 1,2,3)

Then solve step-by-step using Markdown LaTeX blocks ($$ ... $$).
CRITICAL: Do NOT indent equations! All $$ blocks must be flush left.

**Step 1: [Apparant goal of this step]**
$$ master equation (if any) $$
$$ calculation $$

**Step 2: [Apparant goal of this step]**
... 

2. <EQUATION_DATA> block: A JSON array describing the equations from the solution.
Multiple equations that serve the same purpose CAN share the same entry.
<EQUATION_DATA>
[
  {
    "step_number": 1,
    "equation_latex": "F = m \\\\cdot a",
    "hover_text": "We use Newton's Second Law here because we need to relate force to acceleration for the block on the incline."
  },
  ...
]
</EQUATION_DATA>

Rules for EQUATION_DATA:
- equation_latex = the LaTeX content between $$ and $$ (must match the solution).
- hover_text = explain WHY we use this particular equation at this point in the solution and the law where it is coming from (1-2 sentences)
- for each step of the solution, declare the primary formula first
- vertically stack steps logically bounded below the current master equation.
- All the comments included with solution should be define the GOAL of doing a certain operation we are peforming

3. <STEP_CONCEPTS> block: A JSON array with ONE entry per step. Each entry identifies a "set of words" in "operation" which describe what operation is happening in that particular step, should strictly include if any particular method or trick name if used.
<STEP_CONCEPTS>
[
  {
    "step_number": 1,
    "operation":""
  },
    ...
]
</STEP_CONCEPTS>

Rules for STEP_CONCEPTS:
- ONE entry per step (not per equation).
- concept = the exact main concept, formula, identity, or theorem that this step relies on. Name it precisely (e.g. "Quadratic Formula", "Integration by Parts", "Ohm's Law").
- search_query = a YouTube-optimized search string (4-8 words) a confused student would type to find a tutorial video about this exact concept. Include the formula/concept name.
`;

    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash-lite',
      contents: `PROBLEM: ${prompt}`,
      config: {
        systemInstruction,
        temperature: 0.2,
      }
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of responseStream) {
            const text = chunk.text;
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (e: any) {
          console.error("Stream Error:", e);
          controller.error(e);
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8'
      }
    });
  } catch (error: any) {
    console.error("Playground API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
