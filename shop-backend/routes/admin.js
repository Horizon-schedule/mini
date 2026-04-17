/**
 * 管理员模块路由
 * POST   /api/admin/login       - 管理员登录
 * GET    /api/admin/info        - 获取管理员信息
 * GET    /api/admin/statistics  - 数据统计
 *
 * 以下需要管理员权限：
 * PUT    /api/admin/product     - 商品上下架
 * PUT    /api/admin/order/status - 修改订单状态/发货
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const adminAuth = require('../middlewares/adminAuth');
const { parsePagination, hashPassword, verifyPassword } = require('../utils/index');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 配置上传目录
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'));
    }
  }
});

/**
 * 图片上传接口
 */
router.post('/upload', adminAuth, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.fail('请上传图片文件');
    }
    const url = `/uploads/${req.file.filename}`;
    return res.success({ url });
  } catch (err) {
    return res.fail('上传失败: ' + err.message);
  }
});

/**
 * 管理员登录
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.fail('用户名和密码不能为空');
    }

    const [admins] = await db.query(
      'SELECT * FROM admin WHERE username = ?',
      [username]
    );

    if (admins.length === 0) {
      return res.fail('用户名或密码错误');
    }

    const admin = admins[0];

    // 验证密码
    const isValid = await verifyPassword(password, admin.password);
    if (!isValid) {
      return res.fail('用户名或密码错误');
    }

    // 生成管理员 Token
    const token = jwt.sign(
      { id: admin.id, username: admin.username, type: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.success({
      token,
      adminInfo: {
        id: admin.id,
        username: admin.username,
        nickname: admin.nickname,
        avatar: admin.avatar
      }
    });
  } catch (err) {
    return res.fail('登录失败: ' + err.message);
  }
});

/**
 * 获取管理员信息
 */
router.get('/info', adminAuth, async (req, res) => {
  try {
    const [admins] = await db.query(
      'SELECT id, username, nickname, avatar, created_at FROM admin WHERE id = ?',
      [req.admin.id]
    );
    if (admins.length === 0) return res.fail('管理员不存在', 404);
    return res.success(admins[0]);
  } catch (err) {
    return res.fail('获取管理员信息失败: ' + err.message);
  }
});

/**
 * 数据统计面板
 */
router.get('/statistics', adminAuth, async (req, res) => {
  try {
    // 今日订单数
    const [todayOrders] = await db.query(
      'SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = CURDATE()'
    );

    // 总订单数
    const [totalOrders] = await db.query('SELECT COUNT(*) as count FROM orders');

    // 商品总数
    const [totalProducts] = await db.query('SELECT COUNT(*) as count FROM product');

    // 用户总数
    const [totalUsers] = await db.query('SELECT COUNT(*) as count FROM user');

    // 今日销售额
    const [todaySales] = await db.query(
      'SELECT COALESCE(SUM(pay_amount), 0) as total FROM orders WHERE status >= 1 AND DATE(pay_time) = CURDATE()'
    );

    // 总销售额
    const [totalSales] = await db.query(
      'SELECT COALESCE(SUM(pay_amount), 0) as total FROM orders WHERE status >= 1'
    );

    // 待发货订单数
    const [pendingShip] = await db.query(
      'SELECT COUNT(*) as count FROM orders WHERE status = 1'
    );

    return res.success({
      todayOrders: todayOrders[0].count,
      totalOrders: totalOrders[0].count,
      totalProducts: totalProducts[0].count,
      totalUsers: totalUsers[0].count,
      todaySales: parseFloat(todaySales[0].total).toFixed(2),
      totalSales: parseFloat(totalSales[0].total).toFixed(2),
      pendingShip: pendingShip[0].count
    });
  } catch (err) {
    return res.fail('获取统计数据失败: ' + err.message);
  }
});

// ============================================================
// 管理员 - 商品管理
// ============================================================

/**
 * 商品列表（管理端，含下架商品）
 */
router.get('/product/list', adminAuth, async (req, res) => {
  try {
    const { page = 1, pageSize = 10, keyword, status, categoryId } = req.query;
    const { offset, limit } = parsePagination(page, pageSize);

    let where = 'WHERE 1=1';
    const params = [];

    if (keyword) { where += ' AND p.name LIKE ?'; params.push(`%${keyword}%`); }
    if (status !== '' && status !== undefined) { where += ' AND p.status = ?'; params.push(status); }
    if (categoryId) { where += ' AND p.category_id = ?'; params.push(categoryId); }

    const [list] = await db.query(
      `SELECT p.*, c.name as category_name 
       FROM product p LEFT JOIN category c ON p.category_id = c.id 
       ${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM product p ${where}`,
      params
    );

    return res.success({
      list,
      total: countResult[0].total,
      page: parseInt(page),
      pageSize: limit
    });
  } catch (err) {
    return res.fail('获取商品列表失败: ' + err.message);
  }
});

