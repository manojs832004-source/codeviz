import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { NextRequest } from 'next/server';

const customOllama = createOpenAI({
  baseURL: 'http://127.0.0.1:11434/v1',
  apiKey: 'ollama',
});

export async function POST(req: NextRequest) {
  try {
    const { context } = await req.json();

    const fullPrompt = `You are a helpful AI tutor for an algorithm visualizer.
Your goal is to explain exactly what is happening in the current line of code, specifically focusing on memory and variables.
Do not use markdown.

Here is the current state of the execution:
Line of code: ${context?.currentLine}
Variables: ${JSON.stringify(context?.vars)}
Array/Heap state: ${JSON.stringify(context?.arrays)}

Instructions:
1. ONLY explain the provided current line of code and the current visual memory state. Do NOT explain future or unrelated concepts.
2. If the line is an import/include statement or a class definition, explain where it comes from (e.g., standard library) and why it is used in this language.
3. For regular lines, follow this exact format: "[Variable] is [action]. [Memory state]."
4. Keep the explanation extremely short (under 20 words). Be direct, no filler words, no greetings, no markdown.`;

    const result = await streamText({
      model: customOllama('qwen2.5-coder:7b'),
      prompt: fullPrompt,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Error in /api/explain:", error);
    return new Response(JSON.stringify({ error: "Failed to generate explanation" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
