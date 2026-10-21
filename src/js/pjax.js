const pjaxAnimationValidStyles = ['multi-cube', 'wave-pulse', 'orbit-system']

/*
 * 页面内容区选择器：正文 + 侧边栏 widget 都在这里面（common/layout.html 的 .dream2-container-content-main）。
 * 这里的脚本每次导航都要重新执行——小工具（如 aplayer）、正文增强（公式、评论、代码高亮）都是这个区域里的。
 */
const CONTENT_SELECTOR = '.dream2-container-content-main, .column-main'

/* 初始文档里的脚本视为已执行 */
const jsLoadCompletes = new Set(Array.from(document.querySelectorAll('script[src]'), item => item.getAttribute('src')))

/*
 * 已执行过的行内脚本内容。
 * 必须跨导航持久：整文档替换后，当前文档里的站点级内联脚本（theme_config、banner 等）已经消失，
 * 只看当前文档会把它们当成"新脚本"再执行一遍，顶层 const/let 直接报
 * "Identifier 'DreamConfig'/'video' has already been declared"。
 */
const executedInlineScripts = new Set(Array.from(document.querySelectorAll('script:not([src])'), item => item.textContent))

/* 主题在非 debug 模式下会接管 console.log，这里用原生输出，保证资源处理过程可见 */
const log = (...args) => (window.logger || console.log)(...args)

/*
 * 整文档替换前的脚本裁剪。
 * pjax 会把 head/body 整体换成新页面，并把保留下来的 <script> 全部执行一遍，
 * 所以「站点级、已经跑过」的脚本必须先裁掉，否则会重复创建实例、重复绑事件：
 *   - 外部脚本按 src 判重；
 *   - 行内脚本按内容判重（内容跑过 = 站点级常驻脚本，例如 theme_config）。
 * 内容区（CONTENT_SELECTOR）里的是页面脚本：每次导航都必须执行，一律保留、不参与判重。
 */
const pruneSiteScripts = (doc) => {
  const inContent = (el) => !!el.closest(CONTENT_SELECTOR)
  let pruned = 0

  /* 以当前文档为准重新登记一次：pjax.js 位于 body 脚本中段，
     初始化时后面那些 <script> 还没解析进来（fancybox、不蒜子、自定义 js 等） */
  document.querySelectorAll('script[src]').forEach(function (script) {
    const src = script.getAttribute('src')
    if (src) jsLoadCompletes.add(src)
  })

  doc.querySelectorAll('script[src]').forEach(function (script) {
    if (inContent(script)) return
    const src = script.getAttribute('src')
    if (!src) return
    if (jsLoadCompletes.has(src)) {
      script.remove()
      pruned++
      return
    }
    jsLoadCompletes.add(src)
  })

  doc.querySelectorAll('script:not([src])').forEach(function (script) {
    if (inContent(script)) return
    const code = script.textContent
    if (!code || !code.trim()) return
    if (executedInlineScripts.has(code)) {
      script.remove()
      pruned++
      return
    }
    /* 保留即意味着它会被 pjax 执行，登记下来，下次导航直接裁掉 */
    executedInlineScripts.add(code)
  })

  return pruned
}

/*
 * 特效画布/容器（#effects_sakura 等）由特效脚本挂在 body 下，脚本内部有常驻动画循环、只初始化一次。
 * 整文档替换前先把它们搬到新 body，避免导航后特效消失。
 */
const persistEffects = (doc) => {
  if (!doc.body) return
  document.body.querySelectorAll(':scope > [id^="effects_"]').forEach(function (el) {
    doc.body.appendChild(el)
  })
}

/*
 * 正文入场动画：给新页面的 .column-main 打标记。
 * 标记在节点插入文档前就加上，插入首帧即处于动画起始态，播放一次「从上往下揭示」的入场效果，
 * 结束后元素回到自身样式（html.loaded 的 opacity: 1），不会残留裁剪。
 * 用 class 而不是复用 html.loaded：后者只在首次加载时变化一次，pjax 后不会再触发过渡。
 * 侧栏不加：左右两列一起揭示会显得晃，正文单独入场更干净。
 */
const markContentEnter = (doc) => {
  doc.querySelectorAll('.column-main').forEach(function (el) {
    el.classList.add('content-enter')
  })
}

/* 动画播完就摘掉标记：否则之后 display 变化（如跨 768 断点重排）会再触发一次动画 */
document.addEventListener('animationend', function (event) {
  if (event.animationName === 'content-enter') {
    event.target.classList.remove('content-enter')
  }
})

/*
 * 侧边栏音乐播放器（<meting-js> Web Component）。
 * Meting 的行为是：节点从文档移除时 disconnectedCallback 里 destroy 播放器，重新插入时 connectedCallback
 * 里又会新建一个 APlayer。整文档替换会让它「销毁 + 重建」，异步创建时还可能旧实例继续出声、新实例再建一个，
 * 于是出现多个播放器同时播放。
 *
 * 处理：把旧 widget 节点整体搬到新文档的同一位置，并在搬之前让 Meting 实例不再重建——
 *   - lock = true：断开连接时不销毁；
 *   - 覆盖 _init/_parse：重新连接时不再创建第二个 APlayer；
 *   - 去掉节点内的 <script>：它们已经执行过，跟着 body 走会让 pjax 再次执行（customElements.define 会抛错）。
 * <link> 保留，播放器样式继续生效。
 */
