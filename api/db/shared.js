import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { createSeedDb, DOCQ_DEFAULT_TERMS } from '../seed.js';
import { DEFAULT_USERS } from '../auth/roles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function mapDbFromRows({
  companyRow,
  seqRow,
  settingsRow,
  employees,
  htrans,
  vacations,
  products,
  moves,
}) {
  return {
    company: {
      name: companyRow?.name || '',
      nameEn: companyRow?.name_en || companyRow?.nameEn || '',
      phone: companyRow?.phone || '',
      address: companyRow?.address || '',
      taxno: companyRow?.taxno || '',
    },
    seq: {
      emp: Number(seqRow?.emp || 0),
      htr: Number(seqRow?.htr || 0),
      vac: Number(seqRow?.vac || 0),
      prod: Number(seqRow?.prod || 0),
      mov: Number(seqRow?.mov || 0),
      quote: Number(seqRow?.quote ?? 78),
    },
    settings: {
      quoteDefaultTerms: settingsRow?.quote_default_terms || DOCQ_DEFAULT_TERMS,
    },
    employees: employees.map((e) => ({
      id: e.id,
      name: e.name,
      phone: e.phone || '',
      salary: Number(e.salary),
      opening: Number(e.opening),
      active: e.active !== false && e.active !== 0,
    })),
    htrans: htrans.map((t) => ({
      id: t.id,
      empId: t.emp_id || t.empId,
      date: t.date ? String(t.date).slice(0, 10) : '',
      type: t.type,
      amount: Number(t.amount),
      hours: t.hours != null ? Number(t.hours) : undefined,
      desc: t.desc_text || t.desc || '',
      paid: !!(t.paid === true || t.paid === 1),
    })),
    vacations: vacations.map((v) => ({
      id: v.id,
      empId: v.emp_id || v.empId,
      from: v.from_date ? String(v.from_date).slice(0, 10) : v.from || '',
      to: v.to_date ? String(v.to_date).slice(0, 10) : v.to || '',
      reason: v.reason || '',
      settled: !!(v.settled === true || v.settled === 1),
    })),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      openProd: Number(p.open_prod ?? p.openProd ?? 0),
      openDraw: Number(p.open_draw ?? p.openDraw ?? 0),
    })),
    moves: moves.map((m) => ({
      id: m.id,
      prodId: m.prod_id || m.prodId,
      date: m.date ? String(m.date).slice(0, 10) : '',
      type: m.type,
      qty: Number(m.qty),
      desc: m.desc_text || m.desc || '',
    })),
  };
}

export async function persistDb(client, db, exec) {
  const run = exec || ((sql, params) => client.query(sql, params));

  await run('DELETE FROM moves');
  await run('DELETE FROM htrans');
  await run('DELETE FROM vacations');
  await run('DELETE FROM employees');
  await run('DELETE FROM products');

  for (const e of db.employees || []) {
    await run(
      'INSERT INTO employees (id, name, phone, salary, opening, active) VALUES ($1,$2,$3,$4,$5,$6)',
      [e.id, e.name, e.phone || '', e.salary || 0, e.opening || 0, e.active !== false]
    );
  }

  for (const p of db.products || []) {
    await run(
      'INSERT INTO products (id, name, open_prod, open_draw) VALUES ($1,$2,$3,$4)',
      [p.id, p.name, p.openProd || 0, p.openDraw || 0]
    );
  }

  for (const t of db.htrans || []) {
    await run(
      'INSERT INTO htrans (id, emp_id, date, type, amount, hours, desc_text, paid) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        t.id,
        t.empId,
        t.date || null,
        t.type,
        t.amount || 0,
        t.hours ?? null,
        t.desc || '',
        !!t.paid,
      ]
    );
  }

  for (const v of db.vacations || []) {
    await run(
      'INSERT INTO vacations (id, emp_id, from_date, to_date, reason, settled) VALUES ($1,$2,$3,$4,$5,$6)',
      [v.id, v.empId, v.from, v.to, v.reason || '', !!v.settled]
    );
  }

  for (const m of db.moves || []) {
    await run(
      'INSERT INTO moves (id, prod_id, date, type, qty, desc_text) VALUES ($1,$2,$3,$4,$5,$6)',
      [m.id, m.prodId, m.date || null, m.type, m.qty || 0, m.desc || '']
    );
  }

  const c = db.company || {};
  await run(
    `INSERT INTO company (id, name, name_en, phone, address, taxno)
     VALUES (1,$1,$2,$3,$4,$5)
     ON CONFLICT (id) DO UPDATE SET
       name=EXCLUDED.name, name_en=EXCLUDED.name_en, phone=EXCLUDED.phone,
       address=EXCLUDED.address, taxno=EXCLUDED.taxno`,
    [c.name || '', c.nameEn || '', c.phone || '', c.address || '', c.taxno || '']
  );

  const s = db.seq || {};
  await run(
    `INSERT INTO app_seq (id, emp, htr, vac, prod, mov, quote)
     VALUES (1,$1,$2,$3,$4,$5,$6)
     ON CONFLICT (id) DO UPDATE SET
       emp=EXCLUDED.emp, htr=EXCLUDED.htr, vac=EXCLUDED.vac,
       prod=EXCLUDED.prod, mov=EXCLUDED.mov, quote=EXCLUDED.quote`,
    [s.emp || 0, s.htr || 0, s.vac || 0, s.prod || 0, s.mov || 0, s.quote ?? 78]
  );

  const terms = db.settings?.quoteDefaultTerms || DOCQ_DEFAULT_TERMS;
  await run(
    `INSERT INTO app_settings (id, quote_default_terms)
     VALUES (1,$1::jsonb)
     ON CONFLICT (id) DO UPDATE SET quote_default_terms=EXCLUDED.quote_default_terms`,
    [JSON.stringify(terms)]
  );
}

export async function seedBusinessData(client, exec, seedDb = createSeedDb()) {
  await persistDb(client, seedDb, exec);
}

export async function seedUsers(client, exec) {
  const run = exec || ((sql, params) => client.query(sql, params));
  const { rows } = await run('SELECT COUNT(*)::int AS c FROM users');
  if (rows[0].c > 0) return;

  for (const u of DEFAULT_USERS) {
    const hash = bcrypt.hashSync(u.password, 10);
    await run(
      'INSERT INTO users (username, password_hash, display_name, role, active) VALUES ($1,$2,$3,$4,TRUE)',
      [u.username, hash, u.displayName, u.role]
    );
  }
}

export async function importJsonIfExists(client, exec, jsonPath) {
  if (!fs.existsSync(jsonPath)) return false;
  try {
    const db = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (!db.employees || !db.products) return false;
    await seedBusinessData(client, exec, db);
    return true;
  } catch {
    return false;
  }
}

export function readSchema(driver) {
  const file =
    driver === 'mssql'
      ? path.join(__dirname, 'schema.mssql.sql')
      : path.join(__dirname, 'schema.postgres.sql');
  return fs.readFileSync(file, 'utf8');
}
