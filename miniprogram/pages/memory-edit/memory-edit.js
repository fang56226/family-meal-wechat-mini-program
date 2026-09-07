const { call, chooseImages, uploadImage, toastError } = require('../../utils/api')

Page({
  data: { orderId: '', title: '', existingPhotos: [], newPhotos: [], memoryNote: '', saving: false },
  onLoad() {
    const memory = getApp().globalData.editingMemory
    if (!memory) return wx.navigateBack()
    this.setData({
      orderId: memory._id,
      title: memory.itemNames || '本顿饭记录',
      existingPhotos: (memory.photoFileIDs || []).map((fileID, index) => ({
        fileID,
        url: (memory.photoURLs || [])[index] || fileID
      })),
      memoryNote: memory.memoryNote || ''
    })
  },
  onUnload() { getApp().globalData.editingMemory = null },
  setNote(e) { this.setData({ memoryNote: e.detail.value }) },
  async addPhotos() {
    const left = 9 - this.data.existingPhotos.length - this.data.newPhotos.length
    if (left <= 0) return wx.showToast({ title: '最多保留9张照片', icon: 'none' })
    try {
      const paths = await chooseImages(left)
      this.setData({ newPhotos: this.data.newPhotos.concat(paths).slice(0, left + this.data.newPhotos.length) })
    } catch (e) { toastError(e) }
  },
  removeExisting(e) {
    const photos = this.data.existingPhotos.slice()
    photos.splice(e.currentTarget.dataset.index, 1)
    this.setData({ existingPhotos: photos })
  },
  removeNew(e) {
    const photos = this.data.newPhotos.slice()
    photos.splice(e.currentTarget.dataset.index, 1)
    this.setData({ newPhotos: photos })
  },
  cancel() { if (!this.data.saving) wx.navigateBack() },
  async save() {
    if (!this.data.existingPhotos.length && !this.data.newPhotos.length) return wx.showToast({ title: '请至少保留一张照片', icon: 'none' })
    this.setData({ saving: true })
    wx.showLoading({ title: '保存修改中' })
    try {
      const uploaded = []
      for (const path of this.data.newPhotos) uploaded.push(await uploadImage(path, 'meal-memories'))
      await call('updateMemory', {
        orderId: this.data.orderId,
        photoFileIDs: this.data.existingPhotos.map(photo => photo.fileID).concat(uploaded),
        memoryNote: this.data.memoryNote.trim()
      })
      wx.showToast({ title: '记录已更新' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (e) { toastError(e) }
    finally { wx.hideLoading(); this.setData({ saving: false }) }
  }
})
