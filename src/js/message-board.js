(function () {
  const board = document.getElementById('messageBoard')
  if (!board) return
  const tiles = board.querySelectorAll('.message-tile')
  if (!tiles.length) return

  // 缓存 content 宽度，供布局和拖拽共用
  var contentW = 0

  function measureContentWidth() {
    var probe = document.createElement('div')
    probe.style.cssText = 'position:absolute;visibility:hidden;left:0;right:0;top:0;height:1px'
    board.appendChild(probe)
    contentW = probe.getBoundingClientRect().width
    board.removeChild(probe)
  }

  function layout() {
    measureContentWidth()
    var boardW = contentW
    const gap = 10
    const maxCols = Math.max(1, Math.floor((boardW - gap) / (200 + gap)))
    // 列数不超过卡片数量
    const cols = Math.min(maxCols, tiles.length)
    // 卡片宽度上限 200
    const tileW = Math.min(200, Math.floor((boardW - gap * (cols + 1)) / cols))
    // 用实际间距吸收 floor 取整的余量，确保铺满宽度
    const actualGap = (boardW - cols * tileW) / (cols + 1)

    // 先设置宽度，让浏览器算出实际高度
    tiles.forEach(function (tile) {
      tile.style.width = tileW + 'px'
    })

    // 瀑布流布局：每张卡片放入当前最短的列
    const colHeights = new Array(cols).fill(actualGap)
    tiles.forEach(function (tile) {
      // 找最短列
      let minCol = 0
      for (let c = 1; c < cols; c++) {
        if (colHeights[c] < colHeights[minCol]) minCol = c
      }
      const jitterX = (Math.random() - 0.5) * 6
      const jitterY = (Math.random() - 0.5) * 6
      const rotate = (Math.random() - 0.5) * 3
      tile.style.left = (minCol * (tileW + actualGap) + actualGap + jitterX) + 'px'
      tile.style.top = (colHeights[minCol] + jitterY) + 'px'
      tile.style.transform = 'rotate(' + rotate + 'deg)'
      colHeights[minCol] += tile.offsetHeight + actualGap
    })

    // 调整容器高度
    board.style.minHeight = Math.max.apply(null, colHeights) + 'px'
  }

  // 等待页面动画/过渡完成后再计算布局
  requestAnimationFrame(function () {
    requestAnimationFrame(layout)
  })

  // 拖拽功能
  let dragging = null, startX, startY, origLeft, origTop

  tiles.forEach(function (tile) {
    tile.addEventListener('mousedown', onStart)
    tile.addEventListener('touchstart', onStart, {passive: false})
  })

  function onStart(e) {
    e.preventDefault()
    dragging = this
    dragging.classList.add('dragging')
    const point = e.touches ? e.touches[0] : e
    startX = point.clientX
    startY = point.clientY
    origLeft = parseFloat(dragging.style.left) || 0
    origTop = parseFloat(dragging.style.top) || 0
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onEnd)
    document.addEventListener('touchmove', onMove, {passive: false})
    document.addEventListener('touchend', onEnd)
  }

  function onMove(e) {
    if (!dragging) return
    e.preventDefault()
    const point = e.touches ? e.touches[0] : e
    const dx = point.clientX - startX
    const dy = point.clientY - startY
    let newLeft = origLeft + dx
    let newTop = origTop + dy
    // 限制拖拽范围不超出 board
    const tW = dragging.offsetWidth
    const tH = dragging.offsetHeight
    const maxLeft = contentW - tW - 4
    const maxTop = board.offsetHeight - tH - 4
    newLeft = Math.max(4, Math.min(newLeft, maxLeft))
    newTop = Math.max(4, Math.min(newTop, maxTop))
    dragging.style.left = newLeft + 'px'
    dragging.style.top = newTop + 'px'
    dragging.style.transform = 'rotate(0deg)'
  }

  function onEnd() {
    if (!dragging) return
    dragging.classList.remove('dragging')
    const rotate = (Math.random() - 0.5) * 4
    dragging.style.transform = 'rotate(' + rotate + 'deg)'
    dragging = null
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onEnd)
    document.removeEventListener('touchmove', onMove)
    document.removeEventListener('touchend', onEnd)
  }
})()
