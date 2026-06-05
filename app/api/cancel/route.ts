import { NextResponse } from "next/server";
import { taskStore } from "../../../lib/memoryStore";
import { updateTask } from "../../../lib/supabase";

const RENDER_SERVER_URL = process.env.RENDER_SERVER_URL || "http://127.0.0.1:8000";

export async function POST(req: Request) {
  try {
    const { taskId } = await req.json();

    if (!taskId) {
      return NextResponse.json({ success: false, error: "No taskId provided" }, { status: 400 });
    }

    // Cancel in local store
    taskStore.set(taskId, { status: "failed", error: "Cancelled by user or timeout" });
    await updateTask(taskId, "status", "cancelled");

    // Forward cancellation to render server
    try {
      await fetch(`${RENDER_SERVER_URL}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId }),
      });
    } catch (e) {
      console.error("[Cancel] Failed to forward to render server", e);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
