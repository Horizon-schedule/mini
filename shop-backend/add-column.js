require('dotenv').config();
const db = require('./config/db');

async function addColumn() {
  try {
    await db.query("ALTER TABLE admin ADD COLUMN permission_group_id INT DEFAULT NULL COMMENT '权限组ID'");
    console.log('✓ admin 表添加 permission_group_id 字段成功');
  } catch (e) {
    if (e.message.includes('Duplicate') || e.message.includes('already exists')) {
      console.log('✓ 字段已存在');
    } else {
      console.error('✗ 错误:', e.message);
    }
  }
  process.exit();
}

addColumn();
