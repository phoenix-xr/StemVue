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

      const checkInterval = setInterval(() => {
        const localState = taskStore.get(taskId);
        
        if (localState) {
          sendEvent({
            status: localState.status,
            videoUrl: localState.videoUrl || null,
            error: localState.error || null,
          });

          // End the stream connection when finished
          if (localState.status === "completed" || localState.status === "failed") {
            clearInterval(checkInterval);
            try { controller.close(); } catch {}
          }
        } else {
           // Still spinning up, push processing
           sendEvent({ status: "processing", videoUrl: null, error: null });
        }
      }, 1000); // Check local memory map frequently

      // Proper cleanup if the user closes their browser tab
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