/**
 * 新增/编辑商品
 */
router.post('/product/save', adminAuth, async (req, res) => {
  try {
    const { id, name, subtitle, cover, images, detail_images, category_id, price, original_price, stock, spec_list, is_hot, is_new, status, sort_order } = req.body;

    if (!name) return res.fail('商品名称不能为空');
    if (!category_id) return res.fail('请选择分类');
    if (price === undefined || price === '') return res.fail('请设置价格');

    const data = {
      name, subtitle: subtitle || '', cover: cover || '',
      images: typeof images === 'string' ? images : JSON.stringify(images || []),
      detail_images: typeof detail_images === 'string' ? detail_images : JSON.stringify(detail_images || []),
      category_id: parseInt(category_id),
      price: parseFloat(price),
      original_price: parseFloat(original_price) || 0,
      stock: parseInt(stock) || 0,
      spec_list: typeof spec_list === 'string' ? spec_list : JSON.stringify(spec_list || []),
      is_hot: is_hot ? 1 : 0,
      is_new: is_new ? 1 : 0,
      status: status !== undefined ? (status ? 1 : 0) : 1,
      sort_order: parseInt(sort_order) || 0
    };

    if (id) {
      // 编辑
      const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
      await db.query(`UPDATE product SET ${fields} WHERE id = ?`, [...Object.values(data), id]);
    } else {
      // 新增
      const fields = Object.keys(data).join(', ');
      const placeholders = Object.keys(data).map(() => '?').join(', ');
      await db.query(`INSERT INTO product (${fields}) VALUES (${placeholders})`, Object.values(data));
    }

    return res.success(null, id ? '更新成功' : '新增成功');
  } catch (err) {
    return res.fail('保存商品失败: ' + err.message);
  }
});

/**
 * 删除商品
 */
router.delete('/product/delete', adminAuth, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.fail('缺少商品ID');
    await db.query('DELETE FROM product WHERE id = ?', [id]);
    return res.success(null, '删除成功');
  } catch (err) {
    return res.fail('删除商品失败: ' + err.message);
  }
});

/**
 * 商品上下架
 */
router.put('/product/status', adminAuth, async (req, res) => {
  try {
    const { id, status } = req.body;
    await db.query('UPDATE product SET status = ? WHERE id = ?', [status, id]);
    return res.success(null, status ? '已上架' : '已下架');
  } catch (err) {
    return res.fail('操作失败: ' + err.message);
  }
});

// ============================================================
// 管理员 - 分类管理
// ============================================================

router.get('/category/list', adminAuth, async (req, res) => {
  try {
    const [list] = await db.query('SELECT * FROM category ORDER BY sort_order ASC, id ASC');
    return res.success(list);
  } catch (err) {
    return res.fail('获取分类失败: ' + err.message);
  }
});

router.post('/category/save', adminAuth, async (req, res) => {
  try {
    const { id, name, icon, sort_order, status } = req.body;
    if (!name) return res.fail('分类名称不能为空');

    if (id) {
      await db.query(
        'UPDATE category SET name = ?, icon = ?, sort_order = ?, status = ? WHERE id = ?',
        [name, icon || '', parseInt(sort_order) || 0, status !== undefined ? status : 1, id]
      );
    } else {
      await db.query(
        'INSERT INTO category (name, icon, sort_order, status) VALUES (?, ?, ?, ?)',
        [name, icon || '', parseInt(sort_order) || 0, status !== undefined ? status : 1]
      );
    }
    return res.success(null, id ? '更新成功' : '新增成功');
  } catch (err) {
    return res.fail('保存分类失败: ' + err.message);
  }
});

router.delete('/category/delete', adminAuth, async (req, res) => {
  try {
    const { id } = req.body;
    // 检查是否有商品使用该分类
    const [products] = await db.query('SELECT COUNT(*) as count FROM product WHERE category_id = ?', [id]);
    if (products[0].count > 0) {
      return res.fail('该分类下有商品，无法删除');
    }
    await db.query('DELETE FROM category WHERE id = ?', [id]);
    return res.success(null, '删除成功');
  } catch (err) {
    return res.fail('删除分类失败: ' + err.message);
  }
});

// ============================================================
// 管理员 - 订单管理
// ============================================================

