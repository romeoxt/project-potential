// session checks
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!req.session.user.isAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return next();
}

module.exports = { requireAuth, requireAdmin };
