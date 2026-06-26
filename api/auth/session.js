import jwt from 'jsonwebtoken';
import { getRepo } from '../db/index.js';

export async function resolveAuthUser(token, jwtSecret) {
  const payload = jwt.verify(token, jwtSecret);
  const repo = await getRepo();
  const row = await repo.findUserByUsername(payload.username);
  if (!row || !row.active) return null;

  return {
    sub: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
  };
}
