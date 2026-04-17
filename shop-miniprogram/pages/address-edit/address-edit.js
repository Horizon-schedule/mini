const { post, put } = require('../../utils/request');

Page({
  data: {
    id: '',
    isEdit: false,
    form: { name: '', phone: '', province: '', city: '', district: '', detail: '', postal_code: '', is_default: false }
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ id: options.id, isEdit: true });
      try {
        const data = JSON.parse(decodeURIComponent(options.data));
        this.setData({ form: { ...this.data.form, ...data } });
      } catch (err) { /* */ }
    }
  },

  onInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  toggleDefault() {
    this.setData({ 'form.is_default': !this.data.form.is_default });
  },

  /**
   * 调用微信地址选择
   */
  chooseAddress() {
    wx.chooseAddress({
      success: (res) => {
        this.setData({
          'form.name': res.userName,
          'form.phone': res.telNumber,
          'form.province': res.provinceName,
          'form.city': res.cityName,
          'form.district': res.countyName,
          'form.detail': res.detailInfo,
          'form.postal_code': res.postalCode
        });
      },
      fail: (err) => {
        if (err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '提示', content: '需要授权获取您的地址信息',
            success: (mr) => { if (mr.confirm) wx.openSetting(); }
          });
        }
      }
    });
  },

  /**
   * 保存地址
   */
  async saveAddress() {
    const { form, isEdit, id } = this.data;
    if (!form.name) { wx.showToast({ title: '请输入收货人', icon: 'none' }); return; }
    if (!form.phone || form.phone.length !== 11) { wx.showToast({ title: '请输入正确手机号', icon: 'none' }); return; }
    if (!form.detail) { wx.showToast({ title: '请输入详细地址', icon: 'none' }); return; }

    wx.showLoading({ title: '保存中...' });
    try {
      if (isEdit) {
        await put('/address/update', { id, ...form }, true);
      } else {
        await post('/address/add', form, true);
      }
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (err) {
      wx.hideLoading();
    }
  }
});
