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
      wx.setNavigationBarTitle({ title: '编辑地址' });
      try {
        const data = JSON.parse(decodeURIComponent(options.data));
        this.setData({ form: { ...this.data.form, ...data } });
      } catch (err) { /* */ }
    } else {
      wx.setNavigationBarTitle({ title: '新增地址' });
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
        // 不做任何提示，用户可以手动输入
        console.log('chooseAddress fail:', err.errMsg);
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
    if (!form.province || !form.city) { wx.showToast({ title: '请选择省市区', icon: 'none' }); return; }
    if (!form.detail) { wx.showToast({ title: '请输入详细地址', icon: 'none' }); return; }

    wx.showLoading({ title: '保存中...' });
    try {
      const saveData = {
        ...form,
        is_default: form.is_default ? 1 : 0
      };
      if (isEdit) {
        await put('/address/update', { id, ...saveData }, true);
      } else {
        await post('/address/save', saveData, true);
      }
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  }
});
