const { call, toastError } = require('../../utils/api')
Page({
  data: { loading: true, user: null, members: [], name: '' },
  onShow() { this.load() },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()) },
  async load() {
    try { const data = await call('bootstrap'); this.setData({ user: data.user, members: data.members, name: data.user.name || '' }) }
    catch (e) { toastError(e) }
    finally { this.setData({ loading: false }) }
  },
  setName(e) { this.setData({ name: e.detail.value }) },
  async saveName() {
    if (!this.data.name.trim()) return wx.showToast({ title: '请输入名字', icon: 'none' })
    try { await call('updateProfile', { name: this.data.name.trim() }); await this.load(); wx.showToast({ title: '名字已保存' }) }
    catch (e) { toastError(e) }
  },
  async manage(e) {
    try { await call('manageUser', { userId: e.currentTarget.dataset.id, operation: e.currentTarget.dataset.operation }); await this.load() }
    catch (err) { toastError(err) }
  }
})
