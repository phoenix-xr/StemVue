import { NextResponse } from "next/server";
import { taskStore } from "../../../../lib/memoryStore";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const encoder = new TextEncoder();

  // Create a readable stream that pushes events to the browser 
  // from local memory without ever polling standard HTTP multiple times.
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // connection likely closed
        }
      };

      const checkInterval = setInterval(async () => {
        const localState = taskStore.get(taskId);
        
        if (localState) {
          let currentStatus = localState.status;
          let queuePosition = 0;
          let queueTotal = 0;

          if (currentStatus === "queued") {
            try {
              const { getQueueStats } = await import("../../../../lib/supabase");
              const stats = await getQueueStats(taskId);
              queuePosition = stats.position;
              queueTotal = stats.total;
            } catch (e) {
              console.error("Failed to get queue stats", e);
            }
          }

          // If Next.js has handed off to FastAPI, it says "rendering".
          // Since we strictly throttle globally, if it hits Celery it is immediately processing.
          if (currentStatus === "rendering") {
             currentStatus = "processing";
          }

          sendEvent({
            status: currentStatus,
            position: queuePosition,
            total: queueTotal,
            videoUrl: localState.videoUrl || null,
            error: localState.error || null,
          });

          // End the stream connection when finished
          if (localState.status === "completed" || localState.status === "failed") {
            clearInterval(checkInterval);
            try { controller.close(); } catch {}
          }
        } else {
           // Still spinning up, push queued
           sendEvent({ status: "queued", position: 0, total: 0, videoUrl: null, error: null });
        }
      }, 2000); // Check every 2 seconds

      req.signal.addEventListener("abort", () => {
        clearInterval(checkInterval);
        try { controller.close(); } catch {}
        
        // If aborted while still queued, mark as failed so the queue loop skips it
        const localState = taskStore.get(taskId);
        if (localState && localState.status === "queued") {
          taskStore.set(taskId, { status: "failed", error: "Cancelled by user disconnect" });
          import("../../../../lib/supabase").then(m => m.updateTask(taskId, "status", "cancelled")).catch(console.error);
        }
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
