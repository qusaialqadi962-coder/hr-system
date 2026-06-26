import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { initDb } from './db/index.js';
import { authMiddleware } from './auth/middleware.js';
import { createAuthRouter } from './routes/auth.js';
import { createSyncRouter } from './routes/sync.js';
import { createUsersRouter } from './routes/users.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const auth = authMiddleware(config.jwtSecret);

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    const repo = await initDb();
    const driver =
      repo.saveAllForRole ? 'json' : config.dbDriver === 'mssql' ? 'mssql' : 'postgres';
    res.json({
      ok: true,
      version: 2,
      service: 'afaq-hr-inventory-api',
      database: driver,
      features: ['auth', 'sync', 'users', 'roles'],
    });
  } catch (e) {
    res.status(503).json({
      ok: false,
      version: 2,
      service: 'afaq-hr-inventory-api',
      message: e.message,
    });
  }
});

app.use('/api/auth', createAuthRouter());
app.use('/api/sync', createSyncRouter(auth));
app.use('/api/users', createUsersRouter(auth));
app.use(express.static(path.join(__dirname, '..')));

async function start() {
  try {
    await initDb();
    const driver = config.dbDriver === 'json' ? 'json' : config.dbDriver;
    app.listen(config.port, () => {
      console.log(`Afaq API v2 running on http://localhost:${config.port}`);
      console.log(`Database: ${driver} (auto-fallback to json if SQL unavailable)`);
      console.log('Users: admin, hr, warehouse, accountant, viewer — password: 1234');
    });
  } catch (e) {
    console.error('Failed to start API:', e.message || e);
    if (config.dbDriver === 'postgres') {
      console.error('');
      console.error('PostgreSQL is required. Options:');
      console.error('  1) docker compose up -d   (inside api folder)');
      console.error('  2) Install PostgreSQL and set DATABASE_URL in api/.env');
      console.error(`  Current DATABASE_URL: ${config.databaseUrl}`);
    }
    if (config.dbDriver === 'mssql') {
      console.error('');
      console.error('Set MSSQL_* variables in api/.env for SQL Server connection.');
    }
    process.exit(1);
  }
}

start();
