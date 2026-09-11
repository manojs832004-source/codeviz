const JavaAdapter = require('./src/adapters/JavaAdapter');
const fs = require('fs');

const code2 = `
import java.util.Arrays;
public class Main {
    public static void main(String[] args) {
        int[] numbers = {12, 45, 7, 12, 89, 23, 45, 56, 7};
        int[] uniqueNumbers = Arrays.stream(numbers).distinct().toArray();
        System.out.println("Original array: " + Arrays.toString(numbers));
        System.out.println("Without duplicates: " + Arrays.toString(uniqueNumbers));
    }
}
`;

(async () => {
  const adapter2 = new JavaAdapter();
  await adapter2.prepare(code2, '');
  
  try {
    const gen = adapter2.execute({ timeoutMs: 30000 });
    let c = 0; 
    for await (const f of gen) {
      c++;
      console.log('Frame', c, f.stdout);
    }
    console.log('Alg 2 frames:', c);
  } catch(e) { console.log('Alg 2 error:', e.message); }
})();
