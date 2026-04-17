/**
 * 上传模块路由（需管理员权限）
 * POST /api/upload/image - 上传图片
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const adminAuth = require('../middlewares/adminAuth');

// 确保上传目录存在
const uploadDir = process.env.UPLOAD_PATH || './public/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 生成唯一文件名：时间戳 + 随机数 + 原始扩展名
    const ext = path.extname(file.originalname);
    const name = Date.now() + '_' + Math.random().toString(36).substr(2, 8) + ext;
    cb(null, name);
  }
});

// 文件过滤器：只允许图片
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传图片文件（jpg/png/gif/webp）'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB 限制
});

/**
 * 上传图片
 */
router.post('/image', adminAuth, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.fail('请选择要上传的图片');
  }

  const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
  const imageUrl = `${serverUrl}/uploads/${req.file.filename}`;

  return res.success({
    url: imageUrl,
    filename: req.file.filename,
    size: req.file.size
  }, '上传成功');
});

module.exports = router;
