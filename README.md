# 🛒 微信电商小程序 - 完整项目

## 项目概述

一套完整的微信电商小程序，包含小程序用户端 + 内嵌式管理后台。技术栈简洁：Node.js Express 后端 + 微信小程序原生前端 + MySQL 数据库，无任何中间件依赖。

## 📁 项目结构

```
shop-backend/          # 后端服务（Node.js Express）
├── app.js             # 主入口文件
├── package.json       # 依赖配置
├── .env               # 环境变量配置
├── .env.example       # 配置示例文件
├── config/
│   └── db.js          # MySQL 数据库连接
├── middlewares/
│   ├── auth.js        # 用户Token验证中间件
│   └── adminAuth.js   # 管理员Token验证中间件
├── routes/
│   ├── user.js        # 用户模块（登录、信息）
│   ├── product.js     # 商品模块
│   ├── category.js    # 分类模块
│   ├── cart.js        # 购物车模块
│   ├── order.js       # 订单与支付模块
│   ├── address.js     # 收货地址模块
│   ├── admin.js       # 管理员模块（商品/订单/用户管理）
│   ├── express.js     # 快递公司列表
│   └── upload.js      # 文件上传
├── utils/
│   ├── index.js       # 通用工具函数
│   ├── wechat.js      # 微信登录/支付工具
│   └── express.js     # 快递查询工具
├── sql/
│   └── init.sql       # 数据库建表+初始数据
└── public/
    └── admin/
        └── index.html # 管理后台页面

shop-miniprogram/      # 小程序前端
├── app.js             # 小程序入口
├── app.json           # 全局配置
├── app.wxss           # 全局样式
├── utils/
│   ├── request.js     # 网络请求封装
│   └── index.js       # 工具函数
├── images/            # 图片资源
└── pages/
    ├── index/         # 首页（轮播图、分类、热门、新品）
    ├── category/      # 分类页
    ├── search/        # 搜索页
    ├── product-list/  # 商品列表（筛选、排序、分页）
    ├── product-detail/# 商品详情（规格选择、加购、购买）
    ├── cart/          # 购物车（增删改、选中结算）
    ├── order/         # 确认订单（下单页）
    ├── order-detail/  # 订单详情（物流、确认收货）
    ├── address-list/  # 地址列表
    ├── address-edit/  # 地址编辑（微信地址对接）
    └── profile/       # 个人中心
```

## 🚀 快速启动

### 1. 环境准备

| 依赖 | 版本要求 | 说明 |
|------|---------|------|
| Node.js | 14.x+ | 推荐使用 16.x 或 18.x |
| MySQL | 5.7+ | 需要 utf8mb4 字符集支持 |
| 微信开发者工具 | 最新版 | 用于运行小程序 |

### 2. 数据库初始化

```bash
# 1. 登录 MySQL
mysql -u root -p

# 2. 执行建表脚本
source shop-backend/sql/init.sql

# 或者用 Navicat 等工具导入 sql/init.sql 文件
```

脚本会自动创建：
- `shop_mini` 数据库
- 11 张数据表（admin, user, product, category, cart, orders, order_item, address, express, payment, banner）
- 默认管理员账号（admin / admin123）
- 8 个商品分类
- 10 个快递公司
- 6 个示例商品
- 3 个轮播图

### 3. 后端启动

```bash
cd shop-backend

# 1. 安装依赖
npm install

# 2. 修改配置
#    复制 .env.example 为 .env，填写实际数据库密码等信息
#    已有默认 .env 文件，请修改 DB_PASSWORD

# 3. 启动服务
npm start
# 或使用热重载开发模式
npm run dev

# 4. 验证
# 浏览器访问：http://localhost:3000/admin
# 使用 admin / admin123 登录管理后台
```

### 4. 小程序启动

