/**
 * 生成 bcrypt 密码哈希
 * 运行: node generate-admin.js
 */
const bcrypt = require('bcrypt');

async function main() {
  const password = 'admin123';
  const hash = await bcrypt.hash(password, 10);
  console.log('密码:', password);
  console.log('bcrypt哈希:', hash);
  console.log('\n复制以下 SQL 到 MySQL 执行：');
  console.log(`UPDATE admin SET password = '${hash}' WHERE username = 'admin';`);
}

main();
