/**
 * 分类页
 */
const { get } = require('../../utils/request');

Page({
  data: {
    categories: [],
    activeIndex: 0,
    products: [],
    loaded: false
  },

  onLoad() {
    this.loadCategories();
  },

  /**
   * 加载分类列表
   */
  async loadCategories() {
    try {
      const res = await get('/category/list');
      const categories = res.data || [];
      this.setData({ categories }, () => {
        if (categories.length > 0) {
          this.loadProducts(categories[0].id);
        }
      });
    } catch (err) {
      console.error('加载分类失败:', err);
    }
  },

  /**
   * 选择分类
   */
  selectCategory(e) {
    const { index, item } = e.currentTarget.dataset;
    this.setData({ activeIndex: index });
    this.loadProducts(item.id);
  },

  /**
   * 加载分类下的商品
   */
  async loadProducts(categoryId) {
    this.setData({ loaded: false });
    try {
      const res = await get('/product/list', { categoryId, pageSize: 50 });
      this.setData({ products: res.data.list || [], loaded: true });
    } catch (err) {
      console.error('加载商品失败:', err);
      this.setData({ loaded: true });
    }
  },

  /**
   * 跳转商品详情
   */
  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/product-detail/product-detail?id=${id}` });
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack({
      fail: () => {
        // 如果没有上一页，跳转到首页
        wx.switchTab({ url: '/pages/index/index' });
      }
    });
  }
});
