const { call, toastError } = require('../../utils/api')

Page({
  data: { loading: true, user: null, currentOrder: null, dishes: [], categories: [], pending: false },
  onShow() { this.load() },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()) },
  async load() {
    try {
      const data = await call('bootstrap')
      getApp().globalData.user = data.user
      const categories = [...new Set(data.dishes.map(x => (x.category || '其他').trim() || '其他'))]
      this.setData({ ...data, categories, pending: !data.user.approved || !data.user.enabled })
    } catch (e) { toastError(e) }
    finally { this.setData({ loading: false }) }
  },
  goMenu() { wx.switchTab({ url: '/pages/menu/menu' }) },
  goOrder() { wx.switchTab({ url: '/pages/order/order' }) },
  goMine() { wx.switchTab({ url: '/pages/mine/mine' }) }
})
