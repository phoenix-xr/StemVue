import { NextResponse } from "next/server";
import { getHistory } from "../../../lib/supabase";

export async function GET(req: Request) {
  try {
    // Extract client IP address to bind queries
    const forwardedFor = req.headers.get("x-forwarded-for");
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : "127.0.0.1";

    const history = await getHistory(clientIp);

    // Filter out rows without video URLs to preserve clean UI
    const validHistory = history.filter(h => h.video_url);

    return NextResponse.json({ success: true, history: validHistory });
  } catch (error) {
    console.error("[History API] Error fetching tasks:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load history" },
      { status: 500 }
    );
  }
}
