"use client";

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface StepChatProps {
  stepNumber: number;
  stepBody: string;
  solutionSummary: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function StepChat({ stepNumber, stepBody, solutionSummary, isOpen, onClose }: StepChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setInput('');
      setStreaming(false);
    }
  }, [isOpen]);

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || streaming) return;

    const newMessages: ChatMessage[] = [...messages, { role: 'user', text: question }];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);

    try {
      const res = await fetch('/api/playground/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          solutionSummary,
          stepBody,
          stepNumber,
          history: messages, // prior turns
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessages([...newMessages, { role: 'model', text: `Error: ${err.error || 'Failed to get response'}` }]);
        setStreaming(false);
        return;
      }

      if (!res.body) {
        setMessages([...newMessages, { role: 'model', text: 'Error: Streaming not supported.' }]);
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let modelText = '';

      // Add an empty model message that we'll stream into
      setMessages([...newMessages, { role: 'model', text: '' }]);

      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          modelText += decoder.decode(value, { stream: true });
          setMessages([...newMessages, { role: 'model', text: modelText }]);
        }
      }
    } catch (err: any) {
      setMessages([...newMessages, { role: 'model', text: `Error: ${err.message}` }]);
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="step-chat-overlay" onClick={onClose}>
      <div className="step-chat-popup" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="step-chat-header">
          <div className="step-chat-header-left">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>Ask about Step {stepNumber}</span>
          </div>
          <button onClick={onClose} className="step-chat-close" title="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="step-chat-messages">
          {messages.length === 0 && (
            <div className="step-chat-empty">
              <p>Ask anything about <strong>Step {stepNumber}</strong>.</p>
              <div className="step-chat-suggestions">
                <button onClick={() => { setInput("Why do we use this formula?"); }}>Why this formula?</button>
                <button onClick={() => { setInput("Explain this step simply"); }}>Explain simply</button>
                <button onClick={() => { setInput("What concept is this based on?"); }}>What concept?</button>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`step-chat-msg step-chat-msg-${msg.role}`}>
              {msg.role === 'model' ? (
                <div className="step-chat-msg-content">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
                  >
                    {msg.text || (streaming && i === messages.length - 1 ? '...' : '')}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="step-chat-msg-content">{msg.text}</div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="step-chat-input-area">
          <input
            ref={inputRef}
            type="text"
            placeholder="Ask a question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming}
            className="step-chat-input"
          />
          <button
            onClick={sendMessage}
            disabled={streaming || !input.trim()}
            className="step-chat-send"
          >
            {streaming ? (
              <div className="step-chat-spinner" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <style>{`
        .step-chat-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          animation: chatOverlayIn 0.2s ease;
        }

        @keyframes chatOverlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .step-chat-popup {
          width: 480px;
          max-width: 92vw;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          background: #0f172a;
          border: 1px solid rgba(96, 165, 250, 0.15);
          border-radius: 16px;
          box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6), 0 0 40px rgba(96, 165, 250, 0.05);
          animation: chatPopupIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }

        @keyframes chatPopupIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        .step-chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          border-bottom: 1px solid rgba(96, 165, 250, 0.08);
          background: rgba(30, 41, 59, 0.6);
        }

        .step-chat-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8rem;
          font-weight: 700;
          color: rgba(147, 197, 253, 0.85);
        }

        .step-chat-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: rgba(148, 163, 184, 0.5);
          cursor: pointer;
          transition: all 0.15s;
        }
        .step-chat-close:hover {
          background: rgba(239, 68, 68, 0.12);
          color: #f87171;
        }

        .step-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 200px;
          max-height: 50vh;
        }

        .step-chat-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 32px 16px;
          text-align: center;
          color: rgba(148, 163, 184, 0.5);
          font-size: 0.85rem;
        }
        .step-chat-empty strong {
          color: rgba(147, 197, 253, 0.7);
        }

        .step-chat-suggestions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          justify-content: center;
        }
        .step-chat-suggestions button {
          padding: 5px 12px;
          font-size: 0.7rem;
          border-radius: 20px;
          border: 1px solid rgba(96, 165, 250, 0.15);
          background: rgba(96, 165, 250, 0.05);
          color: rgba(147, 197, 253, 0.6);
          cursor: pointer;
          transition: all 0.15s;
        }
        .step-chat-suggestions button:hover {
          border-color: rgba(96, 165, 250, 0.35);
          color: #60a5fa;
          background: rgba(96, 165, 250, 0.1);
        }

        .step-chat-msg {
          display: flex;
        }

        .step-chat-msg-user {
          justify-content: flex-end;
        }
        .step-chat-msg-user .step-chat-msg-content {
          background: rgba(96, 165, 250, 0.15);
          border: 1px solid rgba(96, 165, 250, 0.2);
          color: #bfdbfe;
          border-radius: 14px 14px 4px 14px;
          padding: 8px 14px;
          font-size: 0.82rem;
          max-width: 85%;
        }

        .step-chat-msg-model {
          justify-content: flex-start;
        }
        .step-chat-msg-model .step-chat-msg-content {
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(51, 65, 85, 0.5);
          color: #cbd5e1;
          border-radius: 14px 14px 14px 4px;
          padding: 10px 14px;
          font-size: 0.82rem;
          max-width: 90%;
          line-height: 1.6;
        }

        .step-chat-msg-model .step-chat-msg-content p {
          margin: 0 0 8px;
        }
        .step-chat-msg-model .step-chat-msg-content p:last-child {
          margin-bottom: 0;
        }

        .step-chat-msg-model .katex-display {
          font-size: 0.9rem !important;
          margin: 8px 0 !important;
          color: #93c5fd;
        }

        .step-chat-input-area {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 14px 14px;
          border-top: 1px solid rgba(51, 65, 85, 0.4);
          background: rgba(15, 23, 42, 0.8);
        }

        .step-chat-input {
          flex: 1;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid rgba(51, 65, 85, 0.5);
          background: rgba(30, 41, 59, 0.6);
          color: #e2e8f0;
          font-size: 0.82rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .step-chat-input:focus {
          border-color: rgba(96, 165, 250, 0.4);
        }
        .step-chat-input::placeholder {
          color: rgba(148, 163, 184, 0.35);
        }
        .step-chat-input:disabled {
          opacity: 0.5;
        }

        .step-chat-send {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: none;
          background: rgba(96, 165, 250, 0.15);
          color: #60a5fa;
          cursor: pointer;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .step-chat-send:hover:not(:disabled) {
          background: rgba(96, 165, 250, 0.25);
          color: #93c5fd;
        }
        .step-chat-send:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .step-chat-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(96, 165, 250, 0.15);
          border-top-color: #60a5fa;
          border-radius: 50%;
          animation: chatSpin 0.6s linear infinite;
        }

        @keyframes chatSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
