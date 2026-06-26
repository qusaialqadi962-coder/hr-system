import express from 'express';
import { getRepo } from '../db/index.js';
import { mergeDbByRole, hasAnyWrite } from '../auth/roles.js';

export function createSyncRouter(auth) {
  const router = express.Router();

  router.get('/', auth, async (req, res) => {
    try {
      const repo = await getRepo();
      const db = await repo.loadAll();
      res.json(db);
    } catch (e) {
      res.status(500).json({ message: e.message || 'فشل تحميل البيانات' });
    }
  });

  router.put('/', auth, async (req, res) => {
    try {
      if (!hasAnyWrite(req.user.role)) {
        return res.status(403).json({ message: 'حسابك للعرض فقط — لا يمكن الحفظ' });
      }

      const incoming = req.body;
      if (!incoming || !Array.isArray(incoming.employees) || !Array.isArray(incoming.products)) {
        return res.status(400).json({ message: 'بيانات غير صالحة' });
      }

      const repo = await getRepo();
      const current = await repo.loadAll();
      const merged = mergeDbByRole(current, incoming, req.user.role);
      const saved = repo.saveAllForRole
        ? await repo.saveAllForRole(incoming, req.user.role)
        : await repo.saveAll(merged);
      res.json(saved);
    } catch (e) {
      res.status(400).json({ message: e.message || 'فشل الحفظ' });
    }
  });

  return router;
}
