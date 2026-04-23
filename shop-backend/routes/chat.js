/**
 * 客服聊天模块路由
 */
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const userAuth = require('../middlewares/auth');
const adminAuth = require('../middlewares/adminAuth');

// 客服分配轮询状态（内存中存储，生产环境建议用Redis）
let serviceRoundRobin = {
  lastIndex: 0,
  serviceIds: []
};

/**
 * 获取所有可用的客服列表
 */
async function getAvailableServices() {
  const [services] = await db.query(
    `SELECT id, nickname, avatar, service_status FROM admin 
     WHERE role = 'service' AND status = 1 
     ORDER BY id ASC`
  );
  // 只返回在线的客服
  return services.filter(s => s.service_status === 'online' || !s.service_status);
}

/**
 * 轮询获取下一个可用客服
 */
async function getNextService() {
  const services = await getAvailableServices();
  
  if (services.length === 0) {
    // 如果没有在线客服，返回第一个客服账号
    const [all] = await db.query(
      `SELECT id, nickname, avatar FROM admin WHERE role = 'service' AND status = 1 LIMIT 1`
    );
    return all.length > 0 ? all[0] : null;
  }
  
  // 轮询分配
  const idx = serviceRoundRobin.lastIndex % services.length;
  serviceRoundRobin.lastIndex++;
  return services[idx];
}

/**
 * 查找用户之前的客服（确保同一用户始终分配给同一个客服）
 */
async function getUserAssignedService(userId) {
  // 查找该用户的历史会话中分配过的客服（最新的一个）
  const [sessions] = await db.query(
    `SELECT admin_id FROM chat_session 
     WHERE user_id = ? AND admin_id IS NOT NULL 
     ORDER BY id DESC LIMIT 1`,
    [userId]
  );
  
  if (sessions.length > 0 && sessions[0].admin_id) {
    // 检查该客服是否仍然可用
    const [admin] = await db.query(
      'SELECT id, nickname, avatar FROM admin WHERE id = ? AND status = 1',
      [sessions[0].admin_id]
    );
    if (admin.length > 0) {
      return admin[0];
    }
  }
  
  return null;
}

/**
 * 获取或创建会话（用户端）
 * POST /api/chat/session
 */
router.post('/session', userAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, orderId } = req.body;

    // 查找现有会话
    let [sessions] = await db.query(
      'SELECT * FROM chat_session WHERE user_id = ? AND status = 1 ORDER BY last_time DESC LIMIT 1',
      [userId]
    );

    let sessionId, assignedAdmin = null;
    
    if (sessions.length === 0) {
      // 创建新会话
      // 1. 先尝试获取该用户之前的客服（确保同一用户始终分配给同一个客服）
      let admin = await getUserAssignedService(userId);
      
      // 2. 如果没有历史记录，轮询分配一个新客服
      if (!admin) {
        admin = await getNextService();
      }
      
      const [result] = await db.query(
        'INSERT INTO chat_session (user_id, admin_id, product_id, order_id) VALUES (?, ?, ?, ?)',
        [userId, admin ? admin.id : null, productId || null, orderId || null]
      );
      sessionId = result.insertId;
      assignedAdmin = admin;
      console.log(`【创建新会话】userId:${userId} 分配客服:${admin?.nickname || '无'}`);
    } else {
      sessionId = sessions[0].id;
      assignedAdmin = sessions[0].admin_id;
      // 更新商品信息
      if (productId) {
        await db.query('UPDATE chat_session SET product_id = ? WHERE id = ?', [productId, sessionId]);
      }
    }
    
    // 获取客服信息
    let adminInfo = null;
    if (assignedAdmin) {
      const [admin] = await db.query(
        'SELECT id, nickname, avatar FROM admin WHERE id = ?',
        [assignedAdmin]
      );
      if (admin.length > 0) {
        adminInfo = admin[0];
      }
    }

    return res.success({ sessionId, admin: adminInfo });
  } catch (err) {
    return res.fail('创建会话失败: ' + err.message);
  }
});

/**
 * 发送消息（用户端）
 * POST /api/chat/send
 */
