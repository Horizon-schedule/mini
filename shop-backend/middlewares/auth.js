/**
 * 用户Token验证中间件
 * 从请求头的 Authorization 字段获取 JWT Token
 * 验证通过后，将用户信息挂载到 req.user
 */
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  // 获取 Authorization 头
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.fail('未登录或登录已过期', 401);
  }

  const token = authHeader.substring(7);
  try {
    // 验证 token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, openid, ... }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.fail('登录已过期，请重新登录', 401);
    }
    return res.fail('无效的登录凭证', 401);
  }
};

module.exports = authMiddleware;
