import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { DOCQ_DEFAULT_TERMS } from '../seed.js';
import {
  mapDbFromRows,
  persistDb,
  seedBusinessData,
  seedUsers,
  importJsonIfExists,
  readSchema,
} from './shared.js';
import { DEFAULT_USERS } from '../auth/roles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let pool;

async function getPool() {
  if (!pool) {
    pool = await sql.connect({
      server: config.mssql.server,
      port: config.mssql.port,
      database: config.mssql.database,
      user: config.mssql.user,
      password: config.mssql.password,
      options: config.mssql.options,
    });
  }
  return pool;
}

async function run(sqlText) {
  const p = await getPool();
  return p.request().query(sqlText);
}

async function runParams(sqlText, bind) {
  const p = await getPool();
  const req = p.request();
  for (const [name, type, value] of bind) {
    req.input(name, type, value);
  }
  return req.query(sqlText);
}

async function persistDbMssql(transaction, db) {
  const req = () => new sql.Request(transaction);

  await req().query('DELETE FROM moves');
  await req().query('DELETE FROM quotes');
  await req().query('DELETE FROM htrans');
  await req().query('DELETE FROM vacations');
  await req().query('DELETE FROM employees');
  await req().query('DELETE FROM products');

  for (const e of db.employees || []) {
    await req()
      .input('id', sql.NVarChar(10), e.id)
      .input('name', sql.NVarChar(100), e.name)
      .input('phone', sql.NVarChar(30), e.phone || '')
      .input('salary', sql.Decimal(12, 2), e.salary || 0)
      .input('opening', sql.Decimal(12, 2), e.opening || 0)
      .input('active', sql.Bit, e.active !== false)
      .query(
        'INSERT INTO employees (id, name, phone, salary, opening, active) VALUES (@id,@name,@phone,@salary,@opening,@active)'
      );
  }

  for (const p of db.products || []) {
    await req()
      .input('id', sql.NVarChar(10), p.id)
      .input('name', sql.NVarChar(200), p.name)
      .input('open_prod', sql.Decimal(12, 2), p.openProd || 0)
      .input('open_draw', sql.Decimal(12, 2), p.openDraw || 0)
      .query(
        'INSERT INTO products (id, name, open_prod, open_draw) VALUES (@id,@name,@open_prod,@open_draw)'
      );
  }

  for (const t of db.htrans || []) {
    await req()
      .input('id', sql.NVarChar(20), t.id)
      .input('emp_id', sql.NVarChar(10), t.empId)
      .input('date', sql.Date, t.date || null)
      .input('type', sql.NVarChar(20), t.type)
      .input('amount', sql.Decimal(12, 2), t.amount || 0)
      .input('hours', sql.Decimal(8, 2), t.hours ?? null)
      .input('desc_text', sql.NVarChar(sql.MAX), t.desc || '')
      .input('paid', sql.Bit, !!t.paid)
      .query(
        'INSERT INTO htrans (id, emp_id, date, type, amount, hours, desc_text, paid) VALUES (@id,@emp_id,@date,@type,@amount,@hours,@desc_text,@paid)'
      );
  }

  for (const v of db.vacations || []) {
    await req()
      .input('id', sql.NVarChar(20), v.id)
      .input('emp_id', sql.NVarChar(10), v.empId)
      .input('from_date', sql.Date, v.from)
      .input('to_date', sql.Date, v.to)
      .input('reason', sql.NVarChar(sql.MAX), v.reason || '')
      .input('settled', sql.Bit, !!v.settled)
      .query(
        'INSERT INTO vacations (id, emp_id, from_date, to_date, reason, settled) VALUES (@id,@emp_id,@from_date,@to_date,@reason,@settled)'
      );
  }

  for (const m of db.moves || []) {
    await req()
      .input('id', sql.NVarChar(20), m.id)
      .input('prod_id', sql.NVarChar(10), m.prodId)
      .input('date', sql.Date, m.date || null)
      .input('type', sql.NVarChar(10), m.type)
      .input('qty', sql.Decimal(12, 2), m.qty || 0)
      .input('desc_text', sql.NVarChar(sql.MAX), m.desc || '')
      .query(
        'INSERT INTO moves (id, prod_id, date, type, qty, desc_text) VALUES (@id,@prod_id,@date,@type,@qty,@desc_text)'
      );
  }

  for (const q of db.quotes || []) {
    if (q == null || q.number == null) continue;
    await req()
      .input('quote_number', sql.Int, Number(q.number))
      .input('data', sql.NVarChar(sql.MAX), JSON.stringify(q))
      .input('saved_at', sql.DateTime2, q.savedAt ? new Date(q.savedAt) : null)
      .input('saved_by', sql.NVarChar(50), q.savedBy || '')
      .query(
        'INSERT INTO quotes (quote_number, data, saved_at, saved_by) VALUES (@quote_number,@data,@saved_at,@saved_by)'
      );
  }

  const c = db.company || {};
  await req()
    .input('name', sql.NVarChar(200), c.name || '')
    .input('name_en', sql.NVarChar(200), c.nameEn || '')
    .input('phone', sql.NVarChar(50), c.phone || '')
    .input('address', sql.NVarChar(sql.MAX), c.address || '')
    .input('taxno', sql.NVarChar(50), c.taxno || '')
    .query(`MERGE company AS t
      USING (SELECT 1 AS id) AS s ON t.id = s.id
      WHEN MATCHED THEN UPDATE SET name=@name, name_en=@name_en, phone=@phone, address=@address, taxno=@taxno
      WHEN NOT MATCHED THEN INSERT (id,name,name_en,phone,address,taxno) VALUES (1,@name,@name_en,@phone,@address,@taxno);`);

  const s = db.seq || {};
  await req()
    .input('emp', sql.Int, s.emp || 0)
    .input('htr', sql.Int, s.htr || 0)
    .input('vac', sql.Int, s.vac || 0)
    .input('prod', sql.Int, s.prod || 0)
    .input('mov', sql.Int, s.mov || 0)
    .input('quote', sql.Int, s.quote ?? 78)
    .query(`MERGE app_seq AS t
      USING (SELECT 1 AS id) AS s ON t.id = s.id
      WHEN MATCHED THEN UPDATE SET emp=@emp, htr=@htr, vac=@vac, prod=@prod, mov=@mov, quote=@quote
      WHEN NOT MATCHED THEN INSERT (id,emp,htr,vac,prod,mov,quote) VALUES (1,@emp,@htr,@vac,@prod,@mov,@quote);`);

  const terms = JSON.stringify(db.settings?.quoteDefaultTerms || DOCQ_DEFAULT_TERMS);
  await req()
    .input('terms', sql.NVarChar(sql.MAX), terms)
    .query(`MERGE app_settings AS t
      USING (SELECT 1 AS id) AS s ON t.id = s.id
      WHEN MATCHED THEN UPDATE SET quote_default_terms=@terms
      WHEN NOT MATCHED THEN INSERT (id,quote_default_terms) VALUES (1,@terms);`);
}

