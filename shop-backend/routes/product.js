/**
 * 商品模块路由
 * GET  /api/product/list      - 商品列表（分页、筛选、排序）
 * GET  /api/product/hot       - 热门/推荐商品
 * GET  /api/product/search    - 搜索商品
 * GET  /api/product/:id       - 商品详情
 * GET  /api/product/category  - 获取所有分类（含图标）
 */
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { parsePagination } = require('../utils/index');

/**
 * 商品列表 - 支持分类筛选、价格排序、分页
 * 参数：categoryId, sort(price_asc/price_desc/sales/new), keyword, page, pageSize
 */
router.get('/list', async (req, res) => {
  try {
    const { categoryId, sort, keyword, page, pageSize } = req.query;
    const { offset, limit } = parsePagination(page, pageSize);

    // 构建查询条件
    let where = 'WHERE status = 1';
    const params = [];

    // 分类筛选
    if (categoryId) {
      where += ' AND category_id = ?';
      params.push(categoryId);
    }

    // 关键词搜索
    if (keyword) {
      where += ' AND (name LIKE ? OR subtitle LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    // 排序
    let orderBy = 'ORDER BY sort_order ASC, id DESC';
    if (sort === 'price_asc') orderBy = 'ORDER BY price ASC, id DESC';
    else if (sort === 'price_desc') orderBy = 'ORDER BY price DESC, id DESC';
    else if (sort === 'sales') orderBy = 'ORDER BY sales DESC, id DESC';
    else if (sort === 'new') orderBy = 'ORDER BY id DESC';

    // 查询商品列表
    const [list] = await db.query(
      `SELECT id, name, subtitle, cover, price, original_price, stock, sales, is_new 
       FROM product ${where} ${orderBy} LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // 查询总数
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM product ${where}`,
      params
    );

    return res.success({
      list,
      total: countResult[0].total,
      page: parseInt(page) || 1,
      pageSize: limit
    });
  } catch (err) {
    return res.fail('获取商品列表失败: ' + err.message);
  }
});

/**
 * 热门/推荐商品
 */
router.get('/hot', async (req, res) => {
  try {
    const [list] = await db.query(
      `SELECT id, name, cover, price, original_price, sales 
       FROM product WHERE status = 1 AND is_hot = 1 
       ORDER BY sales DESC LIMIT 10`
    );
    return res.success(list);
  } catch (err) {
    return res.fail('获取热门商品失败: ' + err.message);
  }
});

/**
 * 搜索商品（与列表接口合并，此接口为简化版）
 */
router.get('/search', async (req, res) => {
  try {
    const { keyword } = req.query;
    if (!keyword) {
      return res.fail('请输入搜索关键词');
    }

    const [list] = await db.query(
      `SELECT id, name, cover, price, original_price, sales 
       FROM product WHERE status = 1 AND name LIKE ? 
       ORDER BY sales DESC LIMIT 20`,
      [`%${keyword}%`]
    );
    return res.success(list);
  } catch (err) {
    return res.fail('搜索失败: ' + err.message);
  }
});

/**
 * 商品详情
 */
router.get('/:id', async (req, res) => {
  try {
    const productId = req.params.id;

    const [products] = await db.query(
      'SELECT * FROM product WHERE id = ? AND status = 1',
      [productId]
    );

    if (products.length === 0) {
      return res.fail('商品不存在或已下架', 404);
    }

    const product = products[0];

    // 解析 JSON 字段
    try { product.images = JSON.parse(product.images); } catch { product.images = []; }
    try { product.spec_list = JSON.parse(product.spec_list); } catch { product.spec_list = []; }
    try { product.detail_images = JSON.parse(product.detail_images); } catch { product.detail_images = []; }

    return res.success(product);
  } catch (err) {
    return res.fail('获取商品详情失败: ' + err.message);
  }
});

module.exports = router;
