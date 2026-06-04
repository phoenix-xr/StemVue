import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

/** Lazily initializes the Supabase client (avoids build-time crashes when env vars are placeholders). */
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      throw new Error(
        "Missing SUPABASE_URL or SUPABASE_KEY environment variables. " +
        "Please set them in .env.local"
      );
    }

    _supabase = createClient(url, key);
  }
  return _supabase;
}

/* ── DB helpers (mirrors python_exp/db_func.py) ── */

export async function createTask(taskId: string, problem: string, ipAddress: string) {
  const { error } = await getSupabase()
    .from("task_data")
    .insert({ task_id: taskId, status: "processing", problem, ip_address: ipAddress });

  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
}

export async function checkRateLimit(ipAddress: string): Promise<{ allowed: boolean, minutesLeft?: number }> {
  // DEV OVERRIDE: Temporarily disabled rate limiting for testing
  return { allowed: true };
}

export async function hasActiveTask(ipAddress: string): Promise<boolean> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data, error } = await getSupabase()
    .from("task_data")
    .select("task_id")
    .eq("ip_address", ipAddress)
    .in("status", ["processing", "rendering"])
    .gt("created_at", tenMinutesAgo)
    .limit(1);

  if (error) {
    console.error(`Active task check failed: ${error.message}`);
    return false; // Fail open if auth drops to not completely hard block UI randomly
  }
  
  return data && data.length > 0;
}

export async function getHistory(ipAddress: string) {
  const { data, error } = await getSupabase()
    .from("task_data")
    .select("task_id, problem, video_url, created_at")
    .eq("ip_address", ipAddress)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw new Error(`History fetch failed: ${error.message}`);
  return data || [];
}

export async function updateTask(taskId: string, key: string, value: string) {
  const { error } = await getSupabase()
    .from("task_data")
    .update({ [key]: value })
    .eq("task_id", taskId);

  if (error) throw new Error(`Supabase update failed: ${error.message}`);
}

export async function getTask(taskId: string) {
  const { data, error } = await getSupabase()
    .from("task_data")
    .select("*")
    .eq("task_id", taskId)
    .single();

  if (error) throw new Error(`Supabase select failed: ${error.message}`);
  return data;
}
