import Swup from 'swup'
import SwupScrollPlugin from '@swup/scroll-plugin'

/*
 * Swup 版无刷新导航。
 *
 * 与 pjax.js 的行为对齐：
 *   - 只替换正文列 .column-main，导航栏 / banner / 侧栏 / 页脚 / head 都沿用首屏节点；
 *   - 页面级资源（样式、脚本、内联样式）按差集手动补齐，不依赖白名单；
 *   - 布局容器 class、页面级 meta、banner 显隐、音乐播放器、进度条、加载动画全部照旧；
 *   - 入场仍然用主题自己的 content-enter 动画，不启用 Swup 的 CSS transition 机制，
 *     所以「Pjax 加载动画风格」这套配置项继续有效。
 *
 * pjax.js 暂时保留，模板里只挂其中一个（见 common/scripts.html）。
 */

const LOADING_ANIMATION_STYLES = ['multi-cube', 'wave-pulse', 'orbit-system']

/* 内容列：每次导航只替换这一块 */
const CONTENT_SELECTOR = '.column-main'

/*
 * 布局容器（正文 + 两侧栏的外框，见 common/layout.html）。
 * 侧栏是否隐藏完全由服务端渲染在它身上的 class 决定（.container.hide-sidebar），
 * 容器本身不参与替换，所以每次导航必须把新页面的 class 抄过来。
 */
const CONTAINER_SELECTOR = '.dream2-container-content-main'

/* 调试日志：只在主题设置开启「调试模式」时输出（DreamConfig.enable_debug） */
const isDebug = () => typeof DreamConfig !== 'undefined' && !!DreamConfig.enable_debug
const log = (...args) => {
  if (!isDebug()) return
  ;(window.logger || console.log)('[swup]', ...args)
}

/* ======================= 页面级资源同步 ======================= */

/*
 * 只替换正文列时，新页面 head/body 里的资源不会自己进文档，必须手动补：
 *   - <link rel="stylesheet">、<script src> 这类外链；
 *   - <style>、<script> 里的直接内容。
 * 判定方式是跟「当前文档已有的资源」做差集（外链比 URL，内联比内容），
 * 而不是靠 data-pjax 之类的白名单——插件页面的资源未必带标记，也不一定放在 /plugins 下。
 */

/* 已加载过的外链资源 */
const loadedStyles = new Set()
const loadedScripts = new Set()

/* 已经插进文档的内联样式内容：同样的样式插两份会叠加优先级 */
const appliedInlineStyles = new Set()

/* 首屏就存在的内联脚本 = 站点级脚本，已经执行过，导航时不再重复执行 */
const executedSiteScripts = new Set()

/*
 * 首屏资源快照：必须等到第一次导航时再拍。
 * swup.js 位于 body 脚本中段，后面还有 inline_body_html、公告弹窗（notice/*.html）等内联脚本，
 * 此刻拍快照会漏掉它们，导航时就会被当成"新页面的脚本"重复执行——
 * 那些脚本带顶层 const（如 notice_read_key），第二次执行直接报重复声明、整段失效。
 */
let documentAssetsRegistered = false
const registerDocumentAssets = () => {
  if (documentAssetsRegistered) return
  documentAssetsRegistered = true
  document.querySelectorAll('link[href]').forEach(function (el) {
    loadedStyles.add(el.getAttribute('href'))
  })
  document.querySelectorAll('script[src]').forEach(function (el) {
    loadedScripts.add(el.getAttribute('src'))
  })
  document.querySelectorAll('style').forEach(function (el) {
    appliedInlineStyles.add(el.textContent)
  })
  document.querySelectorAll('script:not([src])').forEach(function (el) {
    executedSiteScripts.add(el.textContent)
  })
}

/* 正文列由导航整体替换，里面的资源它自己会处理，不能再补一遍 */
const inContentArea = (el) => !!el.closest(CONTENT_SELECTOR)

/* 需要补进 head 的样式外链：stylesheet 或 preload as=style */
const isStyleLink = (el) => {
  const rel = (el.getAttribute('rel') || '').toLowerCase().split(/\s+/)
  return rel.indexOf('stylesheet') !== -1 || (el.getAttribute('as') || '').toLowerCase() === 'style'
}

