import { config } from '../config.js';

let repo;

async function loadDriver(name) {
  if (name === 'mssql') return import('./mssql.js');
  if (name === 'postgres') return import('./postgres.js');
  return import('./json.js');
}

export async function initDb() {
  if (repo) return repo;

  const driver = config.dbDriver;

  if (driver === 'json') {
    repo = await loadDriver('json');
    await repo.init();
    return repo;
  }

  try {
    repo = await loadDriver(driver);
    await repo.init();
    return repo;
  } catch (e) {
    if (config.isProduction) {
      throw new Error(`Database unavailable in production (${e.message})`);
    }
    console.warn(`[db] ${driver} unavailable (${e.message}) — using JSON storage`);
    repo = await loadDriver('json');
    await repo.init();
    return repo;
  }
}

export async function getRepo() {
  if (!repo) await initDb();
  return repo;
}
