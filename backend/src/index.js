const WebSocket = require('ws');
const { handleConnection } = require('./websocket/handler');

const PORT = process.env.PORT || 8080;

const wss = new WebSocket.Server({ port: PORT, host: '0.0.0.0' }, () => {
  console.log(`WebSocket server is listening on 0.0.0.0:${PORT}`);
});

wss.on('connection', handleConnection);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Closing WebSocket server...');
  wss.close(() => {
    process.exit(0);
  });
});