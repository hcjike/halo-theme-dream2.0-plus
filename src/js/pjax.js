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

/*
 * 调试日志：只在主题设置开启「调试模式」时输出（DreamConfig.enable_debug）。
 * 用 window.logger 拿原生 console.log，避免被主题的日志接管逻辑吞掉。
 */
const isDebug = () => typeof DreamConfig !== 'undefined' && !!DreamConfig.enable_debug
const log = (...args) => {
  if (!isDebug()) return
  ;(window.logger || console.log)(...args)
}

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
 * Meting 的生命周期是：节点移除时 disconnectedCallback 里 destroy 播放器，重新插入时 connectedCallback
 * 里再 _init + _parse 建一个新的 APlayer；整文档替换会让它「销毁 + 重建」，
 * 而 _parse 里的网络请求是异步的，在途时断开还会留下一个脱离文档、却仍在出声的实例——
 * 这就是「偶尔出现多个播放器 / 两份声音」的来源。
 *
 * 处理：
 *   - 不管播放器有没有创建出来，一律接管：lock = true（断开不销毁）+ 覆盖 _init/_parse（重连不重建）；
 *     在途的创建流程不受影响，它会把播放器挂到搬过去的同一个节点上；
 *   - 删掉节点内的 <script>：它们已执行过，跟着 body 走会被 pjax 再执行一次（customElements.define 抛错）；
 *   - 样式表补一份到新 head：节点搬运期间会短暂脱离文档，避免掉样式；
 *   - 记录搬运目标：导航失败时放回原位，避免出现「看不见但还在播」的幽灵实例。
 */
const knownMeting = new Set()
let pendingMusicMove = null

const takeOverMeting = (meting) => {
  meting.lock = true
  meting._init = function () {}
  meting._parse = function () {}
  knownMeting.add(meting)
}

/*
 * 清掉「已不在当前文档、却还在出声」的实例：
 * 搬运目标被丢弃（导航被打断/失败）时，节点会被 DOMParser 文档收养，
 * 此时 isConnected 仍为 true，必须用 ownerDocument 判断，否则会漏杀。
 */
const cleanupGhostMeting = () => {
  knownMeting.forEach(function (meting) {
    if (meting.ownerDocument === document && meting.isConnected) return
    knownMeting.delete(meting)
    try {
      if (meting.aplayer) meting.aplayer.destroy()
    } catch (e) {
      /* 实例已销毁，或播放器还在异步创建中，忽略 */
    }
  })
}

const persistMusicWidget = (doc) => {
  const oldWidget = document.querySelector('.widget.music')
  const newWidget = doc.querySelector('.widget.music')

  /*
   * 新页面没有音乐模块：旧节点会随旧 body 一起丢弃。
   * 此时必须解除接管（lock = false），让它断开时按默认逻辑销毁，
   * 否则会出现「页面上看不到播放器、音乐却还在响」，下次进有播放器的页面就变成两个。
   */
  if (!oldWidget || !newWidget) {
    if (oldWidget && !newWidget) {
      oldWidget.querySelectorAll('meting-js').forEach(function (meting) {
        meting.lock = false
        knownMeting.delete(meting)
      })
    }
    cleanupGhostMeting()
    return
  }

  oldWidget.querySelectorAll('meting-js').forEach(takeOverMeting)
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

  pendingMusicMove = { node: oldWidget, parent: oldWidget.parentNode, next: oldWidget.nextSibling }
  newWidget.replaceWith(oldWidget)
}

/*
 * 侧边栏音乐在「布局契约页面」（.container.hide-sidebar，左右两列被 display: none）里看不见，
 * 声音却还在放，用户没法暂停。这里只做最小干预：
 *   - 播放器不可见且正在播放 → 暂停，并记下「这次是我暂停的」；
 *   - 回到可见页面时，只有上一次是自动暂停的才恢复播放；
 *   - 其余情况（用户自己暂停、本来就没在放）一律不动。
 * 移动端把 widget 搬进导航抽屉时，元素只是移出视口（rect 不为 0），仍算可见，不会触发暂停。
 */
let musicPausedByHidden = false

const syncMusicPlayback = () => {
  const meting = document.querySelector('meting-js')
  const aplayer = meting && meting.aplayer
  if (!aplayer || !aplayer.audio) {
    /* 实例已重建/销毁，旧的暂停标记没有意义，清掉避免回来时莫名其妙开始播放 */
    musicPausedByHidden = false
    return
  }

  /* 只按几何尺寸判断：侧栏被 display: none 时 rect 全为 0；
     移动端装进导航抽屉时元素只是被 transform 移出视口，尺寸仍在，仍算可见 */
  const rect = meting.getBoundingClientRect()
  const invisible = rect.width === 0 || rect.height === 0

  if (invisible) {
    if (!aplayer.audio.paused) {
      musicPausedByHidden = true
      aplayer.pause()
    }
    return
  }

  if (musicPausedByHidden) {
    musicPausedByHidden = false
    try {
      const played = aplayer.play()
      if (played && typeof played.catch === 'function') played.catch(function () {})
    } catch (e) {
      /* 浏览器可能因缺少用户手势拒绝自动恢复，忽略即可 */
    }
  }
}

