/**
 * 订单模块路由（需登录）
 * POST   /api/order/create    - 创建订单
 * GET    /api/order/list      - 订单列表（支持状态筛选）
 * GET    /api/order/detail/:id - 订单详情
 * POST   /api/order/pay       - 发起支付
 * PUT    /api/order/cancel/:id - 取消订单
 * PUT    /api/order/confirm/:id - 确认收货
 * POST   /api/order/notify    - 微信支付回调通知
 * GET    /api/order/express/:id - 查询订单物流
 */
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middlewares/auth');
const { generateOrderNo, parsePagination } = require('../utils/index');
const { createWxPayOrder, decryptWxPayNotify } = require('../utils/wechat');

router.use(auth);

/**
 * 创建订单
 * 从购物车选中商品创建订单，支持直接购买
 */
router.post('/create', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { address_id, items, remark = '' } = req.body;
    // items: [{ product_id, spec_name, quantity }] 或 cart_ids: [1,2,3]
    const cart_ids = req.body.cart_ids;

    if (!address_id) {
      return res.fail('请选择收货地址');
    }

    // 查询收货地址
    const [addresses] = await conn.query(
      'SELECT * FROM address WHERE id = ? AND user_id = ?',
      [address_id, req.user.id]
    );
    if (addresses.length === 0) {
      return res.fail('收货地址不存在');
    }
    const address = addresses[0];

    let orderItems = [];

    if (items && items.length > 0) {
      // 直接购买模式
      for (const item of items) {
        const [products] = await conn.query(
          'SELECT * FROM product WHERE id = ? AND status = 1',
          [item.product_id]
        );
        if (products.length === 0) {
          await conn.rollback();
          return res.fail(`商品ID ${item.product_id} 不存在或已下架`);
        }
        const product = products[0];
        if (product.stock < item.quantity) {
          await conn.rollback();
          return res.fail(`商品"${product.name}"库存不足`);
        }
        orderItems.push({
          product_id: item.product_id,
          product_name: product.name,
          product_cover: product.cover,
          spec_name: item.spec_name || '',
          price: product.price,
          quantity: item.quantity,
          stock: product.stock
        });
      }
    } else if (cart_ids && cart_ids.length > 0) {
      // 从购物车创建订单
      const placeholders = cart_ids.map(() => '?').join(',');
      const [cartList] = await conn.query(
        `SELECT c.*, p.name, p.cover, p.price, p.stock, p.status 
         FROM cart c LEFT JOIN product p ON c.product_id = p.id 
         WHERE c.id IN (${placeholders}) AND c.user_id = ? AND c.checked = 1`,
        [...cart_ids, req.user.id]
      );

      if (cartList.length === 0) {
        await conn.rollback();
        return res.fail('请选择要结算的商品');
      }

      for (const cart of cartList) {
        if (cart.status !== 1) {
          await conn.rollback();
          return res.fail(`商品"${cart.name}"已下架`);
        }
        if (cart.stock < cart.quantity) {
          await conn.rollback();
          return res.fail(`商品"${cart.name}"库存不足`);
        }
        orderItems.push({
          product_id: cart.product_id,
          product_name: cart.name,
          product_cover: cart.cover,
          spec_name: cart.spec_name || '',
          price: cart.price,
          quantity: cart.quantity,
          stock: cart.stock
        });
      }
    } else {
      await conn.rollback();
      return res.fail('请选择要购买的商品');
    }

    // 计算订单金额
    const totalAmount = orderItems.reduce((sum, item) => {
      return sum + parseFloat(item.price) * item.quantity;
    }, 0);
    const payAmount = totalAmount; // 运费为0，后续可扩展

    // 生成订单号
    const orderNo = generateOrderNo();

    // 创建订单主表
    const addressSnapshot = JSON.stringify({
      name: address.name,
      phone: address.phone,
      province: address.province,
      city: address.city,
      district: address.district,
      detail: address.detail,
      postal_code: address.postal_code
    });

    const [orderResult] = await conn.query(
      `INSERT INTO orders (order_no, user_id, total_amount, pay_amount, freight_amount, status, address_snapshot, remark) 
       VALUES (?, ?, ?, ?, 0, 0, ?, ?)`,
      [orderNo, req.user.id, totalAmount, payAmount, addressSnapshot, remark]
    );

    const orderId = orderResult.insertId;

    // 创建订单明细 + 扣减库存
    for (const item of orderItems) {
      const itemTotal = parseFloat(item.price) * item.quantity;
      await conn.query(
        `INSERT INTO order_item (order_id, product_id, product_name, product_cover, spec_name, price, quantity, total_price) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.product_name, item.product_cover, item.spec_name, item.price, item.quantity, itemTotal]
      );

      // 扣减库存
      await conn.query(
        'UPDATE product SET stock = stock - ? WHERE id = ? AND stock >= ?',
        [item.quantity, item.product_id, item.quantity]
      );

      // 增加销量
      await conn.query(
        'UPDATE product SET sales = sales + ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    // 清除已下单的购物车商品
    if (cart_ids && cart_ids.length > 0) {
      const placeholders = cart_ids.map(() => '?').join(',');
      await conn.query(`DELETE FROM cart WHERE id IN (${placeholders}) AND user_id = ?`, [...cart_ids, req.user.id]);
    }

    await conn.commit();

    return res.success({
      order_id: orderId,
      order_no: orderNo,
      total_amount: payAmount.toFixed(2)
    }, '下单成功');
  } catch (err) {
    await conn.rollback();
    console.error('创建订单失败:', err);
    return res.fail('下单失败: ' + err.message);
  } finally {
    conn.release();
  }
});

/**
 * 订单列表
 * status: 0全部 1待支付 2待发货 3待收货 4已完成（小程序端状态映射）
 */
router.get('/list', async (req, res) => {
  try {
    const { status, page = 1, pageSize = 10 } = req.query;
    const { offset, limit } = parsePagination(page, pageSize);

    let where = 'WHERE user_id = ?';
    const params = [req.user.id];

    // 状态筛选
    if (status && status !== '0') {
      // 前端传的status与数据库status的映射：
      // 1=待支付(0) 2=待发货(1) 3=待收货(2) 4=已完成(3)
      const statusMap = { '1': 0, '2': 1, '3': 2, '4': 3 };
      const dbStatus = statusMap[status];
      if (dbStatus !== undefined) {
        where += ' AND o.status = ?';
        params.push(dbStatus);
      }
    }

    const [list] = await db.query(
      `SELECT o.id, o.order_no, o.total_amount, o.pay_amount, o.status, o.pay_time, 
              o.express_company, o.express_no, o.created_at,
              (SELECT oi.product_cover FROM order_item oi WHERE oi.order_id = o.id LIMIT 1) as first_cover
       FROM orders o ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
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
 * 订单详情
 */
router.get('/detail/:id', async (req, res) => {
  try {
    const orderId = req.params.id;

    const [orders] = await db.query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [orderId, req.user.id]
    );

    if (orders.length === 0) {
      return res.fail('订单不存在', 404);
    }

    const order = orders[0];
    // 解析地址快照
    try { order.address_snapshot = JSON.parse(order.address_snapshot); } catch { order.address_snapshot = {}; }

    // 获取订单明细
    const [items] = await db.query(
      'SELECT * FROM order_item WHERE order_id = ?',
      [orderId]
    );

    // 获取支付记录
    const [payments] = await db.query(
      'SELECT * FROM payment WHERE order_no = ? ORDER BY id DESC LIMIT 1',
      [order.order_no]
    );

    order.items = items;
    order.payment = payments[0] || null;

    return res.success(order);
  } catch (err) {
    return res.fail('获取订单详情失败: ' + err.message);
  }
});

/**
 * 发起支付 - 调用微信支付 V3
 */
router.post('/pay', async (req, res) => {
  try {
    const { order_id } = req.body;

    // 查询订单
    const [orders] = await db.query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ? AND status = 0',
      [order_id, req.user.id]
    );
    if (orders.length === 0) {
      return res.fail('订单不存在或状态不正确');
    }

    const order = orders[0];

    // 检查微信支付配置是否完整
    const wxConfigured = process.env.WX_MCH_ID &&
                         process.env.WX_MCH_APIV3_KEY &&
                         process.env.WX_APPID !== 'wx0000000000000000';

    if (!wxConfigured) {
      // 微信支付未配置，模拟支付成功（开发测试用）
      console.log('微信支付未配置，使用模拟支付');

      // 模拟直接支付成功
      await db.query(
        'UPDATE orders SET status = 1, pay_time = NOW(), pay_type = ? WHERE id = ?',
        ['wechat', order_id]
      );

      // 创建支付记录
      await db.query(
        'INSERT INTO payment (order_no, transaction_id, pay_type, amount, status, pay_time) VALUES (?, ?, ?, ?, 1, NOW())',
        [order.order_no, `MOCK_${Date.now()}`, 'wechat', order.pay_amount]
      );

      return res.success({
        mock: true,
        message: '模拟支付成功（微信支付未配置）'
      }, '支付成功');
    }

    // 正常微信支付流程
    // 金额单位转换为分
    const amountInCents = Math.round(parseFloat(order.pay_amount) * 100);

    const payParams = await createWxPayOrder(
      order.order_no,
      amountInCents,
      `订单-${order.order_no}`,
      req.user.openid
    );

    // 创建待支付记录
    await db.query(
      'INSERT INTO payment (order_no, pay_type, amount, status) VALUES (?, ?, ?, 0)',
      [order.order_no, 'wechat', order.pay_amount]
    );

    return res.success({
      ...payParams,
      order_no: order.order_no
    });
  } catch (err) {
    console.error('支付失败:', err);
    return res.fail('支付失败: ' + err.message);
  }
});

/**
 * 取消订单
 */
router.put('/cancel/:id', async (req, res) => {
  try {
    const orderId = req.params.id;

    const [orders] = await db.query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [orderId, req.user.id]
    );
    if (orders.length === 0) return res.fail('订单不存在');

    const order = orders[0];
    if (order.status !== 0) return res.fail('只有待支付的订单可以取消');

    // 更新订单状态为已取消
    await db.query('UPDATE orders SET status = 4 WHERE id = ?', [orderId]);

    // 恢复库存
    const [items] = await db.query('SELECT product_id, quantity FROM order_item WHERE order_id = ?', [orderId]);
    for (const item of items) {
      await db.query('UPDATE product SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
      await db.query('UPDATE product SET sales = sales - ? WHERE id = ?', [item.quantity, item.product_id]);
    }

    return res.success(null, '订单已取消');
  } catch (err) {
    return res.fail('取消订单失败: ' + err.message);
  }
});

/**
 * 确认收货
 */
router.put('/confirm/:id', async (req, res) => {
  try {
    const orderId = req.params.id;

    const [orders] = await db.query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [orderId, req.user.id]
    );
    if (orders.length === 0) return res.fail('订单不存在');

    const order = orders[0];
    if (order.status !== 2) return res.fail('只有已发货的订单可以确认收货');

    await db.query(
      'UPDATE orders SET status = 3, confirm_time = NOW() WHERE id = ?',
      [orderId]
    );

    return res.success(null, '已确认收货');
  } catch (err) {
    return res.fail('确认收货失败: ' + err.message);
  }
});

