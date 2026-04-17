/**
 * 小程序入口文件
 */
App({
  globalData: {
    userInfo: null,
    token: '',
    // 后端API地址，替换为你的实际后端地址
    baseUrl: 'http://localhost:3000/api'
  },

  onLaunch() {
    // 检查本地存储的登录信息
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    if (token) {
      this.globalData.token = token;
    }
    if (userInfo) {
      this.globalData.userInfo = userInfo;
    }
  },

  /**
   * 微信登录
   */
  login() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (loginRes) => {
          wx.request({
            url: `${this.globalData.baseUrl}/user/login`,
            method: 'POST',
            data: {
              code: loginRes.code
            },
            success: (res) => {
              if (res.data.code === 200) {
                const { token, userInfo } = res.data.data;
                this.globalData.token = token;
                this.globalData.userInfo = userInfo;
                wx.setStorageSync('token', token);
                wx.setStorageSync('userInfo', userInfo);
                resolve(res.data.data);
              } else {
                reject(res.data);
              }
            },
            fail: (err) => {
              reject(err);
            }
          });
        },
        fail: (err) => reject(err)
      });
    });
  },

  /**
   * 检查是否登录
   */
  checkLogin() {
    return !!this.globalData.token;
  },

  /**
   * 退出登录
   */
  logout() {
    this.globalData.token = '';
    this.globalData.userInfo = null;
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
  }
});
