/**
 * 购物车模块路由（需登录）
 * GET    /api/cart/list     - 获取购物车列表
 * POST   /api/cart/add      - 添加商品到购物车
 * PUT    /api/cart/update   - 更新购物车商品（数量、选中状态）
 * PUT    /api/cart/checkAll - 全选/取消全选
 * DELETE /api/cart/delete   - 删除购物车商品
 */
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middlewares/auth');

// 所有购物车接口都需要登录
router.use(auth);

/**
 * 获取购物车列表（含商品信息）
 */
router.get('/list', async (req, res) => {
  try {
    const [list] = await db.query(
      `SELECT c.id, c.product_id, c.spec_name, c.quantity, c.checked,
              p.name, p.cover, p.price, p.original_price, p.stock, p.status
       FROM cart c
       LEFT JOIN product p ON c.product_id = p.id
       WHERE c.user_id = ?
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );

    // 过滤已下架的商品
    const validList = list.filter(item => item.status === 1);

    // 计算总价和总数量
    const checkedList = validList.filter(item => item.checked === 1);
    const totalPrice = checkedList.reduce((sum, item) => {
      return sum + parseFloat(item.price) * item.quantity;
    }, 0);
    const totalQuantity = checkedList.reduce((sum, item) => sum + item.quantity, 0);

    return res.success({
      list: validList,
      totalPrice: totalPrice.toFixed(2),
      totalQuantity,
      checkedCount: checkedList.length
    });
  } catch (err) {
    return res.fail('获取购物车失败: ' + err.message);
  }
});

/**
 * 添加商品到购物车
 * 如果已存在相同商品+规格，则数量+1
 */
router.post('/add', async (req, res) => {
  try {
    const { product_id, spec_name = '', quantity = 1 } = req.body;

    if (!product_id) {
      return res.fail('缺少商品ID');
    }

    // 检查商品是否存在且上架
    const [products] = await db.query(
      'SELECT id, stock, status FROM product WHERE id = ?',
      [product_id]
    );
    if (products.length === 0 || products[0].status !== 1) {
      return res.fail('商品不存在或已下架');
    }

    // 检查是否已在购物车中
    const [exist] = await db.query(
      'SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ? AND spec_name = ?',
      [req.user.id, product_id, spec_name]
    );

    if (exist.length > 0) {
      // 已存在，更新数量
      const newQty = exist[0].quantity + quantity;
      await db.query(
        'UPDATE cart SET quantity = ? WHERE id = ?',
        [newQty, exist[0].id]
      );
    } else {
      // 新增
      await db.query(
        'INSERT INTO cart (user_id, product_id, spec_name, quantity) VALUES (?, ?, ?, ?)',
        [req.user.id, product_id, spec_name, quantity]
      );
    }

    return res.success(null, '已加入购物车');
  } catch (err) {
    return res.fail('添加失败: ' + err.message);
  }
});

/**
 * 更新购物车商品（数量或选中状态）
 */
router.put('/update', async (req, res) => {
  try {
    const { id, quantity, checked } = req.body;

    if (!id) return res.fail('缺少购物车ID');

    const fields = [];
    const values = [];

    if (quantity !== undefined) {
      fields.push('quantity = ?');
      values.push(Math.max(1, parseInt(quantity)));
    }
    if (checked !== undefined) {
      fields.push('checked = ?');
      values.push(checked ? 1 : 0);
    }

    if (fields.length === 0) return res.fail('没有需要更新的字段');

    values.push(id, req.user.id);
    await db.query(
      `UPDATE cart SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );

    return res.success(null, '更新成功');
  } catch (err) {
    return res.fail('更新失败: ' + err.message);
  }
});

/**
 * 全选 / 取消全选
 */
router.put('/checkAll', async (req, res) => {
  try {
    const { checked } = req.body;
    await db.query(
      'UPDATE cart SET checked = ? WHERE user_id = ?',
      [checked ? 1 : 0, req.user.id]
    );
    return res.success(null, '操作成功');
  } catch (err) {
    return res.fail('操作失败: ' + err.message);
  }
});

/**
 * 删除购物车商品（支持批量）
 */
router.delete('/delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.fail('请选择要删除的商品');
    }

    const placeholders = ids.map(() => '?').join(',');
    await db.query(
      `DELETE FROM cart WHERE id IN (${placeholders}) AND user_id = ?`,
      [...ids, req.user.id]
    );

    return res.success(null, '删除成功');
  } catch (err) {
    return res.fail('删除失败: ' + err.message);
  }
});

module.exports = router;
