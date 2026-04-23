-- 给会话表添加商品卡片推送时间字段
ALTER TABLE `chat_session` ADD COLUMN IF NOT EXISTS `product_card_time` DATETIME DEFAULT NULL COMMENT '最后推送商品卡片时间' AFTER `last_time`;

-- 添加索引
ALTER TABLE `chat_session` ADD INDEX IF NOT EXISTS `idx_product_card_time` (`product_card_time`);