router.post('/send', userAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { content, contentType = 'text', productId } = req.body;
    
    console.log('【用户发送消息】userId:', userId, 'content:', content, 'productId:', productId);

    if (!content) return res.fail('消息内容不能为空');

    // 获取或创建会话
    let [sessions] = await db.query(
      'SELECT * FROM chat_session WHERE user_id = ? AND status = 1 ORDER BY last_time DESC LIMIT 1',
      [userId]
    );

    let sessionId, assignedAdminId = null;
    if (sessions.length === 0) {
      // 创建新会话时，也要分配客服
      let admin = await getUserAssignedService(userId);
      if (!admin) {
        admin = await getNextService();
      }
      
      const [result] = await db.query(
        'INSERT INTO chat_session (user_id, admin_id, product_id) VALUES (?, ?, ?)',
        [userId, admin ? admin.id : null, productId || null]
      );
      sessionId = result.insertId;
      assignedAdminId = admin ? admin.id : null;
      console.log('【新建会话】sessionId:', sessionId, '分配客服:', admin?.nickname);
    } else {
      sessionId = sessions[0].id;
      assignedAdminId = sessions[0].admin_id;
      console.log('【使用已有会话】sessionId:', sessionId, '客服:', assignedAdminId);
    }

    // 保存消息
    const [result] = await db.query(
      'INSERT INTO chat_message (session_id, sender_type, sender_id, content_type, content) VALUES (?, 1, ?, ?, ?)',
      [sessionId, userId, contentType, content]
    );
    console.log('【消息已保存】messageId:', result.insertId);

    // 更新会话信息
    await db.query(
      'UPDATE chat_session SET last_message = ?, last_time = NOW(), admin_unread = admin_unread + 1 WHERE id = ?',
      [content.substring(0, 100), sessionId]
    );

    // 异步推送用户商品信息给客服（待发货订单优先，否则推送浏览商品）
    pushUserProductInfo(sessionId, userId, assignedAdminId);

    return res.success({ messageId: result.insertId, sessionId }, '发送成功');
  } catch (err) {
    console.error('【发送消息失败】', err);
    return res.fail('发送失败: ' + err.message);
  }
});

/**
 * 推送用户商品信息给客服
 * 优先推送待发货订单商品，否则推送最近浏览商品
 * 24小时内只推送一次
 */
