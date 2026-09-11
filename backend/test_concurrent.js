const JavaAdapter = require('./src/adapters/JavaAdapter');
const fs = require('fs');

const code1 = `
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;
public class Main {
    public static void main(String[] args) {
        Integer[] numbers = {12, 45, 7, 12, 89, 23, 45, 56, 7};
        Set<Integer> uniqueSet = new LinkedHashSet<>(Arrays.asList(numbers));
        Integer[] uniqueNumbers = uniqueSet.toArray(new Integer[0]);
    }
}
`;

const code2 = `
import java.util.Arrays;
public class Main {
    public static void main(String[] args) {
        int[] numbers = {12, 45, 7, 12, 89, 23, 45, 56, 7};
        int[] uniqueNumbers = Arrays.stream(numbers).distinct().toArray();
    }
}
`;

(async () => {
  const adapter1 = new JavaAdapter();
  const adapter2 = new JavaAdapter();
  
  await adapter1.prepare(code1, '');
  await adapter2.prepare(code2, '');
  
  const p1 = (async () => {
    try {
      const gen = adapter1.execute({ timeoutMs: 30000 });
      let c = 0; for await (const f of gen) c++;
      console.log('Alg 1 frames:', c);
    } catch(e) { console.log('Alg 1 error:', e.message); }
  })();
  
  const p2 = (async () => {
    try {
      const gen = adapter2.execute({ timeoutMs: 30000 });
      let c = 0; for await (const f of gen) c++;
      console.log('Alg 2 frames:', c);
    } catch(e) { console.log('Alg 2 error:', e.message); }
  })();
  
  await Promise.all([p1, p2]);
})();
