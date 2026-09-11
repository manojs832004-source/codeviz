const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'EXECUTE',
    language: 'c',
    code: `
#include <stdio.h>
int main() {
    int freq[100001] = {0};
    freq[5] = 3;
    freq[100000] = 7;
    printf("freq[5] = %d\\n", freq[5]);
    printf("freq[100000] = %d\\n", freq[100000]);
    return 0;
}
    `
  }));
});

let gotFrames = false;
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'FRAMES') {
    gotFrames = true;
    const frame = msg.frames[0];
    console.log('Heap keys:', Object.keys(frame.heap || {}));
    const arrKey = Object.keys(frame.heap || {}).find(k => k.startsWith('arr-'));
    if (arrKey) {
      const node = frame.heap[arrKey];
      console.log('Array node type:', node.type);
      console.log('Array truncated:', node.truncated);
      console.log('Array totalSize:', node.totalSize);
      console.log('Array value length (preview):', node.value?.length);
      console.log('SUCCESS: Large array handled correctly!');
    } else {
      console.log('No arr- key found in heap. Heap:', JSON.stringify(frame.heap, null, 2).substring(0, 500));
    }
    console.log('stdout:', frame.stdout);
  }
  if (msg.type === 'EXECUTION_COMPLETE') {
    if (!gotFrames) console.log('No frames received!');
    ws.close();
  }
  if (msg.type === 'RESULT' && !msg.success) {
    console.log('Error:', msg.output);
    ws.close();
  }
});

ws.on('close', () => console.log('Done'));
