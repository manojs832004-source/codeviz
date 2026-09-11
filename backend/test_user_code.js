const JavaAdapter = require('./src/adapters/JavaAdapter');

async function test() {
  const adapter = new JavaAdapter();
  const code = `
public class BubbleSort {
    public static void main(String[] args) {
        int[] array = {64, 34, 25, 12, 22, 11, 90};
        
        for (int i = 0; i < array.length - 1; i++) {
            boolean swapped = false;
            
            for (int j = 0; j < array.length - i - 1; j++) {
                if (array[j] > array[j + 1]) {
                    int temp = array[j];
                    array[j] = array[j + 1];
                    array[j + 1] = temp;
                    swapped = true;
                }
            }
            if (!swapped) {
                break;
            }
        }
    }
}
  `;
  await adapter.prepare(code, '');
  const iterator = adapter.execute({ timeoutMs: 60000 });
  
  try {
    for await (const frame of iterator) {
      if (frame.step === 54 || frame.step === 55) {
        console.log(JSON.stringify(frame, null, 2));
      }
    }
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await adapter.cleanup();
  }
}

test();
