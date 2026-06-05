"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { IconSparkle } from "../components/icons";
import { TopBar } from "../components/TopBar";
import { Sidebar } from "../components/Sidebar";
import { GenerationProgress } from "../components/GenerationProgress";
import { InputBar } from "../components/InputBar";

/* ── Suggestion chips ── */
const SUGGESTIONS = [
  "Solve x² + 5x + 6 = 0",
  "Explain Newton's 2nd Law",
  "Find derivative of sin(x)·eˣ",
  "Balance: Fe + O₂ → Fe₂O₃",
];

/* ── Main page ── */
export default function Home() {
  const [query, setQuery] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [language, setLanguage] = useState<"english" | "hinglish">("english");
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [errorPopup, setErrorPopup] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<"queued" | "processing">("queued");
  const [queuePosition, setQueuePosition] = useState(0);
  const [queueTotal, setQueueTotal] = useState(0);
  
  const activeTaskIdRef = useRef<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* Auto-resize textarea */
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, []);

  useEffect(() => autoResize(), [query, autoResize]);

  /* Image handling (Async Transcription) */
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* Submit */
  const handleSubmit = async () => {
    if (!query.trim() && !imageFile) return;
    setIsLoading(true);
    setErrorPopup(null);

    try {
      // Build FormData payload
      const formData = new FormData();
      formData.append("query", query);
      formData.append("language", language);
      if (imageFile) {
        formData.append("image", imageFile);
      }

      // Call our Next.js API route
      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let errStr = "Failed to start generation";
        try {
          const errData = await res.json();
          if (errData.error) errStr = errData.error;
        } catch (e) {}
        throw new Error(errStr);
      }

      const data = await res.json();
      console.log("Backend responded:", data);

      // Transition UI to the "Submitted/Generating" view
      setIsLoading(false);
      setSubmitted(true);
      setGenerating(true);
      setVideoReady(false);
      setVideoUrl(null);
      setGenerationStatus("queued");

      const taskId = data.taskId;
      activeTaskIdRef.current = taskId;

      // Swap out ugly fetch polling for a single, clean Server-Sent Events stream
      const eventSource = new EventSource(`/api/status/${taskId}`);

      let processStartTime: number | null = null;
      let timeoutInterval: NodeJS.Timeout | null = null;

      eventSource.onmessage = (event) => {
        const statusData = JSON.parse(event.data);
        console.log(`[SSE PUSH] Task ${taskId}:`, statusData.status);

        if (statusData.status === "queued" || statusData.status === "processing") {
           setGenerationStatus(statusData.status);
           if (statusData.status === "queued") {
             setQueuePosition(statusData.position || 0);
             setQueueTotal(statusData.total || 0);
           }
        }

        // Timeout tracking
        if (statusData.status === "processing") {
            if (!processStartTime) {
                processStartTime = Date.now();
                timeoutInterval = setInterval(() => {
                    if (Date.now() - processStartTime! > 180000) {
                        eventSource.close();
                        if (timeoutInterval) clearInterval(timeoutInterval);
                        setGenerating(false);
                        setErrorPopup("Video processing timed out. Please try again.");
                        fetch(`/api/cancel`, { method: "POST", body: JSON.stringify({ taskId }) });
                    }
                }, 5000);
            }
        }

        if (statusData.status === "completed" && statusData.videoUrl) {
          eventSource.close();
          if (timeoutInterval) clearInterval(timeoutInterval);
          setGenerating(false);
          setVideoReady(true);
          
          // Build the Supabase Storage URL
          const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
          const fullUrl = `${baseUrl}/storage/v1/object/public/Video%20Storage/${statusData.videoUrl}`;
          setVideoUrl(fullUrl);
          
          // Save to local storage history
          try {
            const newHistoryItem = { video_url: fullUrl, problem: query || "Image problem" };
            const existing = JSON.parse(localStorage.getItem("stemvue_history") || "[]");
            localStorage.setItem("stemvue_history", JSON.stringify([newHistoryItem, ...existing]));
            window.dispatchEvent(new Event("historyUpdated"));
          } catch (err) { console.error("Failed to save history", err); }
          
          console.log("Displayed video from:", fullUrl);
        } else if (statusData.status === "failed") {
          eventSource.close();
          if (timeoutInterval) clearInterval(timeoutInterval);
          setGenerating(false);
          setErrorPopup(`Generation failed: ${statusData.error || "Unknown compilation crash"}`);
        }
      };

      eventSource.onerror = (err) => {
        console.error("SSE stream error:", err);
        eventSource.close();
        if (timeoutInterval) clearInterval(timeoutInterval);
        setGenerating(false);
        setErrorPopup("Lost connection to the generation server tracking stream.");
      };

    } catch (err: any) {
      console.error("Submission error:", err);
      setIsLoading(false);
      setErrorPopup(err.message || "Failed to queue rendering request. Please try again.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  /* Reset */
  const handleNewQuestion = () => {
    setQuery("");
    setImageFile(null);
    setImagePreview(null);
    setSubmitted(false);
    setGenerating(false);
    setVideoReady(false);
    setIsLoading(false);
    setErrorPopup(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCancel = () => {
    if (!activeTaskIdRef.current) return;
    setGenerating(false);
    setSubmitted(false);
    fetch(`/api/cancel`, { method: "POST", body: JSON.stringify({ taskId: activeTaskIdRef.current }) });
  };

  const hasContent = !!query.trim() || !!imagePreview;

  const handleHistorySelect = (url: string, problemStr: string) => {
    // 1. Set the main UI up to show playing a video.
    setIsLoading(false);
    setSubmitted(true);
    setGenerating(false);
    setVideoReady(true);
    
    // 2. Set the UI text to match the history trace.
    setQuery(problemStr);

    // 3. Construct and mount valid URL.
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const loadedUrl = `${baseUrl}/storage/v1/object/public/Video%20Storage/${url}`;
    
    if (url.startsWith("http")) { // In case the DB gives full URLs
      setVideoUrl(url);
    } else {
      setVideoUrl(loadedUrl);
    }
  };

  /* ── Render ── */
  return (
    <div className="relative flex h-full overflow-hidden">
      
      {/* ── ERROR POPUP TOAST ── */}
      {errorPopup && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-red-500/10 border border-red-500/50 backdrop-blur-xl shadow-[0_0_30px_rgba(239,68,68,0.2)] text-red-100 px-6 py-4 rounded-xl flex items-center gap-4 whitespace-pre-wrap max-w-lg text-center font-medium">
            <span className="text-xl">⚠️</span>
            <p className="text-sm leading-relaxed">{errorPopup}</p>
            <button 
              onClick={() => setErrorPopup(null)}
              className="ml-2 bg-red-500/20 hover:bg-red-500/40 text-red-300 hover:text-white transition-all h-8 w-8 rounded-full flex items-center justify-center font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onNewQuestion={handleNewQuestion} 
        onSelectHistoryItem={handleHistorySelect}
      />

      {/* Main area */}
      <div
        className={`relative flex flex-1 flex-col items-center justify-center overflow-hidden transition-all duration-300 ml-0 ${sidebarOpen ? "sm:ml-[240px]" : ""}`}
      >
        {/* Top bar */}
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-4">
          {/* Hamburger */}
          <button
            id="btn-sidebar"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 cursor-pointer text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
            title="Menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Right icons */}
          <TopBar />
        </div>

        {/* Grid background */}
        <div className="bg-grid" />

        {/* Ambient glow */}
        <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            background:
              "radial-gradient(ellipse 65% 55% at 50% 0%, rgba(139,92,246,0.08) 0%, rgba(59,130,246,0.04) 45%, transparent 80%)",
          }}
        />

        {/* ── Idle state: centred ── */}
        {!submitted && (
          <div className="animate-fade-up z-10 flex w-full max-w-3xl flex-col items-center gap-8 px-4">
            {/* Brand */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2.5">
                <IconSparkle />
                <span
                  className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-sm font-semibold tracking-[0.2em] text-transparent uppercase"
                >
                  StemVue
                </span>
              </div>
              <h1 className="text-center text-3xl font-semibold leading-tight tracking-tight text-[var(--foreground)] sm:text-4xl">
                Get <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">animated video solutions</span> for
                <br />any homework problem
              </h1>
              <p className="max-w-md text-center text-sm leading-relaxed text-[var(--muted)]">
                Type or snap a photo of your question — our AI generates a
                step-by-step video walkthrough that explains everything visually.
              </p>
            </div>

            {/* Input bar with glow */}
            <div className="input-glow-wrapper w-full">
              <div className="input-glow-spin" />
              <div className="input-glow-inner">
                <InputBar
                  query={query}
                  setQuery={setQuery}
                  imagePreview={imagePreview}
                  removeImage={removeImage}
                  fileInputRef={fileInputRef}
                  textareaRef={textareaRef}
                  handleImageSelect={handleImageSelect}
                  handleSubmit={handleSubmit}
                  handleKeyDown={handleKeyDown}
                  language={language}
                  setLanguage={setLanguage}
                  hasContent={hasContent}
                  isLoading={isLoading}
                />
              </div>
            </div>

            {/* Suggestion chips */}
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
                  className="rounded-full border px-3.5 py-1.5 text-xs transition-all duration-200 cursor-pointer border-[var(--border)] text-[var(--muted)] bg-transparent hover:border-[var(--accent)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Submitted state: video centred ── */}
        {submitted && (
          <div className="z-10 flex h-full w-full flex-col">
            {/* Main content area */}
            <div className="flex flex-1 flex-col items-center justify-center overflow-hidden px-6 pt-16 pb-4">
              <div className="animate-fade-up flex w-full max-w-4xl flex-col items-center gap-4">
                {/* Query echo */}
                <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                  <IconSparkle />
                  <span className="font-medium text-[var(--foreground)]">
                    {query || "Image problem"}
                  </span>
                </div>

                {generating && <GenerationProgress status={generationStatus} queuePosition={queuePosition} queueTotal={queueTotal} onCancel={handleCancel} />}

                {videoReady && (
                  <div
                    className="relative w-full overflow-hidden rounded-2xl border"
                    style={{
                      borderColor: "var(--border)",
                      background: "#000",
                      aspectRatio: "16/9",
                    }}
                  >
                    {/* "Didn't understand?" button */}
                    <button
                      className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium backdrop-blur-md transition-all duration-200 cursor-pointer bg-[rgba(139,92,246,0.15)] text-[var(--accent)] border-[rgba(139,92,246,0.25)] hover:bg-[var(--accent)] hover:text-[#fff] hover:border-[var(--accent)]"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      Didn&apos;t understand?
                    </button>

                    {/* Render actual video if available, else placeholder */}
                    {videoUrl ? (
                      <video 
                        src={videoUrl} 
                        controls 
                        autoPlay 
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-3">
                        <svg
                          width="48"
                          height="48"
                          viewBox="0 0 24 24"
                          fill="var(--accent)"
                        >
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        <span className="text-sm text-[var(--muted)]">
                          Video walkthrough ready
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom bar */}
            <div className="flex flex-col items-center gap-3 px-6 pb-5 pt-2">
              {videoReady && (
                <button
                  onClick={handleNewQuestion}
                  className="rounded-full border px-4 py-1.5 text-xs transition-all duration-200 cursor-pointer border-[var(--border)] text-[var(--muted)] bg-transparent hover:border-[var(--accent)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)]"
                >
                  Ask another question
                </button>
              )}

              <div className="w-full max-w-3xl">
                <div
                  className="rounded-2xl border"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--surface)",
                  }}
                >
                  <InputBar
                    query={query}
                    setQuery={setQuery}
                    imagePreview={imagePreview}
                    removeImage={removeImage}
                    fileInputRef={fileInputRef}
                    textareaRef={textareaRef}
                    handleImageSelect={handleImageSelect}
                    handleSubmit={handleSubmit}
                    handleKeyDown={handleKeyDown}
                    language={language}
                    setLanguage={setLanguage}
                    hasContent={hasContent}
                    isLoading={isLoading}
                    compact
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div> {/* end main area */}
    </div>
  );
}
