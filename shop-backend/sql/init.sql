-- ============================================================
-- 电商小程序数据库建表脚本
-- 数据库：MySQL 5.7+
-- 字符集：utf8mb4（支持中文和emoji）
-- ============================================================

CREATE DATABASE IF NOT EXISTS `shop_mini` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `shop_mini`;

-- -----------------------------------------------------------
-- 1. 管理员表
-- -----------------------------------------------------------
DROP TABLE IF EXISTS `admin`;
CREATE TABLE `admin` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '管理员ID',
  `username` VARCHAR(50) NOT NULL COMMENT '用户名',
  `password` VARCHAR(255) NOT NULL COMMENT '密码（bcrypt哈希）',
  `nickname` VARCHAR(50) DEFAULT '' COMMENT '昵称',
  `avatar` VARCHAR(500) DEFAULT '' COMMENT '头像URL',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员表';

-- -----------------------------------------------------------
-- 2. 用户表
-- -----------------------------------------------------------
DROP TABLE IF EXISTS `user`;
CREATE TABLE `user` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `openid` VARCHAR(64) NOT NULL COMMENT '微信openid',
  `unionid` VARCHAR(64) DEFAULT '' COMMENT '微信unionid',
  `nickname` VARCHAR(100) DEFAULT '' COMMENT '昵称',
  `avatar` VARCHAR(500) DEFAULT '' COMMENT '头像URL',
  `phone` VARCHAR(20) DEFAULT '' COMMENT '手机号',
  `gender` TINYINT DEFAULT 0 COMMENT '性别：0未知 1男 2女',
  `status` TINYINT DEFAULT 1 COMMENT '状态：0禁用 1正常',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_openid` (`openid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- -----------------------------------------------------------
-- 3. 商品分类表
-- -----------------------------------------------------------
DROP TABLE IF EXISTS `category`;
CREATE TABLE `category` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '分类ID',
  `name` VARCHAR(50) NOT NULL COMMENT '分类名称',
  `icon` VARCHAR(500) DEFAULT '' COMMENT '分类图标URL',
  `sort_order` INT DEFAULT 0 COMMENT '排序（越小越靠前）',
  `status` TINYINT DEFAULT 1 COMMENT '状态：0隐藏 1显示',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品分类表';

-- -----------------------------------------------------------
-- 4. 商品表
-- -----------------------------------------------------------
DROP TABLE IF EXISTS `product`;
CREATE TABLE `product` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '商品ID',
  `name` VARCHAR(200) NOT NULL COMMENT '商品名称',
  `subtitle` VARCHAR(500) DEFAULT '' COMMENT '商品副标题/简介',
  `cover` VARCHAR(500) DEFAULT '' COMMENT '主图URL',
  `images` TEXT COMMENT '商品图片（JSON数组，多张图）',
  `detail_images` TEXT COMMENT '商品详情图（JSON数组）',
  `category_id` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '分类ID',
  `price` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '售价',
  `original_price` DECIMAL(10,2) DEFAULT 0.00 COMMENT '原价（划线价）',
  `stock` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '库存',
  `sales` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '销量',
  `spec_list` TEXT COMMENT '规格列表（JSON数组）',
  `is_hot` TINYINT DEFAULT 0 COMMENT '是否热门推荐：0否 1是',
  `is_new` TINYINT DEFAULT 0 COMMENT '是否新品：0否 1是',
  `status` TINYINT DEFAULT 1 COMMENT '状态：0下架 1上架',
  `sort_order` INT DEFAULT 0 COMMENT '排序（越小越靠前）',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category_id`),
  KEY `idx_status_sort` (`status`, `sort_order`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品表';

-- -----------------------------------------------------------
-- 5. 购物车表
-- -----------------------------------------------------------
DROP TABLE IF EXISTS `cart`;
CREATE TABLE `cart` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '购物车ID',
  `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
  `product_id` INT UNSIGNED NOT NULL COMMENT '商品ID',
  `spec_name` VARCHAR(200) DEFAULT '' COMMENT '选中的规格描述',
  `quantity` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '数量',
  `checked` TINYINT DEFAULT 1 COMMENT '是否选中：0否 1是',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '添加时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='购物车表';

