!(function () {

  function checkDebug() {
    const startTime = performance.now()
    eval('debugger')
    const endTime = performance.now()
    if (endTime - startTime > 300) {
      showBlockMessage()
    }
  }

  checkDebug()

  // 方法1：无限 debugger
  setInterval(function () {
    checkDebug()
  }, 1000)

  // 方法2：键盘监听
  document.addEventListener('keydown', function (e) {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
      e.preventDefault()
    }
  })

  function showBlockMessage() {
    document.body.innerHTML = '<div style="position: fixed; width: 100%; height: 100%;top: 0;left: 0;display: flex;justify-content: center;align-items: center;font-size: 1.5rem;">\n' +
      '<div>' +
      '<div style="text-align: center;">' + DreamConfig.ban_debug_tips +
      '</div>' +
      '<br/>' +
      '<a style="display: flex; justify-content: center;" data-not-pjax href="/">'+DreamConfig.ban_debug_back_home+'</a>' +
      '</div>' +
      '</div>'
  }
})()