/* 导航失败时把搬走的音乐模块放回原位，否则播放器会脱离文档继续出声、下次导航又建一个 */
const restoreMusicWidget = () => {
  const move = pendingMusicMove
  pendingMusicMove = null
  if (!move) return
  /* 节点被收养进 DOMParser 文档时 isConnected 仍为 true，必须看 ownerDocument */
  if (move.node.ownerDocument === document) return
  if (!move.parent || !move.parent.isConnected) {
    cleanupGhostMeting()
    return
  }
  try {
    move.parent.insertBefore(move.node, move.next)
  } catch (e) {
    cleanupGhostMeting()
  }
}

/*
 * banner 的初始化原本是 banner.html 里的内联脚本（含顶层 const，重复执行会因重复声明直接失败），
 * 整文档替换时它们会被当作站点级脚本裁掉，于是视频没有 src、该隐藏的页面也不带 hidden。
 * 这里在文档切换前把等价状态直接算好：隐藏与否、视频源/封面、描述的可见性；
 * 切换后由 common.js 的 initBanner 接手打字动画、initBannerVideo 处理窗口宽度变化。
 */
const prepareBanner = (doc) => {
  const banner = doc.querySelector('.banner')
  if (!banner) return
  /*
   * 直接以最终态插入（首页展开、其余页折叠）：切换期间过渡是关闭的，全程无动画。
   * 目标路径取 location.pathname —— pjax 在调用 document hook 之前已经 pushState 到新地址，
   * 比依赖 request hook 里自己记的状态更可靠（那个状态一旦漏更新，banner 就会先显示再瞬间消失）。
   */
  banner.classList.toggle('hidden', location.pathname !== '/')

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

// pjax:send - 请求发送时
document.addEventListener('pjax:send', function () {
  log('------------------------')
  log('pjax:send')
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
document.addEventListener('pjax:success', function () {
  log('pjax:success')

  /* 音乐模块已在新文档中就位，落账；顺手清掉历史上脱离文档的残留实例 */
  pendingMusicMove = null
  cleanupGhostMeting()

  /*
   * 非首页：直接把 banner 节点移出文档。
   * 只靠 hidden 类，一旦有别处的样式覆盖 display/height，仍会留下一整块空白；
   * banner 在非首页本来就没有任何用处，移除后 section 紧挨 navbar，顶部间距也是最紧凑的。
   * 首页不动：新文档自带 banner，视频源/描述已由 prepareBanner 准备好。
   */
  if (location.pathname !== '/') {
    document.querySelectorAll('.banner').forEach(function (el) {
      el.remove()
    })
  }

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

  /*
   * 等 initWidget 把 widget 归位后再判断播放器是否可见：
   * 契约页面（侧栏 display: none）自动暂停，回到普通页面时只恢复这次自动暂停的播放。
   */
  syncMusicPlayback()

  log('全部处理完成')
  window.DProgress && DProgress.done()
})

// pjax:error - 请求出错时
document.addEventListener('pjax:error', function (event) {
  /* 错误用 console.error：不受调试开关影响，出问题时始终可见 */
  console.error(`[pjax] 请求失败：${event.detail}`)
  /* 没切成就把搬走的音乐模块放回原位，避免播放器脱离文档继续出声、下次导航又建一个 */
  restoreMusicWidget()
})

// pjax:complete - 请求完成后（无论成功或失败）
document.addEventListener('pjax:complete', function () {
  log('pjax:complete')

  //动画模式
  if (DreamConfig.pjax_animation_style === 'scale') {
    document.documentElement.classList.remove('pjax-loading')
  } else if (pjaxAnimationValidStyles.includes(DreamConfig.pjax_animation_style)) {
    const el = document.querySelector('.pjax-animation-container')
    if (el) el.classList.remove('active')
  }

  /* banner 的初始状态（hidden / 视频源）已在切换前设好，等首帧渲染完成再恢复过渡；
     同时解除抽屉/遮罩的切换禁用（两帧之后，避免收尾时又播一次动画）。 */
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      document.documentElement.classList.remove('banner-no-transition')
      /* 必须无条件解除：一旦残留，抽屉会被永久钉成不可见。
         快速连点时下一次导航会自己再加一次，不存在露出问题。 */
      document.documentElement.classList.remove('pjax-swapping')
    })
  })

  /*
   * pjax 后唯一的 mermaid 渲染入口：initMermaid 属于 ON_IDLE 组，
   * 而 reinitAfterPjax 只跑 IMMEDIATE / AFTER_PAINT / ON_READY，不会带上它，所以这段不能删。
   * 页面里没有待渲染的 mermaid 图时直接跳过，普通页面就不用白跑 6 秒轮询。
   */
  const pendingMermaid = Array.from(document.querySelectorAll('text-diagram[data-type=mermaid]'))
    .some(function (el) { return !el.querySelector('svg') })
  if (!pendingMermaid) return

  /* 等 pjax 过渡结束、页面布局稳定后再插入 mermaid 渲染出的 SVG，避免过渡期间产生额外重排；
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
