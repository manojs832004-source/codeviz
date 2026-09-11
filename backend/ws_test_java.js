const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'EXECUTE',
    language: 'java',
    code: `import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        String name = scanner.nextLine();
        System.out.println("Hello, " + name + "!");
    }
}`,
    stdin: `AlgoViz\n`
  }));
});
ws.on('message', (data) => console.log('Received:', data.toString()));
ws.on('close', () => console.log('Disconnected'));
