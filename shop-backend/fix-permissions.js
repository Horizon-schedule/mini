require('dotenv').config();
const db = require('./config/db');

async function fixPermissions() {
  try {
    const [rows] = await db.query('SELECT * FROM permission_group');
    console.log('正在修复权限数据...\n');
    
    for (const row of rows) {
      let fixedPermissions;
      const permStr = row.permissions ? row.permissions.toString().trim() : '';
      
      if (!permStr) {
        fixedPermissions = '[]';
      } else if (permStr.startsWith('[')) {
        // 已经是 JSON 格式，检查是否有效
        try {
          JSON.parse(permStr);
          fixedPermissions = permStr; // 保持原样
        } catch {
          // JSON 格式但解析失败，转为数组
          fixedPermissions = JSON.stringify(permStr.split(',').map(p => p.trim()).filter(p => p));
        }
      } else {
        // 逗号分隔的字符串，转为 JSON 数组
        const perms = permStr.split(',').map(p => p.trim()).filter(p => p);
        fixedPermissions = JSON.stringify(perms);
      }
      
      console.log(`ID ${row.id}: ${row.name}`);
      console.log(`  原始: ${row.permissions}`);
      console.log(`  修复: ${fixedPermissions}`);
      
      await db.query('UPDATE permission_group SET permissions = ? WHERE id = ?', [fixedPermissions, row.id]);
      console.log(`  ✓ 已更新\n`);
    }
    
    console.log('修复完成！');
  } catch (err) {
    console.error('修复失败:', err);
  } finally {
    process.exit(0);
  }
}

fixPermissions();
