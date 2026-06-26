import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { createSeedDb } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const AUTH_FILE = path.join(DATA_DIR, 'auth.json');

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

export function initStore() {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) {
    writeJson(DB_FILE, createSeedDb());
  }
  if (!fs.existsSync(AUTH_FILE)) {
    const hash = bcrypt.hashSync('1234', 10);
    writeJson(AUTH_FILE, { username: 'admin', passwordHash: hash });
  }
}

export function getDb() {
  initStore();
  return readJson(DB_FILE, createSeedDb());
}

export function saveDb(db) {
  if (!db || !Array.isArray(db.employees) || !Array.isArray(db.products)) {
    throw new Error('Invalid database payload');
  }
  writeJson(DB_FILE, db);
  return db;
}

export function verifyUser(username, password) {
  initStore();
  const auth = readJson(AUTH_FILE, null);
  if (!auth || auth.username !== username) return false;
  return bcrypt.compareSync(password, auth.passwordHash);
}

export function changePassword(username, currentPassword, newPassword) {
  initStore();
  const auth = readJson(AUTH_FILE, null);
  if (!auth || auth.username !== username) return false;
  if (!bcrypt.compareSync(currentPassword, auth.passwordHash)) return false;
  auth.passwordHash = bcrypt.hashSync(newPassword, 10);
  writeJson(AUTH_FILE, auth);
  return true;
}
