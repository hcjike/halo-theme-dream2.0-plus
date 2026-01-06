/**
 * 下雨特效模块
 * 使用方法：
 * 1. 引入此JS文件
 * 2. 调用RainEffect.init()初始化
 */
const RainEffect = (function () {
  // 配置参数
  const config = {
    density: 5,     // 雨滴密度
    speed: 0.5,      // 下落速度
    frameDuration: 1000 / 20   // 帧间隔 ms
  }

  let container = null
  let lastRenderTime = 0
  let isNight = null

  // 创建样式
  function createStyles() {
    const style = document.createElement('style')
    style.textContent = `
            .rain-effect-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 1000;
            }
            
            .rain {
                position: absolute;
                width: 1px;
                height: 20px;
                background: linear-gradient(to bottom, transparent, rgba(210, 210, 210, 0.8));
                animation: rainFall linear forwards;
                pointer-events: none;
            }
            
            @keyframes rainFall {
                0% {
                    transform: translateY(-100px) rotate(10deg);
                    opacity: 0;
                }
                10% {
                    opacity: 1;
                }
                95% {
                    opacity: 1;
                }
                100% {
                    transform: translateY(100vh) rotate(10deg);
                    opacity: 0;
                }
            }
        `
    document.head.appendChild(style)
  }

  // 创建雨滴容器
  function createContainer() {
    const container = document.createElement('div')
    container.id = 'effects_rain'
    container.className = 'rain-effect-container'
    document.body.appendChild(container)
    return container
  }

  // 创建雨滴
  function createRainDrop() {
    const rain = document.createElement('div')
    rain.className = 'rain'

    // 随机位置
    const left = Math.random() * window.innerWidth

    // 随机大小和下落速度
    const width = Math.random() * 1.2 + 0.3
    const height = Math.random() * 15 + 10
    const duration = (Math.random() * 0.3 + 0.3) / config.speed

    rain.style.left = `${left}px`
    rain.style.top = '-50px'
    rain.style.width = `${width}px`
    rain.style.height = `${height}px`
    rain.style.animationDuration = `${duration}s`

    container.appendChild(rain)

    // 动画结束后移除雨滴
    rain.addEventListener('animationend', function () {
      rain.remove()
    })
  }

  function getNightMode() {
    const nightValue = localStorage.getItem('night')
    if (nightValue !== null) return nightValue === 'true'
    return isNight !== null ? isNight : document.documentElement.classList.contains('night')
  }

  // 开始下雨
  function animate() {
    let now = Date.now()
    let secondsSinceLastRender = (now - lastRenderTime)
    if (secondsSinceLastRender >= config.frameDuration) {
      isNight = getNightMode()
      let rainMode = DreamConfig.effects_rain_mode
      if (rainMode === 'all' || (rainMode === 'day' && !isNight) || (rainMode === 'night' && isNight)) {
        for (let i = 0; i < config.density; i++) {
          createRainDrop()
        }
      } else {
        RainEffect.clear()
      }
      lastRenderTime = now
    }
    requestAnimationFrame(animate)
  }

  // 窗口大小改变时调整雨滴
  function setupResizeHandler() {
    window.addEventListener('resize', function () {
      const rains = container.querySelectorAll('.rain')
      rains.forEach(rain => {
        rain.style.left = `${Math.random() * window.innerWidth}px`
      })
    })
  }

  // 公开方法
  return {
    init: function (options = {}) {
      // 合并配置
      if (options.density) config.density = options.density
      if (options.speed) config.speed = options.speed

      createStyles()
      container = createContainer()
      animate()
      setupResizeHandler()
    },

    destroy: function () {
      if (container) container.remove()
      const style = document.querySelector('style[data-rain-effect]')
      if (style) style.remove()
    },

    clear: function () {
      const rains = container.querySelectorAll('.rain')
      rains.forEach(rain => {
        rain.remove()
      })
    },

    setDensity: function (density) {
      config.density = density
    },

    setSpeed: function (speed) {
      config.speed = speed
    }
  }
})()

RainEffect.init({
  density: Utils.isMobile() ? 1 : 2,  // 雨滴密度
  speed: 0.5    // 下落速度
})

