/**
 * Auth middleware for Express routes.
 */
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.status(403).json({ error: '需要管理员权限。请先登录。' });
}

module.exports = { requireAdmin };