async function loadRows() {
  const [company, seq, settings, employees, htrans, vacations, products, moves, quotes] =
    await Promise.all([
      run('SELECT * FROM company WHERE id=1'),
      run('SELECT * FROM app_seq WHERE id=1'),
      run('SELECT * FROM app_settings WHERE id=1'),
      run('SELECT * FROM employees ORDER BY id'),
      run('SELECT * FROM htrans ORDER BY id'),
      run('SELECT * FROM vacations ORDER BY id'),
      run('SELECT * FROM products ORDER BY id'),
      run('SELECT * FROM moves ORDER BY id'),
      run('SELECT * FROM quotes ORDER BY quote_number DESC'),
    ]);

  const settingsRow = settings.recordset[0];
  let quoteTerms = DOCQ_DEFAULT_TERMS;
  if (settingsRow?.quote_default_terms) {
    try {
      quoteTerms = JSON.parse(settingsRow.quote_default_terms);
    } catch {
      quoteTerms = DOCQ_DEFAULT_TERMS;
    }
  }

  return mapDbFromRows({
    companyRow: company.recordset[0],
    seqRow: seq.recordset[0],
    settingsRow: { quote_default_terms: quoteTerms },
    employees: employees.recordset,
    htrans: htrans.recordset,
    vacations: vacations.recordset,
    products: products.recordset,
    moves: moves.recordset,
    quotes: quotes.recordset,
  });
}

