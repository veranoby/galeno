import { Server } from 'http';
import app from '../src/index.js';

let server: Server | null = null;
let testPort: number = 0;

export async function startTestServer(port?: number): Promise<Server> {
  if (server) {
    return server;
  }

  return new Promise((resolve, reject) => {
    testPort = port || 0; // 0 = puerto aleatorio disponible
    server = app.listen(testPort, () => {
      const address = server?.address();
      if (address && typeof address === 'object') {
        testPort = address.port;
      }
      resolve(server!);
    });
    server.on('error', reject);
  });
}

export async function stopTestServer(): Promise<void> {
  if (!server) return;

  return new Promise((resolve) => {
    server!.close(() => {
      server = null;
      resolve();
    });
  });
}

export function getTestServerUrl(): string {
  return `http://localhost:${testPort}`;
}

export function getTestPort(): number {
  return testPort;
}
