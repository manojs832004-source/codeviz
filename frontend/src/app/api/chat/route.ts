import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const customOllama = createOpenAI({
  baseURL: 'http://127.0.0.1:11434/v1',
  apiKey: 'ollama',
});

export async function POST(req: Request) {
  try {
    const { messages, data } = await req.json();

    let systemPrompt = `You are a helpful, encouraging, and brilliant AI coding tutor built into the AlgoViz platform.
Your goal is to help students understand exactly how their code is executing in memory.
When answering, keep your responses concise, focused on the current step, and easy to understand for beginners. Don't write full code rewrites unless asked.
CRITICAL INSTRUCTION: You MUST ONLY answer questions related to programming, algorithms, data structures, or the specific code being visualized. If the user asks a question about any other topic (e.g., general knowledge, politics, history, or random questions like "what is quantum ai"), you must politely refuse to answer and redirect them back to the code.`;

    if (data && data.context) {
      const numberedCode = data.context.code 
        ? data.context.code.split('\n').map((line: string, i: number) => `${i + 1}: ${line}`).join('\n')
        : '';

      systemPrompt += `\n\n[SYSTEM CONTEXT - DO NOT SHOW TO USER]
The user is currently on execution step ${data.context.step ?? '?'} looking at this exact state in the visualizer:
- Step Number: ${data.context.step ?? 'unknown'}
- Line Number: ${data.context.line}
- Code on this line: ${data.context.currentLine}
- Local Variables: ${JSON.stringify(data.context.vars)}
- Array Data: ${JSON.stringify(data.context.arrays)}
${data.context.explanation ? `- What's happening: ${data.context.explanation}` : ''}
${numberedCode ? `\nHere is the complete source code being visualized, with line numbers included for your reference:\n\`\`\`\n${numberedCode}\n\`\`\`\n` : ''}
Use this context to inform your answers. If they ask "what is happening here?", explain the logic of this specific line based on these variable values. If they ask about other specific lines, reference the complete source code provided and match the line numbers exactly. Always refer to the specific line and variable values.`;
    }

    const coreMessages = messages.map((m: any) => ({
      role: m.role,
      content: m.content,
    }));

    const result = await streamText({
      model: customOllama('qwen2.5-coder:7b'),
      system: systemPrompt,
      messages: coreMessages,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Error in /api/chat:", error);
    return new Response(JSON.stringify({ error: "Failed to generate chat response" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
