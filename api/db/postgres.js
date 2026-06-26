import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import {
  mapDbFromRows,
  persistDb,
  seedBusinessData,
  seedUsers,
  importJsonIfExists,
  readSchema,
} from './shared.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pool = new pg.Pool({ connectionString: config.databaseUrl });

async function query(text, params = []) {
  return pool.query(text, params);
}

async function runSchema() {
  const sql = readSchema('postgres');
  await query(sql);
}

async function loadRows() {
  const [company, seq, settings, employees, htrans, vacations, products, moves] =
    await Promise.all([
      query('SELECT * FROM company WHERE id=1'),
      query('SELECT * FROM app_seq WHERE id=1'),
      query('SELECT * FROM app_settings WHERE id=1'),
      query('SELECT * FROM employees ORDER BY id'),
      query('SELECT * FROM htrans ORDER BY id'),
      query('SELECT * FROM vacations ORDER BY id'),
      query('SELECT * FROM products ORDER BY id'),
      query('SELECT * FROM moves ORDER BY id'),
    ]);

  const rawTerms = settings.rows[0]?.quote_default_terms;
  let quoteTerms = [];
  if (rawTerms) {
    quoteTerms = typeof rawTerms === 'string' ? JSON.parse(rawTerms) : rawTerms;
  }

  return mapDbFromRows({
    companyRow: company.rows[0],
    seqRow: seq.rows[0],
    settingsRow: { quote_default_terms: quoteTerms },
    employees: employees.rows,
    htrans: htrans.rows,
    vacations: vacations.rows,
    products: products.rows,
    moves: moves.rows,
  });
}

export async function init() {
  await runSchema();
  try {
    await query('ALTER TABLE app_seq ADD COLUMN IF NOT EXISTS quote INT NOT NULL DEFAULT 78');
  } catch {
    /* ignore for fresh schema */
  }
  await seedUsers(pool, query);

  const { rows } = await query('SELECT COUNT(*)::int AS c FROM employees');
  if (rows[0].c === 0) {
    const imported = await importJsonIfExists(
      pool,
      query,
      path.join(__dirname, '..', 'data', 'db.json')
    );
    if (!imported) await seedBusinessData(pool, query);
  }
}

export async function loadAll() {
  return loadRows();
}

export async function saveAll(db) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await persistDb(client, db, (sql, params) => client.query(sql, params));
    await client.query('COMMIT');
    return loadRows();
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function findUserByUsername(username) {
  const { rows } = await query(
    'SELECT id, username, password_hash, display_name, role, active FROM users WHERE username=$1',
    [username]
  );
  return rows[0] || null;
}

export async function verifyUser(username, password) {
  const user = await findUserByUsername(username);
  if (!user || !user.active) return null;
  if (!bcrypt.compareSync(password, user.password_hash)) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
  };
}

export async function listUsers() {
  const { rows } = await query(
    'SELECT id, username, display_name, role, active, created_at FROM users ORDER BY id'
  );
  return rows.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    role: u.role,
    active: u.active,
    createdAt: u.created_at,
  }));
}

export async function createUser({ username, password, displayName, role }) {
  const hash = bcrypt.hashSync(password, 10);
  const { rows } = await query(
    `INSERT INTO users (username, password_hash, display_name, role, active)
     VALUES ($1,$2,$3,$4,TRUE)
     RETURNING id, username, display_name, role, active, created_at`,
    [username, hash, displayName || username, role || 'viewer']
  );
  const u = rows[0];
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    role: u.role,
    active: u.active,
    createdAt: u.created_at,
  };
}

export async function updateUser(id, { displayName, role, active, password }) {
  const fields = [];
  const values = [];
  let i = 1;

  if (displayName != null) {
    fields.push(`display_name=$${i++}`);
    values.push(displayName);
  }
  if (role != null) {
    fields.push(`role=$${i++}`);
    values.push(role);
  }
  if (active != null) {
    fields.push(`active=$${i++}`);
    values.push(active);
  }
  if (password) {
    fields.push(`password_hash=$${i++}`);
    values.push(bcrypt.hashSync(password, 10));
  }

  if (!fields.length) return null;
  values.push(id);

  const { rows } = await query(
    `UPDATE users SET ${fields.join(', ')} WHERE id=$${i}
     RETURNING id, username, display_name, role, active, created_at`,
    values
  );
  const u = rows[0];
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    role: u.role,
    active: u.active,
    createdAt: u.created_at,
  };
}

export async function deleteUser(id) {
  const { rowCount } = await query('DELETE FROM users WHERE id=$1', [id]);
  return rowCount > 0;
}

export async function countAdmins(excludeId = null) {
  const params = [];
  let sql = "SELECT COUNT(*)::int AS c FROM users WHERE role='admin' AND active=TRUE";
  if (excludeId != null) {
    sql += ' AND id <> $1';
    params.push(excludeId);
  }
  const { rows } = await query(sql, params);
  return rows[0].c;
}
