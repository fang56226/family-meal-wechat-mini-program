const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const ok = data => ({ ok: true, data })
const fail = message => ({ ok: false, message })
const statusText = status => ['等待接单', '正在做饭', '已经完成'][status] || '未知状态'
const formatDate = date => {
  const d = new Date(date)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}年${p(d.getMonth() + 1)}月${p(d.getDate())}日 ${p(d.getHours())}:${p(d.getMinutes())}`
}

async function getTempURLMap(fileIDs) {
  const unique = [...new Set((fileIDs || []).filter(fileID => typeof fileID === 'string' && fileID.startsWith('cloud://')))]
  const urlMap = {}
  for (let i = 0; i < unique.length; i += 50) {
    const result = await cloud.getTempFileURL({ fileList: unique.slice(i, i + 50) })
    ;(result.fileList || []).forEach(file => {
      if (file.fileID && file.tempFileURL) urlMap[file.fileID] = file.tempFileURL
    })
  }
  return urlMap
}

async function getMe(openid, create = true) {
  const found = await db.collection('users').where({ openid }).limit(1).get()
  if (found.data[0]) return found.data[0]
  if (!create) return null
  const anyApproved = await db.collection('users').where({ approved: true }).limit(1).get()
  const first = !anyApproved.data.length
  const user = { openid, name: first ? '家庭管理员' : '', role: first ? 'admin' : 'member', approved: first, enabled: first, createdAt: db.serverDate(), updatedAt: db.serverDate() }
  const added = await db.collection('users').add({ data: user })
  return { ...user, _id: added._id }
}

function assertMember(user) {
  if (!user || !user.approved || !user.enabled) throw new Error('等待家庭管理员批准后才能使用')
}
function assertAdmin(user) {
  assertMember(user)
  if (user.role !== 'admin') throw new Error('只有管理员可以管理家庭成员')
}

async function bootstrap(openid) {
  const user = await getMe(openid)
  let members = [], dishes = [], currentOrder = null
  if (user.approved && user.enabled) {
    const [memberRes, dishRes, orderRes] = await Promise.all([
      db.collection('users').where({ approved: true }).get(),
      db.collection('dishes').where({ available: true }).get(),
      db.collection('orders').where({ status: _.in([0, 1]) }).get()
    ])
    members = memberRes.data.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).map(x => ({ _id: x._id, name: x.name, role: x.role, approved: x.approved, enabled: x.enabled }))
    dishes = dishRes.data.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    currentOrder = orderRes.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null
    const imageFileIDs = dishes.map(dish => dish.imageFileID)
    if (currentOrder) imageFileIDs.push(...(currentOrder.items || []).map(item => item.imageFileID))
    const imageURLMap = await getTempURLMap(imageFileIDs)
    dishes = dishes.map(dish => ({ ...dish, displayImageURL: imageURLMap[dish.imageFileID] || '' }))
    if (currentOrder) currentOrder = {
      ...currentOrder,
      statusText: statusText(currentOrder.status),
      items: (currentOrder.items || []).map(item => ({ ...item, displayImageURL: imageURLMap[item.imageFileID] || '' }))
    }
  } else if (user.role === 'admin') {
    members = (await db.collection('users').orderBy('createdAt', 'asc').get()).data
  }
  if (user.role === 'admin') members = (await db.collection('users').get()).data.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).map(x => ({ _id: x._id, name: x.name, role: x.role, approved: x.approved, enabled: x.enabled }))
  return { user: { _id: user._id, name: user.name, role: user.role, approved: user.approved, enabled: user.enabled }, members, dishes, currentOrder }
}

async function saveDish(openid, input) {
  const user = await getMe(openid); assertMember(user)
  const dish = {
    name: String(input.name || '').trim().slice(0, 30),
    ingredients: String(input.ingredients || '').trim().slice(0, 500),
    note: String(input.note || '').trim().slice(0, 500),
    category: String(input.category || '家常菜').trim().slice(0, 20),
    emoji: String(input.emoji || '🍲').slice(0, 4),
    imageFileID: String(input.imageFileID || ''),
    available: true,
    updatedBy: openid,
    updatedByName: user.name || '家人',
    updatedAt: db.serverDate()
  }
  if (!dish.name || !dish.ingredients) throw new Error('菜名和所需食材不能为空')
  if (input._id) {
    const old = await db.collection('dishes').doc(input._id).get()
    await db.collection('dishes').doc(input._id).update({ data: dish })
    if (old.data.imageFileID && dish.imageFileID && old.data.imageFileID !== dish.imageFileID) await cloud.deleteFile({ fileList: [old.data.imageFileID] }).catch(() => {})
    return { _id: input._id }
  }
  const added = await db.collection('dishes').add({ data: { ...dish, createdBy: openid, createdByName: user.name || '家人', createdAt: db.serverDate() } })
  return { _id: added._id }
}

async function deleteDish(openid, dishId) {
  const user = await getMe(openid); assertMember(user)
  const old = await db.collection('dishes').doc(dishId).get()
  await db.collection('dishes').doc(dishId).update({ data: { available: false, updatedBy: openid, updatedAt: db.serverDate() } })
  return { deleted: true, keptPhotoForHistory: Boolean(old.data.imageFileID) }
}

async function createOrder(openid, selections) {
  const user = await getMe(openid); assertMember(user)
  const active = await db.collection('orders').where({ status: _.in([0, 1]) }).limit(1).get()
  if (active.data.length) throw new Error('当前已经有一份饭单，请完成后再点新的一顿')
  if (!Array.isArray(selections) || !selections.length) throw new Error('请至少选择一道菜')
  const uniqueIds = [...new Set(selections.map(x => x.dishId))]
  const dishes = (await db.collection('dishes').where({ _id: _.in(uniqueIds) }).get()).data.filter(x => x.available)
  const map = Object.fromEntries(dishes.map(x => [x._id, x]))
  const items = selections.map(s => {
    const d = map[s.dishId], count = Math.max(1, Math.min(20, Number(s.count) || 1))
    if (!d) throw new Error('有菜品已下架，请刷新菜单')
    return { dishId: d._id, name: d.name, ingredients: d.ingredients, note: d.note, emoji: d.emoji, imageFileID: d.imageFileID, count }
  })
  const added = await db.collection('orders').add({ data: { status: 0, items, createdBy: openid, createdByName: user.name || '家人', createdAt: db.serverDate(), updatedAt: db.serverDate() } })
  return { _id: added._id }
}

async function changeOrderStatus(openid, orderId, status) {
  const user = await getMe(openid); assertMember(user)
  const order = (await db.collection('orders').doc(orderId).get()).data
  if (status !== 1 || order.status !== 0) throw new Error('饭单状态已经变化，请刷新')
  await db.collection('orders').doc(orderId).update({ data: { status: 1, cookId: openid, cookName: user.name || '家人', acceptedAt: db.serverDate(), updatedAt: db.serverDate() } })
  return { changed: true }
}

async function finishOrder(openid, orderId, photoFileIDs, memoryNote) {
  const user = await getMe(openid); assertMember(user)
  const order = (await db.collection('orders').doc(orderId).get()).data
  if (order.status !== 1) throw new Error('请先接单再完成')
  if (!Array.isArray(photoFileIDs) || !photoFileIDs.length || photoFileIDs.length > 9) throw new Error('请上传1至9张完成照')
  if (!photoFileIDs.every(x => typeof x === 'string' && x.startsWith('cloud://'))) throw new Error('照片地址无效')
  await db.collection('orders').doc(orderId).update({ data: { status: 2, photoFileIDs, memoryNote: String(memoryNote || '').slice(0, 500), finishedAt: db.serverDate(), finishedBy: openid, updatedAt: db.serverDate() } })
  return { finished: true }
}

async function updateMemory(openid, orderId, photoFileIDs, memoryNote) {
  const user = await getMe(openid); assertMember(user)
  const order = (await db.collection('orders').doc(orderId).get()).data
  if (order.status !== 2) throw new Error('只能修改已经完成的吃饭记录')
  if (!Array.isArray(photoFileIDs) || !photoFileIDs.length || photoFileIDs.length > 9) throw new Error('请保留1至9张照片')
  if (!photoFileIDs.every(x => typeof x === 'string' && x.startsWith('cloud://'))) throw new Error('照片地址无效')
  const removed = (order.photoFileIDs || []).filter(x => !photoFileIDs.includes(x))
  await db.collection('orders').doc(orderId).update({ data: {
    photoFileIDs,
    memoryNote: String(memoryNote || '').trim().slice(0, 500),
    memoryUpdatedBy: openid,
    memoryUpdatedByName: user.name || '家人',
    memoryUpdatedAt: db.serverDate(),
    updatedAt: db.serverDate()
  } })
  if (removed.length) await cloud.deleteFile({ fileList: removed }).catch(() => {})
  return { updated: true }
}

async function listMemories(openid) {
  const user = await getMe(openid)
  if (!user.approved || !user.enabled) return { allowed: false, memories: [] }
  const data = (await db.collection('orders').where({ status: 2 }).limit(50).get()).data.sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))
  const photoURLMap = await getTempURLMap(data.flatMap(x => x.photoFileIDs || []))
  return { allowed: true, memories: data.map(x => ({
    ...x,
    photoURLs: (x.photoFileIDs || []).map(fileID => photoURLMap[fileID] || fileID),
    finishedDate: formatDate(x.finishedAt),
    itemNames: x.items.map(i => `${i.name} × ${i.count}`).join('、')
  })) }
}

async function updateProfile(openid, name) {
  const user = await getMe(openid)
  const clean = String(name || '').trim().slice(0, 12)
  if (!clean) throw new Error('名字不能为空')
  await db.collection('users').doc(user._id).update({ data: { name: clean, updatedAt: db.serverDate() } })
  return { saved: true }
}

async function manageUser(openid, userId, operation) {
  const admin = await getMe(openid); assertAdmin(admin)
  if (admin._id === userId) throw new Error('不能停用自己')
  const values = operation === 'approve' ? { approved: true, enabled: true } : operation === 'enable' ? { enabled: true } : operation === 'disable' ? { enabled: false } : null
  if (!values) throw new Error('未知操作')
  await db.collection('users').doc(userId).update({ data: { ...values, updatedAt: db.serverDate() } })
  return { changed: true }
}

exports.main = async event => {
  const { OPENID } = cloud.getWXContext()
  try {
    switch (event.action) {
      case 'bootstrap': return ok(await bootstrap(OPENID))
      case 'saveDish': return ok(await saveDish(OPENID, event.dish || {}))
      case 'deleteDish': return ok(await deleteDish(OPENID, event.dishId))
      case 'createOrder': return ok(await createOrder(OPENID, event.selections))
      case 'changeOrderStatus': return ok(await changeOrderStatus(OPENID, event.orderId, event.status))
      case 'finishOrder': return ok(await finishOrder(OPENID, event.orderId, event.photoFileIDs, event.memoryNote))
      case 'updateMemory': return ok(await updateMemory(OPENID, event.orderId, event.photoFileIDs, event.memoryNote))
      case 'listMemories': return ok(await listMemories(OPENID))
      case 'updateProfile': return ok(await updateProfile(OPENID, event.name))
      case 'manageUser': return ok(await manageUser(OPENID, event.userId, event.operation))
      default: return fail('未知请求')
    }
  } catch (e) { console.error(e); return fail(e.message || '服务器开小差了') }
}
