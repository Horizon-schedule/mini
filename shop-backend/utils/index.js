/**
 * 通用工具函数模块
 */

/**
 * 生成订单号
 * 格式：年月日时分秒 + 6位随机数，共20位
 */
function generateOrderNo() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  return `${y}${m}${d}${h}${min}${s}${rand}`;
}

/**
 * 分页参数解析
 * @param {number} page - 页码，默认1
 * @param {number} pageSize - 每页条数，默认10
 * @returns {{offset: number, limit: number}}
 */
function parsePagination(page = 1, pageSize = 10) {
  const p = Math.max(1, parseInt(page) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize) || 10));
  return {
    offset: (p - 1) * ps,
    limit: ps,
    page: p,
    pageSize: ps
  };
}

/**
 * 密码哈希与验证（使用 bcrypt）
 */
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}

/**
 * 时间格式化
 */
function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

module.exports = {
  generateOrderNo,
  parsePagination,
  hashPassword,
  verifyPassword,
  formatTime
};
