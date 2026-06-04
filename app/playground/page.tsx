"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { parseEquationData, buildEquationMap, parseStepConcepts, type EquationData } from './traceParser';
import EquationTooltip from './VariableTooltip';
import VideoSuggestions from './VideoSuggestions';
import StepChat from './StepChat';

export default function PlaygroundPage() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [hoverData, setHoverData] = useState<{ data: EquationData; x: number; y: number } | null>(null);
  const [openVideoStep, setOpenVideoStep] = useState<number | null>(null);
  const [openChatStep, setOpenChatStep] = useState<number | null>(null);
  const mathContainerRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setResponse("");
    setHoverData(null);

    try {
      const res = await fetch('/api/playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setResponse(`Error: ${errData.error || res.statusText}`);
        return;
      }

      if (!res.body) {
        setResponse("Error: ReadableStream not supported.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let streamed = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          streamed += decoder.decode(value, { stream: true });
          setResponse(streamed);
        }
      }
    } catch (err: any) {
      setResponse(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- Extract solution section ---
  const solutionSection = useMemo(() => {
    const solMatch = response.match(/<SOLUTION>\s*([\s\S]*?)\s*<\/SOLUTION>/i);
    if (solMatch) return solMatch[1].trim();

    // Fallback: everything before <EQUATION_DATA>
    const eqIdx = response.search(/<EQUATION_DATA>/i);
    if (eqIdx !== -1) return response.substring(0, eqIdx).replace(/<\/?SOLUTION>/gi, '').trim();

    // During streaming: strip any partial tags
    return response.replace(/<SOLUTION>/i, '').replace(/<EQUATION_DATA>[\s\S]*/i, '').trim();
  }, [response]);

  // --- Parse equation data (only after stream completes) ---
  const equationMap = useMemo(() => {
    if (loading) return new Map();
    const data = parseEquationData(response);
    return buildEquationMap(data);
  }, [response, loading]);

  // --- Build step_number → search_query lookup from <STEP_CONCEPTS> ---
  const stepSearchMap = useMemo(() => {
    if (loading) return new Map<number, string>();
    const concepts = parseStepConcepts(response);
    const map = new Map<number, string>();
    for (const [stepNum, concept] of concepts) {
      map.set(stepNum, concept.search_query);
    }
    return map;
  }, [response, loading]);

  // --- Extract solution summary (first paragraph / roadmap) ---
  const solutionSummary = useMemo(() => {
    if (!solutionSection) return '';
    // The roadmap is everything before the first step heading
    const firstStepIdx = solutionSection.search(/\*\*Step\s*\d+/i);
    if (firstStepIdx > 0) return solutionSection.substring(0, firstStepIdx).trim();
    return solutionSection.substring(0, 300).trim();
  }, [solutionSection]);

  // --- Extract each step's body content for chat context ---
  const stepBodiesMap = useMemo(() => {
    const map = new Map<number, string>();
    if (!solutionSection) return map;
    // Split on step headings like **Step 1: ...**
    const stepRegex = /\*\*Step\s*(\d+)[:\.][^*]*\*\*/gi;
    const parts = solutionSection.split(stepRegex);
    // parts = [preamble, "1", body1, "2", body2, ...]
    for (let i = 1; i < parts.length; i += 2) {
      const stepNum = parseInt(parts[i], 10);
      const body = (parts[i + 1] || '').trim();
      if (stepNum && body) map.set(stepNum, body);
    }
    return map;
  }, [solutionSection]);

  // --- DOM post-processing: tag KaTeX equations for hover ---
  useEffect(() => {
    if (loading || !mathContainerRef.current || equationMap.size === 0) return;

    const timeoutId = setTimeout(() => {
      const container = mathContainerRef.current;
      if (!container) return;

      // Clean up previous tags
      container.querySelectorAll('.eq-interactive').forEach(el => {
        el.classList.remove('eq-interactive');
        el.removeAttribute('data-eq-idx');
      });

      const katexDisplays = container.querySelectorAll('.katex-display');
      const allEqData = parseEquationData(response);

      katexDisplays.forEach((el) => {
        const htmlEl = el as HTMLElement;

        // Extract LaTeX source from KaTeX's hidden annotation element
        const annotationEl = htmlEl.querySelector('annotation[encoding="application/x-tex"]');
        if (!annotationEl) return;

        const latexSource = (annotationEl.textContent || '').trim();
        const normalized = latexSource.replace(/\s+/g, ' ');
        const stripped = latexSource.replace(/\s/g, '');

        // Try direct match
        let matched = equationMap.get(normalized) || equationMap.get(stripped);

        // Fallback: partial/substring match
        if (!matched) {
          for (const [key, data] of equationMap) {
            const keyStripped = key.replace(/\s/g, '');
            if (stripped.includes(keyStripped) || keyStripped.includes(stripped) ||
                normalized.includes(key) || key.includes(normalized)) {
              matched = data;
              break;
            }
          }
        }

        if (matched) {
          const idx = allEqData.indexOf(matched);
          htmlEl.setAttribute('data-eq-idx', String(idx));
          htmlEl.classList.add('eq-interactive');
        }
      });

      // Attach hover listeners to tagged equations
      const interactiveEqs = container.querySelectorAll('.eq-interactive');

      const onEnter = (e: Event) => {
        const el = e.currentTarget as HTMLElement;
        const idx = parseInt(el.getAttribute('data-eq-idx') || '-1', 10);
        if (idx < 0 || idx >= allEqData.length) return;

        const rect = el.getBoundingClientRect();
        setHoverData({ data: allEqData[idx], x: rect.left, y: rect.bottom });
      };

      const onLeave = () => setHoverData(null);

      interactiveEqs.forEach(el => {
        el.addEventListener('mouseenter', onEnter);
        el.addEventListener('mouseleave', onLeave);
      });
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [loading, solutionSection, equationMap, response]);

  // --- Markdown post-processing ---
  function processForMarkdown(text: string): string {
    let r = text;

    // Step headers
    r = r.replace(/\*\*(Step\s*\d+[:\.][^*]*)\*\*/gi, '\n### $1\n');

    // Inline equation upgrader
    r = r.replace(/(?<!\$)\$([^$\n]+)\$(?!\$)\s*([.,;:]?)/g, (match, innerMath) => {
      if (innerMath.includes('=') && !innerMath.match(/\\le|\\ge|\\leq|\\geq|<|>/i)) {
        return `\n\n$$\n${innerMath.trim()}\n$$\n\n`;
      }
      return match;
    });

    // Block math margins (keep each equation separate for hover matching)
    r = r.replace(/\$\$([\s\S]*?)\$\$/g, (m, p1) => {
      const clean = p1.trim().replace(/\n{2,}/g, '\n');
      return `\n\n$$\n${clean}\n$$\n\n`;
    });

    // Clean up excessive newlines
    r = r.replace(/\n{4,}/g, '\n\n\n');

    // AST auto-closer for streaming
    const dd = (r.match(/\$\$/g) || []).length;
    if (dd % 2 !== 0) r += '\n$$';
    else {
      const sd = (r.replace(/\$\$/g, '').match(/\$/g) || []).length;
      if (sd % 2 !== 0) r += '$';
    }

    return r;
  }

  const renderText = solutionSection ? processForMarkdown(solutionSection) : '';
  const hasInteractive = equationMap.size > 0;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8 flex flex-col items-center justify-start py-20 font-sans">
      <div className="w-full max-w-4xl bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-700 p-8">
        <h1 className="text-3xl font-bold mb-4 font-inter tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
          Prompt Engineering UI
        </h1>
        
        <p className="text-slate-400 mb-8 border-b border-slate-700 pb-6">
          Test prompts visually. Backend config: <code className="bg-slate-900 px-2 py-1 rounded text-pink-400 text-sm">app/api/playground/route.ts</code>
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <textarea
            className="w-full p-4 min-h-[160px] bg-slate-900/50 border border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-y text-slate-200 placeholder-slate-500 shadow-inner"
            placeholder="Enter a math or physics problem..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button 
            type="submit" 
            disabled={loading || !prompt.trim()}
            className="self-end px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center min-w-[200px]"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </span>
            ) : "Run Prompt"}
          </button>
        </form>

        {response && (
          <div className="mt-10 flex flex-col gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]"></div>
                <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest">Solution</h2>
                {hasInteractive && (
                  <span className="ml-auto text-[0.6rem] text-emerald-400/70 uppercase tracking-widest font-bold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Hover equations for context
                  </span>
                )}
              </div>

              <style>{`
                .katex-display {
                  font-size: 1.05rem !important;
                  margin-top: 1.25rem !important;
                  margin-bottom: 1.25rem !important;
                  color: #93c5fd;
                  overflow-x: auto;
                }
                .katex-display + .katex-display {
                  margin-top: -0.75rem !important;
                }
                .eq-interactive {
                  cursor: help;
                  border-radius: 8px;
                  padding: 2px 6px;
                  transition: all 0.15s ease;
                  border: 1px solid transparent;
                }
                .eq-interactive:hover {
                  background: rgba(96, 165, 250, 0.06);
                  border-color: rgba(96, 165, 250, 0.15);
                }

                .step-heading-row {
                  display: flex;
                  align-items: center;
                  gap: 8px;
                }
                .step-heading-row h3 {
                  flex: 1;
                  min-width: 0;
                }

                .step-video-btn {
                  flex-shrink: 0;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  width: 30px;
                  height: 30px;
                  border-radius: 8px;
                  border: 1px solid rgba(96, 165, 250, 0.15);
                  background: rgba(96, 165, 250, 0.04);
                  color: rgba(147, 197, 253, 0.45);
                  cursor: pointer;
                  transition: all 0.2s ease;
                  margin-top: 2rem;
                }
                .step-video-btn:hover {
                  border-color: rgba(96, 165, 250, 0.4);
                  background: rgba(96, 165, 250, 0.1);
                  color: #60a5fa;
                  transform: scale(1.08);
                }
                .step-video-btn-active {
                  border-color: rgba(96, 165, 250, 0.5);
                  background: rgba(96, 165, 250, 0.15);
                  color: #60a5fa;
                  box-shadow: 0 0 12px rgba(96, 165, 250, 0.15);
                }

                .step-chat-btn {
                  flex-shrink: 0;
                  display: flex;
                  align-items: center;
                  gap: 5px;
                  padding: 4px 10px;
                  border-radius: 8px;
                  border: 1px solid rgba(139, 92, 246, 0.2);
                  background: rgba(139, 92, 246, 0.06);
                  color: rgba(196, 181, 253, 0.5);
                  cursor: pointer;
                  transition: all 0.2s ease;
                  font-size: 0.65rem;
                  font-weight: 600;
                  letter-spacing: 0.02em;
                  margin-top: 2rem;
                  white-space: nowrap;
                }
                .step-chat-btn:hover {
                  border-color: rgba(139, 92, 246, 0.45);
                  background: rgba(139, 92, 246, 0.12);
                  color: #a78bfa;
                  transform: scale(1.03);
                }
              `}</style>
              
              <div ref={mathContainerRef} className="bg-slate-900 rounded-xl p-8 text-slate-100 border border-slate-700 leading-loose shadow-inner text-lg">
                {!solutionSection ? (
                  <span className="text-slate-500 italic animate-pulse">Waiting for solution...</span>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
                    components={{
                      h3: ({node, children, ...props}) => {
                        // Extract step number from heading text like "Step 1: ..."
                        const text = String(children ?? '');
                        const stepMatch = text.match(/Step\s*(\d+)/i);
                        const stepNum = stepMatch ? parseInt(stepMatch[1], 10) : null;
                        const searchQuery = stepNum !== null ? stepSearchMap.get(stepNum) : undefined;
                        // Fallback: use the step description from the heading itself
                        const fallbackQuery = text.replace(/Step\s*\d+[:.]\s*/i, '').trim();
                        const effectiveQuery = searchQuery || fallbackQuery || null;
                        const isVideoOpen = stepNum !== null && openVideoStep === stepNum;

                        return (
                          <div>
                            <div className="step-heading-row">
                              <h3 className="text-xl font-bold tracking-wide text-blue-400 mt-10 mb-5 pb-1" {...props}>{children}</h3>
                              {stepNum !== null && effectiveQuery && (
                                <button
                                  className={`step-video-btn ${isVideoOpen ? 'step-video-btn-active' : ''}`}
                                  title="Watch related videos"
                                  onClick={() => setOpenVideoStep(isVideoOpen ? null : stepNum)}
                                >
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                  </svg>
                                </button>
                              )}
                              {stepNum !== null && (
                                <button
                                  className="step-chat-btn"
                                  title="Ask about this step"
                                  onClick={() => setOpenChatStep(stepNum)}
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                  </svg>
                                  <span>Didn&apos;t understand?</span>
                                </button>
                              )}
                            </div>
                            {stepNum !== null && effectiveQuery && (
                              <VideoSuggestions
                                searchQuery={effectiveQuery}
                                isOpen={isVideoOpen}
                                onClose={() => setOpenVideoStep(null)}
                              />
                            )}
                          </div>
                        );
                      },
                      p: ({node, ...props}) => (
                        <p className="text-[1.05rem] text-slate-300 leading-relaxed mb-4" {...props} />
                      ),
                    }}
                  >
                    {renderText}
                  </ReactMarkdown>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Raw Output</h2>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-4 whitespace-pre-wrap text-slate-400 border border-slate-800 leading-relaxed max-h-[300px] overflow-y-auto shadow-inner font-mono text-xs">
                {response}
              </div>
            </div>
          </div>
        )}
      </div>

      {hoverData && (
        <EquationTooltip
          data={hoverData.data}
          x={hoverData.x}
          y={hoverData.y}
        />
      )}

      {openChatStep !== null && (
        <StepChat
          stepNumber={openChatStep}
          stepBody={stepBodiesMap.get(openChatStep) || ''}
          solutionSummary={solutionSummary}
          isOpen={true}
          onClose={() => setOpenChatStep(null)}
        />
      )}
    </div>
  );
}