/**
 * 查询订单物流信息
 */
router.get('/express/:id', async (req, res) => {
  try {
    const orderId = req.params.id;

    const [orders] = await db.query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [orderId, req.user.id]
    );
    if (orders.length === 0) return res.fail('订单不存在');

    const order = orders[0];
    if (!order.express_company || !order.express_no) {
      return res.success(null, '暂无物流信息');
    }

    // 查询快递公司编码
    const [expressList] = await db.query(
      'SELECT code FROM express WHERE name = ?',
      [order.express_company]
    );

    if (expressList.length === 0) {
      return res.success({
        express_company: order.express_company,
        express_no: order.express_no,
        message: '暂无物流轨迹'
      });
    }

    // 调用快递查询工具
    const expressQuery = require('../utils/express');
    const result = await expressQuery.queryExpress100(
      expressList[0].code,
      order.express_no
    );

    return res.success(result);
  } catch (err) {
    return res.fail('查询物流失败: ' + err.message);
  }
});

/**
 * 微信支付回调通知（无需登录验证）
 * 注意：此接口需要在路由注册时排除 auth 中间件
 */
router.post('/notify', async (req, res) => {
  try {
    const { resource } = req.body;

    if (!resource) {
      return res.status(400).json({ code: 'FAIL', message: '缺少通知数据' });
    }

    // 解密通知数据
    const payData = decryptWxPayNotify(resource);

    const orderNo = payData.out_trade_no;
    const transactionId = payData.transaction_id;
    const tradeState = payData.trade_state; // SUCCESS / NOTPAY / CLOSED 等

    if (tradeState === 'SUCCESS') {
      // 更新订单状态
      const [orders] = await db.query(
        'SELECT * FROM orders WHERE order_no = ? AND status = 0',
        [orderNo]
      );

      if (orders.length > 0) {
        // 标记订单为已支付
        await db.query(
          'UPDATE orders SET status = 1, pay_time = NOW(), pay_type = ? WHERE order_no = ?',
          ['wechat', orderNo]
        );

        // 更新支付记录
        await db.query(
          'UPDATE payment SET transaction_id = ?, status = 1, pay_time = NOW(), notify_data = ? WHERE order_no = ? AND status = 0',
          [transactionId, JSON.stringify(req.body), orderNo]
        );
      }
    }

    // 微信要求返回此格式表示处理成功
    res.json({ code: 'SUCCESS', message: '成功' });
  } catch (err) {
    console.error('支付回调处理失败:', err);
    res.status(500).json({ code: 'FAIL', message: '处理失败' });
  }
});

module.exports = router;
