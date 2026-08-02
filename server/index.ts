import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { runtimeRouter } from './routes/runtime.js';
import { eventStreamRouter } from './routes/events.js';
import { workspaceRouter } from './routes/workspace.js';
import { diagnosticsRouter } from './routes/diagnostics.js';
import { shutdownAdapter } from './runtime/OpenClawAdapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// API routes
app.use('/api/runtime', runtimeRouter);
app.use('/api/runtime', eventStreamRouter);
app.use('/api/runtime', workspaceRouter);
app.use('/api/runtime', diagnosticsRouter);

// Serve frontend in production
const isProd = process.env.NODE_ENV === 'production';
if (isProd) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  
  app.get('{*splat}', (req, res) => {
    if (req.path.startsWith('/api/')) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    // Don't serve index.html for missing asset requests — return 404 instead
    if (path.extname(req.path)) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Graceful shutdown — close GatewayClient WebSocket
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n[${signal}] Shutting down…`);
  server.close();
  await shutdownAdapter();
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
