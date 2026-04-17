const { get } = require('../../utils/request');

Page({
  data: { keyword: '', results: [], searched: false, hotWords: ['耳机', '羽绒服', '保温杯', '面膜', '音箱', '坚果'] },

  onInput(e) { this.setData({ keyword: e.detail.value }); },
  clearSearch() { this.setData({ keyword: '', results: [], searched: false }); },
  quickSearch(e) {
    const word = e.currentTarget.dataset.word;
    this.setData({ keyword: word }, () => this.doSearch());
  },

  async doSearch() {
    const { keyword } = this.data;
    if (!keyword.trim()) { wx.showToast({ title: '请输入搜索关键词', icon: 'none' }); return; }
    try {
      const res = await get('/product/search', { keyword: keyword.trim() });
      this.setData({ results: res.data || [], searched: true });
    } catch (err) { console.error(err); }
  },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/product-detail/product-detail?id=${e.currentTarget.dataset.id}` });
  }
});