const persistMusicWidget = (doc) => {
  const oldWidget = document.querySelector('.widget.music')
  const newWidget = doc.querySelector('.widget.music')
  if (!oldWidget || !newWidget) return

  oldWidget.querySelectorAll('meting-js').forEach(function (meting) {
    /* 播放器还没创建出来（异步请求中）时不折腾，交给浏览器按默认逻辑处理 */
    if (!meting.aplayer) return
    meting.lock = true
    meting._init = function () {}
    meting._parse = function () {}
  })
  oldWidget.querySelectorAll('script').forEach(function (el) {
    el.remove()
  })
  /*
   * APlayer 的样式表在 widget 内部：节点整块搬运时会短暂脱离文档，样式会失效；
   * 而且新页面的 head 里本来就没有它，switchHead 重建 head 时旧 head 的这份也带不过来。
   * 所以每次切换都确保新 head 里有一份（同 href 只留一个），widget 内部的原 link 保留不删。
   */
  oldWidget.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
    const href = link.getAttribute('href')
    if (!doc.head || !href) return
    const exists = Array.prototype.some.call(doc.head.querySelectorAll('link[href]'), function (el) {
      return el.getAttribute('href') === href
    })
    if (!exists) doc.head.appendChild(link.cloneNode(true))
  })
  newWidget.replaceWith(oldWidget)
}

/* 本次导航的目标路径（hooks.request 里记录），banner 是否隐藏取决于它 */
let pendingPathname = '/'

/*
 * banner 的初始化原本是 banner.html 里的内联脚本（含顶层 const，重复执行会因重复声明直接失败），
 * 整文档替换时它们会被当作站点级脚本裁掉，于是视频没有 src、该隐藏的页面也不带 hidden。
 * 这里在文档切换前把等价状态直接算好：隐藏与否、视频源/封面、描述的可见性；
 * 切换后由 common.js 的 initBanner 接手打字动画、initBannerVideo 处理窗口宽度变化。
 */
const prepareBanner = (doc) => {
  const banner = doc.querySelector('.banner')
  if (!banner) return
  /* 直接以最终态插入（首页展开、其余页折叠）：切换期间过渡是关闭的，全程无动画 */
  banner.classList.toggle('hidden', pendingPathname !== '/')

  const video = banner.querySelector('video')
  if (video) {
    const attr = (name) => video.getAttribute(name) || ''
    const src = attr('data-src')
    const srcM = attr('data-src-mobile')
    const poster = attr('data-poster')
    const posterM = attr('data-poster-mobile')
    const isMobile = window.Utils && typeof Utils.isMobileByScreenWidth === 'function'
      ? Utils.isMobileByScreenWidth()
      : false
    const nextSrc = isMobile ? (srcM || src) : src
    const nextPoster = isMobile ? (posterM || poster) : poster
    /* 用 setAttribute 而不是 src 属性：此时节点还挂在 DOMParser 生成的文档上，
       直接赋 src 会按 about:blank 解析成错误的绝对地址，插入后才会按真实 base 解析 */
    if (nextSrc) video.setAttribute('src', nextSrc)
    if (nextPoster) video.setAttribute('poster', nextPoster)
    video.dataset.bannerMobile = String(isMobile)
  }

  const desc = banner.querySelector('.banner-info-desc')
  if (desc) {
    /* 未填写描述时整块隐藏，否则只剩一个一直闪烁的打字光标 */
    if (!desc.textContent.trim()) {
      desc.style.display = 'none'
    } else {
      /* 首帧前先藏起来，交给 initBanner 清空后逐字打印，避免先闪出完整文案 */
      desc.style.visibility = 'hidden'
    }
  }
}

/*
 * head 整块换成新页面的内容（meta、title、样式、CSS 变量全部跟随服务端渲染）。
 * 只替换子节点、保留 <head> 元素本身，避免有代码缓存了 document.head 引用后失效；
 * href 相同的 <link> 复用原节点，避免每次导航都重建整批样式表链接造成闪烁。
 */
const switchHead = (oldHead, newHead) => {
  const reusable = new Map()
  oldHead.querySelectorAll('link[href]').forEach(function (link) {
    reusable.set(link.getAttribute('href'), link)
  })
  const nodes = Array.from(newHead.childNodes).map(function (node) {
    if (node.nodeType === 1 && node.tagName === 'LINK') {
      const reused = reusable.get(node.getAttribute('href'))
      if (reused) {
        reusable.delete(node.getAttribute('href'))
        return reused
      }
    }
    return document.adoptNode(node)
  })
  oldHead.replaceChildren(...nodes)
}

