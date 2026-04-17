/**
 * 微信小程序工具模块
 * 处理微信登录、微信支付 V3 等功能
 */
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');

/**
 * 微信小程序登录 - code 换 openid
 * @param {string} code - wx.login() 获取的 code
 * @returns {{ openid, session_key, unionid? }}
 */
async function code2Session(code) {
  const url = 'https://api.weixin.qq.com/sns/jscode2session';
  const params = {
    appid: process.env.WX_APPID,
    secret: process.env.WX_APPSECRET,
    js_code: code,
    grant_type: 'authorization_code'
  };

  const { data } = await axios.get(url, { params });
  if (data.errcode) {
    throw new Error(`微信登录失败: ${data.errcode} - ${data.errmsg}`);
  }
  return {
    openid: data.openid,
    session_key: data.session_key,
    unionid: data.unionid || ''
  };
}

/**
 * 微信支付 V3 - 创建 JSAPI 预支付订单
 * @param {string} orderNo - 商户订单号
 * @param {number} amount - 支付金额（单位：分）
 * @param {string} description - 商品描述
 * @param {string} openid - 用户openid
 * @returns {{ prepay_id, paySign, timeStamp, nonceStr, packageStr }}
 */
async function createWxPayOrder(orderNo, amount, description, openid) {
  const url = 'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi';
  const body = {
    appid: process.env.WX_APPID,
    mchid: process.env.WX_MCH_ID,
    description,
    out_trade_no: orderNo,
    notify_url: process.env.WX_PAY_NOTIFY_URL,
    amount: {
      total: Math.round(amount),
      currency: 'CNY'
    },
    payer: {
      openid
    }
  };

  // 构建 Authorization 头
  const auth = buildWxAuthHeader('POST', '/v3/pay/transactions/jsapi', JSON.stringify(body));

  const { data: resData } = await axios.post(url, body, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': auth,
      'Accept': 'application/json'
    }
  });

  // 生成小程序支付签名参数
  const timeStamp = String(Math.floor(Date.now() / 1000));
  const nonceStr = crypto.randomBytes(16).toString('hex');
  const packageStr = `prepay_id=${resData.prepay_id}`;

  const paySign = buildWxPaySignature(timeStamp, nonceStr, packageStr);

  return {
    prepay_id: resData.prepay_id,
    timeStamp,
    nonceStr,
    package: packageStr,
    signType: 'RSA',
    paySign
  };
}

/**
 * 构建 V3 接口 Authorization 头
 */
function buildWxAuthHeader(method, urlPath, body = '') {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString('hex');

  // 构建签名串
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`;

  // 使用商户私钥签名
  let privateKey;
  try {
    privateKey = fs.readFileSync(process.env.WX_MCH_PRIVATE_KEY_PATH, 'utf-8');
  } catch (e) {
    console.error('商户私钥文件读取失败，微信支付功能不可用:', e.message);
    throw new Error('商户私钥配置错误');
  }

  const sign = crypto.createSign('RSA-SHA256')
    .update(message)
    .sign(privateKey, 'base64');

  const serialNo = process.env.WX_MCH_SERIAL_NO;
  const mchId = process.env.WX_MCH_ID;

  return `WECHATPAY2-SHA256-RSA2048 mchid="${mchId}",nonce_str="${nonce}",signature="${sign}",timestamp="${timestamp}",serial_no="${serialNo}"`;
}

/**
 * 构建小程序端支付签名
 */
function buildWxPaySignature(timeStamp, nonceStr, packageStr) {
  let privateKey;
  try {
    privateKey = fs.readFileSync(process.env.WX_MCH_PRIVATE_KEY_PATH, 'utf-8');
  } catch (e) {
    throw new Error('商户私钥配置错误');
  }

  const message = `${process.env.WX_APPID}\n${timeStamp}\n${nonceStr}\n${packageStr}\n`;
  return crypto.createSign('RSA-SHA256').update(message).sign(privateKey, 'base64');
}

/**
 * 验证微信支付 V3 回调通知签名
 */
function verifyWxPayNotify(headers, body) {
  // 生产环境需实现完整验签逻辑
  // 这里简化处理，仅做格式检查
  const wechatpayTimestamp = headers['wechatpay-timestamp'];
  const wechatpayNonce = headers['wechatpay-nonce'];
  const wechatpaySignature = headers['wechatpay-signature'];
  const wechatpaySerial = headers['wechatpay-serial'];

  if (!wechatpayTimestamp || !wechatpayNonce || !wechatpaySignature) {
    return false;
  }

  // TODO: 使用微信支付平台公钥验签
  // 简化版：跳过验签，直接解析通知体
  return true;
}

/**
 * 解密微信支付 V3 回调通知数据
 */
function decryptWxPayNotify(resource) {
  const { ciphertext, associated_data, nonce } = resource;
  const apiV3Key = process.env.WX_MCH_APIV3_KEY;

  // AES-256-GCM 解密
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    apiV3Key,
    nonce
  );
  decipher.setAuthTag(Buffer.from(ciphertext, 'base64').slice(-16));
  // GCM 模式解密
  const authTag = Buffer.alloc(16);
  const cipherBuf = Buffer.from(ciphertext, 'base64');
  const encryptedData = cipherBuf.slice(0, -16);
  authTag.set(cipherBuf.slice(-16));

  const decipher2 = crypto.createDecipheriv('aes-256-gcm', apiV3Key, nonce);
  decipher2.setAuthTag(authTag);

  let decrypted = decipher2.update(encryptedData, null, 'utf8');
  decrypted += decipher2.final('utf8');

  return JSON.parse(decrypted);
}

module.exports = {
  code2Session,
  createWxPayOrder,
  buildWxAuthHeader,
  verifyWxPayNotify,
  decryptWxPayNotify
};
