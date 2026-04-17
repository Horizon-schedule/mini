/**
 * 首页
 */
const { get } = require('../../utils/request');

Page({
  data: {
    banners: [],
    categories: [],
    hotProducts: [],
    newProducts: []
  },

  onLoad() {
    this.loadBanners();
    this.loadCategories();
    this.loadHotProducts();
    this.loadNewProducts();
  },

  onShow() {
    // 每次显示刷新数据
  },

  onPullDownRefresh() {
    Promise.all([
      this.loadBanners(),
      this.loadCategories(),
      this.loadHotProducts(),
      this.loadNewProducts()
    ]).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 加载轮播图
   */
  async loadBanners() {
    try {
      // 轮播图通过管理后台配置，这里先使用静态数据
      this.setData({
        banners: [
          { id: 1, image: 'https://picsum.photos/750/300?random=1', link_type: 0 },
          { id: 2, image: 'https://picsum.photos/750/300?random=2', link_type: 0 },
          { id: 3, image: 'https://picsum.photos/750/300?random=3', link_type: 0 }
        ]
      });
    } catch (err) {
      console.error('加载轮播图失败:', err);
    }
  },

  /**
   * 加载分类
   */
  async loadCategories() {
    try {
      const res = await get('/category/list');
      this.setData({ categories: res.data || [] });
    } catch (err) {
      console.error('加载分类失败:', err);
    }
  },

  /**
   * 加载热门商品
   */
  async loadHotProducts() {
    try {
      const res = await get('/product/hot');
      this.setData({ hotProducts: res.data || [] });
    } catch (err) {
      console.error('加载热门商品失败:', err);
    }
  },

  /**
   * 加载新品
   */
  async loadNewProducts() {
    try {
      const res = await get('/product/list', { sort: 'new', pageSize: 6 });
      this.setData({ newProducts: res.data.list || [] });
    } catch (err) {
      console.error('加载新品失败:', err);
    }
  },

  /**
   * 跳转搜索页
   */
  goSearch() {
    wx.navigateTo({ url: '/pages/search/search' });
  },

  /**
   * 跳转分类页
   */
  goCategory(e) {
    const item = e.currentTarget.dataset.item;
    wx.switchTab({ url: '/pages/category/category' });
  },

  /**
   * 跳转商品列表
   */
  goProductList(e) {
    const type = e.currentTarget.dataset.type;
    wx.navigateTo({
      url: `/pages/product-list/product-list?sort=${type || ''}`
    });
  },

  /**
   * 跳转商品详情
   */
  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/product-detail/product-detail?id=${id}`
    });
  },

  /**
   * 轮播图点击
   */
  onBannerTap(e) {
    const item = e.currentTarget.dataset.item;
    if (item.link_type === 1 && item.link_value) {
      wx.navigateTo({
        url: `/pages/product-detail/product-detail?id=${item.link_value}`
      });
    }
  }
});