async function seedUsersMssql() {
  const count = await run('SELECT COUNT(*) AS c FROM users');
  if (count.recordset[0].c > 0) return;

  for (const u of DEFAULT_USERS) {
    const hash = bcrypt.hashSync(u.password, 10);
    await runParams(
      'INSERT INTO users (username, password_hash, display_name, role, active) VALUES (@username,@hash,@displayName,@role,1)',
      [
        ['username', sql.NVarChar(50), u.username],
        ['hash', sql.NVarChar(255), hash],
        ['displayName', sql.NVarChar(100), u.displayName],
        ['role', sql.NVarChar(30), u.role],
      ]
    );
  }
}

export async function init() {
  const schema = readSchema('mssql');
  const batches = schema.split(/^\s*GO\s*$/gim).filter((b) => b.trim());
  for (const batch of batches) {
    if (batch.trim()) await run(batch);
  }

  await seedUsersMssql();

  const count = await run('SELECT COUNT(*) AS c FROM employees');
  if (count.recordset[0].c === 0) {
    const jsonPath = path.join(__dirname, '..', 'data', 'db.json');
    let imported = false;
    if (fs.existsSync(jsonPath)) {
      try {
        const db = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        if (db.employees && db.products) {
          const tx = new sql.Transaction(await getPool());
          await tx.begin();
          try {
            await persistDbMssql(tx, db);
            await tx.commit();
            imported = true;
          } catch (e) {
            await tx.rollback();
            throw e;
          }
        }
      } catch {
        imported = false;
      }
    }
    if (!imported) {
      const { createSeedDb } = await import('../seed.js');
      const tx = new sql.Transaction(await getPool());
      await tx.begin();
      try {
        await persistDbMssql(tx, createSeedDb());
        await tx.commit();
      } catch (e) {
        await tx.rollback();
        throw e;
      }
    }
  }
}

export async function loadAll() {
  return loadRows();
}

export async function saveAll(db) {
  const p = await getPool();
  const tx = new sql.Transaction(p);
  await tx.begin();
  try {
    await persistDbMssql(tx, db);
    await tx.commit();
    return loadRows();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

export async function findUserByUsername(username) {
  const result = await runParams(
    'SELECT id, username, password_hash, display_name, role, active FROM users WHERE username=@username',
    [['username', sql.NVarChar(50), username]]
  );
  return result.recordset[0] || null;
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
  const result = await run(
    'SELECT id, username, display_name, role, active, created_at FROM users ORDER BY id'
  );
  return result.recordset.map((u) => ({
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
  const result = await runParams(
    `INSERT INTO users (username, password_hash, display_name, role, active)
     OUTPUT INSERTED.id, INSERTED.username, INSERTED.display_name, INSERTED.role, INSERTED.active, INSERTED.created_at
     VALUES (@username,@hash,@displayName,@role,1)`,
    [
      ['username', sql.NVarChar(50), username],
      ['hash', sql.NVarChar(255), hash],
      ['displayName', sql.NVarChar(100), displayName || username],
      ['role', sql.NVarChar(30), role || 'viewer'],
    ]
  );
  const u = result.recordset[0];
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
  const bind = [];
  const sets = [];
  if (displayName != null) {
    sets.push('display_name=@displayName');
    bind.push(['displayName', sql.NVarChar(100), displayName]);
  }
  if (role != null) {
    sets.push('role=@role');
    bind.push(['role', sql.NVarChar(30), role]);
  }
  if (active != null) {
    sets.push('active=@active');
    bind.push(['active', sql.Bit, active ? 1 : 0]);
  }
  if (password) {
    sets.push('password_hash=@hash');
    bind.push(['hash', sql.NVarChar(255), bcrypt.hashSync(password, 10)]);
  }
  if (!sets.length) return null;

  bind.push(['id', sql.Int, Number(id)]);
  const result = await runParams(
    `UPDATE users SET ${sets.join(', ')} WHERE id=@id;
     SELECT id, username, display_name, role, active, created_at FROM users WHERE id=@id`,
    bind
  );
  const u = result.recordset[0];
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
  const result = await run(`DELETE FROM users WHERE id=${Number(id)}`);
  return result.rowsAffected[0] > 0;
}

export async function countAdmins(excludeId = null) {
  let sqlText = "SELECT COUNT(*) AS c FROM users WHERE role='admin' AND active=1";
  if (excludeId != null) sqlText += ` AND id<>${Number(excludeId)}`;
  const result = await run(sqlText);
  return result.recordset[0].c;
}