/* 与 HTML 规范一致的 JS MIME 判定；其余（application/json、text/template 等）只插入不执行 */
const JS_MIME = /^((application|text)\/(x-)?(ecma|java)script|text\/(javascript1\.[0-5]|(j|live)script))$/
const isExecutableScript = (el) => {
  const type = (el.getAttribute('type') || '').trim().toLowerCase()
  if (!type) return true
  return type === 'module' || JS_MIME.test(type)
}

/* 从新页面文档里摘出当前文档还没有的资源；正文列内的留给 runContentScripts 单独处理 */
const collectPageAssets = (doc) => {
  const styles = []
  const inlineStyles = []
  const scripts = []

  doc.querySelectorAll('link[href]').forEach(function (el) {
    if (inContentArea(el) || !isStyleLink(el)) return
    const href = el.getAttribute('href')
    if (!href || loadedStyles.has(href)) return
    styles.push(el)
  })

  doc.querySelectorAll('style').forEach(function (el) {
    if (inContentArea(el)) return
    const code = el.textContent
    if (!code || !code.trim() || appliedInlineStyles.has(code)) return
    inlineStyles.push(el)
  })

  doc.querySelectorAll('script').forEach(function (el) {
    if (inContentArea(el)) return
    if (el.hasAttribute('src')) {
      const src = el.getAttribute('src')
      if (!src || loadedScripts.has(src)) return
      scripts.push(el)
      return
    }
    const code = el.textContent
    /* 站点级内联脚本（首屏已经执行过）不再重复执行，页面独有的每次导航都要跑 */
    if (!code || !code.trim() || executedSiteScripts.has(code)) return
    scripts.push(el)
  })

  return {styles, inlineStyles, scripts}
}

/* 样式外链：替换前就插进 head，等正文到位时基本已经加载完 */
const addPageStyles = (links) => {
  links.forEach(function (link) {
    const href = link.getAttribute('href')
    loadedStyles.add(href)
    const el = link.cloneNode(true)
    el.addEventListener('load', function () {
      window.DProgress && DProgress.inc()
    })
    document.head.appendChild(el)
    log('加载页面样式 ' + href)
  })
}

/*
 * 页面级脚本：在切换之前先用 preload 把请求发出去。
 * 执行仍然等到 page:view（那时新内容已就位，串行执行才不会互相踩），
 * 但下载可以和切换并行——否则像首页轮播的 swiper-bundle 要等内容插进来才开始下载，
 * 轮播区会先空一块（`.swiper:not(.swiper-ready) .swiper-wrapper { opacity: 0 }`）等它。
 */
const preloadPageScripts = (nodes) => {
  nodes.forEach(function (node) {
    const src = node.getAttribute('src')
    if (!src) return
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'script'
    link.href = src
    /* 跨域脚本要带同样的 crossorigin 才会命中预加载的那份响应 */
    const crossOrigin = node.getAttribute('crossorigin')
    if (crossOrigin !== null) link.setAttribute('crossorigin', crossOrigin)
    document.head.appendChild(link)
    log('预加载页面脚本 ' + src)
  })
}

/* 内联样式：切换完成立即生效，避免新内容无样式的一帧 */
const addInlineStyles = (nodes) => {
  nodes.forEach(function (node) {
    const code = node.textContent
    appliedInlineStyles.add(code)
    document.head.appendChild(node.cloneNode(true))
    log('应用页面内联样式 ' + code.trim().slice(0, 40).replace(/\s+/g, ' '))
  })
}

/*
 * 用新建的 <script> 执行新页面里的脚本：
 *   - 内联内容插入即同步执行；
 *   - 外链等 load 完成。
 * 显式关掉 async 才能保证文档顺序（动态插入的脚本默认 async，会乱序执行）。
 * 加载有超时兜底：请求悬着不返回时不能让后面的初始化（以及切换收尾）一直等下去。
 */
const SCRIPT_LOAD_TIMEOUT = 8000

