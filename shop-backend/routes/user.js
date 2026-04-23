/**
 * 用户模块路由
 * POST /api/user/login - 微信登录
 * GET  /api/user/info  - 获取用户信息
 * PUT  /api/user/info  - 更新用户信息
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middlewares/auth');
const { code2Session } = require('../utils/wechat');

/**
 * 微信小程序登录
 * 接收前端传来的 wx.login code，换取 openid，创建或查找用户
 */
router.post('/login', async (req, res) => {
  try {
    const { code, nickname, avatar, gender } = req.body;

    if (!code) {
      return res.fail('缺少登录凭证code');
    }

    // 1. 调用微信接口，用 code 换取 openid
    let wxResult;
    try {
      wxResult = await code2Session(code);
    } catch (err) {
      console.error('微信登录失败:', err.message);
      // 开发环境：允许模拟登录
      if (process.env.NODE_ENV === 'development' || !process.env.WX_APPID || process.env.WX_APPID === 'wx0000000000000000') {
        return devLogin(res, code, nickname, avatar, gender);
      }
      return res.fail('微信登录失败: ' + err.message);
    }

    const { openid, unionid } = wxResult;

    // 2. 查找用户是否已存在
    const [users] = await db.query('SELECT * FROM user WHERE openid = ?', [openid]);

    if (users.length > 0) {
      // 已有用户，更新信息
      const user = users[0];
      const updateFields = [];
      const updateValues = [];

      if (nickname) { updateFields.push('nickname = ?'); updateValues.push(nickname); }
      if (avatar) { updateFields.push('avatar = ?'); updateValues.push(avatar); }
      if (gender !== undefined) { updateFields.push('gender = ?'); updateValues.push(gender); }

      if (updateFields.length > 0) {
        updateValues.push(user.id);
        await db.query(`UPDATE user SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
      }

      // 生成 Token
      const token = generateUserToken({ id: user.id, openid: user.openid });
      return res.success({
        token,
        userInfo: { id: user.id, nickname: user.nickname, avatar: user.avatar }
      });
    }

    // 3. 新用户注册
    const [result] = await db.query(
      'INSERT INTO user (openid, unionid, nickname, avatar, gender) VALUES (?, ?, ?, ?, ?)',
      [openid, unionid || '', nickname || '微信用户', avatar || '', gender || 0]
    );

    const token = generateUserToken({ id: result.insertId, openid });
    return res.success({
      token,
      userInfo: { id: result.insertId, nickname: nickname || '微信用户', avatar: avatar || '' }
    });
  } catch (err) {
    console.error('用户登录失败:', err);
    return res.fail('登录失败: ' + err.message);
  }
});

/**
 * 手机号登录（开发环境使用模拟手机号）
 * POST /api/user/login-phone
 */
router.post('/login-phone', async (req, res) => {
  try {
    const { code, phoneCode } = req.body;

    if (!code) {
      return res.fail('缺少登录凭证code');
    }

    // 开发环境：使用模拟手机号
    const isDev = process.env.NODE_ENV === 'development' || !process.env.WX_APPID || process.env.WX_APPID === 'wx0000000000000000';
    
    if (isDev) {
      // 开发环境：使用 code 模拟手机号
      const mockPhone = `1380000${String(code).slice(-4).padStart(4, '0')}`;
      const mockOpenid = `phone_dev_${mockPhone}_${Date.now()}`;
      
      // 查找或创建用户
      const [existingUsers] = await db.query('SELECT * FROM user WHERE phone = ?', [mockPhone]);
      
      if (existingUsers.length > 0) {
        const user = existingUsers[0];
        const token = generateUserToken({ id: user.id, openid: user.openid });
        return res.success({
          token,
          userInfo: { id: user.id, nickname: user.nickname, avatar: user.avatar, phone: user.phone }
        });
      }
      
      // 创建新用户
      const [result] = await db.query(
        'INSERT INTO user (openid, phone, nickname, avatar) VALUES (?, ?, ?, ?)',
        [mockOpenid, mockPhone, `用户${mockPhone.slice(-4)}`, '']
      );
      
      const token = generateUserToken({ id: result.insertId, openid: mockOpenid });
      return res.success({
        token,
        userInfo: { id: result.insertId, nickname: `用户${mockPhone.slice(-4)}`, avatar: '', phone: mockPhone }
      });
    }

    // 正式环境：需要调用微信接口获取真实手机号
    // 由于获取手机号需要 access_token，这里暂时返回失败提示
    return res.fail('手机号登录需要在微信后台配置，请联系管理员');

  } catch (err) {
    console.error('手机号登录失败:', err);
    return res.fail('登录失败: ' + err.message);
  }
});

/**
 * 获取用户信息
 */
router.get('/info', auth, async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, openid, nickname, avatar, phone, gender, created_at FROM user WHERE id = ?',
      [req.user.id]
    );
    if (users.length === 0) {
      return res.fail('用户不存在', 404);
    }
    return res.success(users[0]);
  } catch (err) {
    return res.fail('获取用户信息失败: ' + err.message);
  }
});

/**
 * 更新用户信息
 */
router.put('/info', auth, async (req, res) => {
  try {
    const { nickname, avatar, phone, gender } = req.body;
    const fields = [];
    const values = [];

    if (nickname !== undefined) { fields.push('nickname = ?'); values.push(nickname); }
    if (avatar !== undefined) { fields.push('avatar = ?'); values.push(avatar); }
    if (phone !== undefined) { fields.push('phone = ?'); values.push(phone); }
    if (gender !== undefined) { fields.push('gender = ?'); values.push(gender); }

    if (fields.length === 0) {
      return res.fail('没有需要更新的信息');
    }

    values.push(req.user.id);
    await db.query(`UPDATE user SET ${fields.join(', ')} WHERE id = ?`, values);

    return res.success(null, '更新成功');
  } catch (err) {
    return res.fail('更新失败: ' + err.message);
  }
});

/**
 * 开发环境模拟登录（无需真实微信code）
 */
function devLogin(res, code, nickname, avatar, gender) {
  // 使用 code 作为模拟 openid
  const mockOpenid = `dev_${code}_${Date.now()}`;

  db.query('SELECT * FROM user WHERE openid = ?', [mockOpenid])
    .then(([users]) => {
      if (users.length > 0) {
        const user = users[0];
        const token = generateUserToken({ id: user.id, openid: user.openid });
        return res.success({
          token,
          userInfo: { id: user.id, nickname: user.nickname, avatar: user.avatar }
        });
      }

      return db.query(
        'INSERT INTO user (openid, nickname, avatar, gender) VALUES (?, ?, ?, ?)',
        [mockOpenid, nickname || '测试用户', avatar || '', gender || 0]
      ).then(([result]) => {
        const token = generateUserToken({ id: result.insertId, openid: mockOpenid });
        return res.success({
          token,
          userInfo: { id: result.insertId, nickname: nickname || '测试用户', avatar: avatar || '' }
        });
      });
    })
    .catch(err => {
      return res.fail('模拟登录失败: ' + err.message);
    });
}

/**
 * 生成用户JWT Token
 */
function generateUserToken(payload) {
  return jwt.sign(
    { ...payload, type: 'user' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/**
 * 获取指定用户信息（管理员接口）
 * GET /api/user/:id/info
 */
router.get('/:id/info', async (req, res) => {
  try {
    const userId = req.params.id;
    const [users] = await db.query(
      'SELECT id, nickname, avatar, phone, gender, created_at FROM user WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.fail('用户不存在', 404);
    }
    
    return res.success(users[0]);
  } catch (err) {
    return res.fail('获取用户信息失败: ' + err.message);
  }
});

module.exports = router;
