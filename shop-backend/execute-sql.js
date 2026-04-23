/**
 * 执行 SQL 文件
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./config/db');

async function executeSQL() {
  try {
    console.log('开始执行 SQL 文件...');
    
    // 读取 SQL 文件
    const sqlFile = path.join(__dirname, 'sql', 'permission_group.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // 分割 SQL 语句（按分号分割，但忽略注释中的分号）
    const statements = sql
      .replace(/--.*$/gm, '') // 移除单行注释
      .replace(/\/\*[\s\S]*?\*\//g, '') // 移除多行注释
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    console.log(`找到 ${statements.length} 条 SQL 语句`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\n执行第 ${i + 1} 条 SQL...`);
      console.log(statement.substring(0, 100) + (statement.length > 100 ? '...' : ''));
      
      try {
        await db.query(statement);
        console.log('✓ 执行成功');
      } catch (err) {
        // 如果是 "已存在" 的错误，忽略
        if (err.message.includes('Duplicate') || err.message.includes('already exists') || err.message.includes('ER_DUP_FIELDNAME')) {
          console.log('⚠ 已存在，跳过');
        } else {
          console.error('✗ 执行失败:', err.message);
        }
      }
    }
    
    console.log('\n========================================');
    console.log('SQL 执行完成！');
    console.log('========================================');
    
    // 验证表是否创建成功
    const [tables] = await db.query("SHOW TABLES LIKE 'permission_group'");
    if (tables.length > 0) {
      console.log('✓ permission_group 表已创建');
    } else {
      console.log('✗ permission_group 表未找到');
    }
    
    // 验证 admin 表是否有 permission_group_id 字段
    const [columns] = await db.query("SHOW COLUMNS FROM admin LIKE 'permission_group_id'");
    if (columns.length > 0) {
      console.log('✓ admin 表已添加 permission_group_id 字段');
    } else {
      console.log('✗ admin 表未找到 permission_group_id 字段');
    }
    
    // 查看权限组数据
    const [groups] = await db.query('SELECT * FROM permission_group');
    console.log(`\n✓ 已创建 ${groups.length} 个默认权限组:`);
    groups.forEach(g => {
      console.log(`  - ${g.name}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('执行失败:', err);
    process.exit(1);
  }
}

executeSQL();