const runScriptNode = (node) => new Promise(function (resolve) {
  const src = node.getAttribute('src')
  const executable = node.hasAttribute('src') || isExecutableScript(node)
  const el = document.createElement('script')
  node.getAttributeNames().forEach(function (name) {
    el.setAttribute(name, node.getAttribute(name) || '')
  })
  el.async = false
  el.textContent = node.textContent

  let resolved = false
  const next = () => {
    if (resolved) return
    resolved = true
    resolve()
  }

  if (!src) {
    document.head.appendChild(el)
    /* 非 JS 的内联内容（JSON、模板）留在 head，供页面脚本读取；可执行的执行完即可移除，避免堆积 */
    if (executable) el.remove()
    next()
    return
  }

  loadedScripts.add(src)
  el.addEventListener('load', next)
  el.addEventListener('error', function () {
    log('页面脚本加载失败 ' + src)
    next()
  })
  document.head.appendChild(el)
  log('加载页面脚本 ' + src)
  /*
   * 超时兜底：脚本一直不返回时不能让后面的初始化（以及切换收尾）永远等下去，
   * 否则加载动画摘不掉，页面会一直停在隐藏状态。
   */
  setTimeout(function () {
    if (resolved) return
    log('页面脚本加载超时 ' + src)
    next()
  }, SCRIPT_LOAD_TIMEOUT)
  /* async 脚本本来就不保证顺序，不必等它 */
  if (node.hasAttribute('async')) next()
})

/* 按文档顺序串行补齐脚本：插件页面的初始化脚本常常依赖它自己先加载的库 */
const runPageScripts = async (nodes) => {
  for (const node of nodes) {
    await runScriptNode(node)
  }
}

/*
 * 同步执行一段内联脚本。
 * 内容区里的内联脚本必须当帧执行：主题里 links.html 这类页面把 setSafeSrc 之类的函数
 * 直接写在正文模板里，图片的 onload 依赖它，晚一帧就会报 "xxx is not defined"。
 */
const runInlineScriptNow = (node) => {
  const el = document.createElement('script')
  node.getAttributeNames().forEach(function (name) {
    el.setAttribute(name, node.getAttribute(name) || '')
  })
  el.textContent = node.textContent
  document.head.appendChild(el)
  el.remove()
}

/*
 * 内容区里的脚本：pjax 那套实现会把替换范围内的脚本重新执行一遍，这里照做。
 *   - 内联脚本同步执行（保证函数定义在图片 onload 之前就绪）；
 *   - 外链脚本排进 pendingScripts，由 page:view 按顺序加载后再做后续初始化。
 * 每次导航内容都是新节点，重复执行是预期行为（模板里的脚本本身可重复执行）。
 */
const runContentScripts = () => {
  const nodes = Array.from(document.querySelectorAll(CONTENT_SELECTOR + ' script'))
  const deferred = []
  nodes.forEach(function (node) {
    if (!node.hasAttribute('src')) {
      if (isExecutableScript(node)) runInlineScriptNow(node)
      return
    }
    if (node.getAttribute('src')) deferred.push(node)
  })
  if (deferred.length > 0) pendingScripts = pendingScripts.concat(deferred)
}

/* ======================= 布局 / head 同步 ======================= */

/* 每次导航从新页面文档里摘出来的页面级信息：page:load 填，切换完成后落地 */
let pendingContainerClass = null
let pendingMetas = []
let pendingCanonical = null
let pendingInlineStyles = []
let pendingScripts = []

/*
 * 导航序号：page:view 里有 await（等页面脚本下载），期间用户完全可能又点了别的链接。
 * 等回来时如果序号变了，说明内容已经被下一次导航替换，这次剩下的初始化必须丢掉，
 * 否则会对着新页面重复初始化（重复建 Swiper、重复包图片）。
 */
let navigationToken = 0

const containerClassOf = (doc) => {
  const el = doc.querySelector(CONTAINER_SELECTOR)
  return el ? el.getAttribute('class') || '' : null
}

/*
 * 布局契约：把新页面的容器 class 套到当前容器上。
 * hide-sidebar / two-column 都写在这个 class 里，抄过来即可，
 * 侧栏节点不动（CSS 只是 display: none），移动端抽屉里的 widget 也不受影响。
 */
const syncContainerClass = () => {
  const className = pendingContainerClass
  pendingContainerClass = null
  if (className === null) return
  document.querySelectorAll(CONTAINER_SELECTOR).forEach(function (el) {
    if ((el.getAttribute('class') || '') === className) return
    el.setAttribute('class', className)
    log('同步布局容器 class：' + className)
  })
}

