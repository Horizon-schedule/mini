/**
 * 分类模块路由
 * GET  /api/category/list     - 获取所有启用的分类
 */
const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * 获取分类列表
 */
router.get('/list', async (req, res) => {
  try {
    const [list] = await db.query(
      'SELECT * FROM category WHERE status = 1 ORDER BY sort_order ASC, id ASC'
    );
    return res.success(list);
  } catch (err) {
    return res.fail('获取分类失败: ' + err.message);
  }
});

module.exports = router;
