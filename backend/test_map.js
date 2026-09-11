const runner = require('./src/docker/runner');

const code = `
import java.util.HashMap;
import java.util.Map;

public class Main {
    public static void main(String[] args) {
        Map<Integer, Integer> numMap = new HashMap<>();
        numMap.put(2, 0);
        numMap.put(7, 1);
        int target = 9;
    }
}`;

runner.executeJavaCode(code).then(res => {
    console.log(res.output);
});