```bash
# 1. 使用微信开发者工具导入 shop-miniprogram 目录

# 2. 修改后端地址
#    打开 utils/request.js，将 baseUrl 改为你的后端地址
#    开发环境：http://localhost:3000/api
#    生产环境：https://yourdomain.com/api

# 3. 在微信开发者工具中：
#    - 详情 → 本地设置 → 勾选"不校验合法域名"
#    - 这样小程序可以访问 localhost

# 4. 编译运行即可
```

## 📋 接口文档

### 用户模块
| 方法 | 路径 | 说明 | 需登录 |
|------|------|------|--------|
| POST | /api/user/login | 微信登录（传入code） | ❌ |
| GET | /api/user/info | 获取用户信息 | ✅ |
| PUT | /api/user/info | 更新用户信息 | ✅ |

### 商品模块
| 方法 | 路径 | 说明 | 需登录 |
|------|------|------|--------|
| GET | /api/product/list | 商品列表（分页、筛选） | ❌ |
| GET | /api/product/hot | 热门商品 | ❌ |
| GET | /api/product/search | 搜索商品 | ❌ |
| GET | /api/product/:id | 商品详情 | ❌ |

### 分类模块
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/category/list | 获取所有分类 |

### 购物车模块（需登录）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/cart/list | 获取购物车（含商品信息） |
| POST | /api/cart/add | 添加到购物车 |
| PUT | /api/cart/update | 更新数量/选中状态 |
| PUT | /api/cart/checkAll | 全选/取消全选 |
| DELETE | /api/cart/delete | 删除购物车商品 |

### 订单模块（需登录）
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/order/create | 创建订单 |
| GET | /api/order/list | 订单列表（状态筛选） |
| GET | /api/order/detail/:id | 订单详情 |
| POST | /api/order/pay | 发起支付 |
| PUT | /api/order/cancel/:id | 取消订单 |
| PUT | /api/order/confirm/:id | 确认收货 |
| GET | /api/order/express/:id | 查询物流 |
| POST | /api/order/notify | 支付回调（微信调用） |

### 地址模块（需登录）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/address/list | 地址列表 |
| GET | /api/address/default | 默认地址 |
| POST | /api/address/add | 新增地址 |
| PUT | /api/address/update | 编辑地址 |
| DELETE | /api/address/delete | 删除地址 |
| PUT | /api/address/default | 设为默认 |

### 管理员模块
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/admin/login | 管理员登录 |
| GET | /api/admin/info | 管理员信息 |
| GET | /api/admin/statistics | 数据统计 |
| GET | /api/admin/product/list | 商品管理列表 |
| POST | /api/admin/product/save | 新增/编辑商品 |
| DELETE | /api/admin/product/delete | 删除商品 |
| PUT | /api/admin/product/status | 商品上下架 |
| GET | /api/admin/category/list | 分类列表 |
| POST | /api/admin/category/save | 新增/编辑分类 |
| DELETE | /api/admin/category/delete | 删除分类 |
| GET | /api/admin/order/list | 订单列表 |
| PUT | /api/admin/order/status | 修改订单状态/发货 |
| GET | /api/admin/user/list | 用户列表 |
| GET | /api/admin/express/list | 快递公司列表 |
| POST | /api/admin/express/save | 新增快递公司 |
| GET | /api/admin/banner/list | 轮播图列表 |
| POST | /api/admin/banner/save | 新增/编辑轮播图 |
| DELETE | /api/admin/banner/delete | 删除轮播图 |

### 统一返回格式

```json
{
  "code": 200,
  "msg": "success",
  "data": {}
}
```

- `code: 200` 成功
- `code: 401` 未登录/登录过期
- `code: 500` 服务器错误

## 🧪 测试指南

### 第一步：后端测试

