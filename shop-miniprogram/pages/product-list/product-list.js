const { get } = require('../../utils/request');

Page({
  data: { list: [], sort: '', page: 1, pageSize: 10, total: 0, loading: false, noMore: false, categoryId: '' },

  onLoad(options) {
    this.setData({
      sort: options.sort || '',
      categoryId: options.categoryId || ''
    }, () => this.loadList(true));
  },

  setSort(e) {
    const sort = e.currentTarget.dataset.sort;
    const newSort = sort === 'price_asc' && this.data.sort === 'price_asc' ? 'price_desc' : sort;
    this.setData({ sort: newSort, page: 1, list: [], noMore: false }, () => this.loadList(true));
  },

  async loadList(reset = false) {
    if (this.data.loading) return;
    if (!reset && this.data.noMore) return;
    this.setData({ loading: true });

    try {
      const params = {
        page: this.data.page,
        pageSize: this.data.pageSize,
        sort: this.data.sort
      };
      if (this.data.categoryId) params.categoryId = this.data.categoryId;

      const res = await get('/product/list', params);
      const { list, total } = res.data;
      const newList = reset ? list : [...this.data.list, ...list];

      this.setData({
        list: newList,
        total,
        noMore: newList.length >= total,
        loading: false
      });
    } catch (err) {
      this.setData({ loading: false });
    }
  },

  loadMore() {
    if (this.data.noMore || this.data.loading) return;
    this.setData({ page: this.data.page + 1 }, () => this.loadList());
  },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/product-detail/product-detail?id=${e.currentTarget.dataset.id}` });
  }
});
