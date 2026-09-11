import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { code } = await req.json();

    const prompt = `You are a helpful coding tutor. 
Analyze the following code and provide a plain-English explanation of what each line does.
Return a valid JSON object where the keys are line numbers (strings, e.g., "1", "2") and the values are 1-2 sentence explanations.
Do not wrap the JSON in markdown blocks. Return only JSON.

Code:
${code}`;

    const response = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3',
        prompt: prompt,
        stream: false,
        format: 'json'
      }),
    });

    if (!response.ok) {
      throw new Error('Ollama API error');
    }

    const data = await response.json();
    let jsonStr = data.response;
    
    // Try to extract JSON from markdown blocks if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    
    let parsed = {};
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("JSON parse error on string:", jsonStr);
      // Fallback: return empty object if parsing totally fails
    }
    
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Error in /api/analyze-code:", error);
    return NextResponse.json({ error: "Failed to analyze code" }, { status: 500 });
  }
}
