const { exec, spawn } = require('child_process');
const fs = require('fs');

async function test() {
  const code = `
#include <stdio.h>
int main() {
    int arr[] = {29, 10, 14, 37, 13};
    int n = 5;
    for (int i = 0; i < n; i++) {
        int temp = arr[i];
    }
    return 0;
}
  `;
  const CAdapter = require('./src/adapters/CAdapter');
  const adapter = new CAdapter();
  await adapter.prepare(code);
  const iterator = adapter.execute({ maxSteps: 20 });
  try {
    for await (const frame of iterator) {
      console.log(JSON.stringify(frame, null, 2));
    }
  } catch (e) {
    console.error(e);
  } finally {
    await adapter.cleanup();
  }
}
test();
