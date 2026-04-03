/**
 * Blocks until the Vitals API accepts TCP on the configured port (same rules as vite.config proxy).
 */
import dotenv from "dotenv";
import { createConnection } from "node:net";
import { resolve } from "node:path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

const port = Number(process.env.VITE_DEV_API_PORT || process.env.PORT || 4000);
const host = "127.0.0.1";
const timeoutMs = 90_000;
const pollMs = 200;

function waitForListen() {
  const started = Date.now();
  return new Promise((resolvePromise, reject) => {
    const attempt = () => {
      const socket = createConnection({ port, host }, () => {
        socket.end();
        resolvePromise();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timed out waiting for API at http://${host}:${port} (${timeoutMs}ms)`));
        } else {
          setTimeout(attempt, pollMs);
        }
      });
    };
    attempt();
  });
}

await waitForListen();
