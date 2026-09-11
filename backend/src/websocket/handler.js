// Language Adapters handle execution

function handleConnection(ws) {
  console.log('Client connected');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'EXECUTE' && data.language) {
        console.log('Received code for execution:', data.language);
        
        let adapter;
        if (data.language === 'java') {
          const JavaAdapter = require('../adapters/JavaAdapter');
          adapter = new JavaAdapter();
        } else if (data.language === 'python') {
          const PythonAdapter = require('../adapters/PythonAdapter');
          adapter = new PythonAdapter();
        } else if (data.language === 'c') {
          const CAdapter = require('../adapters/CAdapter');
          adapter = new CAdapter();
        } else {
          ws.send(JSON.stringify({ type: 'ERROR', message: `Language ${data.language} not currently supported` }));
          return;
        }

        // Notify client that execution has started
        ws.send(JSON.stringify({ type: 'STATUS', status: 'running' }));
        
        // Execute the code using the adapter
        try {
          await adapter.prepare(data.code, data.stdin || '');
          const generator = adapter.execute({ timeoutMs: 25000, maxSteps: 500 });
          
          // Collect UMS frames
          const frames = [];
          for await (const frame of generator) {
            frames.push(frame);
          }
          
          // Synthesize frames for early lines (imports, class declarations) that debuggers skip
          if (frames.length > 0 && frames[0].line > 1) {
            const firstLine = frames[0].line;
            const codeLines = data.code.split('\n');
            const syntheticFrames = [];
            
            for (let i = 1; i < firstLine; i++) {
              const lineContent = codeLines[i - 1]?.trim() || '';
              // Only synthesize for lines that look like actual code, not empty or purely comments
              if (lineContent !== '' && !lineContent.startsWith('//') && !lineContent.startsWith('/*') && !lineContent.startsWith('*')) {
                syntheticFrames.push({
                  line: i,
                  stack: [],
                  heap: {},
                  variables: {},
                  actionExplanation: 'Loading declaration into memory...'
                });
              }
            }
            frames.unshift(...syntheticFrames);
          }
          
          ws.send(JSON.stringify({ 
            type: 'RESULT', 
            success: true, 
            output: 'Execution complete',
            frames: frames 
          }));
        } catch (execError) {
          ws.send(JSON.stringify({ type: 'RESULT', success: false, output: execError.message }));
        } finally {
          await adapter.cleanup();
        }
      } else {
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Unsupported operation' }));
      }
    } catch (err) {
      console.error('Error parsing message:', err);
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid payload format' }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
}

module.exports = {
  handleConnection
};
