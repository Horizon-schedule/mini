-- 为 admin 表添加 avatar 字段（如果不存在）
ALTER TABLE admin ADD COLUMN IF NOT EXISTS avatar VARCHAR(500) DEFAULT '' COMMENT '客服头像';
