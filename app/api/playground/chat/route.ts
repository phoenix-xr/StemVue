import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/**
 * POST /api/playground/chat
 * 
 * Body: {
 *   question: string,        // the user's follow-up question
 *   solutionSummary: string,  // the solution roadmap
 *   stepBody: string,         // the full body of the step they're stuck on
 *   stepNumber: number,       // which step
 *   history: Array<{ role: 'user'|'model', text: string }>  // prior turns
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { question, solutionSummary, stepBody, stepNumber, history } = await req.json();

    if (!question?.trim()) {
      return NextResponse.json({ error: 'No question provided' }, { status: 400 });
    }

    const systemInstruction = `You are a patient, encouraging math/physics tutor helping a student who is stuck on a specific step in a solution.

CONTEXT YOU HAVE:
- The overall solution summary (roadmap) of the problem
- The specific step the student is confused about, including all equations and explanations

YOUR BEHAVIOR:
- Answer the student's question about this step clearly and concisely.
- Use LaTeX ($$ ... $$) for any math you write.
- Keep answers focused — don't re-derive the entire solution, just clarify the part they're confused about.`;

    // Build history for multi-turn chat
    const chatHistory = (history || []).map((h: { role: string; text: string }) => ({
      role: h.role as 'user' | 'model',
      parts: [{ text: h.text }],
    }));

    // Create a chat session with context baked into the first user message
    const contextPrefix = stepNumber
      ? `[CONTEXT — Solution Summary]\n${solutionSummary || 'Not available'}\n\n[CONTEXT — Step ${stepNumber} Content]\n${stepBody || 'Not available'}\n\n`
      : '';

    const chat = ai.chats.create({
      model: 'gemma-4-31b-it',
      config: {
        systemInstruction,
        temperature: 0.4,
      },
      history: chatHistory.length > 0 ? chatHistory : [
        {
          role: 'user' as const,
          parts: [{ text: `${contextPrefix}I'm studying this problem and I'm on Step ${stepNumber || '?'}. I'll ask you questions about it.` }],
        },
        {
          role: 'model' as const,
          parts: [{ text: `Sure! I can see Step ${stepNumber || '?'} and the overall solution. What part are you confused about? Feel free to ask anything.` }],
        },
      ],
    });

    // Stream the response
    const responseStream = await chat.sendMessageStream({
      message: chatHistory.length > 0 ? question : `${contextPrefix}${question}`,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of responseStream) {
            const text = chunk.text;
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (e: any) {
          console.error('[Chat Stream Error]', e.message);
          controller.error(e);
        }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error: any) {
    console.error('[Playground Chat Error]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
