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
        try {
          const { getTask, getQueueStats } = await import("../../../../lib/supabase");
          const dbTask = await getTask(taskId);
          
          if (dbTask) {
            let currentStatus = dbTask.status;
            let queuePosition = 0;
            let queueTotal = 0;

            if (currentStatus === "queued") {
              const stats = await getQueueStats(taskId);
              queuePosition = stats.position;
              queueTotal = stats.total;
            }

            if (currentStatus === "rendering") {
               currentStatus = "processing";
            }

            sendEvent({
              status: currentStatus,
              position: queuePosition,
              total: queueTotal,
              videoUrl: dbTask.video_url || null,
              error: dbTask.error || null,
            });

            if (currentStatus === "completed" || currentStatus === "failed") {
              clearInterval(checkInterval);
              try { controller.close(); } catch {}
            }
          } else {
             sendEvent({ status: "queued", position: 0, total: 0, videoUrl: null, error: null });
          }
        } catch (e) {
          console.error("[SSE] DB poll error:", e);
        }
      }, 3000); // Check DB every 3 seconds to be gentle on Supabase Free Tier

      req.signal.addEventListener("abort", () => {
        clearInterval(checkInterval);
        try { controller.close(); } catch {}
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
