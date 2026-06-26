export const ROLE_LABELS = {
  admin: 'مدير النظام',
  hr_manager: 'مسؤول الموارد البشرية',
  inventory_manager: 'مسؤول المخزون',
  accountant: 'محاسب',
  viewer: 'عرض فقط',
};

export const ROLES = {
  admin: {
    sections: ['dashboard', 'hr', 'inv', 'docs', 'settings', 'users'],
    write: ['hr', 'inv', 'docs', 'settings', 'users'],
  },
  hr_manager: {
    sections: ['dashboard', 'hr', 'inv', 'docs', 'settings'],
    write: ['hr', 'docs', 'settings'],
  },
  inventory_manager: {
    sections: ['dashboard', 'hr', 'inv', 'docs', 'settings'],
    write: ['inv'],
  },
  accountant: {
    sections: ['dashboard', 'hr', 'inv', 'docs', 'settings'],
    write: ['docs'],
  },
  viewer: {
    sections: ['dashboard', 'hr', 'inv', 'docs'],
    write: [],
  },
};

export function getPermissions(role) {
  return ROLES[role] || ROLES.viewer;
}

export function canWrite(role, section) {
  const perms = getPermissions(role);
  return role === 'admin' || perms.write.includes(section);
}

export function canAccessSection(role, section) {
  return getPermissions(role).sections.includes(section);
}

export function hasAnyWrite(role) {
  return getPermissions(role).write.length > 0;
}

export function mergeDbByRole(current, incoming, role) {
  if (role === 'admin') return incoming;

  const merged = structuredClone(current);
  const write = getPermissions(role).write;

  if (write.includes('hr')) {
    merged.employees = incoming.employees;
    merged.htrans = incoming.htrans;
    merged.vacations = incoming.vacations;
    merged.seq = merged.seq || {};
    merged.seq.emp = incoming.seq?.emp ?? merged.seq.emp;
    merged.seq.htr = incoming.seq?.htr ?? merged.seq.htr;
    merged.seq.vac = incoming.seq?.vac ?? merged.seq.vac;
  }

  if (write.includes('inv')) {
    merged.products = incoming.products;
    merged.moves = incoming.moves;
    merged.seq = merged.seq || {};
    merged.seq.prod = incoming.seq?.prod ?? merged.seq.prod;
    merged.seq.mov = incoming.seq?.mov ?? merged.seq.mov;
  }

  if (write.includes('settings')) {
    merged.company = incoming.company;
    merged.settings = incoming.settings;
    merged.seq = merged.seq || {};
    if (incoming.seq?.quote != null) merged.seq.quote = incoming.seq.quote;
  }

  if (write.includes('docs')) {
    merged.settings = merged.settings || {};
    merged.settings.quoteDefaultTerms =
      incoming.settings?.quoteDefaultTerms || merged.settings.quoteDefaultTerms;
    merged.quotes = incoming.quotes || merged.quotes || [];
    merged.seq = merged.seq || {};
    if (incoming.seq?.quote != null) merged.seq.quote = incoming.seq.quote;
  }

  return merged;
}

export const DEFAULT_USERS = [
  { username: 'admin', password: '1234', displayName: 'مدير النظام', role: 'admin' },
  { username: 'hr', password: '1234', displayName: 'موارد بشرية', role: 'hr_manager' },
  {
    username: 'warehouse',
    password: '1234',
    displayName: 'أمين المخزون',
    role: 'inventory_manager',
  },
  { username: 'accountant', password: '1234', displayName: 'المحاسب', role: 'accountant' },
  { username: 'viewer', password: '1234', displayName: 'مشاهد', role: 'viewer' },
];
