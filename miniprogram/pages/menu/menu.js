const { call, toastError } = require('../../utils/api')

Page({
  data: { loading: true, allowed: false, dishes: [], dishGroups: [], cart: {}, cartCount: 0, ordering: false },
  onShow() { this.load() },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()) },
  async load() {
    try {
      const data = await call('bootstrap')
      const groups = {}
      data.dishes.forEach(dish => {
        const category = (dish.category || '其他').trim() || '其他'
        if (!groups[category]) groups[category] = []
        groups[category].push(dish)
      })
      const dishGroups = Object.keys(groups).map(category => ({ category, dishes: groups[category] }))
      this.setData({ dishes: data.dishes, dishGroups, allowed: data.user.approved && data.user.enabled })
    } catch (e) { toastError(e) }
    finally { this.setData({ loading: false }) }
  },
  openAdd() {
    getApp().globalData.editingDish = null
    wx.navigateTo({ url: '/pages/dish-edit/dish-edit' })
  },
  openEdit(e) {
    const dish = this.data.dishes.find(x => x._id === e.currentTarget.dataset.id)
    if (!dish) return
    getApp().globalData.editingDish = { ...dish }
    wx.navigateTo({ url: '/pages/dish-edit/dish-edit' })
  },
  changeCount(e) {
    const { id, delta } = e.currentTarget.dataset
    const cart = { ...this.data.cart }
    cart[id] = Math.max(0, (cart[id] || 0) + Number(delta))
    if (!cart[id]) delete cart[id]
    let cartCount = 0
    this.data.dishes.forEach(d => { cartCount += cart[d._id] || 0 })
    this.setData({ cart, cartCount })
  },
  async createOrder() {
    if (!this.data.cartCount || this.data.ordering) return
    this.setData({ ordering: true })
    try {
      await call('createOrder', { selections: Object.keys(this.data.cart).map(dishId => ({ dishId, count: this.data.cart[dishId] })) })
      this.setData({ cart: {}, cartCount: 0 })
      wx.showToast({ title: '饭单已提交' })
      setTimeout(() => wx.switchTab({ url: '/pages/order/order' }), 500)
    } catch (e) { toastError(e) }
    finally { this.setData({ ordering: false }) }
  }
})