// 初始化 Pjax 实例
const pjax = new Pjax({
  /* 整文档替换：head、body 全部换成服务端渲染的新页面，新增资源随文档一起到位 */
  selectors: ['head', 'body'],
  switches: {
    head: switchHead,
  },
  defaultTrigger: {
    exclude: 'a[target="_blank"], a[data-not-pjax]',
  },
  scrollTo: 0,
  scrollRestoration: true,
  timeout: 8000,
  scripts: false,
  hooks: {
    /* 记录目标路径：banner 的隐藏状态依赖它 */
    request: (request) => {
      try {
        pendingPathname = new URL(request.url, location.href).pathname
      } catch (e) {
        pendingPathname = location.pathname
      }
    },
    // 拦截解析后的新页面文档：裁掉站点级脚本，其余资源与脚本由 pjax 自己加载执行
    document: (doc) => {
      const pruned = pruneSiteScripts(doc)
      persistEffects(doc)
      /* 内容区插入即播放入场动画 */
      markContentEnter(doc)
      /* 音乐播放器整块搬过去，避免被销毁后重建出多个实例 */
      persistMusicWidget(doc)
      prepareBanner(doc)
      /* 整块替换期间禁用 banner 过渡，避免出现"先显示再折叠"的动画 */
      document.documentElement.classList.add('banner-no-transition')
      log('[pjax] 新页面资源: css=' + doc.querySelectorAll('link[rel~="stylesheet"][href]').length
        + ', js=' + doc.querySelectorAll('script[src]').length
        + ', 内联脚本=' + doc.querySelectorAll('script:not([src])').length
        + ', 跳过站点级脚本=' + pruned)
    },
  },
})

/* 切换代次：快速连续导航时，只有最后一次 complete 才解除抽屉守卫类 */
let swapGeneration = 0

// pjax:send - 请求发送时
document.addEventListener('pjax:send', function (event) {
  console.log('------------------------')
  console.log('pjax:send')
  swapGeneration++
  //动画模式
  if (DreamConfig.pjax_animation_style === 'scale') {
    document.documentElement.classList.add('pjax-loading')
  } else if (pjaxAnimationValidStyles.includes(DreamConfig.pjax_animation_style)) {
    const el = document.querySelector('.pjax-animation-container')
    if (el) el.classList.add('active')
  }
  window.DProgress && DProgress.start() && DProgress.inc()
  /*
   * 桌面端：整个切换窗口内把抽屉/遮罩钉成不可见，避免切换瞬间闪出展开/收起动画。
   * 手机端不加这个守卫——抽屉要保留正常的收起动画。
   */
  const isMobileLayout = window.Utils && typeof Utils.isMobileByScreenWidth === 'function' && Utils.isMobileByScreenWidth()
  if (!isMobileLayout) document.documentElement.classList.add('pjax-swapping')
  /* 复位抽屉/遮罩/搜索面板（手机端带动画），并解除 html 上的滚动锁定 */
  commonContext.closeNavbarPanels()
})

// pjax:success - 内容替换成功后
document.addEventListener('pjax:success', function (event) {
  log('pjax:success')

  /*
   * head/body 已是新页面：样式、meta、页面脚本（含 .column-main 里的内联脚本、
   * data-* 配置脚本、ES Module）都由 pjax 按文档顺序加载并执行完，这里只重跑主题初始化。
   * reinitAfterPjax 依次跑首帧 / 事件绑定 / DOM 就绪三组；document 级监听已去重，
   * 元素级监听随新 DOM 重新绑定。
   */
  commonContext.reinitAfterPjax && commonContext.reinitAfterPjax()

  /* 内容区脚本暴露的初始化钩子 */
  window.tagcloudPjax && window.tagcloudPjax()
  window.recentCommentsPjax && window.recentCommentsPjax()
  /* 初始化日志界面 */
  window.journalPjax && window.journalPjax()
  /* 初始化文章界面 */
  window.postPjax && window.postPjax()

  console.log('全部处理完成')
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

  /* banner 的初始状态（hidden / 视频源）已在切换前设好，等首帧渲染完成再恢复过渡；
     同时解除抽屉/遮罩的切换禁用（两帧之后，避免收尾时又播一次动画）。
     只在最后一次导航解除，防止连续点击时提前放开守卫。 */
  const generation = swapGeneration
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      document.documentElement.classList.remove('banner-no-transition')
      if (generation === swapGeneration) {
        document.documentElement.classList.remove('pjax-swapping')
      }
    })
  })

  /* 等 pjax 过渡结束、页面布局稳定后再插入 mermaid 渲染出的 SVG，避免过渡期间产生额外重排
     （当前 pjax-loading 只有 opacity 过渡，并没有缩放，350ms 是历史遗留的缓冲，非强约束）；
     initMermaid 在 mermaid 未就绪时会直接静默返回，所以这里轮询等待脚本就绪，最多重试 30 次（6s） */
  let mermaidRetry = 30
  const tryInitMermaid = () => {
    if (typeof mermaid !== 'undefined') {
      commonContext.initMermaid()
      return
    }
    if (mermaidRetry-- > 0) {
      setTimeout(tryInitMermaid, 200)
    }
  }
  setTimeout(tryInitMermaid, 350)
})
