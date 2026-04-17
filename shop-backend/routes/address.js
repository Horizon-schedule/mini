/**
 * 收货地址模块路由（需登录）
 * GET    /api/address/list    - 获取地址列表
 * POST   /api/address/add     - 新增地址
 * PUT    /api/address/update  - 更新地址
 * DELETE /api/address/delete  - 删除地址
 * PUT    /api/address/default - 设置默认地址
 * GET    /api/address/default - 获取默认地址
 */
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middlewares/auth');

router.use(auth);

/**
 * 获取地址列表
 */
router.get('/list', async (req, res) => {
  try {
    const [list] = await db.query(
      'SELECT * FROM address WHERE user_id = ? ORDER BY is_default DESC, id DESC',
      [req.user.id]
    );
    return res.success(list);
  } catch (err) {
    return res.fail('获取地址列表失败: ' + err.message);
  }
});

/**
 * 获取默认地址
 */
router.get('/default', async (req, res) => {
  try {
    const [list] = await db.query(
      'SELECT * FROM address WHERE user_id = ? AND is_default = 1 LIMIT 1',
      [req.user.id]
    );
    return res.success(list[0] || null);
  } catch (err) {
    return res.fail('获取默认地址失败: ' + err.message);
  }
});

/**
 * 新增地址
 * 支持从微信 chooseAddress 获取的数据直接传入
 */
router.post('/add', async (req, res) => {
  try {
    const { name, phone, province, city, district, detail, postal_code = '', is_default = 0 } = req.body;

    if (!name || !phone || !detail) {
      return res.fail('收货人姓名、电话、详细地址不能为空');
    }

    // 如果设为默认，先取消其他默认
    if (is_default) {
      await db.query('UPDATE address SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    }

    const [result] = await db.query(
      'INSERT INTO address (user_id, name, phone, province, city, district, detail, postal_code, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, name, phone, province || '', city || '', district || '', detail, postal_code, is_default ? 1 : 0]
    );

    return res.success({ id: result.insertId }, '添加成功');
  } catch (err) {
    return res.fail('添加地址失败: ' + err.message);
  }
});

/**
 * 更新地址
 */
router.put('/update', async (req, res) => {
  try {
    const { id, name, phone, province, city, district, detail, postal_code, is_default } = req.body;

    if (!id) return res.fail('缺少地址ID');

    const fields = [];
    const values = [];

    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (phone !== undefined) { fields.push('phone = ?'); values.push(phone); }
    if (province !== undefined) { fields.push('province = ?'); values.push(province); }
    if (city !== undefined) { fields.push('city = ?'); values.push(city); }
    if (district !== undefined) { fields.push('district = ?'); values.push(district); }
    if (detail !== undefined) { fields.push('detail = ?'); values.push(detail); }
    if (postal_code !== undefined) { fields.push('postal_code = ?'); values.push(postal_code); }
    if (is_default !== undefined) { fields.push('is_default = ?'); values.push(is_default ? 1 : 0); }

    if (fields.length === 0) return res.fail('没有需要更新的字段');

    // 如果设为默认，先取消其他默认
    if (is_default) {
      await db.query('UPDATE address SET is_default = 0 WHERE user_id = ? AND id != ?', [req.user.id, id]);
    }

    values.push(id, req.user.id);
    await db.query(
      `UPDATE address SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );

    return res.success(null, '更新成功');
  } catch (err) {
    return res.fail('更新地址失败: ' + err.message);
  }
});

/**
 * 删除地址
 */
router.delete('/delete', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.fail('缺少地址ID');

    await db.query('DELETE FROM address WHERE id = ? AND user_id = ?', [id, req.user.id]);
    return res.success(null, '删除成功');
  } catch (err) {
    return res.fail('删除地址失败: ' + err.message);
  }
});

/**
 * 设置默认地址
 */
router.put('/default', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.fail('缺少地址ID');

    // 先取消所有默认
    await db.query('UPDATE address SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    // 设置指定地址为默认
    await db.query('UPDATE address SET is_default = 1 WHERE id = ? AND user_id = ?', [id, req.user.id]);

    return res.success(null, '设置成功');
  } catch (err) {
    return res.fail('设置默认地址失败: ' + err.message);
  }
});

module.exports = router;
