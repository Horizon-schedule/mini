/**
 * 网络请求封装
 * 统一处理请求头、登录态、错误提示
 */
const app = getApp();

/**
 * 封装 wx.request
 * @param {object} options - 请求配置
 * @param {boolean} needLogin - 是否需要登录态
 */
function request(options, needLogin = false) {
  return new Promise((resolve, reject) => {
    // 检查是否需要登录
    if (needLogin && !app.globalData.token) {
      // 自动尝试登录
      app.login().then(() => {
        doRequest(options, needLogin, resolve, reject);
      }).catch(err => {
        wx.showToast({ title: '请先登录', icon: 'none' });
        reject(err);
      });
    } else {
      doRequest(options, needLogin, resolve, reject);
    }
  });
}

function doRequest(options, needLogin, resolve, reject) {
  const header = {
    'Content-Type': 'application/json',
    ...options.header
  };

  // 携带 Token
  if (needLogin && app.globalData.token) {
    header['Authorization'] = `Bearer ${app.globalData.token}`;
  }

  wx.request({
    url: `${app.globalData.baseUrl}${options.url}`,
    method: options.method || 'GET',
    data: options.data || {},
    header,
    success(res) {
      if (res.statusCode === 200) {
        if (res.data.code === 200) {
          resolve(res.data);
        } else if (res.data.code === 401) {
          // 登录过期
          app.logout();
          wx.showToast({ title: '请重新登录', icon: 'none' });
          reject(res.data);
        } else {
          wx.showToast({ title: res.data.msg || '请求失败', icon: 'none' });
          reject(res.data);
        }
      } else {
        wx.showToast({ title: '网络请求失败', icon: 'none' });
        reject(res);
      }
    },
    fail(err) {
      wx.showToast({ title: '网络连接失败', icon: 'none' });
      reject(err);
    }
  });
}

/**
 * GET 请求
 */
function get(url, data = {}, needLogin = false) {
  return request({ url, method: 'GET', data }, needLogin);
}

/**
 * POST 请求
 */
function post(url, data = {}, needLogin = false) {
  return request({ url, method: 'POST', data }, needLogin);
}

/**
 * PUT 请求
 */
function put(url, data = {}, needLogin = false) {
  return request({ url, method: 'PUT', data }, needLogin);
}

/**
 * DELETE 请求
 */
function del(url, data = {}, needLogin = false) {
  return request({ url, method: 'DELETE', data }, needLogin);
}

module.exports = { request, get, post, put, del };
