export type TaskState = {
  status: "processing" | "rendering" | "completed" | "failed";
  videoUrl?: string;
  error?: string;
};

// Use global to persist the map across Next.js HMR reloads in development
const globalForMemoryStore = global as unknown as {
  taskStore: Map<string, TaskState>;
};

export const taskStore =
  globalForMemoryStore.taskStore || new Map<string, TaskState>();

if (process.env.NODE_ENV !== "production") {
  globalForMemoryStore.taskStore = taskStore;
}
