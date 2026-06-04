import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_MODEL = "gemini-3.5-flash"; // Primary model for all LLM tasks, with fallback to 2.5-lite on crashes

const client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

/**
 * The master prompt — direct port of `master_agent()` from get_agent.py.
 * Returns the full LLM response as a string.
 */
export async function queryGemini(
  problem: string,
  language: string = "english",
  imagePayload: { data: string, mimeType: string } | null = null
): Promise<string> {
  const systemInstructionsText = `
You are the Master Agent. Strictly output a <PLAN> block and a <CODE> block.
VizLearn AI. Translate the given problem into Manim Python code.

OUTPUT: EXACTLY two XML blocks: <PLAN> and <CODE>.

<PLAN>:
- MATH: Detail zero-skip algebraic derivations cleanly BEFORE generating any code. To support our real-time frontend UI streaming, you MUST output this mathematical solution progressively in a numbered step-by-step layout using raw Markdown LaTeX blocks ($$ ... $$) for all math.
CRITICAL FORMATTING: Do NOT indent the equations with spaces! Maintain all $$ blocks completely flush left to prevent Markdown AST parsing errors. Ensure all superscripts and subscripts in LaTeX are properly grouped with curly braces (e.g. use x^{2} instead of x^2, and a_{i} instead of a_i) so they render beautifully on screen without parsing breaks.
Structure it strictly like this:
**Step 1: [Contextual description]** | KEYWORDS: [1-3 concept keywords, comma separated]
$$ [Master Equation Here] $$
$$ [Calculations WITHOUT MISSING ANY STEPS logically below that] $$

**Step 2: [Next contextual description]** | KEYWORDS: [1-3 concept keywords]
... and so on. (ALWAYS seek out the most elegant mathematical trick!).
- PEDAGOGY: "Roadmap Planning". Introduce a new PHASE 1.5 in the video called "Planning". During this phase, outline the overarching math strategy. The voiceover MUST ask rhetorical conversational questions (e.g., "But how do we find angular velocity?") and natively answer them to clearly establish the roadmap. Divide the upcoming solution into clear "Parts".
- VOICEOVER STYLE: The voiceover MUST be written in HINGLISH (a conversational mix of Hindi and English). NEVER literally read out full mathematical equations. Instead of saying "x equals fraction 2y over 3", say "Substituting the values...". IMPORTANT: Write out single-letter math variables phonetically so the TTS pronounces them as English letters (e.g. write "tee" instead of "t", "ex" instead of "x", "vai" instead of "y").

<CODE> (class GeneratedScene(VizLearnScene)):
- STRICTLY use standard Manim (Circle, Write, Create, FadeIn) and provided Base methods. NEVER invent helper methods like \`self.add_circle()\` or \`self.play_animation()\`.
- PHASE 1 (VISUAL): Diagram physical/geometric setups. Skip entirely if Pure Math. ALL geometrical creation MUST be wrapped in generic \`with self.voiceover(text="..."):\` blocks!
- PHASE 1.5 (PLANNING): Call \`self.clear_screen()\` to wipe the visuals. Then, draw a brief text roadmap on screen (using text and simple formatting) to explain the upcoming mathematical strategy. Use rhetorical questions and answers in the voiceover.
- PHASE 2 (MATH):
  - Start: \`self.set_scene_title("Math Solution")\` (this also automatically clears the screen safely).
  - Parts Layout: For each part of the solution, declare the primary formula using \`self.set_master_equation(r"F = m \\cdot a")\`. This auto-clears previous calculations and headers the current step.
  - Calculations: Use \`self.present_equation(r"...")\` to vertically stack steps logically bounded below the current master equation.
  - Voiceover Example:
    \`\`\`python
    with self.voiceover(text="To solve for x, we first subtract 5 from both sides."):
        self.present_equation(r"3x = 9")
    \`\`\`
  `;

  let attempts = 0;
  const maxRetries = 3;

  while (attempts < maxRetries) {
    try {
      const activeModel = attempts === 0 ? GEMINI_MODEL : "gemma-4-31b-it"; // Fallback to lower parameter Gemma if primary crashes
      console.log(`[Gemini] Sending request to ${activeModel} (Attempt ${attempts + 1}/${maxRetries})...`);

      let contentParts: any[] = [`PROBLEM: ${problem}`];
      if (imagePayload) {
        contentParts.push({
          inlineData: {
            data: imagePayload.data,
            mimeType: imagePayload.mimeType
          }
        });
      }

      // Use streaming to collect the full response
      const response = await client.models.generateContentStream({
        model: activeModel,
        contents: contentParts,
        config: { 
          temperature: 0.2,
          systemInstruction: systemInstructionsText,
        },
      });

      let fullResponse = "";
      for await (const chunk of response) {
        const text = chunk.text ?? "";
        fullResponse += text;
        process.stdout.write(text); // stream to server console for debugging
      }

      console.log("\n[Gemini] Response complete, length:", fullResponse.length);
      return fullResponse;
    } catch (error: any) {
      console.error(`\n[Gemini] Server crashed on attempt ${attempts + 1}: ${error.message}`);
      attempts++;
      
      if (attempts >= maxRetries) {
        throw new Error(`Google API fatal failure after ${maxRetries} retries: ${error.message}`);
      }
      
      // Wait 2 seconds manually before next network hit
      console.log("[Gemini] Waiting 2s before firing backup request...");
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return "";
}

/**
 * Executes a dedicated multimodal vision pass strictly utilizing Gemini 1.5 Flash
 * to transcribe user-uploaded homework images into pure geometric constraints.
 */
export async function extractTextFromImage(imageFile: File): Promise<string> {
  const visionPrompt = "Extract all text verbatim. For physics diagrams, concisely define vectors, forces, angles, and geometry mathematically so an AI can reconstruct the exact mechanical layout securely.";
  const visionModel = "gemini-1.5-flash-latest"; // Strictly single free model as requested
  
  try {
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log(`[Gemini Vision] Analyzing image (${imageFile.type}), size: ${buffer.byteLength} bytes...`);
    console.log(`[Gemini Vision] Attempting extraction via strictly ${visionModel}...`);
    
    const response = await client.models.generateContent({
      model: visionModel,
      contents: [
        visionPrompt,
        {
          inlineData: {
            data: buffer.toString("base64"),
            mimeType: imageFile.type || "image/jpeg"
          }
        }
      ],
      config: { temperature: 0.1 }
    });
    
    const text = response.text || "";
    console.log(`[Gemini Vision] Extracted Content:\n>> ${text}\n`);
    return text.trim();

  } catch (err: any) {
    console.error(`[Gemini Vision] Fatal strict crash against ${visionModel}:`, err.message);
    throw new Error(`Vision extraction engine failed natively on primary model: ${err.message}`);
  }
}
