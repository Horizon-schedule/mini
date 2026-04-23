-- 添加客服在线状态字段
ALTER TABLE `admin` ADD COLUMN IF NOT EXISTS `service_status` VARCHAR(20) DEFAULT 'online' COMMENT '客服状态：online在线 busy忙碌 away离开 dnd勿扰 offline离线' AFTER `status`;