```bash
# 1. 确认数据库连接
#    启动后端后看到 "✅ 数据库连接成功" 即可

# 2. 管理后台测试
#    访问 http://localhost:3000/admin
#    使用 admin / admin123 登录
#    测试各功能模块的增删改查

# 3. API 测试（使用 Postman 或 curl）
curl http://localhost:3000/api/category/list
curl http://localhost:3000/api/product/list?page=1&pageSize=5
curl http://localhost:3000/api/product/hot
curl http://localhost:3000/api/product/search?keyword=耳机
```

### 第二步：小程序测试

```bash
# 1. 首页浏览
#    - 查看轮播图是否显示
#    - 点击分类进入分类页
#    - 横向滑动查看热门推荐
#    - 点击商品进入详情

# 2. 商品详情
#    - 切换规格选项
#    - 点击图片预览大图
#    - 点击"加入购物车"
#    - 点击"立即购买"

# 3. 购物车
#    - 勾选/取消商品
#    - 调整数量
#    - 全选功能
#    - 点击结算

# 4. 下单流程
#    - 选择收货地址（调用微信地址）
#    - 确认商品信息
#    - 提交订单
#    - 模拟支付（未配置微信支付时自动模拟）

# 5. 订单管理
#    - 查看订单列表
#    - 按状态筛选
#    - 取消待支付订单
#    - 确认收货

# 6. 地址管理
#    - 新增地址（手动填写）
#    - 使用微信地址（调用wx.chooseAddress）
#    - 设置默认地址
#    - 编辑/删除地址
```

### 第三步：管理后台测试

```
1. 登录 → 查看数据统计面板
2. 商品管理 → 新增/编辑/上架/下架/删除商品
3. 分类管理 → 新增/编辑/删除分类
4. 订单管理 → 查看订单 → 发货（录入快递信息）
5. 用户管理 → 查看用户列表
6. 快递管理 → 查看快递公司列表
7. 轮播管理 → 新增/删除轮播图
```

## 🔧 微信支付配置指南

### 申请流程

1. **注册微信支付商户号**
   - 访问 https://pay.weixin.qq.com/
   - 提交资质审核（营业执照等）
   - 审核通过后获得商户号（mch_id）

2. **关联小程序**
   - 在微信支付商户平台 → 产品中心 → AppID 账号管理
   - 关联你的小程序 AppID

3. **获取 API 证书**
   - 商户平台 → 账户中心 → API 安全
   - 申请 API 证书（需要 CSR 文件）
   - 下载证书文件（apiclient_cert.pem, apiclient_key.pem）

4. **设置 APIv3 密钥**
   - 商户平台 → 账户中心 → API 安全
   - 设置 APIv3 密钥（32位字符串）

5. **配置回调地址**
   - .env 中设置 `WX_PAY_NOTIFY_URL`
   - 必须是 HTTPS 且公网可访问的地址

### 配置参数

```env
# 微信小程序
WX_APPID = wx1234567890abcdef        # 小程序 AppID
WX_APPSECRET = your_appsecret         # 小程序 AppSecret

# 微信支付 V3
WX_MCH_ID = 1234567890               # 商户号
WX_MCH_APIV3_KEY = your32charkey     # APIv3 密钥
WX_MCH_SERIAL_NO = 证书序列号         # API 证书序列号
WX_MCH_PRIVATE_KEY_PATH = ./certs/apiclient_key.pem  # 商户私钥
WX_PAY_NOTIFY_URL = https://yourdomain.com/api/order/notify  # 回调地址
```

### 证书部署

```
shop-backend/
└── certs/                    # 新建此目录
    └── apiclient_key.pem     # 商户API私钥文件
```

> ⚠️ 注意：开发阶段未配置微信支付时，系统会自动使用**模拟支付**（直接标记订单为已支付），方便测试其他流程。

## 📦 快递接口配置指南

### 方案一：快递100（推荐）

1. **注册账号**
   - 访问 https://www.kuaidi100.com/openapi/
   - 注册企业版账号

2. **申请接口**
   - 进入控制台 → 快递查询
   - 选择"实时查询"产品
   - 获取 Customer 和 Key