-- -----------------------------------------------------------
-- 6. 用户地址表
-- -----------------------------------------------------------
DROP TABLE IF EXISTS `address`;
CREATE TABLE `address` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '地址ID',
  `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
  `name` VARCHAR(50) NOT NULL COMMENT '收货人姓名',
  `phone` VARCHAR(20) NOT NULL COMMENT '收货人电话',
  `province` VARCHAR(30) DEFAULT '' COMMENT '省',
  `city` VARCHAR(30) DEFAULT '' COMMENT '市',
  `district` VARCHAR(30) DEFAULT '' COMMENT '区',
  `detail` VARCHAR(500) DEFAULT '' COMMENT '详细地址',
  `postal_code` VARCHAR(10) DEFAULT '' COMMENT '邮编',
  `is_default` TINYINT DEFAULT 0 COMMENT '是否默认：0否 1是',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户地址表';

-- -----------------------------------------------------------
-- 7. 订单主表
-- -----------------------------------------------------------
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '订单ID',
  `order_no` VARCHAR(32) NOT NULL COMMENT '订单编号',
  `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
  `total_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '订单总金额',
  `pay_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '实付金额',
  `freight_amount` DECIMAL(10,2) DEFAULT 0.00 COMMENT '运费',
  `status` TINYINT NOT NULL DEFAULT 0 COMMENT '订单状态：0待支付 1已支付待发货 2已发货 3已完成 4已取消 5退款中 6已退款',
  `pay_time` DATETIME DEFAULT NULL COMMENT '支付时间',
  `pay_type` VARCHAR(20) DEFAULT '' COMMENT '支付方式：wechat微信',
  `address_snapshot` TEXT COMMENT '收货地址快照（JSON）',
  `remark` VARCHAR(500) DEFAULT '' COMMENT '用户备注',
  `express_company` VARCHAR(50) DEFAULT '' COMMENT '快递公司',
  `express_no` VARCHAR(50) DEFAULT '' COMMENT '快递单号',
  `confirm_time` DATETIME DEFAULT NULL COMMENT '确认收货时间',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  KEY `idx_user` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单主表';

-- -----------------------------------------------------------
-- 8. 订单明细表
-- -----------------------------------------------------------
DROP TABLE IF EXISTS `order_item`;
CREATE TABLE `order_item` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '明细ID',
  `order_id` INT UNSIGNED NOT NULL COMMENT '订单ID',
  `product_id` INT UNSIGNED NOT NULL COMMENT '商品ID',
  `product_name` VARCHAR(200) NOT NULL COMMENT '商品名称（快照）',
  `product_cover` VARCHAR(500) DEFAULT '' COMMENT '商品主图（快照）',
  `spec_name` VARCHAR(200) DEFAULT '' COMMENT '规格描述',
  `price` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '单价（快照）',
  `quantity` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '数量',
  `total_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '小计金额',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单明细表';

-- -----------------------------------------------------------
-- 9. 支付记录表
-- -----------------------------------------------------------
DROP TABLE IF EXISTS `payment`;
CREATE TABLE `payment` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '支付ID',
  `order_no` VARCHAR(32) NOT NULL COMMENT '关联订单编号',
  `transaction_id` VARCHAR(64) DEFAULT '' COMMENT '微信支付交易号',
  `pay_type` VARCHAR(20) DEFAULT 'wechat' COMMENT '支付方式',
  `amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '支付金额',
  `status` TINYINT DEFAULT 0 COMMENT '支付状态：0待支付 1支付成功 2支付失败',
  `pay_time` DATETIME DEFAULT NULL COMMENT '支付时间',
  `notify_data` TEXT COMMENT '微信回调原始数据（JSON）',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_order_no` (`order_no`),
  KEY `idx_transaction_id` (`transaction_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付记录表';

-- -----------------------------------------------------------
-- 10. 快递公司表
-- -----------------------------------------------------------
DROP TABLE IF EXISTS `express`;
CREATE TABLE `express` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '快递公司ID',
  `name` VARCHAR(50) NOT NULL COMMENT '快递公司名称',
  `code` VARCHAR(30) NOT NULL COMMENT '快递公司编码（快递100编码）',
  `status` TINYINT DEFAULT 1 COMMENT '状态：0禁用 1启用',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='快递公司表';

-- -----------------------------------------------------------
-- 11. 轮播图表（额外补充）
-- -----------------------------------------------------------
DROP TABLE IF EXISTS `banner`;
CREATE TABLE `banner` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '轮播图ID',
  `image` VARCHAR(500) NOT NULL COMMENT '图片URL',
  `link_type` TINYINT DEFAULT 0 COMMENT '跳转类型：0无 1商品 2分类 3网页',
  `link_value` VARCHAR(500) DEFAULT '' COMMENT '跳转值（商品ID/分类ID/URL）',
  `sort_order` INT DEFAULT 0 COMMENT '排序',
  `status` TINYINT DEFAULT 1 COMMENT '状态：0隐藏 1显示',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='轮播图表';

-- ============================================================
-- 初始数据
-- ============================================================

-- 插入默认管理员（密码：admin123，使用bcrypt加密）
-- 注意：实际部署时请修改密码，这里使用预计算的 bcrypt hash
INSERT INTO `admin` (`username`, `password`, `nickname`) VALUES
('admin', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '超级管理员');

