/**
 * 商品评价列表页
 */
const { get } = require('../../utils/request');

Page({
  data: {
    productId: '',
    product: null,
    reviews: [],
    tags: [],
    activeTag: 'all',
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false
  },

  onLoad(options) {
    this.setData({ productId: options.productId });
    this.loadProduct();
    this.loadReviews();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadReviews(true);
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

  async loadReviews(isMore = false) {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      const res = await get('/review/list', {
        product_id: this.data.productId,
        tag: this.data.activeTag === 'all' ? '' : this.data.activeTag,
        page: this.data.page,
        pageSize: this.data.pageSize
      });

      const list = res.data.list || [];
      this.setData({
        reviews: isMore ? [...this.data.reviews, ...list] : list,
        tags: res.data.tags || [],
        hasMore: list.length >= this.data.pageSize,
        loading: false
      });
    } catch (err) {
      // 使用模拟数据
      this.setData({
        reviews: [
          { id: 1, avatar: 'https://picsum.photos/100/100?random=1', nickname: '用户***123', rating: 5, content: '商品质量很好，物流也很快，非常满意！', images: [], date: '2026-04-15' },
          { id: 2, avatar: 'https://picsum.photos/100/100?random=2', nickname: '小***明', rating: 5, content: '性价比很高，推荐购买', images: ['https://picsum.photos/200/200?random=10'], date: '2026-04-14' },
          { id: 3, avatar: 'https://picsum.photos/100/100?random=3', nickname: '爱***购', rating: 4, content: '整体不错，就是包装可以再精美一些', images: [], date: '2026-04-13' }
        ],
        tags: [
          { name: '全部', count: 1234 },
          { name: '好评', count: 1156 },
          { name: '有图', count: 328 },
          { name: '回头客', count: 89 }
        ],
        hasMore: false,
        loading: false
      });
    }
  },

  selectTag(e) {
    const tag = e.currentTarget.dataset.tag;
    if (tag === this.data.activeTag) return;
    this.setData({ activeTag: tag, reviews: [], page: 1, hasMore: true });
    this.loadReviews();
  },

  previewImage(e) {
    const urls = e.currentTarget.dataset.urls;
    wx.previewImage({
      current: e.currentTarget.dataset.current,
      urls: urls
    });
  }
});
