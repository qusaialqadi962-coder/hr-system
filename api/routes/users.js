import express from 'express';
import { getRepo } from '../db/index.js';
import { ROLE_LABELS } from '../auth/roles.js';
import { requireRole } from '../auth/middleware.js';

export function createUsersRouter(auth) {
  const router = express.Router();
  router.use(auth, requireRole('admin'));

  router.get('/', async (_req, res) => {
    try {
      const repo = await getRepo();
      const users = await repo.listUsers();
      res.json({
        users: users.map((u) => ({
          ...u,
          roleLabel: ROLE_LABELS[u.role] || u.role,
        })),
        roles: ROLE_LABELS,
      });
    } catch (e) {
      res.status(500).json({ message: e.message || 'فشل جلب المستخدمين' });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const username = String(req.body?.username || '').trim();
      const password = String(req.body?.password || '');
      const displayName = String(req.body?.displayName || '').trim();
      const role = String(req.body?.role || 'viewer');

      if (!username || !password) {
        return res.status(400).json({ message: 'اسم المستخدم وكلمة المرور مطلوبان' });
      }
      if (!ROLE_LABELS[role]) {
        return res.status(400).json({ message: 'دور غير صالح' });
      }

      const repo = await getRepo();
      const existing = await repo.findUserByUsername(username);
      if (existing) return res.status(409).json({ message: 'اسم المستخدم موجود مسبقاً' });

      const user = await repo.createUser({ username, password, displayName, role });
      res.status(201).json({ ...user, roleLabel: ROLE_LABELS[user.role] });
    } catch (e) {
      res.status(400).json({ message: e.message || 'فشل إنشاء المستخدم' });
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const role = req.body?.role != null ? String(req.body.role) : null;
      if (role && !ROLE_LABELS[role]) {
        return res.status(400).json({ message: 'دور غير صالح' });
      }

      const repo = await getRepo();
      const target = (await repo.listUsers()).find((u) => u.id === id);
      if (!target) return res.status(404).json({ message: 'المستخدم غير موجود' });

      if (target.role === 'admin' && role && role !== 'admin') {
        const admins = await repo.countAdmins(id);
        if (admins < 1) {
          return res.status(400).json({ message: 'يجب بقاء مدير نظام واحد على الأقل' });
        }
      }

      const user = await repo.updateUser(id, {
        displayName: req.body?.displayName,
        role,
        active: req.body?.active,
        password: req.body?.password,
      });
      if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });
      res.json({ ...user, roleLabel: ROLE_LABELS[user.role] });
    } catch (e) {
      res.status(400).json({ message: e.message || 'فشل التحديث' });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (id === req.user.sub) {
        return res.status(400).json({ message: 'لا يمكنك حذف حسابك الحالي' });
      }

      const repo = await getRepo();
      const target = (await repo.listUsers()).find((u) => u.id === id);
      if (!target) return res.status(404).json({ message: 'المستخدم غير موجود' });

      if (target.role === 'admin') {
        const admins = await repo.countAdmins(id);
        if (admins < 1) {
          return res.status(400).json({ message: 'يجب بقاء مدير نظام واحد على الأقل' });
        }
      }

      const ok = await repo.deleteUser(id);
      if (!ok) return res.status(404).json({ message: 'المستخدم غير موجود' });
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ message: e.message || 'فشل الحذف' });
    }
  });

  return router;
}
