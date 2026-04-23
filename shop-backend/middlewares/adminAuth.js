/**
 * 管理员Token验证中间件
 * 与用户Token共用 JWT，通过 req.user.type 区分身份
 * 允许 admin 或 service 类型的管理员访问
 */
const jwt = require('jsonwebtoken');

const adminAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.fail('未登录或登录已过期', 401);
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // 管理员token必须携带 type='admin' 或 'service'
    if (decoded.type !== 'admin' && decoded.type !== 'service') {
      return res.fail('无管理员权限', 403);
    }
    req.admin = decoded; // { id, username, type }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.fail('登录已过期，请重新登录', 401);
    }
    return res.fail('无效的登录凭证', 401);
  }
};

module.exports = adminAuthMiddleware;
