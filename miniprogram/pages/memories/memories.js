const { call, toastError } = require('../../utils/api')
Page({
  data: { loading: true, allowed: false, memories: [] },
  onShow() { this.load() },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()) },
  async load() {
    try { const data = await call('listMemories'); this.setData(data) }
    catch (e) { toastError(e) }
    finally { this.setData({ loading: false }) }
  },
  preview(e) { wx.previewImage({ current: e.currentTarget.dataset.src, urls: e.currentTarget.dataset.urls }) },
  editMemory(e) {
    const memory = this.data.memories.find(x => x._id === e.currentTarget.dataset.id)
    if (!memory) return
    getApp().globalData.editingMemory = { ...memory, photoFileIDs: (memory.photoFileIDs || []).slice() }
    wx.navigateTo({ url: '/pages/memory-edit/memory-edit' })
  }
})
