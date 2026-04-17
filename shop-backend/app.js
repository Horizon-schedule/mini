/**
 * 电商小程序后端 - 主入口文件
 * 技术栈：Node.js + Express + MySQL2
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// 导入数据库配置
const db = require('./config/db');

// 导入路由
const userRoutes = require('./routes/user');
const productRoutes = require('./routes/product');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/order');
const addressRoutes = require('./routes/address');
const adminRoutes = require('./routes/admin');
const categoryRoutes = require('./routes/category');
const uploadRoutes = require('./routes/upload');
const expressRoutes = require('./routes/express');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// 中间件配置
// ============================================================

// 跨域支持
app.use(cors());

// 解析 JSON 请求体
app.use(express.json({ limit: '10mb' }));
// 解析 URL 编码请求体
app.use(express.urlencoded({ extended: true }));

// 静态文件服务（上传的图片、管理后台页面）
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/admin', express.static(path.join(__dirname, 'public/admin')));

// ============================================================
// 统一响应格式封装
// ============================================================
app.use((req, res, next) => {
  res.success = (data = null, msg = 'success') => {
    res.json({ code: 200, msg, data });
  };
  res.fail = (msg = '操作失败', code = 500, data = null) => {
    res.json({ code, msg, data });
  };
  next();
});

// ============================================================
// 路由注册
// ============================================================
app.use('/api/user', userRoutes);
app.use('/api/product', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/address', addressRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/category', categoryRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/express', expressRoutes);

// 管理后台入口 - 返回 index.html
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin/index.html'));
});

// ============================================================
// 全局错误处理
// ============================================================
app.use((err, req, res, next) => {
  console.error('服务器错误:', err.stack);
  res.fail(err.message || '服务器内部错误', 500);
});

// ============================================================
// 启动服务器
// ============================================================
app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`  电商小程序后端服务已启动`);
  console.log(`  地址: http://localhost:${PORT}`);
  console.log(`  管理后台: http://localhost:${PORT}/admin`);
  console.log(`  API文档: http://localhost:${PORT}/api`);
  console.log(`========================================`);
});

module.exports = app;
