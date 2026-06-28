// Authentication middleware for Mobile Klinic

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) {
    return next();
  }
  return res.status(401).json({ error: 'Admin authentication required' });
}

function requireCustomer(req, res, next) {
  if (req.session && req.session.customer) {
    return next();
  }
  return res.status(401).json({ error: 'Please login to continue' });
}

module.exports = { requireAdmin, requireCustomer };
