import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { createServer as createViteServer } from 'vite';
import {
  getHealthInfo,
  handleApiWithSync,
  initEngine,
  resolvePhotoPath,
} from './src/server/workshopEngine.ts';

async function startServer() {
  await initEngine();

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '30mb' }));

  app.post('/api', async (req, res) => {
    const result = await handleApiWithSync(req.body);
    res.setHeader('Cache-Control', 'no-store');
    res.json(result);
  });

  app.get('/photo/:id', async (req, res) => {
    const photoPath = await resolvePhotoPath(req.params.id);
    if (!photoPath) {
      res.status(404).type('text/plain').send('Not found');
      return;
    }
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.sendFile(photoPath);
  });

  app.get('/healthz', (_req, res) => {
    res.json(getHealthInfo());
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Not built');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Workshop Operational Control listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
