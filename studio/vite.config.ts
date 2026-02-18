import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

function workspacePlugin(workspace: string): Plugin {
  return {
    name: 'clawstudio-workspace',
    configureServer(server) {
      server.middlewares.use('/api/workspace', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ workspace }));
      });

      server.middlewares.use('/api/assets/import', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        if (!workspace) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Workspace is not configured' }));
          return;
        }

        const chunks: Buffer[] = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
          try {
            const body = Buffer.concat(chunks);
            const marker = req.headers['content-type']?.match(/boundary=(.+)$/)?.[1];
            if (!marker) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid multipart form data' }));
              return;
            }

            const boundary = `--${marker}`;
            const content = body.toString('binary');
            const parts = content.split(boundary).filter(part => part.includes('filename='));
            const saved: Array<{ name: string; path: string }> = [];
            const assetDir = path.join(workspace, 'assets');
            if (!fs.existsSync(assetDir)) fs.mkdirSync(assetDir, { recursive: true });

            for (const part of parts) {
              const nameMatch = part.match(/filename="([^"]+)"/);
              if (!nameMatch) continue;
              const filename = path.basename(nameMatch[1]);
              const splitIndex = part.indexOf('\r\n\r\n');
              if (splitIndex < 0) continue;

              const fileBinary = part.slice(splitIndex + 4, part.lastIndexOf('\r\n'));
              const buffer = Buffer.from(fileBinary, 'binary');
              const outputPath = path.join(assetDir, filename);
              fs.writeFileSync(outputPath, buffer);
              saved.push({ name: filename, path: outputPath });
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ saved }));
          } catch (error: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: error.message }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const workspace = env.CLAWMOTION_WORKSPACE || '';

  return {
    plugins: [react(), tailwindcss(), workspacePlugin(workspace)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@types': path.resolve(__dirname, './src/types'),
        '@core': path.resolve(__dirname, './src/core'),
        '@client': path.resolve(__dirname, './src/client'),
      },
    },
    server: {
      port: 5173,
      fs: {
        allow: ['..'],
      },
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
  };
});
