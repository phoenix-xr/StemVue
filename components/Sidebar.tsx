import { useEffect, useState } from "react";
import { IconSparkle } from "./icons";

interface SidebarProps {
  isOpen: boolean;
  onNewQuestion: () => void;
  onSelectHistoryItem?: (videoUrl: string, problemStr: string) => void;
}

interface HistoryItem {
  task_id: string;
  problem: string;
  video_url: string;
}

export function Sidebar({ isOpen, onNewQuestion, onSelectHistoryItem }: SidebarProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/history")
        .then(res => res.json())
        .then(data => {
          if (data.success && data.history) {
            setHistory(data.history);
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  const navItems = [
    {
      label: "New question",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      ),
      onClick: onNewQuestion,
    },
    {
      label: "Saved",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      ),
      onClick: () => {}
    },
  ];

  return (
    <div
      className={`z-40 flex flex-col transition-all duration-300 bg-[var(--surface)]
        /* Mobile */
        absolute top-14 left-4 w-56 rounded-xl border border-[var(--border)] shadow-[0_10px_30px_rgba(0,0,0,0.5)]
        ${isOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-4 pointer-events-none"}
        
        /* Desktop */
        sm:fixed sm:top-0 sm:left-0 sm:h-full sm:w-[240px] sm:rounded-none sm:border-y-0 sm:border-l-0 sm:border-r sm:shadow-none sm:pointer-events-auto sm:opacity-100 sm:translate-y-0
        ${isOpen ? "sm:translate-x-0" : "sm:-translate-x-full"}
      `}
    >
      <div className="flex items-center gap-2 px-5 pt-5 pb-4">
        <IconSparkle />
        <span className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.18em", color: "var(--accent)" }}>
          StemVue
        </span>
      </div>

      <div className="flex flex-col gap-0.5 px-3 mb-4">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150 cursor-pointer text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {history.length > 0 && (
        <div className="flex flex-col px-3 gap-1 overflow-y-auto max-h-[50vh] scrollbar-hide">
          <h3 className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-[var(--muted)] uppercase">
            Recent Queries
          </h3>
          {history.map(item => (
            <button
              key={item.task_id}
              onClick={() => onSelectHistoryItem && onSelectHistoryItem(item.video_url, item.problem)}
              className="group flex flex-col items-start gap-1 rounded-lg px-3 py-2 transition-all duration-150 cursor-pointer hover:bg-[var(--surface-hover)] text-left"
            >
              <span className="text-xs font-medium text-[var(--foreground)] line-clamp-1">
                {item.problem}
              </span>
              <span className="text-[10px] text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors">
                Replay video →
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex-1" />

      <div className="px-5 py-4">
        <p className="text-[10px] text-[var(--muted)]" style={{ opacity: 0.5 }}>
          StemVue © 2026
        </p>
      </div>
    </div>
  );
}
