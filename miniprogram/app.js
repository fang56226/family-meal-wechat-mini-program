App({
  onLaunch() {
    if (!wx.cloud) {
      wx.showModal({ title: '版本过低', content: '请升级微信后再使用', showCancel: false })
      return
    }
    wx.cloud.init({ traceUser: true })
  },
  globalData: { user: null }
})
