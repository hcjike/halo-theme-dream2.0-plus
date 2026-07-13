const cssLoadCompletes = new Set(Array.from(document.querySelectorAll('link[href*=".css"]'), item => item.getAttribute('href')))
const jsLoadCompletes = new Set(Array.from(document.querySelectorAll('script[src*=".js"]'), item => item.getAttribute('src')))

const pjaxAnimationValidStyles = ['multi-cube', 'wave-pulse', 'orbit-system']

// pjax请求时进行界面预处理
const initPjax = () => {
}

const syncLoadScripts = (scripts, i, resolve) => {
  if (i >= scripts.length) {
    resolve && resolve()
    return
  }
  const src = scripts[i].getAttribute('src')
  if (jsLoadCompletes.has(src)) {
    syncLoadScripts(scripts, i + 1, resolve)
    return
  }
  console.log((resolve ? '同步' : '异步') + '顺序加载js ' + src)
  Utils.cachedScript(src)
    .done(function () {
      console.log((resolve ? '同步' : '异步') + '顺序加载js完成 ' + src)
      jsLoadCompletes.add(src)
      window.DProgress && DProgress.inc()
      syncLoadScripts(scripts, i + 1, resolve)
    })
    .fail(function () {
      console.log((resolve ? '同步' : '异步') + '顺序加载js失败 ' + src)
      syncLoadScripts(scripts, i + 1, resolve)
    })
}

// 存储从新页面文档中提取的待加载资源
let pendingCssLoads = []
let pendingJsLoads = []
let pendingHeadElements = []

/**
 * 从新页面文档中提取并加载 CSS/JS 资源
 * 使用 Pjax 的 hooks.document 钩子，在 DOM 切换前拦截解析后的新页面文档
 */
const loadResourcesFromDoc = (newDoc) => {
  pendingCssLoads = []
  pendingJsLoads = []
  pendingHeadElements = []

  // 提取新文档中的 meta 和 canonical，用于后续替换 head 中的内容
  newDoc.querySelectorAll('head meta').forEach(function (meta) {
    pendingHeadElements.push(meta.cloneNode(true))
  })
  newDoc.querySelectorAll('head link[rel="canonical"]').forEach(function (link) {
    pendingHeadElements.push(link.cloneNode(true))
  })

  // 提取需要加载的 CSS
  newDoc.querySelectorAll('link[href]').forEach(function (link) {
    const isDataPjax = link.hasAttribute('data-pjax')
    const href = link.getAttribute('href')
    const isStaticPath = href && href.startsWith('/plugins')
    if ((isDataPjax || isStaticPath) && !cssLoadCompletes.has(href)) {
      pendingCssLoads.push({link: link, href: href})
    }
  })

  // 提取需要加载的 JS
  const allScripts = newDoc.querySelectorAll('script[src]')
  allScripts.forEach(function (script) {
    const isDataPjax = script.hasAttribute('data-pjax')
    const src = script.getAttribute('src')
    const isStaticPath = src && src.startsWith('/plugins')
    if ((isDataPjax || isStaticPath) && !jsLoadCompletes.has(src)) {
      pendingJsLoads.push(script)
    }
  })

  // 立即加载 CSS（异步）
  pendingCssLoads.forEach(function (item) {
    const newLink = item.link.cloneNode(true)
    document.head.appendChild(newLink)
    console.log('加载css ' + item.href)
    newLink.onload = function () {
      cssLoadCompletes.add(item.href)
      window.DProgress && DProgress.inc()
      console.log('加载css完成 ' + item.href)
    }
  })
}

// 初始化 Pjax 实例
const pjax = new Pjax({
  selectors: ['title', '.column-main'],
  defaultTrigger: {
    exclude: 'a[target="_blank"], a[data-not-pjax]',
  },
  scrollTo: 0,
  scrollRestoration: true,
  timeout: 8000,
  scripts: 'script[data-pjax]',
  hooks: {
    // 拦截解析后的新页面文档，提取 CSS/JS 资源
    document: (doc) => {
      loadResourcesFromDoc(doc)
    },
  },
})

