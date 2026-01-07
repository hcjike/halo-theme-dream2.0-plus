(function () {
  let isNight = null
  let isCanvasValid = true

  // 初始化配置
  function initConfig() {
    return {
      zIndex: -1,
      opacity: 0.5,
      particleCount: 99
    }
  }

  // 获取颜色的函数
  function getDynamicColor(alpha) {
    let specialEfficacyScheme = localStorage.getItem('special-efficacy-scheme')
    let isDarkMode = specialEfficacyScheme ? specialEfficacyScheme === 'dark' : false
    return isDarkMode
      ? `rgba(200, 200, 200, ${Math.min(alpha + 0.2, 1)})`
      : `rgba(100, 100, 100, ${Math.min(alpha + 0.2, 1)})`
  }

  // 调整画布大小
  function resizeCanvas() {
    canvas.width = window.innerWidth ||
      document.documentElement.clientWidth ||
      document.body.clientWidth
    canvas.height = window.innerHeight ||
      document.documentElement.clientHeight ||
      document.body.clientHeight
  }

  function getNightMode() {
    const nightValue = localStorage.getItem('night')
    if (nightValue !== null) return nightValue === 'true'
    return isNight !== null ? isNight : document.documentElement.classList.contains('night')
  }

  // 动画主循环
  function animate() {
    // 模式检查
    const mode = DreamConfig.effects_quantum_silk_thread_mode
    isNight = getNightMode()
    if (mode === 'all' || (mode === 'day' && !isNight) || (mode === 'night' && isNight)) {
      isCanvasValid = true
      context.clearRect(0, 0, canvas.width, canvas.height)
      var particleA, particleB, distance, dx, dy, alpha, lineWidth

      particles.forEach(function (currentParticle, index) {
        currentParticle.x += currentParticle.vx
        currentParticle.y += currentParticle.vy
        currentParticle.vx *= currentParticle.x > canvas.width || currentParticle.x < 0 ? -1 : 1
        currentParticle.vy *= currentParticle.y > canvas.height || currentParticle.y < 0 ? -1 : 1
        context.fillRect(currentParticle.x - 0.5, currentParticle.y - 0.5, 1, 1)

        for (var j = index + 1; j < allParticles.length; j++) {
          particleB = allParticles[j]
          if (particleB.x !== null && particleB.y !== null) {
            dx = currentParticle.x - particleB.x
            dy = currentParticle.y - particleB.y
            distance = dx * dx + dy * dy

            if (distance < particleB.maxDistance) {
              if (particleB === mouseParticle && distance >= particleB.maxDistance / 2) {
                currentParticle.x -= 0.03 * dx
                currentParticle.y -= 0.03 * dy
              }

              alpha = (particleB.maxDistance - distance) / particleB.maxDistance
              context.beginPath()
              context.lineWidth = alpha / 2
              context.strokeStyle = getDynamicColor(alpha)
              context.moveTo(currentParticle.x, currentParticle.y)
              context.lineTo(particleB.x, particleB.y)
              context.stroke()
            }
          }
        }
      })
    } else {
      if (isCanvasValid) {
        isCanvasValid = false
        context.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
    requestAnimationFrame(animate)
  }

  // 全局变量
  var canvas = document.createElement('canvas')
  var config = initConfig()
  var context = canvas.getContext('2d')
  var requestAnimFrame = window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    function (callback) {
      window.setTimeout(callback, 1000 / 45)
    }

  // 鼠标粒子对象
  var mouseParticle = {
    x: null,
    y: null,
    maxDistance: 20000
  }

  // 设置canvas属性
  canvas.id = 'effects_quantum'
  canvas.style.cssText = 'position:fixed;top:0;left:0;z-index:' +
    config.zIndex + ';opacity:' + config.opacity

  // 添加到DOM
  document.body.appendChild(canvas)

  // 初始化画布大小
  resizeCanvas()

  // 窗口大小调整事件
  window.onresize = resizeCanvas

  // 鼠标移动事件
  window.onmousemove = function (event) {
    event = event || window.event
    mouseParticle.x = event.clientX
    mouseParticle.y = event.clientY
  }

  // 鼠标离开事件
  window.onmouseout = function () {
    mouseParticle.x = null
    mouseParticle.y = null
  }

  // 创建粒子数组
  var particles = []
  for (var i = 0; i < config.particleCount; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: 2 * Math.random() - 1,
      vy: 2 * Math.random() - 1,
      maxDistance: 6000
    })
  }

  // 合并普通粒子和鼠标粒子
  var allParticles = particles.concat([mouseParticle])

  // 延迟启动动画
  setTimeout(function () {
    animate()
  }, 100)
})()