async function pushUserProductInfo(sessionId, userId, assignedAdminId) {
  try {
    // 1. 检查是否在24小时内已经推送过商品卡片
    const [sessionInfo] = await db.query(
      'SELECT product_card_time FROM chat_session WHERE id = ?',
      [sessionId]
    );
    
    if (sessionInfo.length > 0 && sessionInfo[0].product_card_time) {
      const lastTime = new Date(sessionInfo[0].product_card_time).getTime();
      const now = Date.now();
      // 如果距离上次推送不足24小时，不推送
      if (now - lastTime < 24 * 60 * 60 * 1000) {
        console.log(`【商品卡片】会话${sessionId} 24小时内已推送过，跳过`);
        return;
      }
    }

    let product = null;
    let messageType = '';

    // 2. 查询是否有待发货订单商品
    const [pendingOrders] = await db.query(
      `SELECT oi.product_id, p.name, p.cover, p.price
       FROM orders o
       JOIN order_item oi ON o.id = oi.order_id
       JOIN product p ON oi.product_id = p.id
       WHERE o.user_id = ? AND o.status = 1
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (pendingOrders.length > 0) {
      product = pendingOrders[0];
      messageType = '待发货商品';
    } else {
      // 3. 查询最近浏览的商品（从会话中获取）
      const [sessions] = await db.query(
        'SELECT product_id FROM chat_session WHERE id = ? AND product_id IS NOT NULL',
        [sessionId]
      );
      
      if (sessions.length > 0 && sessions[0].product_id) {
        const [products] = await db.query(
          'SELECT id as product_id, name, cover, price FROM product WHERE id = ?',
          [sessions[0].product_id]
        );
        if (products.length > 0) {
          product = products[0];
          messageType = '浏览商品';
        }
      }
    }

    // 4. 如果找到商品，自动发送商品卡片消息
    if (product) {
      // 使用分配给该用户的客服ID作为发送者
      const adminId = assignedAdminId || 1;
      
      // 保存商品卡片消息
      await db.query(
        'INSERT INTO chat_message (session_id, sender_type, sender_id, content_type, content, extra_data) VALUES (?, 2, ?, ?, ?, ?)',
        [sessionId, adminId, 'product', `[${messageType}] ${product.name}`, JSON.stringify({
          id: product.product_id,
          name: product.name,
          cover: product.cover,
          price: product.price
        })]
      );

      // 更新会话，同时记录推送时间
      await db.query(
        'UPDATE chat_session SET last_message = ?, last_time = NOW(), unread_count = unread_count + 1, product_card_time = NOW() WHERE id = ?',
        [`[${messageType}] ${product.name}`, sessionId]
      );
      
      console.log(`【商品卡片】会话${sessionId} 推送成功，24小时有效`);
    }
  } catch (err) {
    console.error('推送用户商品信息失败:', err);
  }
}

/**
 * 获取消息列表（用户端）
 * GET /api/chat/messages
 */
router.get('/messages', userAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // 获取用户会话
    const [sessions] = await db.query(
      'SELECT * FROM chat_session WHERE user_id = ? AND status = 1 ORDER BY last_time DESC LIMIT 1',
      [userId]
    );

    if (sessions.length === 0) {
      return res.success({ messages: [], session: null });
    }

    const sessionId = sessions[0].id;
    const session = sessions[0];

    // 获取分配的客服信息
    let adminInfo = null;
    if (session.admin_id) {
      const [admin] = await db.query(
        'SELECT id, nickname, avatar, service_status FROM admin WHERE id = ?',
        [session.admin_id]
      );
      if (admin.length > 0) {
        adminInfo = admin[0];
      }
    }

    // 获取消息
    const [messages] = await db.query(
      `SELECT m.*, 
              u.nickname as sender_name, 
              u.avatar as sender_avatar,
              a.nickname as admin_name,
              a.avatar as admin_avatar
       FROM chat_message m 
       LEFT JOIN user u ON m.sender_id = u.id AND m.sender_type = 1
       LEFT JOIN admin a ON m.sender_id = a.id AND m.sender_type = 2
       WHERE m.session_id = ? 
       ORDER BY m.created_at ASC 
       LIMIT 100`,
      [sessionId]
    );

    // 标记消息为已读
    await db.query(
      'UPDATE chat_message SET is_read = 1 WHERE session_id = ? AND sender_type = 2 AND is_read = 0',
      [sessionId]
    );

    // 重置未读数
    await db.query('UPDATE chat_session SET unread_count = 0 WHERE id = ?', [sessionId]);

    return res.success({ messages, session: { ...session, admin: adminInfo } });
  } catch (err) {
    return res.fail('获取消息失败: ' + err.message);
  }
});

// ==================== 客服后台接口 ====================

/**
 * 获取会话列表（客服端）
 * GET /api/chat/sessions
 */
router.get('/sessions', adminAuth, async (req, res) => {
  try {
    const adminId = req.admin.id;
    const { status = 1, page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;

    console.log('【获取会话列表】adminId:', adminId, 'status:', status);

    // 只获取分配给当前客服的会话
    const [sessions] = await db.query(
      `SELECT s.id, s.user_id, s.admin_id, s.product_id, s.order_id, s.status, s.unread_count, s.admin_unread, s.last_message, s.last_time, s.created_at,
              u.nickname, u.avatar,
              p.name as product_name, p.cover as product_cover, p.price as product_price,
              a.nickname as admin_name, a.avatar as admin_avatar
       FROM chat_session s 
       LEFT JOIN user u ON s.user_id = u.id
       LEFT JOIN product p ON s.product_id = p.id
       LEFT JOIN admin a ON s.admin_id = a.id
       WHERE s.status = ? AND (s.admin_id = ? OR s.admin_id IS NULL)
       ORDER BY s.last_time DESC
       LIMIT ? OFFSET ?`,
      [status, adminId, parseInt(pageSize), parseInt(offset)]
    );

    console.log('【会话列表数据】共', sessions.length, '条');

    // 获取所有有昵称的用户列表，按 ID 排序
    const [allUsers] = await db.query(
      'SELECT id, nickname FROM user WHERE nickname IS NOT NULL AND nickname != "" ORDER BY id'
    );
    const usersWithNickname = new Set(allUsers.map(u => u.id));

    // 为没有昵称的用户分配序号
    const [allUsersWithoutNickname] = await db.query(
      'SELECT id FROM user WHERE nickname IS NULL OR nickname = "" ORDER BY id'
    );
    const userSeqMap = {};
    allUsersWithoutNickname.forEach((u, idx) => {
      userSeqMap[u.id] = idx + 1;
    });

    // 转换格式以适配前端，确保类型一致
    const result = sessions.map(s => {
      // 判断是否需要使用序号名称
      const isDefaultNickname = !s.nickname || 
                                s.nickname.trim() === '' || 
                                s.nickname === '测试用户' ||
                                s.nickname.startsWith('测试用户');
      
      let displayName;
      if (isDefaultNickname) {
        const seq = userSeqMap[s.user_id];
        displayName = seq ? `用户${seq}号` : `用户${s.user_id}号`;
      } else {
        displayName = s.nickname;
      }
      
      return {
        id: Number(s.id),
        user_id: Number(s.user_id),
        admin_id: Number(s.admin_id) || null,
        nickname: displayName,
        avatar: s.avatar,
        last_message: s.last_message,
        last_time: s.last_time,
        unread: Number(s.admin_unread) || 0,
        product_name: s.product_name,
        product_cover: s.product_cover,
        product_price: s.product_price
      };
    });

    console.log('【返回数据】', JSON.stringify(result));
    return res.success(result);
  } catch (err) {
    console.error('【获取会话列表失败】', err);
    return res.fail('获取会话列表失败: ' + err.message);
  }
});

/**
 * 获取用户信息（客服端）
 * GET /api/chat/user-info
 */
router.get('/user-info', adminAuth, async (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.fail('缺少用户ID');

    // 获取用户基本信息
    const [users] = await db.query(
      'SELECT id, nickname, avatar, phone, created_at FROM user WHERE id = ?',
      [userId]
    );

    if (users.length === 0) return res.fail('用户不存在', 404);

    const user = users[0];

    // 获取订单统计
    const [orderStats] = await db.query(
      `SELECT COUNT(*) as order_count, COALESCE(SUM(pay_amount), 0) as total_amount 
       FROM orders WHERE user_id = ? AND status >= 1`,
      [userId]
    );

    return res.success({
      id: user.id,
      nickname: user.nickname || '未设置昵称',
      avatar: user.avatar,
      phone: user.phone,
      created_at: user.created_at,
      order_count: orderStats[0].order_count,
      total_amount: parseFloat(orderStats[0].total_amount).toFixed(2)
    });
  } catch (err) {
    return res.fail('获取用户信息失败: ' + err.message);
  }
});

/**
 * 获取用户订单列表（客服端）
 * GET /api/chat/admin/orders
 */
router.get('/admin/orders', adminAuth, async (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.fail('缺少用户ID');

    const [orders] = await db.query(
      `SELECT o.id, o.order_no, o.pay_amount, o.status, o.created_at, o.pay_time, o.express_company, o.express_no,
              a.contact_name, a.phone as addr_phone, a.province, a.city, a.district, a.address as addr_address
       FROM orders o
       LEFT JOIN address a ON o.address_id = a.id
       WHERE o.user_id = ?
       ORDER BY o.created_at DESC
       LIMIT 20`,
      [userId]
    );

    return res.success(orders);
  } catch (err) {
    return res.fail('获取订单列表失败: ' + err.message);
  }
});

/**
 * 获取用户收货地址（客服端）
 * GET /api/chat/admin/addresses
 */
router.get('/admin/addresses', adminAuth, async (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.fail('缺少用户ID');

    const [addresses] = await db.query(
      `SELECT id, contact_name, phone, province, city, district, address, is_default
       FROM address
       WHERE user_id = ?
       ORDER BY is_default DESC, id DESC`,
      [userId]
    );

    return res.success(addresses);
  } catch (err) {
    return res.fail('获取收货地址失败: ' + err.message);
  }
});

/**
 * 获取会话消息（客服端）- 独立端点
 * GET /api/chat/admin/messages
 * 支持 session_id 或 user_id 参数
 */
router.get('/admin/messages', adminAuth, async (req, res) => {
  try {
    const adminId = req.admin.id;
    let sessionId = req.query.session_id;
    const userId = req.query.user_id;

    console.log('【客服获取消息】adminId:', adminId, 'session_id:', sessionId, 'user_id:', userId);

    // 如果没有传 session_id，用 user_id 查找最新会话（兼容旧逻辑）
    if (!sessionId && userId) {
      const [sessions] = await db.query(
        `SELECT id FROM chat_session 
         WHERE user_id = ? AND status = 1 AND (admin_id = ? OR admin_id IS NULL)
         ORDER BY last_time DESC LIMIT 1`,
        [userId, adminId]
      );
      
      if (sessions.length === 0) {
        console.log('【未找到会话】');
        return res.success([]);
      }
      
      sessionId = sessions[0].id;
      console.log('【通过user_id找到会话】session_id:', sessionId);
    }
    
    if (!sessionId) {
      return res.fail('缺少会话ID或用户ID');
    }
    
    // 验证该会话是否分配给当前客服
    const [verifySession] = await db.query(
      'SELECT admin_id FROM chat_session WHERE id = ?',
      [sessionId]
    );
    
    if (verifySession.length > 0 && verifySession[0].admin_id && verifySession[0].admin_id !== adminId) {
      console.log('【会话不属于当前客服】');
      return res.fail('无权查看此会话');
    }
    
    console.log('【获取会话消息】session_id:', sessionId);

    const [messages] = await db.query(
      `SELECT m.*, 
              u.nickname as user_nickname, 
              u.avatar as user_avatar,
              a.nickname as admin_nickname,
              a.avatar as admin_avatar
       FROM chat_message m 
       LEFT JOIN user u ON m.sender_id = u.id AND m.sender_type = 1
       LEFT JOIN admin a ON m.sender_id = a.id AND m.sender_type = 2
       WHERE m.session_id = ? 
       ORDER BY m.created_at ASC 
       LIMIT 200`,
      [sessionId]
    );

    console.log('【消息数量】', messages.length);
    console.log('【消息详情】', messages.map(m => ({id: m.id, content: m.content.substring(0, 30)})));

    // 标记用户消息为已读
    await db.query(
      'UPDATE chat_message SET is_read = 1 WHERE session_id = ? AND sender_type = 1 AND is_read = 0',
      [sessionId]
    );

    // 重置客服未读数
    await db.query('UPDATE chat_session SET admin_unread = 0 WHERE id = ?', [sessionId]);

    // 转换格式以适配前端
    const result = messages.map(m => {
      const isAdmin = m.sender_type === 2;
      let productData = null;
      
      if (m.content_type === 'product' && m.extra_data) {
        try {
          productData = typeof m.extra_data === 'string' ? JSON.parse(m.extra_data) : m.extra_data;
        } catch (e) {}
      }
      
      return {
        id: m.id,
        content: m.content,
        type: m.content_type,
        from_admin: isAdmin,
        sender_name: isAdmin ? m.admin_nickname : m.user_nickname,
        sender_avatar: isAdmin ? m.admin_avatar : m.user_avatar,
        created_at: m.created_at,
        product_data: productData
      };
    });

    return res.success(result);
  } catch (err) {
    console.error('【获取消息失败】', err);
    return res.fail('获取消息失败: ' + err.message);
  }
});

/**
 * 客服发送消息
 * POST /api/chat/admin/send
 */
router.post('/admin/send', adminAuth, async (req, res) => {
  try {
    const adminId = req.admin.id;
    const { sessionId, content, contentType = 'text', session_id, user_id, type, product_id } = req.body;

    console.log('【客服发送消息】参数:', { sessionId, session_id, user_id, content, type, product_id });

    // 兼容两种参数格式：sessionId 或 session_id
    const realSessionId = sessionId || session_id;
    const msgType = type || contentType;
    const finalContent = content;

    if (!realSessionId || !finalContent) {
      return res.fail('缺少会话ID或消息内容');
    }

    // 保存消息
    let extraData = null;
    if ((type === 'product' || contentType === 'product') && product_id) {
      // 获取商品信息
      const [products] = await db.query(
        'SELECT id, name, cover, price FROM product WHERE id = ?',
        [product_id]
      );
      if (products.length > 0) {
        extraData = JSON.stringify(products[0]);
      }
    }

    const [result] = await db.query(
      'INSERT INTO chat_message (session_id, sender_type, sender_id, content_type, content, extra_data) VALUES (?, 2, ?, ?, ?, ?)',
      [realSessionId, adminId, msgType, finalContent, extraData]
    );

    // 更新会话
    await db.query(
      'UPDATE chat_session SET last_message = ?, last_time = NOW(), unread_count = unread_count + 1 WHERE id = ?',
      [finalContent.substring(0, 100), realSessionId]
    );

    return res.success({ messageId: result.insertId, sessionId: realSessionId }, '发送成功');
  } catch (err) {
    console.error('【发送消息失败】', err);
    return res.fail('发送失败: ' + err.message);
  }
});

/**
 * 关闭会话
 * PUT /api/chat/session/:id/close
 */
router.put('/session/:id/close', adminAuth, async (req, res) => {
  try {
    const sessionId = req.params.id;
    await db.query('UPDATE chat_session SET status = 0 WHERE id = ?', [sessionId]);
    return res.success(null, '会话已关闭');
  } catch (err) {
    return res.fail('关闭会话失败: ' + err.message);
  }
});

/**
 * 发送商品卡片消息
 * POST /api/chat/admin/send-product
 */
router.post('/admin/send-product', adminAuth, async (req, res) => {
  try {
    const adminId = req.admin.id;
    const { sessionId, productId } = req.body;

    if (!sessionId || !productId) return res.fail('参数错误');

    // 获取商品信息
    const [products] = await db.query(
      'SELECT id, name, cover, price FROM product WHERE id = ?',
      [productId]
    );

    if (products.length === 0) return res.fail('商品不存在');

    const product = products[0];

    // 保存消息
    const [result] = await db.query(
      'INSERT INTO chat_message (session_id, sender_type, sender_id, content_type, content, extra_data) VALUES (?, 2, ?, ?, ?, ?)',
      [sessionId, adminId, 'product', product.name, JSON.stringify(product)]
    );

    // 更新会话
    await db.query(
      'UPDATE chat_session SET last_message = ?, last_time = NOW(), unread_count = unread_count + 1 WHERE id = ?',
      [`[商品] ${product.name}`, sessionId]
    );

    return res.success({ messageId: result.insertId }, '发送成功');
  } catch (err) {
    return res.fail('发送失败: ' + err.message);
  }
});

/**
 * 获取用户统计信息（客服端）
 * GET /api/chat/user/:id/stats
 */
router.get('/user/:id/stats', adminAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // 订单统计
    const [orderStats] = await db.query(
      `SELECT COUNT(*) as order_count, COALESCE(SUM(total_amount), 0) as total_spent 
       FROM orders WHERE user_id = ?`,
      [userId]
    );
    
    // 会话统计
    const [sessionStats] = await db.query(
      'SELECT COUNT(*) as session_count FROM chat_session WHERE user_id = ?',
      [userId]
    );
    
    return res.success({
      order_count: orderStats[0].order_count,
      total_spent: orderStats[0].total_spent,
      session_count: sessionStats[0].session_count
    });
  } catch (err) {
    return res.fail('获取用户统计失败: ' + err.message);
  }
});

/**
 * 清空会话消息（客服端）
 * DELETE /api/chat/session/:id/messages
 */
router.delete('/session/:id/messages', adminAuth, async (req, res) => {
  try {
    const sessionId = req.params.id;
    await db.query('DELETE FROM chat_message WHERE session_id = ?', [sessionId]);
    await db.query('UPDATE chat_session SET last_message = "" WHERE id = ?', [sessionId]);
    return res.success(null, '会话消息已清空');
  } catch (err) {
    return res.fail('清空会话失败: ' + err.message);
  }
});

// ==================== 超级管理员查看子用户聊天统计 ====================

/**
 * 获取所有客服（子用户）的聊天统计
 * GET /api/chat/admin/stats
 * 仅超级管理员可访问
 */
router.get('/admin/stats', adminAuth, async (req, res) => {
  try {
    // 检查是否为超级管理员
    const [admins] = await db.query('SELECT role FROM admin WHERE id = ?', [req.admin.id]);
    if (admins.length === 0 || admins[0].role !== 'super') {
      return res.fail('无权限访问', 403);
    }

    // 获取所有客服（子用户）
    const [staffList] = await db.query(
      'SELECT id, username, nickname, avatar, status FROM admin WHERE role = "service" ORDER BY id ASC'
    );

    // 获取每个客服的统计数据
    const stats = await Promise.all(staffList.map(async (staff) => {
      // 服务客户数（有消息的会话）
      const [customerCount] = await db.query(
        `SELECT COUNT(DISTINCT s.user_id) as count 
         FROM chat_session s 
         JOIN chat_message m ON s.id = m.session_id 
         WHERE m.sender_type = 2 AND m.sender_id = ?`,
        [staff.id]
      );

      // 总消息数
      const [messageCount] = await db.query(
        'SELECT COUNT(*) as count FROM chat_message WHERE sender_type = 2 AND sender_id = ?',
        [staff.id]
      );

      // 今日消息数
      const [todayCount] = await db.query(
        `SELECT COUNT(*) as count FROM chat_message 
         WHERE sender_type = 2 AND sender_id = ? AND DATE(created_at) = CURDATE()`,
        [staff.id]
      );

      return {
        ...staff,
        customer_count: customerCount[0].count,
        total_messages: messageCount[0].count,
        today_messages: todayCount[0].count
      };
    }));

    return res.success(stats);
  } catch (err) {
    return res.fail('获取客服统计失败: ' + err.message);
  }
});

/**
 * 获取指定客服服务的客户列表
 * GET /api/chat/admin/:id/customers
 */
router.get('/admin/:id/customers', adminAuth, async (req, res) => {
  try {
    // 检查是否为超级管理员
    const [admins] = await db.query('SELECT role FROM admin WHERE id = ?', [req.admin.id]);
    if (admins.length === 0 || admins[0].role !== 'super') {
      return res.fail('无权限访问', 403);
    }

    const staffId = req.params.id;

    // 获取该客服服务过的所有客户及最新消息
    const [customers] = await db.query(
      `SELECT DISTINCT 
        u.id as user_id, 
        u.nickname, 
        u.avatar,
        s.id as session_id,
        s.last_message,
        s.last_time,
        (SELECT COUNT(*) FROM chat_message WHERE session_id = s.id AND sender_type = 2) as message_count
       FROM chat_session s
       JOIN chat_message m ON s.id = m.session_id
       JOIN user u ON s.user_id = u.id
       WHERE m.sender_type = 2 AND m.sender_id = ?
       ORDER BY s.last_time DESC`,
      [staffId]
    );

    return res.success(customers);
  } catch (err) {
    return res.fail('获取客户列表失败: ' + err.message);
  }
});

/**
 * 获取指定会话的聊天记录
 * GET /api/chat/admin/session/:id/messages
 */
router.get('/admin/session/:id/messages', adminAuth, async (req, res) => {
  try {
    // 检查是否为超级管理员
    const [admins] = await db.query('SELECT role FROM admin WHERE id = ?', [req.admin.id]);
    if (admins.length === 0 || admins[0].role !== 'super') {
      return res.fail('无权限访问', 403);
    }

    const sessionId = req.params.id;

    const [messages] = await db.query(
      `SELECT m.*, 
              u.nickname as user_name, 
              u.avatar as user_avatar,
              a.nickname as admin_name,
              a.avatar as admin_avatar
       FROM chat_message m 
       LEFT JOIN user u ON m.sender_id = u.id AND m.sender_type = 1
       LEFT JOIN admin a ON m.sender_id = a.id AND m.sender_type = 2
       WHERE m.session_id = ? 
       ORDER BY m.created_at ASC 
       LIMIT 500`,
      [sessionId]
    );

    return res.success(messages);
  } catch (err) {
    return res.fail('获取聊天记录失败: ' + err.message);
  }
});

module.exports = router;