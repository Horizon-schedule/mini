const app = getApp();
const { get, post } = require('../../utils/request');

Page({
  data: { 
    userInfo: null,
    showLoginModal: false,
    loginBtnDisabled: false,
    loginForm: {
      nickname: '',
      avatar: ''
    },
    nicknameFocus: false
  },

  onLoad() { this.updateUserInfo(); },
  onShow() { this.updateUserInfo(); },

  updateUserInfo() {
    this.setData({ userInfo: app.globalData.userInfo });
  },

  // 显示登录弹窗
  showLogin() {
    this.setData({ 
      showLoginModal: true,
      loginForm: { nickname: '', avatar: '' },
      nicknameFocus: false
    });
  },

  // 关闭登录弹窗
  closeLoginModal() {
    this.setData({ showLoginModal: false });
  },

  // 选择头像
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({
      'loginForm.avatar': avatarUrl
    });
  },

  // 昵称输入
  onNicknameInput(e) {
    this.setData({
      'loginForm.nickname': e.detail.value
    });
  },

  // 昵称输入完成
  onNicknameBlur(e) {
    this.setData({
      'loginForm.nickname': e.detail.value
    });
  },

  // 使用微信昵称 - 自动聚焦输入框
  onUseWxNickname() {
    this.setData({ nicknameFocus: true });
  },

  // 确认登录（使用昵称头像）
  async onConfirmLogin() {
    if (this.data.loginBtnDisabled) return;
    
    const { nickname, avatar } = this.data.loginForm;
    if (!nickname) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    this.setData({ loginBtnDisabled: true });

    try {
      // 调用微信登录获取 code
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject
        });
      });

      // 调用后端登录接口
      const res = await post('/user/login', {
        code: loginRes.code,
        nickname: nickname,
        avatar: avatar || ''
      }, false);

      if (res.code === 200) {
        // 保存登录信息
        app.globalData.token = res.data.token;
        app.globalData.userInfo = res.data.userInfo;
        wx.setStorageSync('token', res.data.token);
        wx.setStorageSync('userInfo', res.data.userInfo);
        
        this.setData({ 
          userInfo: res.data.userInfo,
          showLoginModal: false
        });
        wx.showToast({ title: '登录成功', icon: 'success' });
      }
    } catch (err) {
      console.error('登录失败:', err);
      if (err.errMsg && err.errMsg.includes('cancel')) {
        // 用户取消
      } else {
        wx.showToast({ title: '登录失败', icon: 'none' });
      }
    } finally {
      this.setData({ loginBtnDisabled: false });
    }
  },

  // 手机号快速登录
  async onGetPhoneNumber(e) {
    if (this.data.loginBtnDisabled) return;
    
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      console.error('获取手机号失败:', e.detail.errMsg);
      return;
    }

    this.setData({ loginBtnDisabled: true });

    try {
      // 调用微信登录获取 code
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject
        });
      });

      // 调用后端登录接口（解密手机号）
      const res = await post('/user/login-phone', {
        code: loginRes.code,
        phoneCode: e.detail.code
      }, false);

      if (res.code === 200) {
        // 保存登录信息
        app.globalData.token = res.data.token;
        app.globalData.userInfo = res.data.userInfo;
        wx.setStorageSync('token', res.data.token);
        wx.setStorageSync('userInfo', res.data.userInfo);
        
        this.setData({ 
          userInfo: res.data.userInfo,
          showLoginModal: false
        });
        wx.showToast({ title: '登录成功', icon: 'success' });
      }
    } catch (err) {
      console.error('手机号登录失败:', err);
      wx.showToast({ title: '登录失败', icon: 'none' });
    } finally {
      this.setData({ loginBtnDisabled: false });
    }
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
