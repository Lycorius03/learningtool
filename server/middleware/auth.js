/**
 * Auth middleware for Express routes.
 */

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.status(403).json({ error: '需要管理员权限。请先登录。' });
}

/**
 * Optional admin — only enforce if no user-provided API config.
 * Users can use their own API keys without admin login.
 */
function requireAdminIfNoUserConfig(req, res, next) {
  const body = req.body || {};
  // If user provides their own API key config, skip admin check
  if (body.providerConfig && body.providerConfig.apiKey) {
    return next();
  }
  // Otherwise require admin (for system pre-configured key)
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.status(403).json({ error: '需要管理员权限或请在设置中配置自己的 API Key。' });
}

module.exports = { requireAdmin, requireAdminIfNoUserConfig };
