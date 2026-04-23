-- ============================================================
-- 客服聊天模块数据库表
-- ============================================================

-- -----------------------------------------------------------
-- 客服会话表
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `chat_session` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '会话ID',
  `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
  `product_id` INT UNSIGNED DEFAULT NULL COMMENT '关联商品ID',
  `order_id` INT UNSIGNED DEFAULT NULL COMMENT '关联订单ID',
  `status` TINYINT DEFAULT 1 COMMENT '状态：0已关闭 1进行中',
  `unread_count` INT UNSIGNED DEFAULT 0 COMMENT '用户未读消息数',
  `admin_unread` INT UNSIGNED DEFAULT 0 COMMENT '客服未读消息数',
  `last_message` VARCHAR(500) DEFAULT '' COMMENT '最后一条消息预览',
  `last_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '最后消息时间',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_last_time` (`last_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客服会话表';

-- -----------------------------------------------------------
-- 客服消息表
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `chat_message` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '消息ID',
  `session_id` INT UNSIGNED NOT NULL COMMENT '会话ID',
  `sender_type` TINYINT NOT NULL COMMENT '发送者类型：1用户 2客服',
  `sender_id` INT UNSIGNED NOT NULL COMMENT '发送者ID',
  `content_type` VARCHAR(20) DEFAULT 'text' COMMENT '内容类型：text文本 image图片 product商品 order订单',
  `content` TEXT COMMENT '消息内容',
  `extra_data` TEXT COMMENT '额外数据（JSON格式，商品/订单信息）',
  `is_read` TINYINT DEFAULT 0 COMMENT '是否已读：0未读 1已读',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_session` (`session_id`),
  KEY `idx_sender` (`sender_id`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客服消息表';

-- -----------------------------------------------------------
-- 客服账号表（扩展admin表）
-- -----------------------------------------------------------
ALTER TABLE `admin` ADD COLUMN `is_customer_service` TINYINT DEFAULT 0 COMMENT '是否为客服账号：0否 1是' AFTER `nickname`;