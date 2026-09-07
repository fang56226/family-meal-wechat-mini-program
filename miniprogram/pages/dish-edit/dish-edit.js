const { call, uploadImage, chooseImages, toastError } = require('../../utils/api')

Page({
  data: {
    dishId: '', name: '', ingredients: '', note: '', category: '家常菜', categories: [],
    showNewCategory: false, emoji: '🍲', imageFileID: '', displayImageURL: '', imageTemp: '', saving: false
  },
  onLoad() {
    const dish = getApp().globalData.editingDish
    if (dish) {
      wx.setNavigationBarTitle({ title: '编辑菜品' })
      this.setData({
        dishId: dish._id || '', name: dish.name || '', ingredients: dish.ingredients || '',
        note: dish.note || '', category: dish.category || '家常菜', emoji: dish.emoji || '🍲',
        imageFileID: dish.imageFileID || '', displayImageURL: dish.displayImageURL || ''
      })
    }
    this.loadCategories()
  },
  onUnload() { getApp().globalData.editingDish = null },
  setField(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }) },
  async loadCategories() {
    try {
      const data = await call('bootstrap')
      const categories = [...new Set(data.dishes.map(x => (x.category || '其他').trim() || '其他'))]
      const current = this.data.category
      this.setData({ categories, showNewCategory: categories.length > 0 && !categories.includes(current) })
    } catch (e) { toastError(e) }
  },
  selectCategory(e) { this.setData({ category: e.currentTarget.dataset.category, showNewCategory: false }) },
  addCategory() { this.setData({ category: '', showNewCategory: true }) },
  async pickPhoto() {
    try {
      const paths = await chooseImages(1)
      if (paths[0]) this.setData({ imageTemp: paths[0] })
    } catch (e) { toastError(e) }
  },
  cancel() { if (!this.data.saving) wx.navigateBack() },
  async save() {
    const d = this.data
    if (!d.name.trim()) return wx.showToast({ title: '请填写菜名', icon: 'none' })
    if (!d.ingredients.trim()) return wx.showToast({ title: '请填写所需食材', icon: 'none' })
    this.setData({ saving: true })
    wx.showLoading({ title: d.imageTemp ? '上传照片中' : '保存中' })
    try {
      let imageFileID = d.imageFileID
      if (d.imageTemp) imageFileID = await uploadImage(d.imageTemp, 'dish-photos')
      await call('saveDish', { dish: {
        _id: d.dishId, name: d.name.trim(), ingredients: d.ingredients.trim(),
        note: d.note.trim(),
        category: d.category.trim() || '其他', emoji: d.emoji, imageFileID
      } })
      wx.showToast({ title: '菜单已保存' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (e) { toastError(e) }
    finally { wx.hideLoading(); this.setData({ saving: false }) }
  },
  async deleteDish() {
    const confirmed = await new Promise(resolve => wx.showModal({ title: '删除这道菜？', content: '历史饭单不会受影响', success: r => resolve(r.confirm), fail: () => resolve(false) }))
    if (!confirmed) return
    try {
      await call('deleteDish', { dishId: this.data.dishId })
      wx.showToast({ title: '已删除' })
      setTimeout(() => wx.navigateBack(), 400)
    } catch (e) { toastError(e) }
  }
})
