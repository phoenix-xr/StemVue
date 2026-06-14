import { NextResponse } from "next/server";
import { updateTask } from "../../../lib/supabase";
import { taskStore } from "../../../lib/memoryStore";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");
    const videoUrl = searchParams.get("videoUrl");
    const errorMsg = searchParams.get("error");
    const status = searchParams.get("status"); // 'completed' or 'failed'

    if (!taskId) {
      return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
    }

    if (status === "failed") {
      // 1. Update Supabase
      console.log(`[Webhook] Marking task ${taskId} as failed.`);
      await updateTask(taskId, "status", "failed");
      await updateTask(taskId, "error", errorMsg || "Unknown render error");

      // 2. Update local Server Memory so poller sees it instantly
      taskStore.set(taskId, {
        status: "failed",
        error: errorMsg || "Unknown render error",
      });

      return NextResponse.json({ success: true });
    }

    if (!videoUrl) {
      return NextResponse.json(
        { error: "Missing videoUrl for completed task" },
        { status: 400 }
      );
    }

    // Task Completed Successfully!
    console.log(`[Webhook] Task ${taskId} completed! URL: ${videoUrl}`);

    // 1. Update Supabase (Video URL must be updated FIRST to prevent SSE race conditions)
    await updateTask(taskId, "video_url", videoUrl);
    await updateTask(taskId, "status", "completed");

    // 2. Update local Server Memory so poller sees it instantly
    taskStore.set(taskId, {
      status: "completed",
      videoUrl: videoUrl,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Webhook] Failed to process webhook:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
