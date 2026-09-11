const JavaAdapter = require('./src/adapters/JavaAdapter');

async function test() {
  const adapter = new JavaAdapter();
  const code = `
public class RemoveDuplicatesSorted {
    public static void main(String[] args) {
        int[] nums = {1, 1, 2, 2, 3, 4, 4, 5};
        
        int index = 1;
        for (int i = 1; i < nums.length; i++) {
            if (nums[i] != nums[i - 1]) {
                nums[index] = nums[i];
                index++;
            }
        }
        
        for (int i = 0; i < index; i++) {
            System.out.print(nums[i] + " ");
        }
        System.out.println();
    }
}
  `;
  await adapter.prepare(code, '');
  const iterator = adapter.execute({ timeoutMs: 10000 });
  
  try {
    for await (const frame of iterator) {
      if (frame.step === 10 || frame.step === 11) {
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
