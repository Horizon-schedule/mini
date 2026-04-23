/**
 * 数据库诊断工具
 * 运行方式: node check-db.js
 */
require('dotenv').config();
const db = require('./config/db');

async function checkDatabase() {
  console.log('\n========== 数据库诊断 ==========\n');

  try {
    // 1. 检查 chat_session 表
    console.log('1. 检查 chat_session 表...');
    const [sessions] = await db.query('SELECT * FROM chat_session ORDER BY last_time DESC');
    console.log(`   共有 ${sessions.length} 条会话记录`);
    
    if (sessions.length > 0) {
      console.log('\n   会话列表:');
      sessions.forEach((s, i) => {
        console.log(`   [${i + 1}] session_id: ${s.id}, user_id: ${s.user_id}, status: ${s.status}`);
      });
    }

    // 2. 检查 chat_message 表
    console.log('\n2. 检查 chat_message 表（按 session_id 分组）...');
    const [messages] = await db.query('SELECT session_id, COUNT(*) as cnt FROM chat_message GROUP BY session_id ORDER BY MAX(created_at) DESC');
    console.log(`   共有 ${messages.length} 个会话有消息`);
    
    if (messages.length > 0) {
      console.log('\n   各会话消息数量:');
      messages.forEach(m => {
        console.log(`   session_id ${m.session_id}: ${m.cnt} 条消息`);
      });
    }

    // 3. 详细查看每个会话的消息
    console.log('\n3. 各会话消息详情...');
    for (const s of sessions) {
      const [msgs] = await db.query(
        'SELECT id, session_id, sender_type, content FROM chat_message WHERE session_id = ? ORDER BY id ASC',
        [s.id]
      );
      console.log(`\n   会话${s.id} (user_id=${s.user_id}):`);
      msgs.forEach(m => {
        const sender = m.sender_type === 1 ? '用户' : '客服';
        console.log(`     - [${sender}] ${m.content.substring(0, 40)}...`);
      });
    }

    console.log('\n========== 诊断完成 ==========\n');

  } catch (err) {
    console.error('诊断失败:', err);
  }

  process.exit(0);
}

checkDatabase();
