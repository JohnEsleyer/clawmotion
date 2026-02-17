import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
interface ExportRequest {
  config: { width: number; height: number; fps: number; duration: number; concurrency?: number };
  clips: any[];
  blueprints: Record<string, string>;
  images?: Record<string, string>;
  output?: string;
}

type ExportJob = {
  id: string;
  progress: number;
  status: 'running' | 'done' | 'error';
  phase: 'preparing' | 'rendering' | 'stitching' | 'done';
  completedFrames: number;
  totalFrames: number;
  outputPath: string;
  error?: string;
};

function workspacePlugin(workspace: string): Plugin {
  const exportJobs = new Map<string, ExportJob>();

  return {
    name: 'clawstudio-workspace',
    configureServer(server) {
      server.middlewares.use('/api/workspace', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ workspace }));
      });

      server.middlewares.use('/assets', (req, res, next) => {
        if (!workspace) return next();
        const requestPath = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '');
        const assetPath = path.resolve(workspace, 'assets', requestPath);
        const assetRoot = path.resolve(workspace, 'assets');

        if (!assetPath.startsWith(assetRoot)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }

        if (!fs.existsSync(assetPath) || fs.statSync(assetPath).isDirectory()) {
          return next();
        }

        fs.createReadStream(assetPath)
          .on('error', () => {
            res.statusCode = 500;
            res.end('Failed to read asset');
          })
          .pipe(res);
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
            const saved: Array<{ name: string; path: string; publicPath: string }> = [];
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
              saved.push({ name: filename, path: outputPath, publicPath: `/assets/${filename}` });
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ saved }));
          } catch (error: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: error.message }));
          }
        });
      });

      server.middlewares.use('/api/export/download', (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        const url = new URL(req.url || '', 'http://localhost');
        const id = url.searchParams.get('id');
        if (!id || !exportJobs.has(id)) {
          res.statusCode = 404;
          res.end('Export job not found');
          return;
        }

        const job = exportJobs.get(id)!;
        if (job.status !== 'done' || !fs.existsSync(job.outputPath)) {
          res.statusCode = 409;
          res.end('Export is not ready');
          return;
        }

        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(job.outputPath)}"`);
        fs.createReadStream(job.outputPath)
          .on('error', () => {
            res.statusCode = 500;
            res.end('Failed to read exported video');
          })
          .pipe(res);
      });

      server.middlewares.use('/api/export', async (req, res) => {
        if (req.method === 'GET') {
          const url = new URL(req.url || '', 'http://localhost');
          const id = url.searchParams.get('id');
          if (!id || !exportJobs.has(id)) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Export job not found' }));
            return;
          }
          const job = exportJobs.get(id)!;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(job));
          return;
        }

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        const bodyChunks: Buffer[] = [];
        req.on('data', chunk => bodyChunks.push(chunk));
        req.on('end', async () => {
          try {
            const payload = JSON.parse(Buffer.concat(bodyChunks).toString('utf-8')) as ExportRequest;
            const totalTicks = Math.max(1, Math.round(payload.config.duration * payload.config.fps));
            const outputPath = payload.output?.trim()
              ? path.resolve(workspace || process.cwd(), payload.output)
              : path.resolve(workspace || process.cwd(), `clawmotion-export-${Date.now()}.mp4`);

            const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            exportJobs.set(jobId, {
              id: jobId,
              progress: 1,
              status: 'running',
              phase: 'preparing',
              completedFrames: 0,
              totalFrames: totalTicks,
              outputPath,
            });

            const tempEntryPath = path.join(process.cwd(), `.claw-studio-entry-${jobId}.ts`);
            const playerPath = path.resolve(__dirname, '../src/client/Player');
            const assetLoaderPath = path.resolve(__dirname, '../src/client/AssetLoader');
            const enginePath = path.resolve(__dirname, '../src/core/Engine');
            const mathPath = path.resolve(__dirname, '../src/core/Math');
            const blueprintEntries = Object.entries(payload.blueprints || {})
              .map(([name, source]) => `'${name.replace(/'/g, "\\'")}': (${source})`)
              .join(',\n');
            const entryContent = `
import { ClawPlayer } from ${JSON.stringify(playerPath)};
import { AssetLoader } from ${JSON.stringify(assetLoaderPath)};
import { ClawEngine } from ${JSON.stringify(enginePath)};
import { ClawMath } from ${JSON.stringify(mathPath)};

(window as any).ClawPlayer = ClawPlayer;
(window as any).ClawEngine = ClawEngine;
(window as any).ClawMath = ClawMath;
(window as any).AssetLoader = AssetLoader;
(window as any).PredefinedBlueprints = {
${blueprintEntries}
};
`;
            fs.writeFileSync(tempEntryPath, entryContent);

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ jobId }));

            const factoryModulePath = fs.existsSync(path.resolve(__dirname, '../dist/server/Factory.js'))
              ? path.resolve(__dirname, '../dist/server/Factory.js')
              : path.resolve(__dirname, '../src/server/Factory.ts');
            const factoryModule = await import(pathToFileURL(factoryModulePath).href);
            const factory = new factoryModule.MotionFactory();
            try {
              await factory.render(payload.config, payload.clips, outputPath, undefined, payload.images, tempEntryPath, (progressUpdate: any) => {
                const job = exportJobs.get(jobId);
                if (!job) return;
                job.phase = progressUpdate.phase;
                job.completedFrames = progressUpdate.completedFrames;
                job.totalFrames = progressUpdate.totalFrames;
                job.progress = progressUpdate.percent;
              });
              const job = exportJobs.get(jobId);
              if (job) {
                job.progress = 100;
                job.phase = 'done';
                job.status = 'done';
              }
            } catch (error: any) {
              const job = exportJobs.get(jobId);
              if (job) {
                job.status = 'error';
                job.phase = 'done';
                job.error = error?.message || String(error);
              }
            } finally {
              if (fs.existsSync(tempEntryPath)) fs.unlinkSync(tempEntryPath);
            }
          } catch (error: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: error?.message || 'Failed to start export' }));
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
        '@core': path.resolve(__dirname, '../src/core'),
        '@client': path.resolve(__dirname, '../src/client'),
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
