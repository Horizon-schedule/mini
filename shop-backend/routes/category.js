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
    
    // 将图标路径转换为小程序本地路径
    const categories = list.map(item => ({
      ...item,
      icon: item.icon ? `/images/category/${item.icon.split('/').pop()}` : ''
    }));
    
    return res.success(categories);
  } catch (err) {
    return res.fail('获取分类失败: ' + err.message);
  }
});

module.exports = router;
