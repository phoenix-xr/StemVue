import React from "react";
import { IconGlobe, IconBrain, IconPlay, IconLoader, IconX } from "./icons";

interface InputBarProps {
  query: string;
  setQuery: (v: string) => void;
  imagePreview: string | null;
  removeImage: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  handleImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  language: "english" | "hinglish";
  setLanguage: (v: "english" | "hinglish") => void;
  explainDeeply: boolean;
  setExplainDeeply: (v: boolean) => void;
  hasContent: boolean;
  isLoading: boolean;
  compact?: boolean;
}

export function InputBar({
  query,
  setQuery,
  imagePreview,
  removeImage,
  fileInputRef,
  textareaRef,
  handleImageSelect,
  handleSubmit,
  handleKeyDown,
  language,
  setLanguage,
  explainDeeply,
  setExplainDeeply,
  hasContent,
  isLoading,
  compact = false,
}: InputBarProps) {
  return (
    <div
      className="group flex w-full flex-col rounded-2xl transition-all duration-300"
    >
      {/* Image preview */}
      {imagePreview && (
        <div className="flex px-4 pt-3">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Attached"
              className="h-20 w-20 rounded-xl object-cover border"
              style={{ borderColor: "var(--border)" }}
            />
            <button
              onClick={removeImage}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full cursor-pointer"
              style={{
                background: "var(--surface-hover)",
                color: "var(--muted)",
              }}
            >
              <IconX />
            </button>
          </div>
        </div>
      )}

      {/* Upload zone — prominent in full mode, inline in compact */}
      {!compact && !imagePreview && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="group/upload mx-4 mt-3 flex items-center gap-3 rounded-xl border border-dashed px-4 py-3 transition-all duration-300 cursor-pointer border-[var(--border)] bg-[rgba(255,255,255,0.015)] text-[var(--muted)] hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-[var(--foreground)]"
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-300 bg-[var(--surface-hover)] group-hover/upload:bg-blue-600"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white transition-colors duration-300">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          <div className="flex flex-col items-start transition-colors duration-300">
            <span className="text-xs font-medium text-[var(--foreground)]">
              Upload a photo of your question
            </span>
            <span className="text-[11px] text-[var(--muted)] group-hover/upload:opacity-90 transition-opacity duration-300">
              Snap or upload a homework image
            </span>
          </div>
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />

      {/* Textarea row */}
      <div className="flex items-end gap-2 px-4 pt-3 pb-2">
        {/* Compact: inline camera button */}
        {compact && !imagePreview && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-150 cursor-pointer text-[var(--accent)] bg-[var(--accent-soft)] hover:bg-[var(--accent)] hover:text-[#fff]"
            title="Upload photo"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
        )}

        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={imagePreview ? "Add more context... (optional)" : "What do you need help with?"}
          className="flex-1 resize-none bg-transparent outline-none"
          rows={1}
          style={{
            color: "var(--foreground)",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            fontSize: compact ? "0.875rem" : "1.05rem",
            lineHeight: "1.75",
            letterSpacing: "-0.01em",
            caretColor: "var(--accent)",
            minHeight: compact ? "68px" : "48px",
            maxHeight: compact ? "120px" : "160px",
          }}
        />
      </div>

      {/* ── Bottom toolbar: language toggle + explain deeply + generate ── */}
      <div
        className="flex items-center gap-3 border-t px-4 py-2.5"
        style={{ borderColor: "var(--border)" }}
      >
        {/* Language toggle — segmented buttons */}
        <div
          className="flex flex-col sm:flex-row overflow-hidden rounded-lg border bg-[rgba(255,255,255,0.01)]"
          style={{ borderColor: "var(--border)" }}
        >
          {(["english", "hinglish"] as const).map((lang) => {
            const active = language === lang;
            return (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`flex justify-center items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium capitalize transition-all duration-150 cursor-pointer border-b sm:border-b-0 sm:border-r border-[var(--border)] last:border-0 ${
                  active 
                    ? "text-[var(--foreground)] bg-[var(--accent-soft)]" 
                    : "text-[var(--muted)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                {lang === "english" && <IconGlobe />}
                {lang === "hinglish" && (
                  <span className="text-[11px] font-bold leading-none" style={{ color: active ? "var(--accent)" : "var(--muted)" }}>
                    Hi
                  </span>
                )}
                {lang}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div
          className="h-5 w-px"
          style={{ background: "var(--border)" }}
        />

        {/* Explain Deeply toggle */}
        <button
          id="btn-explain-deeply"
          onClick={() => setExplainDeeply(!explainDeeply)}
          className={`flex items-center gap-2 rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer ${
            explainDeeply
              ? "text-[var(--foreground)] bg-[var(--accent-soft)] border-[var(--accent)]"
              : "text-[var(--muted)] bg-transparent border-[var(--border)] hover:bg-[var(--surface-hover)] hover:border-[rgba(139,92,246,0.3)]"
          }`}
        >
          {/* Checkmark box */}
          <span
            className="flex h-3.5 w-3.5 items-center justify-center rounded-sm border transition-all duration-150"
            style={{
              borderColor: explainDeeply ? "var(--accent)" : "var(--muted)",
              background: explainDeeply ? "var(--accent)" : "transparent",
            }}
          >
            {explainDeeply && (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </span>
          <span>Explain deeply</span>
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Generate Solution button — icon-only on mobile, full on desktop */}
        <button
          id="btn-generate"
          onClick={handleSubmit}
          disabled={!hasContent || isLoading}
          className={`flex items-center justify-center gap-2 rounded-lg transition-all duration-300 cursor-pointer disabled:cursor-not-allowed sm:px-4 sm:py-1.5 h-8 w-8 sm:h-auto sm:w-auto ${
            hasContent && !isLoading
              ? "bg-[var(--accent)] text-[#fff] shadow-[0_0_20px_rgba(124,58,237,0.35)] border border-[var(--accent)] hover:bg-[#6d28d9] hover:border-[#6d28d9] hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(124,58,237,0.5)]"
              : "bg-transparent text-[var(--muted)] border border-[var(--border)] opacity-50"
          }`}
        >
          {isLoading ? (
            <>
              <IconLoader />
              <span className="hidden sm:inline text-xs font-semibold">Generating…</span>
            </>
          ) : (
            <>
              <IconPlay />
              <span className="hidden sm:inline text-xs font-semibold">Generate Solution</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
