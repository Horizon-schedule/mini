/**
 * 客服聊天页面
 */
const { get, post } = require('../../utils/request');
const app = getApp();

Page({
  data: {
    product: null,
    messages: [],
    inputValue: '',
    userInfo: null,
    socketOpen: false
  },

  onLoad(options) {
    // 获取商品信息
    if (options.product) {
      try {
        const product = JSON.parse(decodeURIComponent(options.product));
        this.setData({ product });
      } catch (e) {
        console.error('解析商品信息失败:', e);
      }
    }
    
    // 获取用户信息
    this.setData({ userInfo: app.globalData.userInfo });
    
    // 加载历史消息
    this.loadMessages();
    
    // 连接WebSocket（这里使用轮询模拟）
    this.startPolling();
  },

  onUnload() {
    // 停止轮询
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }
  },

  /**
   * 加载历史消息
   */
  async loadMessages() {
    try {
      const res = await get('/chat/messages', {}, true);
      const messages = this.formatMessages(res.data?.messages || []);
      this.setData({ messages });
    } catch (err) {
      console.error('加载消息失败:', err);
    }
  },

  /**
   * 格式化消息，添加时间显示
   */
  formatMessages(messages) {
    let lastTime = 0;
    return messages.map((msg, index) => {
      // 解析 extra_data（商品信息）
      let extraData = null;
      if (msg.extra_data) {
        try {
          extraData = JSON.parse(msg.extra_data);
        } catch (e) {
          console.error('解析 extra_data 失败:', e);
        }
      }
      
      // 转换后端消息格式为前端格式
      const formattedMsg = {
        id: msg.id,
        type: msg.sender_type === 1 ? 'user' : 'service',
        contentType: msg.content_type || 'text',
        content: msg.content,
        time: this.formatTime(msg.created_at),
        created_at: msg.created_at,
        extraData: extraData,
        // 用户头像
        userAvatar: msg.sender_type === 1 ? (msg.sender_avatar || '') : '',
        // 客服头像
        adminAvatar: msg.sender_type === 2 ? (msg.admin_avatar || '/images/service-avatar.png') : ''
      };
      
      // 超过5分钟显示时间
      const msgTime = new Date(msg.created_at).getTime();
      const showTime = msgTime - lastTime > 5 * 60 * 1000;
      lastTime = msgTime;
      
      return { ...formattedMsg, showTime };
    });
  },

  /**
   * 格式化时间
   */
  formatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  /**
   * 开始轮询获取新消息
   */
  startPolling() {
    this.pollingTimer = setInterval(() => {
      this.loadMessages();
    }, 3000); // 每3秒轮询一次
  },

  /**
   * 输入框变化
   */
  onInput(e) {
    this.setData({ inputValue: e.detail.value });
  },

  /**
   * 发送消息
   */
  async sendMessage() {
    const content = this.data.inputValue.trim();
    if (!content) return;

    // 先清空输入框
    this.setData({ inputValue: '' });

    // 发送到服务器
    try {
      const res = await post('/chat/send', {
        content: content,
        contentType: 'text',
        productId: this.data.product?.id
      }, true);
      
      // 发送成功后重新加载消息列表
      this.loadMessages();
    } catch (err) {
      console.error('发送消息失败:', err);
      wx.showToast({ title: '发送失败', icon: 'none' });
    }
  },

  /**
   * 预览图片
   */
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({ urls: [url] });
  },

  /**
   * 跳转到商品详情
   */
  goProductDetail(e) {
    let productId;
    
    // 从事件数据中获取商品信息
    if (e.currentTarget.dataset.product) {
      productId = e.currentTarget.dataset.product.id;
    } else if (this.data.product) {
      productId = this.data.product.id;
    }
    
    if (productId) {
      wx.navigateTo({
        url: `/pages/product-detail/product-detail?id=${productId}`
      });
    }
  }
});