const { get, put, del, post } = require('../../utils/request');

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

  /**
   * 新增收货地址
   */
  addAddress() {
    wx.showActionSheet({
      itemList: ['调用微信收货地址', '手动输入地址'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.chooseWxAddress();
        } else {
          this.manualAddAddress();
        }
      }
    });
  },

  /**
   * 调用微信收货地址
   */
  chooseWxAddress() {
    wx.chooseAddress({
      success: (res) => {
        const addressData = {
          name: res.userName,
          phone: res.telNumber,
          province: res.provinceName,
          city: res.cityName,
          district: res.countyName,
          detail: res.detailInfo,
          is_default: this.data.list.length === 0 ? 1 : 0
        };
        this.saveAddress(addressData);
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.includes('cancel')) return;
        // API不可用时，提示手动输入
        wx.showModal({
          title: '提示',
          content: '微信收货地址接口暂不可用，请选择手动输入',
          confirmText: '手动输入',
          success: (res) => {
            if (res.confirm) {
              this.manualAddAddress();
            }
          }
        });
      }
    });
  },

  /**
   * 手动添加地址
   */
  manualAddAddress() {
    wx.navigateTo({ url: '/pages/address-edit/address-edit' });
  },

  /**
   * 保存地址到后端
   */
  async saveAddress(data) {
    try {
      await post('/address/save', data, true);
      wx.showToast({ title: '添加成功', icon: 'success' });
      this.loadList();
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

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
