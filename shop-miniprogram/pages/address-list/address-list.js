const { get, put, del } = require('../../utils/request');

Page({
  data: { list: [], loading: false },

  onShow() { this.loadList(); },

  async loadList() {
    this.setData({ loading: true });
    try {
      const res = await get('/address/list', {}, true);
      this.setData({ list: res.data || [], loading: false });
    } catch (err) { this.setData({ loading: false }); }
  },

  addAddress() { wx.navigateTo({ url: '/pages/address-edit/address-edit' }); },

  editAddress(e) {
    const item = e.currentTarget.dataset.item;
    wx.navigateTo({ url: `/pages/address-edit/address-edit?id=${item.id}&data=${encodeURIComponent(JSON.stringify(item))}` });
  },

  async setDefault(e) {
    try {
      await put('/address/default', { id: e.currentTarget.dataset.id }, true);
      this.loadList();
    } catch (err) { /* */ }
  },

  async deleteAddress(e) {
    const confirm = await new Promise(r => wx.showModal({ title: '提示', content: '确定要删除该地址吗？', success: r }));
    if (!confirm.confirm) return;
    try {
      await del('/address/delete', { id: e.currentTarget.dataset.id }, true);
      wx.showToast({ title: '已删除', icon: 'success' });
      this.loadList();
    } catch (err) { /* */ }
  }
});
