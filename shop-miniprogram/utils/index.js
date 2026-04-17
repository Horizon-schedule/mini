/**
 * 工具函数
 */

/**
 * 格式化价格
 */
function formatPrice(price) {
  if (!price && price !== 0) return '0.00';
  return parseFloat(price).toFixed(2);
}

/**
 * 格式化时间
 */
function formatTime(date, fmt = 'yyyy-MM-dd HH:mm:ss') {
  if (!date) return '';
  const d = new Date(date);
  const o = {
    'M+': d.getMonth() + 1,
    'd+': d.getDate(),
    'H+': d.getHours(),
    'm+': d.getMinutes(),
    's+': d.getSeconds()
  };
  if (/(y+)/.test(fmt)) {
    fmt = fmt.replace(RegExp.$1, (d.getFullYear() + '').substr(4 - RegExp.$1.length));
  }
  for (const k in o) {
    if (new RegExp('(' + k + ')').test(fmt)) {
      fmt = fmt.replace(RegExp.$1, RegExp.$1.length === 1 ? o[k] : ('00' + o[k]).substr(('' + o[k]).length));
    }
  }
  return fmt;
}

/**
 * 订单状态文字映射
 */
function orderStatusText(status) {
  const map = {
    0: '待支付',
    1: '待发货',
    2: '待收货',
    3: '已完成',
    4: '已取消',
    5: '退款中',
    6: '已退款'
  };
  return map[status] || '未知';
}

/**
 * 订单状态颜色映射
 */
function orderStatusColor(status) {
  const map = {
    0: '#FF6B35',
    1: '#1890FF',
    2: '#52C41A',
    3: '#999999',
    4: '#999999',
    5: '#FF4D4F',
    6: '#FF4D4F'
  };
  return map[status] || '#999';
}

module.exports = {
  formatPrice,
  formatTime,
  orderStatusText,
  orderStatusColor
};
