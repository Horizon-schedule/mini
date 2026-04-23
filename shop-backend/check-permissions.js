require('dotenv').config();
const db = require('./config/db');

async function checkPermissions() {
  try {
    const [rows] = await db.query('SELECT * FROM permission_group');
    console.log('权限组数据：');
    rows.forEach(row => {
      console.log(`\nID: ${row.id}`);
      console.log(`名称: ${row.name}`);
      console.log(`权限原始值: ${row.permissions}`);
      console.log(`权限类型: ${typeof row.permissions}`);
      try {
        const parsed = JSON.parse(row.permissions);
        console.log(`解析后: ${JSON.stringify(parsed)}`);
      } catch (e) {
        console.log(`解析失败: ${e.message}`);
      }
    });
  } catch (err) {
    console.error('查询失败:', err);
  } finally {
    process.exit(0);
  }
}

checkPermissions();
