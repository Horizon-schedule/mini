/**
 * 商品详情页
 */
const { get, post } = require('../../utils/request');
const app = getApp();

Page({
  data: {
    id: '',
    product: null,
    selectedSpec: {},
    specDesc: '',
    cartCount: 0,
    // 弹窗相关
    showSpecModal: false,
    actionType: 'cart', // 'cart' 或 'buy'
    quantity: 1,
    // 发货信息
    deliveryInfo: {
      city: '广州',
      express: '免运费',
      freight: '0元',
      promise: ['24小时发货', '7天无理由退换', '假一赔十']
    },
    // 评价数据
    reviews: {
      total: 1234,
      tags: [
        { name: '全部', count: 1234, active: true },
        { name: '好评', count: 1156, active: false },
        { name: '有图', count: 328, active: false },
        { name: '回头客', count: 89, active: false }
      ],
      list: [
        { id: 1, avatar: 'https://picsum.photos/100/100?random=1', nickname: '用户***123', rating: 5, content: '商品质量很好，物流也很快，非常满意！', date: '2026-04-15' },
        { id: 2, avatar: 'https://picsum.photos/100/100?random=2', nickname: '小***明', rating: 5, content: '性价比很高，推荐购买', date: '2026-04-14' }
      ]
    },
    // 问大家
    qa: {
      total: 56,
      list: [
        { id: 1, question: '这个商品是正品吗？', answer: '亲，我们是官方正品授权店铺，支持验货哦~' },
        { id: 2, question: '发货速度快吗？', answer: '一般24小时内发货，偏远地区48小时内发货' }
      ]
    },
    // 店铺信息
    shop: {
      name: "Don't stop",
      logo: 'https://picsum.photos/200/200?random=10',
      desc: '专注品质，用心服务',
      score: { desc: 4.9, service: 4.8, logistics: 4.9 },
      stats: { goods: 156, new: 12, fans: '2.3万' }
    },
    // 店铺推荐
    recommendList: []
  },

  onLoad(options) {
    this.setData({ id: options.id });
    this.loadProduct();
    this.loadCartCount();
    this.loadRecommend();
  },

  onShow() {
    this.loadCartCount();
  },

  /**
   * 加载商品详情
   */
  async loadProduct() {
    try {
      const res = await get(`/product/${this.data.id}`);
      const product = res.data;
      // 初始化规格选中状态
      const selectedSpec = {};
      if (product.spec_list && product.spec_list.length > 0) {
        product.spec_list.forEach((spec, idx) => {
          selectedSpec[idx] = spec.options[0] || '';
        });
      }
      this.setData({ product, selectedSpec });
      this.updateSpecDesc();
    } catch (err) {
      console.error('加载商品详情失败:', err);
    }
  },

  /**
   * 选择规格
   */
  selectSpec(e) {
    const { group, value } = e.currentTarget.dataset;
    const { selectedSpec } = this.data;
    selectedSpec[group] = value;
    this.setData({ selectedSpec }, () => this.updateSpecDesc());
  },

  /**
   * 更新规格描述
   */
  updateSpecDesc() {
    const { product, selectedSpec } = this.data;
    if (!product || !product.spec_list) return;
    const desc = product.spec_list.map((spec, idx) => selectedSpec[idx] || '').filter(Boolean).join(' / ');
    this.setData({ specDesc: desc });
  },

  /**
   * 预览图片
   */
  previewImage(e) {
    const current = e.currentTarget.dataset.current;
    wx.previewImage({
      current,
      urls: this.data.product.images
    });
  },

  /**
   * 获取购物车数量
   */
  async loadCartCount() {
    if (!app.checkLogin()) return;
    try {
      const { get: g } = require('../../utils/request');
      const res = await g('/cart/list', {}, true);
      this.setData({ cartCount: res.data.totalQuantity || 0 });
    } catch (err) { /* ignore */ }
  },

  /**
   * 加入购物车（显示弹窗）
   */
  addToCart() {
    this.setData({ 
      showSpecModal: true,
      actionType: 'cart'
    });
  },

  /**
   * 立即购买（显示弹窗）
   */
  buyNow() {
    this.setData({ 
      showSpecModal: true,
      actionType: 'buy'
    });
  },

  goHome() { wx.switchTab({ url: '/pages/index/index' }); },
  goCart() { wx.switchTab({ url: '/pages/cart/cart' }); },

  /**
   * 显示规格选择弹窗
   */
  showSpecModal(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ 
      showSpecModal: true,
      actionType: type
    });
  },

  /**
   * 隐藏规格选择弹窗
   */
  hideSpecModal() {
    this.setData({ showSpecModal: false });
  },

  /**
   * 阻止事件冒泡
   */
  preventHide() {
    // 阻止事件冒泡，点击内容区域不关闭弹窗
  },

  /**
   * 弹窗中选择规格
   */
  selectSpecModal(e) {
    const { group, value } = e.currentTarget.dataset;
    const { selectedSpec } = this.data;
    selectedSpec[group] = value;
    this.setData({ selectedSpec }, () => {
      this.updateSpecDesc();
    });
  },

  /**
   * 修改数量
   */
  changeQuantity(e) {
    const delta = parseInt(e.currentTarget.dataset.delta);
    const { quantity, product } = this.data;
    const newQuantity = quantity + delta;
    if (newQuantity < 1) return;
    if (newQuantity > product.stock) {
      wx.showToast({ title: '超出库存', icon: 'none' });
      return;
    }
    this.setData({ quantity: newQuantity });
  },

  /**
   * 数量输入
   */
  onQuantityInput(e) {
    let value = parseInt(e.detail.value) || 1;
    const { product } = this.data;
    if (value < 1) value = 1;
    if (value > product.stock) {
      value = product.stock;
      wx.showToast({ title: '超出库存', icon: 'none' });
    }
    this.setData({ quantity: value });
  },

  /**
   * 确认操作（加入购物车或立即购买）
   */
  confirmAction() {
    const { actionType } = this.data;
    this.hideSpecModal();
    if (actionType === 'cart') {
      this.doAddToCart();
    } else {
      this.doBuyNow();
    }
  },

  /**
   * 执行加入购物车
   */
  async doAddToCart() {
    try {
      const { specDesc, id, quantity } = this.data;
      await post('/cart/add', {
        product_id: parseInt(id),
        spec_name: specDesc,
        quantity: quantity
      }, true);

      wx.showToast({ title: '已加入购物车', icon: 'success' });
      this.loadCartCount();
    } catch (err) {
      console.error(err);
    }
  },

  /**
   * 执行立即购买
   */
  doBuyNow() {
    const { id, product, specDesc, quantity } = this.data;
    if (!product) return;

    const buyItem = [{
      product_id: product.id,
      spec_name: specDesc,
      quantity: quantity
    }];

    wx.setStorageSync('buyNowItems', buyItem);
    wx.navigateTo({
      url: `/pages/order/order?mode=buyNow&addressId=`
    });
  },

  /**
   * 加载店铺推荐
   */
  async loadRecommend() {
    try {
      const res = await get('/product/list', { pageSize: 6 });
      this.setData({ recommendList: res.data.list || [] });
    } catch (err) {
      // 使用模拟数据
      this.setData({
        recommendList: [
          { id: 101, name: '热销商品推荐1', price: 99, sales: 1000, cover: 'https://picsum.photos/300/300?random=20' },
          { id: 102, name: '热销商品推荐2', price: 129, sales: 800, cover: 'https://picsum.photos/300/300?random=21' },
          { id: 103, name: '热销商品推荐3', price: 79, sales: 2000, cover: 'https://picsum.photos/300/300?random=22' }
        ]
      });
    }
  },

  /**
   * 查看全部评价
   */
  goReviews() {
    wx.showToast({ title: '查看全部评价', icon: 'none' });
  },

  /**
   * 查看全部问答
   */
  goQA() {
    wx.showToast({ title: '查看全部问答', icon: 'none' });
  },

  /**
   * 提问
   */
  askQuestion() {
    wx.showToast({ title: '打开提问页面', icon: 'none' });
  },

  /**
   * 联系客服
   */
  contactShop() {
    wx.showToast({ title: '联系客服', icon: 'none' });
  },

  /**
   * 进入店铺
   */
  goShop() {
    wx.showToast({ title: '进入店铺', icon: 'none' });
  }
});
