const { get, put, post } = require('../../utils/request');
const { orderStatusColor } = require('../../utils/index');

Page({
  data: { id: '', order: null, statusColor: '#FF6B35' },

  onLoad(options) {
    this.setData({ id: options.id });
    this.loadDetail();
  },

  async loadDetail() {
    try {
      const res = await get(`/order/detail/${this.data.id}`, {}, true);
      this.setData({
        order: res.data,
        statusColor: orderStatusColor(res.data.status)
      });
    } catch (err) { console.error(err); }
  },

  viewExpress() {
    wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${this.data.id}&express=1` });
  },

  async cancelOrder() {
    const confirm = await new Promise(r => wx.showModal({ title: '提示', content: '确定要取消订单吗？', success: r }));
    if (!confirm.confirm) return;
    try {
      await put(`/order/cancel/${this.data.id}`, {}, true);
      wx.showToast({ title: '已取消', icon: 'success' });
      this.loadDetail();
    } catch (err) { /* */ }
  },

  async payNow() {
    wx.showLoading({ title: '支付中...' });
    try {
      const res = await post('/order/pay', { order_id: this.data.id }, true);
      wx.hideLoading();
      const payData = res.data;
      if (payData.mock) {
        wx.showToast({ title: '支付成功', icon: 'success' });
        setTimeout(() => this.loadDetail(), 1000);
      } else {
        wx.requestPayment({
          timeStamp: payData.timeStamp, nonceStr: payData.nonceStr,
          package: payData.package, signType: payData.signType || 'RSA', paySign: payData.paySign,
          success: () => { wx.showToast({ title: '支付成功', icon: 'success' }); setTimeout(() => this.loadDetail(), 1000); },
          fail: () => wx.showToast({ title: '支付取消', icon: 'none' })
        });
      }
    } catch (err) { wx.hideLoading(); }
  },

  async confirmReceive() {
    const confirm = await new Promise(r => wx.showModal({ title: '提示', content: '确认已收到商品？', success: r }));
    if (!confirm.confirm) return;
    try {
      await put(`/order/confirm/${this.data.id}`, {}, true);
      wx.showToast({ title: '已确认收货', icon: 'success' });
      this.loadDetail();
    } catch (err) { /* */ }
  }
});
