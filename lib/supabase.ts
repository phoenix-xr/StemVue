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
    .insert({ task_id: taskId, status: "queued", problem, ip_address: ipAddress });

  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
}

export async function checkRateLimit(ipAddress: string): Promise<{ allowed: boolean, minutesLeft?: number }> {
  // Simple rate limiting: 1 request per 2 minutes per IP to prevent spam abuse
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data, error } = await getSupabase()
    .from("task_data")
    .select("created_at")
    .eq("ip_address", ipAddress)
    .gt("created_at", twoMinutesAgo)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return { allowed: true };

  const lastCreated = new Date(data[0].created_at).getTime();
  const minutesLeft = Math.ceil((lastCreated + 2 * 60 * 1000 - Date.now()) / 60000);
  
  return { allowed: false, minutesLeft };
}

export async function hasActiveTask(ipAddress: string): Promise<boolean> {
  const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  const { data, error } = await getSupabase()
    .from("task_data")
    .select("task_id")
    .eq("ip_address", ipAddress)
    .in("status", ["queued", "processing", "rendering"])
    .gt("created_at", threeMinutesAgo)
    .limit(1);

  if (error) {
    console.error(`Active task check failed: ${error.message}`);
    return false; // Fail open if auth drops to not completely hard block UI randomly
  }
  
  return data && data.length > 0;
}

export async function getActiveSystemTasksCount(): Promise<number> {
  // We use 15 minutes because tasks might legitimately sit in the 'queued' state for several minutes
  // before they even begin 'processing'. If we use a small window, they age out of this check!
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count, error } = await getSupabase()
    .from("task_data")
    .select("task_id", { count: "exact", head: true })
    .in("status", ["processing", "rendering"])
    .gt("created_at", fifteenMinutesAgo);
  
  if (error) {
    console.error(`System tasks count failed: ${error.message}`);
    return 2; // Fail closed: if DB is unreachable, prevent queue flood
  }
  return count || 0;
}

export async function getQueueStats(taskId: string): Promise<{ position: number, total: number }> {
  const supabase = getSupabase();
  // Get creation time of this task
  const { data: thisTask } = await supabase
    .from("task_data")
    .select("created_at")
    .eq("task_id", taskId)
    .single();

  if (!thisTask) return { position: 1, total: 1 };

  // Total people in queue right now
  const { count: totalCount } = await supabase
    .from("task_data")
    .select("task_id", { count: "exact", head: true })
    .eq("status", "queued");

  // People in queue who joined before us
  const { count: beforeCount } = await supabase
    .from("task_data")
    .select("task_id", { count: "exact", head: true })
    .eq("status", "queued")
    .lt("created_at", thisTask.created_at);

  return { 
    position: (beforeCount || 0) + 1, 
    total: totalCount || 1 
  };
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
    .maybeSingle();

  if (error) throw new Error(`Supabase select failed: ${error.message}`);
  return data;
}