/* 页面级 meta / canonical：title 由 Swup 自己同步，这里只换剩下这几项 */
const syncPageHead = () => {
  if (pendingMetas.length === 0 && !pendingCanonical) return
  document.head.querySelectorAll('meta[name], meta[property], link[rel="canonical"]').forEach(function (el) {
    el.remove()
  })
  pendingMetas.forEach(function (meta) {
    document.head.appendChild(meta)
  })
  if (pendingCanonical) document.head.appendChild(pendingCanonical)
  pendingMetas = []
  pendingCanonical = null
}

/*
 * 正文入场动画：给新页面的 .column-main 打标记。
 * Swup 是外替换容器（新节点整块换掉旧节点），标记在替换后的同一个任务里加，
 * 首帧即处于动画起始态，播放一次「从上往下揭示」的入场效果。
 * 侧栏不加：左右两列一起揭示会显得晃，正文单独入场更干净。
 */
const markContentEnter = () => {
  document.querySelectorAll(CONTENT_SELECTOR).forEach(function (el) {
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
 * 侧边栏音乐播放器在「布局契约页面」（.container.hide-sidebar，左右两列被 display: none）里看不见，
 * 声音却还在放，用户没法暂停。这里只做最小干预：
 *   - 播放器不可见且正在播放 → 暂停，并记下「这次是我暂停的」；
 *   - 回到可见页面时，只有上一次是自动暂停的才恢复播放；
 *   - 其余情况（用户自己暂停、本来就没在放）一律不动。
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

/* 单个初始化失败不影响后续：一处报错不能把后面的内容初始化全掐掉 */
const runInit = (name) => {
  if (typeof commonContext === 'undefined') return
  const init = commonContext[name]
  if (typeof init !== 'function') return
  try {
    init()
  } catch (e) {
    console.error(`[swup] ${name} 初始化失败`, e)
  }
}

/* 加载动画：沿用主题原有的两套表现（scale 用 html.pjax-loading，其余用 .pjax-animation-container） */
const toggleLoadingAnimation = (active) => {
  if (typeof DreamConfig === 'undefined') return
  const style = DreamConfig.pjax_animation_style
  if (style === 'scale') {
    document.documentElement.classList.toggle('pjax-loading', active)
  } else if (LOADING_ANIMATION_STYLES.includes(style)) {
    const el = document.querySelector('.pjax-animation-container')
    if (el) el.classList.toggle('active', active)
  }
}

const isMobileLayout = () => !!(window.Utils && typeof Utils.isMobileByScreenWidth === 'function' && Utils.isMobileByScreenWidth())

/* ======================= Swup 实例 ======================= */

const swup = new Swup({
  /*
   * 只替换正文列：站点级节点（head、nav、banner、侧栏、footer）都不重建，
   * 换页代价最小。随页面变化的内容单独同步（见 hooks）：
   * 容器 class（布局契约的侧栏隐藏）、title/meta、页面级资源。
   */
  containers: [CONTENT_SELECTOR],
  /* 不启用 Swup 的 CSS transition 机制，加载动画仍由主题自己控制 */
  animationSelector: false,
  /*
   * 关掉页面缓存：阅读量、点赞数、评论、置顶/友链这类数据每次都要重新取，
   * 命中缓存会拿到上一次的 HTML，看起来就是"页面没刷新"。
   * 代价只是前进/后退也要重新请求，滚动位置仍由 scroll 插件按 URL 恢复。
   */
  cache: false,
  timeout: 8000,
  linkSelector: 'a[href]',
  /*
   * 与 pjax 的 defaultTrigger.exclude 对齐：站外链接、_blank、带 data-not-pjax 的菜单项都不接管。
   * 覆写这个回调会丢掉 Swup 自带的 data-no-swup 判定，所以两种标记都认。
   * 站外/新窗口的判定 Swup 内部还会再拦一次，这里只补协议类的兜底。
   */
  ignoreVisit: (url, {el} = {}) => {
    if (!el) return false
    if (el.closest('[data-no-swup], a[data-not-pjax], a[target="_blank"]')) return true
    /* 下载链接交给浏览器：交给 Swup 会白取一次二进制内容再退回整页跳转 */
    if (el.hasAttribute('download')) return true
    const href = (el.getAttribute('href') || '').trim()
    return /^(mailto:|tel:|javascript:)/i.test(href)
  },
  plugins: [
    /*
     * 滚动行为对齐 pjax 的 scrollTo: 0 + scrollRestoration: true：
     * 新页面直接到顶部，前进/后退恢复到离开时的位置，全程不做平滑滚动。
     */
    new SwupScrollPlugin({
      animateScroll: {
        betweenPages: false,
        samePageWithHash: false,
        samePage: false
      },
      doScrollingRightAway: false
    })
  ]
})

/* 供插件页面或调试时手动触发导航 */
window.dreamSwup = swup

/* 导航开始：等价于 pjax:send */
swup.hooks.on('visit:start', () => {
  log('visit:start')
  toggleLoadingAnimation(true)
  window.DProgress && DProgress.start() && DProgress.inc()
  /*
   * 清掉跨页面残留的浮层（例如海报分享，模板里标了 .pjax-close）：
   * 这些节点挂在 body 上，不会随正文替换消失，不清就会盖在新页面上。
   */
  document.querySelectorAll('.pjax-close').forEach(function (el) {
    el.remove()
  })
  /* 上一次可能还开着图片预览：在导航开始时就关掉，不等新内容到位 */
  runInit('closeFancybox')
  /*
   * 桌面端：整个切换窗口内把抽屉/遮罩钉成不可见，避免切换瞬间闪出展开/收起动画。
   * 手机端不加这个守卫——抽屉要保留正常的收起动画。
   */
  if (!isMobileLayout()) document.documentElement.classList.add('pjax-swapping')
  /* 复位抽屉/遮罩/搜索面板（手机端带动画），并解除 html 上的滚动锁定 */
  runInit('closeNavbarPanels')
})

/*
 * 替换之前：从新页面文档里摘出页面级信息与资源。
 * 放在 content:replace.before 而不是 page:load：
 *   - page:load 阶段 Swup 还没把解析好的 document 挂到 visit 上，拿不到新页面文档；
 *   - 这个位置 DOM 还没换，但样式插入和脚本 preload 仍赶在新内容绘制之前。
 */
swup.hooks.before('content:replace', (visit) => {
  const doc = visit.to && visit.to.document
  if (!doc) return

  /* 首次导航时才给首屏资源拍快照（见 registerDocumentAssets 的说明） */
  registerDocumentAssets()
  navigationToken++

  pendingContainerClass = containerClassOf(doc)
  pendingMetas = Array.from(doc.head.querySelectorAll('meta[name], meta[property]'), function (el) {
    return el.cloneNode(true)
  })
  const canonical = doc.head.querySelector('link[rel="canonical"]')
  pendingCanonical = canonical ? canonical.cloneNode(true) : null

  const assets = collectPageAssets(doc)
  /* 样式直接插入 head 就开始下载；脚本先 preload，执行留到内容就位之后 */
  addPageStyles(assets.styles)
  preloadPageScripts(assets.scripts)
  pendingInlineStyles = assets.inlineStyles
  pendingScripts = assets.scripts

  log('新页面资源: css=' + assets.styles.length
    + ', 内联样式=' + pendingInlineStyles.length
    + ', 脚本=' + pendingScripts.length)
})

/*
 * 节点替换完成、页面脚本执行之前：先落地布局、banner 显隐、head 与内联样式，避免第一帧闪一下。
 * Swup 的普通 hook 在默认替换之后、同一个任务里执行，所以这里写完仍赶得上首帧。
 */
swup.hooks.on('content:replace', () => {
  syncContainerClass()
  /*
   * banner 在正文列之外，节点不重建，但显隐要跟着当前路径走。
   * 必须在这一步（替换后、绘制前）定好：放到 page:view 里会等脚本执行完，
   * 中间那份旧状态会先画出来，看上去就是"内容换了 banner 才收起来"。
   */
  runInit('showBanner')
  syncPageHead()
  addInlineStyles(pendingInlineStyles)
  pendingInlineStyles = []
  /* 内容区自带的脚本（内联同步执行、外链排队），不能省：模板里的函数定义靠它 */
  runContentScripts()
  markContentEnter()
})

/* 内容就位、滚动完成：等价于 pjax:success */
swup.hooks.on('page:view', async () => {
  log('page:view')

  /*
   * 只有正文列是新节点，所以只重跑作用在内容区上的初始化；
   * 侧栏 widget、导航栏、banner 节点都没重建，重跑它们的初始化只会重复绑事件。
   *
   * 这一段不依赖任何页面级脚本，先跑：否则新内容要等下面几支脚本下载完才有目录、
   * 图片预览、导航高亮，首屏观感会被网络拖慢。
   */
  /* 重新激活图片预览功能（后面 postPjax 的图片折叠依赖它包出来的结构，顺序不能换） */
  runInit('initGallery')
  /* 重新生成目录并修正公告显隐 */
  runInit('initTocAndNotice')
  /* 导航高亮 */
  runInit('initNavbar')
  /* 抽屉菜单的展开面板要跟着新的高亮项走（抽屉节点不重建，高亮项变了） */
  runInit('sideMenuMobile')
  /* 首屏不在首页时 banner 是折叠的，打字动画没启动过，回到首页补一次（函数内部只启动一次） */
  runInit('initBanner')
  /* 初始化任务列表，禁止点击 */
  runInit('iniTaskItemDisabled')
  /*
   * 容器 class 已经跟随新页面更新过：契约页面（侧栏 display: none）自动暂停音乐，
   * 回到普通页面时只恢复这次自动暂停的播放。
   */
  syncMusicPlayback()

  /* 新页面的脚本按文档顺序补齐；下面这些初始化都依赖它们（Swiper/justifiedGallery/post.min.js 等） */
  const token = navigationToken
  const scripts = pendingScripts
  pendingScripts = []
  if (scripts.length > 0) {
    /* 总时长也封顶：多支脚本串行，单支超时叠加起来同样会把切换收尾拖死 */
    await Promise.race([
      runPageScripts(scripts),
      new Promise(function (resolve) {
        setTimeout(resolve, SCRIPT_LOAD_TIMEOUT)
      })
    ])
  }
  /* 等脚本期间用户又点走了：内容已经换掉，剩下的初始化交给新的那一次，别对着新页面重复初始化 */
  if (token !== navigationToken) {
    log('导航已切换，跳过本次剩余初始化')
    return
  }

  /* 初始化轮播 */
  runInit('initCarousel')
  /* 相册页布局 */
  runInit('initPhotosGallery')

  /* 内容区脚本暴露的初始化钩子 */
  window.tagcloudPjax && window.tagcloudPjax()
  /* 初始化日志界面 */
  window.journalPjax && window.journalPjax()
  /* 初始化文章界面 */
  window.postPjax && window.postPjax()

  log('全部处理完成')
})

/*
 * 导航收尾：等价于 pjax:complete，成功和失败都要走，
 * 否则加载动画和 pjax-swapping 会残留。
 */
const finishVisit = () => {
  log('visit:end')
  toggleLoadingAnimation(false)

  /* 等首帧渲染完成再解除抽屉/遮罩的切换禁用（两帧之后，避免收尾时又播一次动画） */
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      /* 必须无条件解除：一旦残留，抽屉会被永久钉成不可见。
         快速连点时下一次导航会自己再加一次，不存在露出问题。 */
      document.documentElement.classList.remove('pjax-swapping')
    })
  })

  window.DProgress && DProgress.done()

  /*
   * 导航后唯一的 mermaid 渲染入口：initMermaid 属于 ON_IDLE 组，
   * 这里不会经过组合初始化，所以这段不能删。
   * 页面里没有待渲染的 mermaid 图时直接跳过，普通页面就不用白跑 6 秒轮询。
   */
  const pendingMermaid = Array.from(document.querySelectorAll('text-diagram[data-type=mermaid]'))
    .some(function (el) { return !el.querySelector('svg') })
  if (!pendingMermaid) return

  /* 等过渡结束、页面布局稳定后再插入 SVG，避免过渡期间产生额外重排；
     initMermaid 在 mermaid 未就绪时会直接静默返回，所以这里轮询等待脚本就绪，最多重试 30 次（6s） */
  let mermaidRetry = 30
  const tryInitMermaid = () => {
    if (typeof mermaid !== 'undefined') {
      runInit('initMermaid')
      return
    }
    if (mermaidRetry-- > 0) {
      setTimeout(tryInitMermaid, 200)
    }
  }
  setTimeout(tryInitMermaid, 350)
}

swup.hooks.on('visit:end', finishVisit)

/*
 * 请求/替换失败：Swup 默认会退化成整页跳转（容器对不上、超时、网络错误都算），
 * 这里只负责把本地的加载动画和进度条收掉，错误本身由 Swup 打到控制台。
 */
swup.hooks.on('visit:fail', finishVisit)
