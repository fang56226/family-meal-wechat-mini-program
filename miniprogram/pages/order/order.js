const { call, chooseImages, uploadImage, toastError } = require('../../utils/api')

Page({
  data: { loading: true, allowed: false, order: null, selectedPhotos: [], memoryNote: '', submitting: false },
  onShow() { this.load() },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()) },
  async load() {
    try {
      const data = await call('bootstrap')
      this.setData({ order: data.currentOrder, allowed: data.user.approved && data.user.enabled })
    } catch (e) { toastError(e) }
    finally { this.setData({ loading: false }) }
  },
  async acceptOrder() {
    try { await call('changeOrderStatus', { orderId: this.data.order._id, status: 1 }); await this.load(); wx.showToast({ title: '已接单，开做！' }) }
    catch (e) { toastError(e) }
  },
  async pickPhotos() {
    try {
      const left = 9 - this.data.selectedPhotos.length
      if (left <= 0) return wx.showToast({ title: '最多上传9张', icon: 'none' })
      const paths = await chooseImages(left)
      this.setData({ selectedPhotos: this.data.selectedPhotos.concat(paths).slice(0, 9) })
    } catch (e) { toastError(e) }
  },
  removePhoto(e) {
    const photos = this.data.selectedPhotos.slice(); photos.splice(e.currentTarget.dataset.index, 1); this.setData({ selectedPhotos: photos })
  },
  setNote(e) { this.setData({ memoryNote: e.detail.value }) },
  async finishOrder() {
    if (!this.data.selectedPhotos.length) return wx.showToast({ title: '请至少上传一张完成照', icon: 'none' })
    this.setData({ submitting: true }); wx.showLoading({ title: '保存纪念中' })
    try {
      const photoFileIDs = []
      for (const path of this.data.selectedPhotos) photoFileIDs.push(await uploadImage(path, 'meal-memories'))
      await call('finishOrder', { orderId: this.data.order._id, photoFileIDs, memoryNote: this.data.memoryNote.trim() })
      this.setData({ selectedPhotos: [], memoryNote: '' }); await this.load()
      wx.showToast({ title: '这顿饭已记录' })
      setTimeout(() => wx.switchTab({ url: '/pages/memories/memories' }), 600)
    } catch (e) { toastError(e) }
    finally { wx.hideLoading(); this.setData({ submitting: false }) }
  }
})
