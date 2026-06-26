import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { createSeedDb } from '../seed.js';
import { DEFAULT_USERS } from '../auth/roles.js';
import { mergeDbByRole } from '../auth/roles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function loadUsers() {
  return readJson(USERS_FILE, []);
}

function saveUsers(users) {
  writeJson(USERS_FILE, users);
}

function seedUsersIfEmpty() {
  let users = loadUsers();
  if (users.length) return users;

  users = DEFAULT_USERS.map((u, i) => ({
    id: i + 1,
    username: u.username,
    passwordHash: bcrypt.hashSync(u.password, 10),
    displayName: u.displayName,
    role: u.role,
    active: true,
    createdAt: new Date().toISOString(),
  }));
  saveUsers(users);
  return users;
}

export async function init() {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) {
    writeJson(DB_FILE, createSeedDb());
  }
  seedUsersIfEmpty();
}

export async function loadAll() {
  await init();
  return readJson(DB_FILE, createSeedDb());
}

export async function saveAll(db) {
  if (!db || !Array.isArray(db.employees) || !Array.isArray(db.products)) {
    throw new Error('Invalid database payload');
  }
  writeJson(DB_FILE, db);
  return db;
}

export async function saveAllForRole(db, role) {
  const current = await loadAll();
  const merged = mergeDbByRole(current, db, role);
  return saveAll(merged);
}

export async function findUserByUsername(username) {
  const users = loadUsers();
  const u = users.find((x) => x.username === username);
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    password_hash: u.passwordHash,
    display_name: u.displayName,
    role: u.role,
    active: u.active,
  };
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
  return loadUsers().map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    active: u.active,
    createdAt: u.createdAt,
  }));
}

export async function createUser({ username, password, displayName, role }) {
  const users = loadUsers();
  const id = users.reduce((m, u) => Math.max(m, u.id), 0) + 1;
  const user = {
    id,
    username,
    passwordHash: bcrypt.hashSync(password, 10),
    displayName: displayName || username,
    role: role || 'viewer',
    active: true,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
  };
}

export async function updateUser(id, { displayName, role, active, password }) {
  const users = loadUsers();
  const u = users.find((x) => x.id === id);
  if (!u) return null;
  if (displayName != null) u.displayName = displayName;
  if (role != null) u.role = role;
  if (active != null) u.active = active;
  if (password) u.passwordHash = bcrypt.hashSync(password, 10);
  saveUsers(users);
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    active: u.active,
    createdAt: u.createdAt,
  };
}

export async function deleteUser(id) {
  const users = loadUsers();
  const next = users.filter((u) => u.id !== id);
  if (next.length === users.length) return false;
  saveUsers(next);
  return true;
}

export async function countAdmins(excludeId = null) {
  return loadUsers().filter(
    (u) => u.role === 'admin' && u.active && u.id !== excludeId
  ).length;
}
