/**
 * 数据库连接配置
 * 使用 mysql2 的连接池管理数据库连接
 */
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'shop_mini',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // 允许多语句查询（用于初始化脚本）
  multipleStatements: true,
  // MySQL 8.0+ 认证插件
  authPlugins: {
    mysql_native_password: () => null
  }
});

// 测试数据库连接
pool.getConnection()
  .then(conn => {
    console.log('✅ 数据库连接成功');
    conn.release();
  })
  .catch(err => {
    console.error('❌ 数据库连接失败:', err.message);
    console.error('请检查 .env 中的数据库配置是否正确');
  });

module.exports = pool;