3. **配置参数**
```env
EXPRESS_KEY = your_kuaidi100_key
EXPRESS_CUSTOMER = your_kuaidi100_customer
```

### 方案二：阿里云物流

1. **开通服务**
   - 阿里云市场搜索"物流查询"
   - 购买对应的 API 服务
   - 获取 AppCode

2. **配置参数**
```env
ALIYUN_EXPRESS_APPCODE = your_aliyun_appcode
```

### 快递公司编码

数据库中 `express` 表已预置了常见快递公司的编码（快递100标准编码），在管理后台的"快递管理"中可以查看和增删。

常见编码：
| 快递公司 | 编码 |
|---------|------|
| 顺丰速运 | shunfeng |
| 中通快递 | zhongtong |
| 圆通速递 | yuantong |
| 韵达快递 | yunda |
| 申通快递 | shentong |
| 极兔速递 | jtexpress |

> ⚠️ 注意：开发阶段未配置快递 API 时，系统会返回**模拟物流数据**。

## 🔑 关键配置说明

所有第三方服务的配置项都集中在 `.env` 文件中，方便替换：

| 配置项 | 说明 | 是否必需 |
|--------|------|---------|
| DB_* | 数据库连接 | ✅ 必需 |
| JWT_SECRET | Token 签名密钥 | ✅ 必需 |
| WX_APPID | 小程序 AppID | 开发可跳过 |
| WX_APPSECRET | 小程序密钥 | 开发可跳过 |
| WX_MCH_* | 微信支付配置 | 开发可跳过 |
| EXPRESS_KEY | 快递100 Key | 开发可跳过 |

**开发模式下的降级策略：**
- 微信登录未配置 → 使用模拟登录（dev_xxx 格式 openid）
- 微信支付未配置 → 模拟支付直接成功
- 快递查询未配置 → 返回模拟物流轨迹

## 📊 数据库表说明

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| admin | 管理员表 | username, password, nickname |
| user | 用户表 | openid, nickname, avatar |
| category | 分类表 | name, icon, sort_order |
| product | 商品表 | name, price, stock, category_id |
| cart | 购物车表 | user_id, product_id, quantity |
| orders | 订单主表 | order_no, user_id, status, total_amount |
| order_item | 订单明细表 | order_id, product_id, price, quantity |
| address | 地址表 | user_id, name, phone, detail, is_default |
| payment | 支付记录表 | order_no, transaction_id, status |
| express | 快递公司表 | name, code |
| banner | 轮播图表 | image, link_type |

## 🛡️ 部署注意事项

1. **HTTPS**：微信支付回调要求 HTTPS，部署时使用 Nginx + SSL 证书
2. **域名备案**：小程序正式上线需要域名完成 ICP 备案
3. **服务器配置**：建议 2核4G 以上，MySQL 单独部署更佳
4. **图片存储**：生产环境建议使用 OSS（如阿里云 OSS）替代本地存储
5. **安全**：
   - 修改 .env 中的 JWT_SECRET 为随机强密码
   - 修改管理员默认密码
   - 配置 Nginx 限流
   - 开启 MySQL 远程访问限制

## 📝 常见问题

**Q: 小程序提示"不在以下 request 合法域名列表中"？**
A: 开发阶段在微信开发者工具 → 详情 → 本地设置 → 勾选"不校验合法域名"

**Q: 数据库连接失败？**
A: 检查 .env 中 DB_HOST、DB_PORT、DB_USER、DB_PASSWORD 是否正确

**Q: 管理后台页面 404？**
A: 确认 shop-backend/public/admin/index.html 文件存在

**Q: 上传图片失败？**
A: 确认 public/uploads 目录存在且有写权限

**Q: 如何重置管理员密码？**
A: 在 MySQL 中执行：
```sql
UPDATE admin SET password = SHA2(CONCAT('new_password', ''), 256) WHERE username = 'admin';
```
