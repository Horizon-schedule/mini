/**
 * 快递公司列表路由（用户端和管理端通用）
 */
const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * 获取所有启用的快递公司
 */
router.get('/list', async (req, res) => {
  try {
    const [list] = await db.query(
      'SELECT id, name, code FROM express WHERE status = 1 ORDER BY id ASC'
    );
    return res.success(list);
  } catch (err) {
    return res.fail('获取快递公司列表失败: ' + err.message);
  }
});

module.exports = router;
