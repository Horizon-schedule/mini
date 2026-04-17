/**
 * 订单列表页
 */
const { get, put, post } = require('../../utils/request');
const { orderStatusText, orderStatusColor } = require('../../utils/index');

Page({
  data: {
    list: [],
    status: 0,
    page: 1,
    loading: false,
    noMore: false
  },

  onLoad(options) {
    const status = parseInt(options.status) || 0;
    this.setData({ status }, () => this.loadList(true));
  },

  onShow() {
    // 每次显示刷新
    if (this.data.list.length > 0) {
      this.loadList(true);
    }
  },

  switchTab(e) {
    const status = parseInt(e.currentTarget.dataset.status);
    this.setData({ status, page: 1, list: [], noMore: false }, () => this.loadList(true));
  },

  async loadList(reset = false) {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      const res = await get('/order/list', {
        status: this.data.status,
        page: this.data.page,
        pageSize: 10
      }, true);

      let list = res.data.list.map(item => ({
        ...item,
        statusText: orderStatusText(item.status),
        statusColor: orderStatusColor(item.status)
      }));

      if (reset) {
        this.setData({ list, noMore: false });
      } else {
        this.setData({ list: [...this.data.list, ...list] });
      }

      this.setData({
        noMore: list.length < 10,
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
    wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${e.currentTarget.dataset.id}` });
  },

  async cancelOrder(e) {
    const id = e.currentTarget.dataset.id;
    const confirm = await new Promise(r => wx.showModal({ title: '提示', content: '确定要取消订单吗？', success: r }));
    if (!confirm.confirm) return;
    try {
      await put(`/order/cancel/${id}`, {}, true);
      wx.showToast({ title: '已取消', icon: 'success' });
      this.loadList(true);
    } catch (err) { /* */ }
  },

  async payOrder(e) {
    const id = e.currentTarget.dataset.id;
    wx.showLoading({ title: '支付中...' });
    try {
      const res = await post('/order/pay', { order_id: id }, true);
      wx.hideLoading();
      const payData = res.data;
      if (payData.mock) {
        wx.showToast({ title: '支付成功', icon: 'success' });
        setTimeout(() => this.loadList(true), 1000);
      } else {
        wx.requestPayment({
          timeStamp: payData.timeStamp, nonceStr: payData.nonceStr,
          package: payData.package, signType: payData.signType || 'RSA', paySign: payData.paySign,
          success: () => { wx.showToast({ title: '支付成功', icon: 'success' }); setTimeout(() => this.loadList(true), 1000); },
          fail: () => { wx.showToast({ title: '支付取消', icon: 'none' }); }
        });
      }
    } catch (err) { wx.hideLoading(); }
  },

  async confirmReceive(e) {
    const id = e.currentTarget.dataset.id;
    const confirm = await new Promise(r => wx.showModal({ title: '提示', content: '确认已收到商品？', success: r }));
    if (!confirm.confirm) return;
    try {
      await put(`/order/confirm/${id}`, {}, true);
      wx.showToast({ title: '已确认收货', icon: 'success' });
      this.loadList(true);
    } catch (err) { /* */ }
  }
});
