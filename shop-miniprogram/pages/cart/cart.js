/**
 * 购物车页
 */
const { get, put, del, post } = require('../../utils/request');
const app = getApp();

Page({
  data: {
    cartList: [],
    totalPrice: '0.00',
    totalQuantity: 0,
    checkedCount: 0,
    allChecked: false,
    loading: false
  },

  onShow() {
    this.loadCart();
  },

  /**
   * 加载购物车
   */
  async loadCart() {
    if (!app.checkLogin()) {
      this.setData({ cartList: [] });
      return;
    }
    try {
      const res = await get('/cart/list', {}, true);
      const { list, totalPrice, totalQuantity, checkedCount } = res.data;
      const allChecked = list.length > 0 && checkedCount === list.length;
      this.setData({ cartList: list || [], totalPrice: totalPrice || '0.00', totalQuantity, checkedCount: checkedCount || 0, allChecked });
    } catch (err) { console.error(err); }
  },

  /**
   * 切换单个商品选中
   */
  async toggleCheck(e) {
    const idx = e.currentTarget.dataset.index;
    const item = this.data.cartList[idx];
    try {
      await put('/cart/update', { id: item.id, checked: item.checked === 1 ? 0 : 1 }, true);
      this.loadCart();
    } catch (err) { /* toast already shown */ }
  },

  /**
   * 全选/取消全选
   */
  async toggleAll() {
    try {
      await put('/cart/checkAll', { checked: !this.data.allChecked }, true);
      this.loadCart();
    } catch (err) { /* */ }
  },

  /**
   * 修改数量
   */
  async changeQty(e) {
    const { index, type } = e.currentTarget.dataset;
    const item = this.data.cartList[index];
    let qty = item.quantity;
    if (type === 'plus') qty++;
    else if (type === 'minus' && qty > 1) qty--;
    if (qty === item.quantity) return;

    try {
      await put('/cart/update', { id: item.id, quantity: qty }, true);
      this.loadCart();
    } catch (err) { /* */ }
  },

  /**
   * 删除单个
   */
  async deleteItem(e) {
    const idx = e.currentTarget.dataset.index;
    const item = this.data.cartList[idx];
    const confirm = await new Promise(resolve => {
      wx.showModal({ title: '提示', content: '确定要删除该商品吗？', success: resolve });
    });
    if (!confirm.confirm) return;

    try {
      await del('/cart/delete', { ids: [item.id] }, true);
      wx.showToast({ title: '已删除', icon: 'success' });
      this.loadCart();
    } catch (err) { /* */ }
  },

  /**
   * 去结算
   */
  goSettle() {
    if (this.data.checkedCount === 0) {
      wx.showToast({ title: '请选择商品', icon: 'none' });
      return;
    }
    // 获取选中的购物车项
    const selectedIds = this.data.cartList.filter(i => i.checked === 1).map(i => i.id);
    wx.setStorageSync('settleCartIds', selectedIds);
    wx.navigateTo({ url: '/pages/order/order?mode=cart' });
  },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/product-detail/product-detail?id=${e.currentTarget.dataset.id}` });
  }
});