router.get('/order/list', adminAuth, async (req, res) => {
  try {
    const { page = 1, pageSize = 10, status, keyword } = req.query;
    const { offset, limit } = parsePagination(page, pageSize);

    let where = 'WHERE 1=1';
    const params = [];

    if (status !== '' && status !== undefined) {
      where += ' AND o.status = ?';
      params.push(status);
    }
    if (keyword) {
      where += ' AND (o.order_no LIKE ? OR o.id = ?)';
      params.push(`%${keyword}%`, keyword);
    }

    const [list] = await db.query(
      `SELECT o.*, u.nickname as user_nickname 
       FROM orders o LEFT JOIN user u ON o.user_id = u.id 
       ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM orders o ${where}`,
      params
    );

    return res.success({
      list,
      total: countResult[0].total,
      page: parseInt(page),
      pageSize: limit
    });
  } catch (err) {
    return res.fail('获取订单列表失败: ' + err.message);
  }
});

/**
 * 修改订单状态 / 发货
 */
router.put('/order/status', adminAuth, async (req, res) => {
  try {
    const { order_id, status, express_company, express_no } = req.body;

    if (status === 2 && (!express_company || !express_no)) {
      return res.fail('发货请填写快递公司和快递单号');
    }

    if (express_company) {
      await db.query(
        'UPDATE orders SET status = ?, express_company = ?, express_no = ? WHERE id = ?',
        [status, express_company, express_no, order_id]
      );
    } else {
      await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, order_id]);
    }

    return res.success(null, '操作成功');
  } catch (err) {
    return res.fail('操作失败: ' + err.message);
  }
});

// ============================================================
// 管理员 - 用户管理
// ============================================================

router.get('/user/list', adminAuth, async (req, res) => {
  try {
    const { page = 1, pageSize = 10 } = req.query;
    const { offset, limit } = parsePagination(page, pageSize);

    const [list] = await db.query(
      'SELECT id, openid, nickname, avatar, phone, status, created_at FROM user ORDER BY id DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    const [countResult] = await db.query('SELECT COUNT(*) as total FROM user');

    return res.success({
      list,
      total: countResult[0].total,
      page: parseInt(page),
      pageSize: limit
    });
  } catch (err) {
    return res.fail('获取用户列表失败: ' + err.message);
  }
});

// ============================================================
// 管理员 - 快递公司管理
// ============================================================

router.get('/express/list', adminAuth, async (req, res) => {
  try {
    const [list] = await db.query('SELECT * FROM express ORDER BY id ASC');
    return res.success(list);
  } catch (err) {
    return res.fail('获取快递公司列表失败: ' + err.message);
  }
});

router.post('/express/save', adminAuth, async (req, res) => {
  try {
    const { id, name, code, status } = req.body;
    if (!name || !code) return res.fail('快递公司名称和编码不能为空');

    if (id) {
      await db.query(
        'UPDATE express SET name = ?, code = ?, status = ? WHERE id = ?',
        [name, code, status !== undefined ? status : 1, id]
      );
    } else {
      await db.query(
        'INSERT INTO express (name, code, status) VALUES (?, ?, ?)',
        [name, code, status !== undefined ? status : 1]
      );
    }
    return res.success(null, '保存成功');
  } catch (err) {
    return res.fail('保存快递公司失败: ' + err.message);
  }
});

// ============================================================
// 管理员 - 轮播图管理
// ============================================================

router.get('/banner/list', adminAuth, async (req, res) => {
  try {
    const [list] = await db.query('SELECT * FROM banner ORDER BY sort_order ASC, id ASC');
    return res.success(list);
  } catch (err) {
    return res.fail('获取轮播图失败: ' + err.message);
  }
});

router.post('/banner/save', adminAuth, async (req, res) => {
  try {
    const { id, image, link_type, link_value, sort_order, status } = req.body;
    if (!image) return res.fail('请上传轮播图');

    if (id) {
      await db.query(
        'UPDATE banner SET image = ?, link_type = ?, link_value = ?, sort_order = ?, status = ? WHERE id = ?',
        [image, link_type || 0, link_value || '', parseInt(sort_order) || 0, status !== undefined ? status : 1, id]
      );
    } else {
      await db.query(
        'INSERT INTO banner (image, link_type, link_value, sort_order, status) VALUES (?, ?, ?, ?, ?)',
        [image, link_type || 0, link_value || '', parseInt(sort_order) || 0, status !== undefined ? status : 1]
      );
    }
    return res.success(null, '保存成功');
  } catch (err) {
    return res.fail('保存轮播图失败: ' + err.message);
  }
});

router.delete('/banner/delete', adminAuth, async (req, res) => {
  try {
    const { id } = req.body;
    await db.query('DELETE FROM banner WHERE id = ?', [id]);
    return res.success(null, '删除成功');
  } catch (err) {
    return res.fail('删除轮播图失败: ' + err.message);
  }
});

module.exports = router;
