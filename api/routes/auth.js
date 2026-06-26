import express from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getRepo } from '../db/index.js';
import { getPermissions, ROLE_LABELS } from '../auth/roles.js';

export function createAuthRouter() {
  const router = express.Router();

  router.post('/login', async (req, res) => {
    try {
      const username = String(req.body?.username || '').trim();
      const password = String(req.body?.password || '');
      const repo = await getRepo();
      const user = await repo.verifyUser(username, password);
      if (!user) {
        return res.status(401).json({ message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
      }

      const permissions = getPermissions(user.role);
      const token = jwt.sign(
        {
          sub: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
        },
        config.jwtSecret,
        { expiresIn: '12h' }
      );

      res.json({
        token,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        roleLabel: ROLE_LABELS[user.role] || user.role,
        permissions,
      });
    } catch (e) {
      res.status(500).json({ message: e.message || 'خطأ في تسجيل الدخول' });
    }
  });

  router.get('/me', async (req, res) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ message: 'غير مصرح' });
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      res.json({
        username: payload.username,
        displayName: payload.displayName,
        role: payload.role,
        roleLabel: ROLE_LABELS[payload.role] || payload.role,
        permissions: getPermissions(payload.role),
      });
    } catch {
      res.status(401).json({ message: 'انتهت الجلسة' });
    }
  });

  return router;
}