// pjax:send - 请求发送时
document.addEventListener('pjax:send', function (event) {
  console.log('------------------------')
  console.log('pjax:send')
  //动画模式
  if (DreamConfig.pjax_animation_style === 'scale') {
    document.documentElement.classList.add('pjax-loading')
  } else if (pjaxAnimationValidStyles.includes(DreamConfig.pjax_animation_style)) {
    const el = document.querySelector('.pjax-animation-container')
    if (el) el.classList.add('active')
  }
  window.DProgress && DProgress.start()
})

// pjax:success - 内容替换成功后
document.addEventListener('pjax:success', async function (event) {
  console.log('pjax:success')

  /* 重新激活图片预览功能 */
  commonContext.initGallery()
  /* 重新加载目录和公告 */
  commonContext.initTocAndNotice()
  /* 初始化pjax加载 */
  initPjax()

  /* 从新加载的 DOM 中获取数据 */
  const newContainer = document.querySelector('.dream2-container-content-main')
  if (newContainer) {
    const currentContainers = document.querySelectorAll('.dream2-container-content-main')
    const newClasses = newContainer.getAttribute('class') || ''
    currentContainers.forEach(function (el) {
      el.className = newClasses
    })
    console.log('替换容器[.dream2-container-content-main]的css：' + newClasses)
  }

  /* 更新 head 中的 meta 和 canonical */
  const $head = $('head')
  $head.find('meta').remove()
  $head.find('link[rel="canonical"]').remove()
  // 从新页面文档中追加 meta 和 canonical
  pendingHeadElements.forEach(function (el) {
    document.head.appendChild(el)
  })

  /* 加载 JS 文件（从 hooks.document 中提取的待加载列表） */
  if (pendingJsLoads.length > 0) {
    // 异步无序加载
    pendingJsLoads.filter(s => s.hasAttribute('async')).forEach(function (script) {
      const src = script.getAttribute('src')
      console.log('异步无序加载js ' + src)
      Utils.cachedScript(src)
        .done(function () {
          console.log('异步无序js完成 ' + src)
          window.DProgress && DProgress.inc()
          jsLoadCompletes.add(src)
        })
        .fail(function () {
          console.log('异步无序js失败 ' + src)
        })
    })
    // defer 脚本同步顺序加载
    new Promise(() => {
      syncLoadScripts(pendingJsLoads.filter(s => s.hasAttribute('defer')), 0)
    })
    // 同步脚本顺序加载
    const syncScripts = pendingJsLoads.filter(s => !s.hasAttribute('async') && !s.hasAttribute('defer'))
    if (syncScripts.length > 0) {
      await new Promise((resolve) => {
        syncLoadScripts(syncScripts, 0, resolve)
      })
    }
  }

  console.log('全部处理完成')

  /* 初始化日志界面 */
  window.journalPjax && window.journalPjax()
  /* 初始化文章界面 */
  window.postPjax && window.postPjax()
  /* 刷新人生倒计时 */
  commonContext.initTimeCount()
  /* 初始化任务列表，禁止点击 */
  commonContext.iniTaskItemDisabled()
  /* 初始化轮播 */
  commonContext.initCarousel()
  /** 关闭画廊 **/
  commonContext.closeFancybox()
  /* 控制是否显示Banner */
  commonContext.showBanner()
  window.DProgress && DProgress.done()
})

// pjax:error - 请求出错时
document.addEventListener('pjax:error', function (event) {
  console.log(`pjax:error error ${event.detail}`)
})

// pjax:complete - 请求完成后（无论成功或失败）
document.addEventListener('pjax:complete', function (event) {
  console.log('pjax:complete')

  //动画模式
  if (DreamConfig.pjax_animation_style === 'scale') {
    document.documentElement.classList.remove('pjax-loading')
  } else if (pjaxAnimationValidStyles.includes(DreamConfig.pjax_animation_style)) {
    const el = document.querySelector('.pjax-animation-container')
    if (el) el.classList.remove('active')
  }
})
