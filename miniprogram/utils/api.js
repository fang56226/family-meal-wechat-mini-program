function call(action, data = {}) {
  return wx.cloud.callFunction({ name: 'familyApi', data: { action, ...data } })
    .then(res => {
      const out = res.result || {}
      if (!out.ok) throw new Error(out.message || '操作失败')
      return out.data
    })
}

function uploadImage(tempFilePath, folder) {
  const ext = (tempFilePath.match(/\.([a-zA-Z0-9]+)$/) || [])[1] || 'jpg'
  const cloudPath = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  return wx.cloud.uploadFile({ cloudPath, filePath: tempFilePath }).then(res => res.fileID)
}

function chooseImages(count = 1) {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: res => resolve(res.tempFiles.map(x => x.tempFilePath)),
      fail: err => err.errMsg && err.errMsg.includes('cancel') ? resolve([]) : reject(err)
    })
  })
}

function toastError(err) {
  wx.showToast({ title: err.message || '操作失败', icon: 'none', duration: 2500 })
}

module.exports = { call, uploadImage, chooseImages, toastError }
