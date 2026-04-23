-- ============================================================
-- 管理员表字段更新
-- ============================================================

-- 添加 phone 字段到 admin 表
ALTER TABLE `admin` ADD COLUMN `phone` VARCHAR(20) DEFAULT NULL COMMENT '手机号' AFTER `avatar`;

-- 添加 role 字段（如果不存在）
ALTER TABLE `admin` ADD COLUMN `role` VARCHAR(20) DEFAULT 'service' COMMENT '角色：service客服 super超级管理员' AFTER `phone`;

-- 添加 status 字段（如果不存在）
ALTER TABLE `admin` ADD COLUMN `status` TINYINT DEFAULT 1 COMMENT '状态：0禁用 1正常' AFTER `role`;

-- 将现有管理员设置为超级管理员
UPDATE `admin` SET `role` = 'super' WHERE `role` IS NULL OR `role` = '';

-- 将现有管理员状态设置为正常
UPDATE `admin` SET `status` = 1 WHERE `status` IS NULL;
