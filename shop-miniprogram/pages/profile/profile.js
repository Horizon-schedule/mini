const app = getApp();

Page({
  data: { userInfo: null },

  onLoad() { this.updateUserInfo(); },
  onShow() { this.updateUserInfo(); },

  updateUserInfo() {
    this.setData({ userInfo: app.globalData.userInfo });
  },

  async doLogin() {
    try {
      await app.login();
      this.setData({ userInfo: app.globalData.userInfo });
      wx.showToast({ title: '登录成功', icon: 'success' });
    } catch (err) { console.error(err); }
  },

  logout() {
    wx.showModal({
      title: '提示', content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.logout();
          this.setData({ userInfo: null });
          wx.showToast({ title: '已退出', icon: 'success' });
        }
      }
    });
  },

  goOrderList(e) {
    const status = e.currentTarget.dataset.status || 0;
    wx.navigateTo({ url: `/pages/order/order?status=${status}` });
  },

  goAddressList() {
    wx.navigateTo({ url: '/pages/address-list/address-list' });
  }
});
