import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createTask, checkRateLimit, hasActiveTask } from "../../../lib/supabase";
import { queryGemini } from "../../../lib/gemini";
import { parseResponse } from "../../../lib/codeParser";
import { fixGeneratedCode } from "../../../lib/codeFixer";
import { taskStore } from "../../../lib/memoryStore";

const RENDER_SERVER_URL = process.env.RENDER_SERVER_URL || "http://127.0.0.1:8000";

export async function POST(req: Request) {
  const taskId = uuidv4();

  try {
    const formData = await req.formData();
    const query = (formData.get("query") as string) || "Solve default problem.";
    const language = (formData.get("language") as string) || "english";
    const explainDeeply = formData.get("explainDeeply") === "true";
    const image = formData.get("image") as File | null;

    let problem = query;

    // Extract client IP address for rate-limiting
    const forwardedFor = req.headers.get("x-forwarded-for");
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : "127.0.0.1";

    console.log(`[Generate] New task ${taskId} from IP ${clientIp}:`, {
      problem: problem.substring(0, 60),
      language,
      explainDeeply,
      hasImage: !!image,
    });

    // ── Pre-Flight: Concurrency and Rate Limiting Guard ──
    try {
      const activeRender = await hasActiveTask(clientIp);
      if (activeRender) {
         return NextResponse.json(
           { success: false, error: "Please wait for your current video to finish rendering natively before submitting a new one!" },
           { status: 409 }
         );
      }

      const rateCheck = await checkRateLimit(clientIp);
      if (!rateCheck.allowed) {
        return NextResponse.json(
          { success: false, error: `Rate limit hit! You can generate a new video in ${rateCheck.minutesLeft} minutes.` },
          { status: 429 }
        );
      }
    } catch (rlErr) {
      console.warn("Failed to check rate limits (assuming OK):", rlErr);
    }

    // ── Step 1: Create task in Supabase ──
    await createTask(taskId, problem, clientIp);
    
    // Register it immediately into local memory so polling finds it
    taskStore.set(taskId, { status: "processing" });

    // Extract image data if available
    let imagePayload: { data: string, mimeType: string } | null = null;
    if (image) {
      const buffer = Buffer.from(await image.arrayBuffer());
      imagePayload = {
        data: buffer.toString("base64"),
        mimeType: image.type || "image/jpeg"
      };
    }

    // ── Step 2-5 are kicked off in the background ──
    runPipeline(taskId, problem, language, imagePayload).catch((err) => {
      console.error(`[Pipeline ${taskId}] Unhandled error:`, err);
    });

    return NextResponse.json({
      success: true,
      taskId,
      statusUrl: `/api/status/${taskId}`,
    });
  } catch (error) {
    console.error("[Generate] Failed to start pipeline:", error);
    return NextResponse.json(
      { success: false, error: "Failed to initiate generation" },
      { status: 500 }
    );
  }
}

/**
 * The async pipeline that runs after the initial response is sent.
 */
async function runPipeline(taskId: string, problem: string, language: string, imagePayload: { data: string, mimeType: string } | null) {
  const start = Date.now();

  try {
    // ── Step 2: Call Gemini LLM ──
    console.log(`[Pipeline ${taskId}] Calling Gemini...`);
    const rawResponse = await queryGemini(problem, language, imagePayload);

    if (!rawResponse) {
      throw new Error("Gemini returned an empty response");
    }

    // ── Step 3: Parse <PLAN> and <CODE> blocks ──
    console.log(`[Pipeline ${taskId}] Parsing LLM response...`);
    const { plan, code } = parseResponse(rawResponse);

    if (!code) {
      throw new Error("Could not extract <CODE> block from LLM response");
    }

    console.log(`[Pipeline ${taskId}] Plan length: ${plan.length}, Code length: ${code.length}`);

    // ── Step 4: Apply code fixers ──
    console.log(`[Pipeline ${taskId}] Running code fixers...`);
    const fixedCode = fixGeneratedCode(code);

    // ── Step 5: Send fixed code to the FastAPI render server ──
    console.log(`[Pipeline ${taskId}] Sending to render server at ${RENDER_SERVER_URL}...`);
    
    // Simply update local memory, do NOT hit database again
    taskStore.set(taskId, { status: "rendering" });

    const renderRes = await fetch(`${RENDER_SERVER_URL}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_id: taskId,
        manim_code: fixedCode,
      }),
    });

    if (!renderRes.ok) {
      const errBody = await renderRes.text();
      throw new Error(`Render server responded ${renderRes.status}: ${errBody}`);
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`[Pipeline ${taskId}] Handed off to render server. Total Next.js time: ${elapsed}s`);

    // We do NOT update the DB to completed here.
    // The FastAPI server will hit the Webhook when it's totally done.

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Pipeline ${taskId}] FAILED:`, message);
    taskStore.set(taskId, { status: "failed", error: message });
  }
}
