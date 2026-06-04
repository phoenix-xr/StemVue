"use client";

import React from 'react';
import type { EquationData } from './traceParser';

interface EquationTooltipProps {
  data: EquationData;
  x: number;
  y: number;
}

export default function EquationTooltip({ data, x, y }: EquationTooltipProps) {
  return (
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{
        left: `${Math.min(x, typeof window !== 'undefined' ? window.innerWidth - 370 : x)}px`,
        top: `${y + 8}px`,
        maxWidth: '340px',
      }}
    >
      <div className="bg-slate-800/95 backdrop-blur-xl border border-slate-600/50 rounded-xl shadow-2xl shadow-black/40 px-4 py-3">
        <p className="text-[0.8rem] text-slate-200 leading-relaxed">
          {data.hover_text}
        </p>
      </div>
    </div>
  );
}
