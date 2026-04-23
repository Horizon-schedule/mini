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
        avatar: admin.avatar,
        role: admin.role
      }
    });
  } catch (err) {
    return res.fail('登录失败: ' + err.message);
  }
});

/**
 * 客服登录（需要超级管理员授权）
 * POST /api/admin/service-login
 * 参数：superAdmin（超级管理员用户名）, subUsername（子账号用户名）, subPassword（子账号密码）
 */
router.post('/service-login', async (req, res) => {
  try {
    const { superAdmin, subUsername, subPassword } = req.body;

    if (!superAdmin || !subUsername || !subPassword) {
      return res.fail('请填写完整信息');
    }

    // 1. 验证超级管理员账号
    const [superAdmins] = await db.query(
      'SELECT * FROM admin WHERE username = ? AND role = ?',
      [superAdmin, 'super']
    );

    if (superAdmins.length === 0) {
      return res.fail('超级管理员账号不存在');
    }

    const superAdminInfo = superAdmins[0];

    // 2. 查找子账号
    const [subAdmins] = await db.query(
      'SELECT a.*, pg.name as permission_group_name, pg.permissions as permission_group_permissions FROM admin a LEFT JOIN permission_group pg ON a.permission_group_id = pg.id WHERE a.username = ? AND a.role = ?',
      [subUsername, 'service']
    );

    if (subAdmins.length === 0) {
      return res.fail('子账号不存在或角色不是客服');
    }

    const subAdmin = subAdmins[0];

    // 3. 验证子账号密码
    const isValid = await verifyPassword(subPassword, subAdmin.password);
    if (!isValid) {
      return res.fail('子账号密码错误');
    }

    // 4. 验证子账号是否启用
    if (!subAdmin.status) {
      return res.fail('该子账号已被禁用');
    }

    // 5. 获取权限组权限（兼容JSON数组和逗号分隔字符串）
    let permissions = [];
    if (subAdmin.permission_group_permissions) {
      const permStr = subAdmin.permission_group_permissions.toString().trim();
      if (permStr.startsWith('[')) {
        // JSON数组格式
        try {
          permissions = JSON.parse(permStr);
        } catch (e) {
          permissions = [];
        }
      } else {
        // 逗号分隔字符串格式
        permissions = permStr.split(',').map(p => p.trim()).filter(p => p);
      }
    }

    // 6. 生成子账号的 Token
    const token = jwt.sign(
      { 
        id: subAdmin.id, 
        username: subAdmin.username, 
        type: 'service',
        permission_group_id: subAdmin.permission_group_id 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.success({
      token,
      adminInfo: {
        id: subAdmin.id,
        username: subAdmin.username,
        nickname: subAdmin.nickname,
        avatar: subAdmin.avatar,
        email: subAdmin.email,
        phone: subAdmin.phone,
        wechat: subAdmin.wechat,
        signature: subAdmin.signature,
        status: subAdmin.status,
        service_status: subAdmin.service_status || 'online',
        role: subAdmin.role,
        permission_group_id: subAdmin.permission_group_id,
        permission_group_name: subAdmin.permission_group_name || null
      },
      permissions: permissions,
      superAdmin: {
        id: superAdminInfo.id,
        username: superAdminInfo.username
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
      'SELECT id, username, nickname, avatar, email, phone, wechat, signature, status, service_status, role, created_at FROM admin WHERE id = ?',
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
    const { id, name, subtitle, cover, images, detail, category_id, price, original_price, stock, spec_list, is_hot, is_new, status, sort_order } = req.body;

    if (!name) return res.fail('商品名称不能为空');
    if (!category_id) return res.fail('请选择分类');
    if (price === undefined || price === '') return res.fail('请设置价格');

    const data = {
      name, subtitle: subtitle || '', cover: cover || '',
      images: typeof images === 'string' ? images : JSON.stringify(images || []),
      detail: detail || '',
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

// ============================================================
// 个人设置
// ============================================================

/**
 * 更新个人资料
 */
router.put('/profile', adminAuth, async (req, res) => {
  try {
    const { nickname, avatar, email, phone, wechat, signature, status, service_status } = req.body;
    const fields = [];
    const values = [];

    if (nickname !== undefined) { fields.push('nickname = ?'); values.push(nickname); }
    if (avatar !== undefined) { fields.push('avatar = ?'); values.push(avatar); }
    if (email !== undefined) { fields.push('email = ?'); values.push(email); }
    if (phone !== undefined) { fields.push('phone = ?'); values.push(phone); }
    if (wechat !== undefined) { fields.push('wechat = ?'); values.push(wechat); }
    if (signature !== undefined) { fields.push('signature = ?'); values.push(signature); }
    if (status !== undefined) { fields.push('status = ?'); values.push(status); }
    if (service_status !== undefined) { fields.push('service_status = ?'); values.push(service_status); }

    if (fields.length === 0) {
      return res.fail('没有需要更新的信息');
    }

    values.push(req.admin.id);
    await db.query(`UPDATE admin SET ${fields.join(', ')} WHERE id = ?`, values);

    return res.success(null, '更新成功');
  } catch (err) {
    return res.fail('更新失败: ' + err.message);
  }
});

/**
 * 修改密码
 */
router.put('/change-password', adminAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.fail('请填写原密码和新密码');
    }

    if (newPassword.length < 6) {
      return res.fail('新密码至少6位');
    }

    // 获取当前管理员信息
    const [admins] = await db.query('SELECT password FROM admin WHERE id = ?', [req.admin.id]);
    if (admins.length === 0) {
      return res.fail('管理员不存在', 404);
    }

    // 验证原密码
    const isValid = await verifyPassword(oldPassword, admins[0].password);
    if (!isValid) {
      return res.fail('原密码错误');
    }

    // 加密新密码
    const hashedPassword = await hashPassword(newPassword);
    await db.query('UPDATE admin SET password = ? WHERE id = ?', [hashedPassword, req.admin.id]);

    return res.success(null, '密码修改成功');
  } catch (err) {
    return res.fail('修改密码失败: ' + err.message);
  }
});

// ============================================================
// 管理员/客服管理（仅超级管理员可用）
// ============================================================

/**
 * 检查是否为超级管理员
 */
const superAdminAuth = async (req, res, next) => {
  try {
    const [admins] = await db.query('SELECT role FROM admin WHERE id = ?', [req.admin.id]);
    if (admins.length === 0 || admins[0].role !== 'super') {
      return res.fail('仅超级管理员可操作', 403);
    }
    next();
  } catch (err) {
    return res.fail('权限检查失败: ' + err.message);
  }
};

/**
 * 获取管理员列表
 */
router.get('/admin/list', adminAuth, superAdminAuth, async (req, res) => {
  try {
    const [list] = await db.query(
      'SELECT id, username, nickname, avatar, role, status, created_at FROM admin ORDER BY id ASC'
    );
    return res.success(list);
  } catch (err) {
    return res.fail('获取管理员列表失败: ' + err.message);
  }
});

/**
 * 创建管理员/客服
 */
router.post('/admin/create', adminAuth, superAdminAuth, async (req, res) => {
  try {
    const { username, password, nickname, role, permission_group_id, avatar } = req.body;

    if (!username || !password) {
      return res.fail('用户名和密码不能为空');
    }

    if (password.length < 6) {
      return res.fail('密码至少6位');
    }

    // 检查用户名是否已存在
    const [existing] = await db.query('SELECT id FROM admin WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.fail('用户名已存在');
    }

    // 加密密码
    const hashedPassword = await hashPassword(password);

    // 插入新管理员
    const [result] = await db.query(
      'INSERT INTO admin (username, password, nickname, role, status, permission_group_id, avatar) VALUES (?, ?, ?, ?, 1, ?, ?)',
      [username, hashedPassword, nickname || '', role || 'service', permission_group_id || null, avatar || '']
    );

    return res.success({ id: result.insertId }, '创建成功');
  } catch (err) {
    return res.fail('创建管理员失败: ' + err.message);
  }
});

/**
 * 删除管理员
 */
router.delete('/admin/delete', adminAuth, superAdminAuth, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.fail('缺少管理员ID');

    // 不能删除自己
    if (parseInt(id) === req.admin.id) {
      return res.fail('不能删除当前登录账号');
    }

    // 检查是否为超级管理员
    const [admins] = await db.query('SELECT role FROM admin WHERE id = ?', [id]);
    if (admins.length === 0) return res.fail('管理员不存在');

    await db.query('DELETE FROM admin WHERE id = ?', [id]);
    return res.success(null, '删除成功');
  } catch (err) {
    return res.fail('删除管理员失败: ' + err.message);
  }
});

// ============================================================
// 权限组管理
// ============================================================

/**
 * 获取权限组列表
 */
router.get('/permission-group/list', adminAuth, superAdminAuth, async (req, res) => {
  try {
    const [list] = await db.query('SELECT * FROM permission_group ORDER BY id ASC');
    // 解析权限，支持 JSON 数组或逗号分隔字符串
    const result = list.map(item => {
      let permissions = [];
      if (item.permissions) {
        const permStr = item.permissions.toString().trim();
        // 尝试解析 JSON 数组
        if (permStr.startsWith('[')) {
          try {
            const parsed = JSON.parse(permStr);
            permissions = Array.isArray(parsed) ? parsed : [];
          } catch {
            permissions = [];
          }
        } else {
          // 逗号分隔的字符串
          permissions = permStr.split(',').map(p => p.trim()).filter(p => p);
        }
      }
      return {
        id: item.id,
        name: item.name,
        permissions: permissions,
        created_at: item.created_at
      };
    });
    return res.success(result);
  } catch (err) {
    return res.fail('获取权限组列表失败: ' + err.message);
  }
});

/**
 * 创建权限组
 */
router.post('/permission-group/create', adminAuth, superAdminAuth, async (req, res) => {
  try {
    const { name, permissions } = req.body;

    if (!name) {
      return res.fail('权限组名称不能为空');
    }

    const [result] = await db.query(
      'INSERT INTO permission_group (name, permissions) VALUES (?, ?)',
      [name, JSON.stringify(permissions || [])]
    );

    return res.success({ id: result.insertId }, '创建成功');
  } catch (err) {
    return res.fail('创建权限组失败: ' + err.message);
  }
});

/**
 * 更新权限组
 */
router.put('/permission-group/update', adminAuth, superAdminAuth, async (req, res) => {
  try {
    const { id, name, permissions } = req.body;

    if (!id) return res.fail('缺少权限组ID');
    if (!name) return res.fail('权限组名称不能为空');

    await db.query(
      'UPDATE permission_group SET name = ?, permissions = ? WHERE id = ?',
      [name, JSON.stringify(permissions || []), id]
    );

    return res.success(null, '更新成功');
  } catch (err) {
    return res.fail('更新权限组失败: ' + err.message);
  }
});

/**
 * 删除权限组
 */
router.delete('/permission-group/delete', adminAuth, superAdminAuth, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.fail('缺少权限组ID');

    // 检查是否有管理员使用该权限组
    const [admins] = await db.query('SELECT COUNT(*) as count FROM admin WHERE permission_group_id = ?', [id]);
    if (admins[0].count > 0) {
      return res.fail('该权限组正在被使用，无法删除');
    }

    await db.query('DELETE FROM permission_group WHERE id = ?', [id]);
    return res.success(null, '删除成功');
  } catch (err) {
    return res.fail('删除权限组失败: ' + err.message);
  }
});

module.exports = router;
