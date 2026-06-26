/**
 * Server-side DB sanitization — removes orphan refs, dedupes quotes, normalizes arrays.
 * Does not delete valid business rows except orphans with broken foreign keys.
 */
export function sanitizeDb(db) {
  const issues = [];
  const out = structuredClone(db || {});

  out.company = out.company || {};
  out.seq = out.seq || {};
  out.settings = out.settings || {};
  if (!Array.isArray(out.employees)) out.employees = [];
  if (!Array.isArray(out.htrans)) out.htrans = [];
  if (!Array.isArray(out.vacations)) out.vacations = [];
  if (!Array.isArray(out.products)) out.products = [];
  if (!Array.isArray(out.moves)) out.moves = [];
  if (!Array.isArray(out.quotes)) out.quotes = [];

  const empIds = new Set(out.employees.map((e) => e.id));
  const prodIds = new Set(out.products.map((p) => p.id));

  const orphanHtr = out.htrans.filter((t) => !empIds.has(t.empId));
  if (orphanHtr.length) {
    issues.push({
      severity: 'High',
      module: 'Payroll',
      description: `Removed ${orphanHtr.length} payroll transaction(s) with invalid employee reference`,
    });
    out.htrans = out.htrans.filter((t) => empIds.has(t.empId));
  }

  const orphanVac = out.vacations.filter((v) => !empIds.has(v.empId));
  if (orphanVac.length) {
    issues.push({
      severity: 'High',
      module: 'Payroll',
      description: `Removed ${orphanVac.length} vacation record(s) with invalid employee reference`,
    });
    out.vacations = out.vacations.filter((v) => empIds.has(v.empId));
  }

  const orphanMoves = out.moves.filter((m) => !prodIds.has(m.prodId));
  if (orphanMoves.length) {
    issues.push({
      severity: 'High',
      module: 'Inventory',
      description: `Removed ${orphanMoves.length} inventory move(s) with invalid product reference`,
    });
    out.moves = out.moves.filter((m) => prodIds.has(m.prodId));
  }

  const quoteMap = new Map();
  for (const q of out.quotes) {
    if (q == null || q.number == null) continue;
    const prev = quoteMap.get(q.number);
    if (!prev || String(q.savedAt || '') > String(prev.savedAt || '')) {
      quoteMap.set(q.number, q);
    } else if (prev) {
      issues.push({
        severity: 'Medium',
        module: 'Documents',
        description: `Dropped duplicate quote number ${q.number}`,
      });
    }
  }
  out.quotes = [...quoteMap.values()].sort((a, b) => Number(b.number) - Number(a.number));

  const maxEmp = out.employees.reduce((m, e) => Math.max(m, parseInt(String(e.id).replace(/\D/g, ''), 10) || 0), 0);
  const maxHtr = out.htrans.reduce((m, t) => Math.max(m, parseInt(String(t.id).replace(/\D/g, ''), 10) || 0), 0);
  const maxVac = out.vacations.reduce((m, v) => Math.max(m, parseInt(String(v.id).replace(/\D/g, ''), 10) || 0), 0);
  const maxProd = out.products.reduce((m, p) => Math.max(m, parseInt(String(p.id).replace(/\D/g, ''), 10) || 0), 0);
  const maxMov = out.moves.reduce((m, mv) => Math.max(m, parseInt(String(mv.id).replace(/\D/g, ''), 10) || 0), 0);
  const maxQuote = out.quotes.reduce((m, q) => Math.max(m, Number(q.number) || 0), 78);

  if ((out.seq.emp || 0) < maxEmp) out.seq.emp = maxEmp;
  if ((out.seq.htr || 0) < maxHtr) out.seq.htr = maxHtr;
  if ((out.seq.vac || 0) < maxVac) out.seq.vac = maxVac;
  if ((out.seq.prod || 0) < maxProd) out.seq.prod = maxProd;
  if ((out.seq.mov || 0) < maxMov) out.seq.mov = maxMov;
  if ((out.seq.quote ?? 78) < maxQuote) out.seq.quote = maxQuote;

  return { db: out, issues };
}

export function auditDb(db) {
  const issues = [];
  const empIds = new Set((db.employees || []).map((e) => e.id));
  const prodIds = new Set((db.products || []).map((p) => p.id));

  (db.htrans || []).forEach((t) => {
    if (!empIds.has(t.empId)) {
      issues.push({ severity: 'High', module: 'Payroll', description: `Orphan transaction ${t.id}` });
    }
    if (t.amount != null && Number(t.amount) < 0) {
      issues.push({ severity: 'Medium', module: 'Payroll', description: `Negative amount on ${t.id}` });
    }
  });

  (db.moves || []).forEach((m) => {
    if (!prodIds.has(m.prodId)) {
      issues.push({ severity: 'High', module: 'Inventory', description: `Orphan move ${m.id}` });
    }
    if (Number(m.qty) <= 0) {
      issues.push({ severity: 'Medium', module: 'Inventory', description: `Invalid qty on move ${m.id}` });
    }
  });

  (db.products || []).forEach((p) => {
    const prod = Number(p.openProd || 0) + (db.moves || []).filter((m) => m.prodId === p.id && m.type === 'prod').reduce((a, m) => a + Number(m.qty), 0);
    const draw = Number(p.openDraw || 0) + (db.moves || []).filter((m) => m.prodId === p.id && m.type === 'draw').reduce((a, m) => a + Number(m.qty), 0);
    if (prod - draw < 0) {
      issues.push({
        severity: 'Medium',
        module: 'Inventory',
        description: `Negative balance: ${p.name} (${prod - draw})`,
      });
    }
  });

  if (!Array.isArray(db.quotes)) {
    issues.push({ severity: 'High', module: 'Documents', description: 'quotes array missing' });
  }

  return issues;
}
