/**
 * 商品问答列表页
 */
const { get, post } = require('../../utils/request');

Page({
  data: {
    productId: '',
    product: null,
    questions: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    showAskModal: false,
    askContent: ''
  },

  onLoad(options) {
    this.setData({ productId: options.productId });
    this.loadProduct();
    this.loadQuestions();
  },

  onShow() {
    // 刷新列表
    this.setData({ page: 1, questions: [], hasMore: true });
    this.loadQuestions();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadQuestions(true);
    }
  },

  async loadProduct() {
    try {
      const res = await get(`/product/${this.data.productId}`);
      this.setData({ product: res.data });
    } catch (err) {
      console.error('加载商品失败:', err);
    }
  },

  async loadQuestions(isMore = false) {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      const res = await get('/question/list', {
        product_id: this.data.productId,
        page: this.data.page,
        pageSize: this.data.pageSize
      });

      const list = res.data.list || [];
      this.setData({
        questions: isMore ? [...this.data.questions, ...list] : list,
        hasMore: list.length >= this.data.pageSize,
        loading: false
      });
    } catch (err) {
      // 使用模拟数据
      this.setData({
        questions: [
          { id: 1, question: '这个商品是正品吗？', answer: '亲，我们是官方正品授权店铺，支持验货哦~', time: '2026-04-10' },
          { id: 2, question: '发货速度快吗？', answer: '一般24小时内发货，偏远地区48小时内发货', time: '2026-04-08' },
          { id: 3, question: '可以退货吗？', answer: '7天内无理由退换货，运费自理', time: '2026-04-05' }
        ],
        hasMore: false,
        loading: false
      });
    }
  },

  // 显示提问弹窗
  showAskModal() {
    this.setData({ showAskModal: true, askContent: '' });
  },

  // 关闭提问弹窗
  hideAskModal() {
    this.setData({ showAskModal: false, askContent: '' });
  },

  // 提问内容输入
  onAskInput(e) {
    this.setData({ askContent: e.detail.value });
  },

  // 提交提问
  async submitQuestion() {
    const { productId, askContent } = this.data;
    if (!askContent.trim()) {
      wx.showToast({ title: '请输入问题', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交中...' });
    try {
      await post('/question/add', {
        product_id: productId,
        question: askContent
      }, true);
      wx.hideLoading();
      wx.showToast({ title: '提交成功', icon: 'success' });
      this.hideAskModal();
      // 刷新列表
      this.setData({ page: 1, questions: [], hasMore: true });
      this.loadQuestions();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '提交失败', icon: 'none' });
    }
  }
});
