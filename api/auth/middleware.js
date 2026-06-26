import { canWrite } from './roles.js';
import { resolveAuthUser } from './session.js';

export function authMiddleware(jwtSecret) {
  return async (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ message: 'غير مصرح' });
    try {
      const user = await resolveAuthUser(token, jwtSecret);
      if (!user) {
        return res.status(401).json({ message: 'انتهت الجلسة — سجّل الدخول مجدداً' });
      }
      req.user = user;
      next();
    } catch {
      return res.status(401).json({ message: 'انتهت الجلسة — سجّل الدخول مجدداً' });
    }
  };
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'ليس لديك صلاحية لهذا الإجراء' });
    }
    next();
  };
}

export function requireWrite(section) {
  return (req, res, next) => {
    if (!canWrite(req.user.role, section)) {
      return res.status(403).json({ message: 'ليس لديك صلاحية التعديل في هذا القسم' });
    }
    next();
  };
}
