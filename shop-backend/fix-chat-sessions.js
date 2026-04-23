/**
 * 修复现有会话的客服分配
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function fixChatSessions() {
  // 创建数据库连接
  const db = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'shop_mini',
    waitForConnections: true,
    connectionLimit: 10
  });

  const query = (sql, params) => db.execute(sql, params);

  console.log('开始修复客服会话分配...\n');

  try {
    // 1. 查看现有客服
    const [admins] = await query(
      `SELECT id, nickname, role, service_status FROM admin WHERE role = 'service'`
    );
    console.log('【客服列表】');
    admins.forEach(a => console.log(`  ID:${a.id} 昵称:${a.nickname} 角色:${a.role} 状态:${a.service_status}`));
    console.log();

    if (admins.length === 0) {
      console.log('没有找到客服账号！请先创建客服账号。');
      return;
    }

    // 找一个可用的客服
    const availableService = admins[0];
    console.log(`将使用客服: ${availableService.nickname} (ID: ${availableService.id})\n`);

    // 2. 查看所有未分配客服的会话
    const [sessions] = await query(
      `SELECT id, user_id FROM chat_session WHERE admin_id IS NULL AND status = 1`
    );
    console.log(`【待分配会话】共 ${sessions.length} 个\n`);

    if (sessions.length === 0) {
      console.log('没有需要分配的会话。');
      return;
    }

    // 3. 为每个会话分配客服
    for (const session of sessions) {
      await query(
        'UPDATE chat_session SET admin_id = ? WHERE id = ?',
        [availableService.id, session.id]
      );
      console.log(`  会话 ${session.id} (用户 ${session.user_id}) -> 分配给 ${availableService.nickname}`);
    }

    console.log('\n【修复完成】');
    
    // 4. 验证
    const [verify] = await query(
      `SELECT s.id, s.user_id, s.admin_id, a.nickname as admin_name 
       FROM chat_session s 
       LEFT JOIN admin a ON s.admin_id = a.id 
       WHERE s.status = 1
       ORDER BY s.id`
    );
    console.log('\n【修复后的会话列表】');
    verify.forEach(s => {
      console.log(`  会话${s.id} 用户${s.user_id} -> 客服: ${s.admin_name || '未分配'}`);
    });

  } catch (err) {
    console.error('修复失败:', err);
  } finally {
    await db.end();
    process.exit();
  }
}

fixChatSessions();
