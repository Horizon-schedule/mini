-- 给会话表添加客服分配字段
ALTER TABLE `chat_session` ADD COLUMN IF NOT EXISTS `admin_id` INT UNSIGNED DEFAULT NULL COMMENT '分配的客服ID' AFTER `user_id`;

-- 添加索引
ALTER TABLE `chat_session` ADD INDEX IF NOT EXISTS `idx_admin` (`admin_id`);
