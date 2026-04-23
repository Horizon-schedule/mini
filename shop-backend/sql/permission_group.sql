-- ============================================================
-- 权限组表
-- ============================================================

-- 创建权限组表
CREATE TABLE IF NOT EXISTS `permission_group` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL COMMENT '权限组名称',
  `permissions` JSON DEFAULT NULL COMMENT '权限列表，如：["dashboard", "products", "orders"]',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='权限组表';

-- 添加 permission_group_id 字段到 admin 表
ALTER TABLE `admin` ADD COLUMN IF NOT EXISTS `permission_group_id` INT DEFAULT NULL COMMENT '权限组ID' AFTER `role`;

-- 插入默认权限组
INSERT INTO `permission_group` (`name`, `permissions`) VALUES
('全部权限', '["dashboard", "products", "categories", "orders", "users", "express", "banners"]'),
('商品管理', '["products", "categories"]'),
('订单管理', '["orders", "express"]'),
('客服权限', '["service"]')
ON DUPLICATE KEY UPDATE `name` = `name`;