-- 插入默认商品分类（使用SVG图标）
INSERT INTO `category` (`name`, `icon`, `sort_order`) VALUES
('数码电子', '/images/category/digital.svg', 1),
('服装鞋包', '/images/category/clothing.svg', 2),
('食品饮料', '/images/category/food.svg', 3),
('美妆个护', '/images/category/beauty.svg', 4),
('家居生活', '/images/category/home.svg', 5),
('母婴用品', '/images/category/baby.svg', 6),
('运动户外', '/images/category/sports.svg', 7),
('图书文具', '/images/category/books.svg', 8);

-- 插入默认快递公司（快递100编码）
INSERT INTO `express` (`name`, `code`) VALUES
('顺丰速运', 'shunfeng'),
('中通快递', 'zhongtong'),
('圆通速递', 'yuantong'),
('韵达快递', 'yunda'),
('申通快递', 'shentong'),
('极兔速递', 'jtexpress'),
('邮政快递', 'youzhengguonei'),
('京东物流', 'jd'),
('德邦快递', 'deppon'),
('百世快递', 'huitongkuaidi');

-- 插入示例轮播图
INSERT INTO `banner` (`image`, `link_type`, `link_value`, `sort_order`) VALUES
('https://picsum.photos/750/300?random=1', 0, '', 1),
('https://picsum.photos/750/300?random=2', 0, '', 2),
('https://picsum.photos/750/300?random=3', 0, '', 3);

-- 插入示例商品
INSERT INTO `product` (`name`, `subtitle`, `cover`, `images`, `detail_images`, `category_id`, `price`, `original_price`, `stock`, `is_hot`, `is_new`, `status`, `spec_list`) VALUES
('无线蓝牙耳机 Pro', '主动降噪 · 40小时续航', 'https://picsum.photos/400/400?random=10', '["https://picsum.photos/400/400?random=10","https://picsum.photos/400/400?random=11","https://picsum.photos/400/400?random=12"]', '["https://picsum.photos/750/400?random=100","https://picsum.photos/750/400?random=101","https://picsum.photos/750/400?random=102"]', 1, 299.00, 599.00, 1000, 1, 1, 1, '[{"name":"颜色","options":["黑色","白色","蓝色"]},{"name":"版本","options":["标准版","降噪版"]}]'),
('轻薄羽绒服 2024新款', '90%白鸭绒 · 轻暖透气', 'https://picsum.photos/400/400?random=20', '["https://picsum.photos/400/400?random=20","https://picsum.photos/400/400?random=21"]', '["https://picsum.photos/750/400?random=200","https://picsum.photos/750/400?random=201"]', 2, 459.00, 899.00, 500, 1, 1, 1, '[{"name":"颜色","options":["黑色","灰色","藏蓝"]},{"name":"尺码","options":["S","M","L","XL","XXL"]}]'),
('有机坚果礼盒装', '每日坚果 · 7种混合装', 'https://picsum.photos/400/400?random=30', '["https://picsum.photos/400/400?random=30","https://picsum.photos/400/400?random=31"]', '["https://picsum.photos/750/400?random=300","https://picsum.photos/750/400?random=301"]', 3, 89.90, 158.00, 2000, 1, 0, 1, '[{"name":"规格","options":["250g","500g","1kg"]}]'),
('保湿面膜套装', '玻尿酸深层补水 · 20片装', 'https://picsum.photos/400/400?random=40', '["https://picsum.photos/400/400?random=40","https://picsum.photos/400/400?random=41"]', '["https://picsum.photos/750/400?random=400","https://picsum.photos/750/400?random=401"]', 4, 69.90, 129.00, 3000, 0, 1, 1, '[{"name":"片数","options":["5片","10片","20片"]}]'),
('智能保温杯', 'LED温度显示 · 316不锈钢', 'https://picsum.photos/400/400?random=50', '["https://picsum.photos/400/400?random=50","https://picsum.photos/400/400?random=51"]', '["https://picsum.photos/750/400?random=500","https://picsum.photos/750/400?random=501"]', 5, 128.00, 258.00, 800, 1, 1, 1, '[{"name":"容量","options":["350ml","500ml"]},{"name":"颜色","options":["白色","粉色","黑色"]}]'),
('运动蓝牙音箱', 'IPX7防水 · 户外便携', 'https://picsum.photos/400/400?random=60', '["https://picsum.photos/400/400?random=60","https://picsum.photos/400/400?random=61"]', '["https://picsum.photos/750/400?random=600","https://picsum.photos/750/400?random=601"]', 7, 159.00, 299.00, 600, 0, 0, 1, '[{"name":"颜色","options":["黑色","红色","军绿"]}]');
