window.encrypt = (str) => window.btoa(unescape(encodeURIComponent(str)))
window.decrypt = (str) => decodeURIComponent(escape(window.atob(str)))

/* 常驻 rAF 循环注册表：同名循环只保留一个，节点脱离文档后自动停止 */
const rafLoops = new Map()

function registerRafLoop(name, node, tick) {
  const prev = rafLoops.get(name)
  if (prev) prev.stop()

  let rafId = null
  const loop = {
    stopped: false,
    stop() {
      if (loop.stopped) return
      loop.stopped = true
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = null
      if (rafLoops.get(name) === loop) rafLoops.delete(name)
    },
  }

  const frame = (ts) => {
    if (loop.stopped) return
    // 目标节点已被移除（pjax 替换或模板切换）时停止，避免继续更新脱离文档的节点
    if (node && node.isConnected === false) {
      loop.stop()
      return
    }
    tick(ts)
    if (!loop.stopped) rafId = requestAnimationFrame(frame)
  }

  rafLoops.set(name, loop)
  rafId = requestAnimationFrame(frame)
  return loop.stop
}

/* 刷新时浏览器恢复滚动位置较晚且不一定派发 scroll 事件，需要一份"上次位置"供首帧预判。
   键名与 templates/common/banner.html 中的读取保持一致，改动时需同步 */
const SCROLL_MEMORY_PREFIX = 'dream2:scroll-top:'

function readRememberedScrollTop() {
  try {
    return parseInt(sessionStorage.getItem(SCROLL_MEMORY_PREFIX + location.pathname) || '0', 10) || 0
  } catch (e) {
    /* 隐私模式下 sessionStorage 不可用，忽略即可 */
    return 0
  }
}

function saveRememberedScrollTop(top) {
  try {
    sessionStorage.setItem(SCROLL_MEMORY_PREFIX + location.pathname, String(top))
  } catch (e) {
    /* 同上 */
  }
}

const commonContext = {
  /* 初始化widget */
  initWidget() {
    const BREAKPOINT = 1216
    const BREAKPOINT_MOBILE = 768
    const $leftCol = $('.column-left')
    const $rightCol = $('.column-right')
    const $mobileCol = $('.column-slideout-mobile-toc-menu')

    // if (!$rightCol.length || !$leftCol.length) return

    const $window = $(window)

    $(window).on('resize', Utils.debounce(checkWidgetPosition, 100))

    // 按顺序插入元素到目标容器
    // 先移入 DocumentFragment 再整体挂载：节点顺序不变，但只触发一次重排
    function insertSequentially($target, elementsArray) {
      const target = $target[0]
      if (!target || elementsArray.length === 0) return
      const fragment = document.createDocumentFragment()
      elementsArray.forEach((el) => fragment.appendChild(el))
      target.appendChild(fragment)
    }

    function checkWidgetPosition() {
      const windowWidth = $window.width()
      const hasMobileCol = $mobileCol.length > 0

      // 从所有容器中收集 data-position="left" 的元素
      const allLeftItems = $leftCol.children().filter(function () {
        return $(this).attr('data-position') === 'left'
      }).toArray()
        .concat($rightCol.children().filter(function () {
          return $(this).attr('data-position') === 'left'
        }).toArray())
        .concat(hasMobileCol ? $mobileCol.children().filter(function () {
          return $(this).attr('data-position') === 'left'
        }).toArray() : [])

      // 从所有容器中收集 data-position="right" 的元素
      const allRightItems = $leftCol.children().filter(function () {
        return $(this).attr('data-position') === 'right'
      }).toArray()
        .concat($rightCol.children().filter(function () {
          return $(this).attr('data-position') === 'right'
        }).toArray())
        .concat(hasMobileCol ? $mobileCol.children().filter(function () {
          return $(this).attr('data-position') === 'right'
        }).toArray() : [])

      // 按 data-index 升序排序
      function sortByIndex(items) {
        return items.sort((a, b) => {
          const indexA = parseInt($(a).attr('data-index'), 10) || 0
          const indexB = parseInt($(b).attr('data-index'), 10) || 0
          return indexA - indexB
        })
      }

      // 检测是否只有一侧有 widget
      const onlyLeft = allLeftItems.length > 0 && allRightItems.length === 0
      const onlyRight = allRightItems.length > 0 && allLeftItems.length === 0
      const isOneSided = onlyLeft || onlyRight

      if (windowWidth < BREAKPOINT_MOBILE && hasMobileCol) {
        // 移动端（< 768 且 mobileCol 存在）：合并所有 widget 到 mobileCol，全局排序
        const allItems = sortByIndex(allLeftItems.concat(allRightItems))
        $leftCol.empty()
        $rightCol.empty()
        $mobileCol.empty()
        insertSequentially($mobileCol, allItems)
      } else if (isOneSided) {
        // 单侧情况：平板和 PC 端 widget 已在正确容器中，仅处理从移动端回来的情况
        const allItems = sortByIndex(allLeftItems.concat(allRightItems))
        if (onlyLeft && !$leftCol.children().filter(function () {
          return $(this).attr('data-position') === 'left'
        }).length) {
          // 所有 left widget 在 mobileCol 中，移回 leftCol
          $mobileCol.empty()
          insertSequentially($leftCol, allItems)
        } else if (onlyRight && !$rightCol.children().filter(function () {
          return $(this).attr('data-position') === 'right'
        }).length) {
          // 所有 right widget 在 mobileCol 中，移回 rightCol
          $mobileCol.empty()
          insertSequentially($rightCol, allItems)
        }
      } else if (windowWidth < BREAKPOINT) {
        // 平板双侧（768 <= width < 1216，或 mobileCol 不存在）：合并所有 widget 到 leftCol，全局排序
        const allItems = sortByIndex(allLeftItems.concat(allRightItems))
        $leftCol.empty()
        $rightCol.empty()
        if (hasMobileCol) $mobileCol.empty()
        insertSequentially($leftCol, allItems)
      } else {
        // 大屏双侧（>= 1216）：left items 回 leftCol，right items 回 rightCol，各自容器内排序
        sortByIndex(allLeftItems)
        sortByIndex(allRightItems)
        $leftCol.empty()
        $rightCol.empty()
        if (hasMobileCol) $mobileCol.empty()
        insertSequentially($leftCol, allLeftItems)
        insertSequentially($rightCol, allRightItems)
      }

      // 根据 data-index 设置 CSS order，确保各容器内视觉顺序与 data-index 一致
      const allWidgets = allLeftItems.concat(allRightItems)
      allWidgets.forEach(el => {
        el.style.order = el.getAttribute('data-index') || '0'
      })
    }

    // 初始检查
    checkWidgetPosition()
  },
  /* 初始化目录和公告模块 */
  initTocAndNotice() {
    const {pathname} = location
    window.tocPjax && window.tocPjax()
    let hideToc = $('.widget.toc .card-content ul').length === 0
    let hideNotice = (DreamConfig.notice_show_mode === 'toc' && !hideToc)
      || (DreamConfig.notice_show_mode === 'index' && pathname !== '/')
    if (hideToc) {
      $('.widget.toc,.action-toc').addClass('is-hidden-all')
    } else {
      $('.widget.toc,.action-toc').removeClass('is-hidden-all')
    }
    if (hideNotice) {
      $('.widget.notice').addClass('is-hidden-all')
    } else {
      $('.widget.notice').removeClass('is-hidden-all')
    }
  },
  /* 更新横幅大图的文字描述 */
  initBanner() {
    const $bannerInfoDesc = $('.banner-info-desc')
    if ($bannerInfoDesc.length === 0) return
    const bannerNode = $bannerInfoDesc[0]
    const bannerDesc = $bannerInfoDesc.text()
    // 没有可展示的文字时不启动循环，避免长期空转
    if (!bannerDesc.trim()) return
    /* banner-info 是绝对定位、按 flex 规则垂直居中，清空文案会让整块变矮并重新居中，
       视觉上就是 banner 内容往下跳一下；先把完整文案的高度固定住再清空，打字过程中高度保持不变 */
    const descHeight = $bannerInfoDesc.height()
    if (descHeight > 0) $bannerInfoDesc.css('min-height', descHeight + 'px')
    $bannerInfoDesc.text('')
    // 文案在首帧前已被隐藏，清空后恢复显示，再由打字动画逐字填充
    $bannerInfoDesc.css('visibility', '')
    let currentBannerDesc = ''
    let isWrite = true
    let lastTime = 0

    registerRafLoop('banner-desc', bannerNode, (ts) => {
      // 初始化时间
      if (lastTime === 0) {
        lastTime = ts
      }
      // 计算时间差
      const elapsed = ts - lastTime
      const currentInterval = isWrite ? 500 : 80
      // 如果时间差大于等于间隔时间，执行一次更新
      if (elapsed >= currentInterval) {
        const num = currentBannerDesc.length
        if (isWrite && num < bannerDesc.length) {
          currentBannerDesc += bannerDesc.charAt(num)
          $bannerInfoDesc.text(currentBannerDesc)
        } else if (!isWrite && num > 0) {
          currentBannerDesc = currentBannerDesc.slice(0, num - 1)
          $bannerInfoDesc.text(currentBannerDesc)
        } else {
          // 当前方向完成，切换方向并重置时间，让下一帧重新开始计时
          isWrite = !isWrite
          lastTime = 0
          return
        }
        // 更新最后执行时间（减去多余的时间，保持节奏）
        lastTime = ts - (elapsed % currentInterval)
      }
    })
  },
  /* 激活图片预览功能 */
  initGallery() {
    // 用链接和标题包装图像
    $('.main-content img:not(.not-gallery)').each(function () {
      if ($(this).parents('[data-fancybox],mew-photos').length === 0) {
        $(this).wrap(`<div class="gallery-item"><div data-fancybox="gallery" data-options='{"hash": false}' ${this.alt ? `data-caption="${this.alt}"` : ''} href="${$(this).attr('src')
        }"></div></div>`)
      }
    })
  },
  /* 照片页 JustifiedGallery 布局：行内图片就绪后整行一次性铺出，无闪烁无加载动画 */
  initPhotosGallery() {
    const $gallery = $('.photos-gallery')
    // 非照片页、插件库未就绪或已初始化过则跳过
    if ($gallery.length === 0 || !$.fn.justifiedGallery || $gallery.hasClass('justified-gallery')) return
    $gallery.justifiedGallery({
      rowHeight: 200,
      maxRowHeight: false,
      maxRowsCount: 0,
      sizeRangeSuffixes: {},
      lastRow: 'nojustify',
      captions: false,
      // 等待图片真实加载获得宽高比，已显示的布局不再变动
      waitThumbnailsLoad: true,
      margins: 10,
      extension: /\.(jpe?g|png|gif|bmp|webp)$/,
      cssAnimation: false,
    })
  },
  /* 初始化Mermaid：只渲染尚未渲染的 text-diagram，避免插件已渲染后对产物重复执行而报错 */
  initMermaid() {
    if (typeof mermaid === 'undefined' || mermaid === null) {
      return
    }
    mermaid.initialize({startOnLoad: true})
    const targets = Array.from(document.querySelectorAll('text-diagram[data-type=mermaid]'))
      .filter(el => !el.querySelector('svg'))
    targets.forEach((el, index) => {
      const code = el.textContent.trim()
      if (!code) return
      mermaid.render(`mermaid-dream-${Date.now()}-${index}`, code)
        .then(({svg}) => { el.innerHTML = svg })
        .catch(error => console.error('mermaid 渲染失败:', error))
    })
  },
  /* 初始化主题模式（仅用户模式） */
  initMode() {
    //检查是否将暗黑模式保存到 localStorage
    const hasNightInLocal = () => {
      const value = localStorage.getItem('night')
      return value === 'true' || value === 'false'
    }
    //根据配置读取默认模式
    const getNightInConfig = () => {
      if (DreamConfig.default_theme === 'night') {
        return true
      }
      if (DreamConfig.default_theme === 'system') {
        return matchMedia('(prefers-color-scheme: dark)').matches
      }
      return false
    }
    //是否是暗黑模式
    let isNight = hasNightInLocal()
      ? localStorage.getItem('night') === 'true' // 检查 localStorage
      : getNightInConfig() // 否则走配置逻辑

    const applyNight = (isNightValue) => {
      if (isNightValue) {
        $('html').addClass('color-scheme-dark').removeClass('color-scheme-light').addClass('night').attr('night', true)
      } else {
        $('html').addClass('color-scheme-light').removeClass('color-scheme-dark').removeClass('night').removeAttr('night')
      }
      //doc文档的配色方案
      localStorage.setItem('color-scheme', isNightValue ? 'dark' : 'light')
      localStorage.setItem('special-efficacy-scheme', isNightValue ? 'dark' : 'light')
      isNight = isNightValue
    }
    //切换按钮
    $('#toggle-mode').on('click', () => {
      //应用配色方案，并切换isNight的状态
      applyNight(!isNight)
      //只有点击了切换才需要保存到localStorage
      localStorage.setItem('night', isNight)
    })
  },
  /* 导航条高亮 */
  initNavbar() {
    document
      .querySelectorAll('.navbar-nav .current, .panel-side-menu .current')
      .forEach(el => el.classList.remove('current'))

    const $nav_menus = $('.navbar-nav a')
    const $nav_side_menus = $('.panel-side-menu .link')
    let activeIndex = 0
    const {href, pathname} = location

    if (pathname && pathname !== '/') {
      for (let i = 0; i < $nav_menus.length; i++) {
        const cur_href = $nav_menus[i].getAttribute('href')
        if (pathname.includes(cur_href) || href.includes(cur_href)) {
          activeIndex = i
          if (pathname === cur_href || href === cur_href) break
        }
      }
    }

    // 高亮PC端
    const $curMenu = $nav_menus.eq(activeIndex)
    $curMenu.addClass('current')
    if ($curMenu.parents('.item-dropdown').length) {
      $curMenu
        .parents('.item-dropdown')
        .find('.item-dropdown-link a')
        .addClass('current')
    }

    // 高亮移动端
    $nav_side_menus.eq(activeIndex).addClass('current')
  },
  // 移动端关闭抽屉弹窗
  mobileCloseNavbarMask() {
    document.querySelector('html.disable-scroll') && document.querySelector('.navbar-mask').click()
  },
  /* 搜索框弹窗 */
  searchDialog() {
    const $result = $('.navbar-search .result')
    $('.navbar-search .input').on('click', function (e) {
      e.stopPropagation()
      $result.addClass('active')
    })
    $(document).on('click', function () {
      $result.removeClass('active')
    })
  },
  /* 激活导航栏全局下拉框功能 */
  initDropMenu() {
    $('.item-dropdown').each(function (index, item) {
      const menu = $(this).find('.item-dropdown-menu')
      const trigger = $(item).attr('trigger') || 'click'
      const placement = $(item).attr('placement') || $(this).height() || 0
      menu.css('top', placement)
      if (trigger === 'hover') {
        $(this).hover(
          () => $(this).addClass('active'),
          () => $(this).removeClass('active')
        )
      } else {
        $(this).on('click', function (e) {
          e.stopPropagation()
          $(this).toggleClass('active')
          $(document).one('click', () => $(this).removeClass('active'))
          e.stopPropagation()
        })
        menu.on('click', (e) => e.stopPropagation())
      }
    })
  },
  /*初始化任务列表，禁止点击*/
  iniTaskItemDisabled() {
    $('li[data-type="taskItem"]').each(function () {
      $(this).find('label > input[type="checkbox"]').prop('disabled', true)
    })
  },
  /* 激活登录窗口下拉框功能 */
  initLogonMenu() {
    $('.navbar-logon').each(function (index, item) {
      const trigger = $(item).attr('trigger') || 'click'
      if (trigger === 'hover') {
        $(this).hover(
          () => $(this).addClass('active'),
          () => $(this).removeClass('active')
        )
      } else {
        $(this).on('click', function (e) {
          e.stopPropagation()
          $(this).toggleClass('active')
          $(document).one('click', () => $(this).removeClass('active'))
        })
      }
    })
  },
  /* 处理滚动 */
  initScroll() {
    const $actions = $('.actions')
    const body = document.body

    // true：上划，false：下滑
    function scrollDirection(currentTop) {
      const result = currentTop > window.initTop
      window.initTop = currentTop
      return result
    }

    /* 按滚动距离应用状态：首帧预判与滚动监听共用同一套阈值，避免两处规则不一致 */
    const applyScrollState = (scrollTop, direction) => {
      if (scrollTop > 50 && direction) {
        body.classList.add('move-up')
      } else {
        body.classList.remove('move-up')
      }
      if (scrollTop > 100) {
        $actions.addClass('show')
      } else {
        $actions.removeClass('show')
      }
    }

    // 滚动事件高频触发，用 rAF 合并为每帧最多执行一次，避免重复查询 DOM
    let ticking = false
    const handleScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        const scrollTop = $(document).scrollTop()
        applyScrollState(scrollTop, scrollDirection(scrollTop))
      })
    }

    /* 刷新时浏览器在首帧之后才恢复滚动位置，且不一定派发 scroll 事件，
       只靠监听会导致右下角按钮组一直不显示，直到用户手动滚动才滑出来。
       这里在首帧前按"当前位置优先、上次记忆位置兜底"同步应用一次，
       既符合滚动距离判断，也不会出现先隐藏再滑入的动画 */
    const currentTop = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0
    const initialTop = currentTop || readRememberedScrollTop()
    window.initTop = initialTop
    applyScrollState(initialTop, initialTop > 0)

    let scrolled = false
    document.addEventListener('scroll', () => {
      scrolled = true
      handleScroll()
    }, {passive: true})

    // 恢复滚动未派发 scroll 事件时，load 之后按真实位置校准一次；状态未变化则无视觉影响
    window.addEventListener('load', () => {
      if (scrolled) return
      const top = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0
      if (top === initialTop) return
      window.initTop = top
      applyScrollState(top, top > 0)
    }, {once: true})

    // 记录滚动位置：刷新时浏览器恢复得较晚，banner 需要在首帧前据此判断是否临时隐藏
    window.addEventListener('pagehide', () => {
      saveRememberedScrollTop(window.scrollY || window.pageYOffset || 0)
    })
  },
  /* 小屏幕伸缩侧边栏，包含导航或者目录 */
  drawerMobile() {
    $('.navbar-slideicon').on('click', function (e) {
      e.stopPropagation()
      /* 关闭搜索框 */
      $('.navbar-searchout').removeClass('active')
      /* 处理开启关闭状态 */
      const $html = $('html')
      const $mask = $('.navbar-mask')
      const $slide_out = $('.navbar-slideout')
      if ($slide_out.hasClass('active')) {
        $html.removeClass('disable-scroll')
        $mask.removeClass('active slideout')
        $slide_out.removeClass('active')
      } else {
        $html.addClass('disable-scroll')
        $mask.addClass('active slideout')
        $slide_out.addClass('active')
      }
    })
    $('.action-toc').on('click', function (e) {
      e.stopPropagation()
      /* 关闭搜索框 */
      $('.navbar-searchout').removeClass('active')
      /* 处理开启关闭状态 */
      const $html = $('html')
      const $mask = $('.navbar-mask')
      const $slide_out = $('.navbar-slideout')
      if ($slide_out.hasClass('active')) {
        $html.removeClass('disable-scroll')
        $mask.removeClass('active slideout')
        $slide_out.removeClass('active slideout-toc')
      } else {
        $html.addClass('disable-scroll')
        $mask.addClass('active slideout')
        $slide_out.addClass('active slideout-toc')
      }
    })
  },
  /* 激活全局返回顶部功能 */
  back2Top() {
    $('#back-to-top').on('click', function () {
      $('body, html').animate({scrollTop: 0}, 400)
    })
  },
  /* 点击遮罩层关闭 */
  maskClose() {
    $('.navbar-mask')
      .on('click', function (e) {
        e.stopPropagation()
        $('html').removeClass('disable-scroll')
        $('.navbar-mask').removeClass('active slideout')
        $('.navbar-searchout').removeClass('active')
        $('.navbar-slideout').removeClass('active slideout-toc')
        $('.navbar-above').removeClass('solid')
      })
    $('.navbar .toc-content')
      .on('click', function (e) {
        e.stopPropagation()
        $('html').removeClass('disable-scroll')
        $('.navbar-mask').removeClass('active slideout')
        $('.navbar-slideout').removeClass('active slideout-toc')
      })
  },
  /* 移动端侧边栏菜单手风琴 */
  sideMenuMobile() {
    $('.navbar-slideout-menu .current')
      .parents('.panel-body')
      .show()
      .siblings('.panel')
      .addClass('in')
    $('.navbar-slideout-menu .panel').on('click', function (e) {
      /* 如果点击目标是链接，不阻止冒泡，让 Pjax 正常处理导航 */
      if (e.target.closest('a[href]')) return
      e.stopPropagation()
      const $this = $(this)
      const panelBox = $this.parent().parent()
      /* 清除全部内容 */
      panelBox.find('.panel').not($this).removeClass('in')
      panelBox
        .find('.panel-body')
        .not($this.siblings('.panel-body'))
        .stop()
        .hide('fast')
      /* 激活当前的内容 */
      $this.toggleClass('in').siblings('.panel-body').stop().toggle('fast')
    })
  },
  /* 初始化事件 */
  initEvent() {
    let $body = $('body')

    function closeSelect(elem) {
      let $elem = $(elem)
      const closeSelect = $elem.attr('data-close')
      return closeSelect && closeSelect.trim() !== '' ? $elem.closest(closeSelect.trim()) : $elem
    }

    $body.on('click', '.click-close', function (e) {
      e.stopPropagation()
      closeSelect(this).remove()
    })
    $body.on('click', '.click-animation-close', function (e) {
      e.stopPropagation()
      let selectElem = closeSelect(this)
      selectElem.addClass('close-animation')
      setTimeout(() => selectElem.remove(), 300)
    })
  },
  /* 离屏提示 */
  offscreenTip() {
    if (Utils.isMobile() || (!DreamConfig.document_hidden_title && !DreamConfig.document_visible_title)) return
    let originTitle = document.title
    let timer = null
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (!DreamConfig.document_visible_title || document.title !== DreamConfig.document_visible_title) {
          originTitle = document.title
        }
        document.title = DreamConfig.document_hidden_title || originTitle
        clearTimeout(timer)
      } else {
        document.title = DreamConfig.document_visible_title || originTitle
        DreamConfig.document_visible_title && (timer = setTimeout(function () {
          if (document.title === DreamConfig.document_visible_title) {
            document.title = originTitle
          }
        }, 2000))
      }
    })
  },
  /** 初始化轮播 **/
  initCarousel() {
    const $swiper = $('.swiper')
    try {
      window.Swiper && new Swiper('.swiper', {
        loop: true,
        parallax: true,
        effect: 'slide',
        spaceBetween: 10,
        speed: 600,
        autoplay: {
          delay: 3000,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        },
        pagination: {
          el: '.swiper-pagination',
          clickable: true,
        },
        navigation: {
          nextEl: '.swiper-button-next',
          prevEl: '.swiper-button-prev',
        },
      })
    } finally {
      // 无论初始化成功与否都要标记，否则轮播会一直停在 opacity: 0
      $swiper.addClass('swiper-ready')
    }
  },
  /** 关闭画廊 **/
  closeFancybox() {
    // 检测Fancybox是否打开
    if (document.querySelector('.fancybox-container')) {
      // 关闭Fancybox
      $.fancybox.close()
    }
  },
  /* 个人信息界面打印彩字 */
  sparkInput() {
    const sparkInputContent = DreamConfig.spark_input_content && DreamConfig.spark_input_content.filter(s => s.length > 0)
    if (sparkInputContent && sparkInputContent.length > 0) {
      Utils.cachedScript(`${DreamConfig.theme_base}/js/spark-input.min.js?mew=${DreamConfig.theme_version}`, function () {
        $('.spark-input').each((index, domEle) => sparkInput(domEle, [domEle.innerText, ...sparkInputContent]))
      })
    }
  },
  /* 恋爱墙倒计时 */
  loveTime() {
    const $elem = $('.love .love-time')
    if ($elem.length === 0 || !DreamConfig.love_time_template || !DreamConfig.love_time_template_year) return
    const loveTime = $elem.attr('data-time')
    if (!/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/.test(loveTime)) {
      $elem.text(loveTime)
      return
    }
    const grt = new Date(loveTime)
    let lastTime = 0
    // 倒计时按整秒变化，缓存上次内容，避免每 200ms 重复重建相同 HTML
    let lastHtml = ''

    registerRafLoop('love-time', $elem[0], (ts) => {
      // 初始化时间
      if (lastTime === 0) {
        lastTime = ts
      }
      // 计算时间差，大约200毫秒更新一次
      const elapsed = ts - lastTime
      if (elapsed >= 200) {
        let now = new Date(Date.now())
        let difference = parseInt((now - grt) / 1000)
        let seconds = difference % 60
        difference = parseInt(difference / 60)
        let minutes = difference % 60
        difference = parseInt(difference / 60)
        let hours = difference % 24
        let days = parseInt(difference / 24)
        let year = 0
        let grtYear = grt.getFullYear()
        let nowYear = now.getFullYear()
        while (grtYear < nowYear) {
          if ((grtYear % 4 === 0 && grtYear % 100 !== 0) || grtYear % 400 === 0) {
            // 闰年366天
            if (days < 366) break
            days -= 366
            year += 1
            grtYear += 1
          } else {
            // 平年365天
            if (days < 365) break
            days -= 365
            year += 1
            grtYear += 1
          }
        }
        let html
        if (year !== 0) {
          html = DreamConfig.love_time_template_year
            .replace(/\{(\d+)\}/g, (match, p1) => {
              const values = [year, days, hours, minutes, seconds]
              return values[p1]
            })
        } else {
          html = DreamConfig.love_time_template
            .replace(/\{(\d+)\}/g, (match, p1) => {
              const values = [days, hours, minutes, seconds]
              return values[p1]
            })
        }
        if (html !== lastHtml) {
          lastHtml = html
          $elem.html(html)
        }
        // 更新最后执行时间（简单重置，不校正多余时间）
        lastTime = ts
      }
    })
  },
  /* 激活建站倒计时功能 */
  websiteTime() {
    if (!DreamConfig.website_time || !DreamConfig.site_time_expression) {
      return
    }
    const websiteDate = document.querySelectorAll('.websiteDate')
    if (DreamConfig.website_time === '' || !websiteDate || websiteDate.length === 0) {
      return
    }
    const grt = new Date(DreamConfig.website_time).getTime()
    let lastTime = 0
    // 建站时间按整秒变化，缓存上次内容，避免每 200ms 重复重建相同 HTML
    let lastText = ''

    registerRafLoop('site-time', websiteDate[0], (ts) => {
      // 初始化时间
      if (lastTime === 0) {
        lastTime = ts
      }
      // 计算时间差，大约200毫秒更新一次
      const elapsed = ts - lastTime
      if (elapsed >= 200) {
        let now = Date.now()
        let difference = parseInt((now - grt) / 1000)
        let seconds = difference % 60
        if (String(seconds).length === 1) {
          seconds = '0' + seconds
        }
        difference = parseInt(difference / 60)
        let minutes = difference % 60
        if (String(minutes).length === 1) {
          minutes = '0' + minutes
        }
        difference = parseInt(difference / 60)
        let hours = difference % 24
        if (String(hours).length === 1) {
          hours = '0' + hours
        }
        let days = parseInt(difference / 24)
        // 使用时间表达式显示，适配多语言
        let timeText = DreamConfig.site_time_expression
          .replace(/\{(\d+)\}/g, (match, p1) => {
            const values = [days, hours, minutes, seconds]
            return `<span class="stand">${values[p1]}</span>`
          })
        if (timeText !== lastText) {
          lastText = timeText
          websiteDate.forEach(element => {
            element.innerHTML = timeText
          })
        }
        // 更新最后执行时间（简单重置，不校正多余时间）
        lastTime = ts
      }
    })
  },
  /* 显示web版权 */
  webCopyright() {
    if (!DreamConfig.website_time) {
      return
    }
    const webCopyrightElements = document.querySelectorAll('.webCopyright')
    if (!webCopyrightElements || webCopyrightElements.length === 0) {
      return
    }
    const now = new Date()
    let nowYear = now.getFullYear()
    const grt = new Date(DreamConfig.website_time)
    let getYear = grt.getFullYear()
    let yearText
    if (nowYear === getYear) {
      yearText = '© ' + nowYear
    } else {
      yearText = '© ' + getYear + '-' + nowYear
    }
    webCopyrightElements.forEach(element => {
      element.innerText = yearText
    })
  },
  /* 激活侧边栏人生倒计时 */
  initTimeCount() {
    if (!$('.timelife').length) {
      return
    }
    if (timeLifeHour === new Date().getHours()) {
      return
    }
    let timelife = DreamConfig.timelife_template
    {
      let nowDate = +new Date()
      let todayStartDate = new Date(new Date().toLocaleDateString()).getTime()
      let todayPassHours = (nowDate - todayStartDate) / 1000 / 60 / 60
      timeLifeHour = todayPassHours
      let todayPassHoursPercent = (todayPassHours / 24) * 100
      timelife[0].num = parseInt(todayPassHours)
      timelife[0].percent = parseInt(todayPassHoursPercent) + '%'
    }
    {
      let weeks = {
        0: 7,
        1: 1,
        2: 2,
        3: 3,
        4: 4,
        5: 5,
        6: 6,
      }
      let weekDay = weeks[new Date().getDay()]
      let weekDayPassPercent = (weekDay / 7) * 100
      timelife[1].num = parseInt(weekDay)
      timelife[1].percent = parseInt(weekDayPassPercent) + '%'
    }
    {
      let year = new Date().getFullYear()
      let date = new Date().getDate()
      let month = new Date().getMonth() + 1
      let monthAll = new Date(year, month, 0).getDate()
      let monthPassPercent = (date / monthAll) * 100
      timelife[2].num = date
      timelife[2].percent = parseInt(monthPassPercent) + '%'
    }
    {
      let month = new Date().getMonth() + 1
      let yearPass = (month / 12) * 100
      timelife[3].num = month
      timelife[3].percent = parseInt(yearPass) + '%'
    }
    let htmlStr = ''
    timelife.forEach((item, index) => {
      htmlStr += `
						<div class="item">
							<div class="title">
								${item.title}
								<span class="text">${item.num}</span>
								${item.endTitle}
							</div>
							<div class="progress">
								<div class="progress-bar">
									<div class="progress-bar-inner progress-bar-inner-${index}" style="width: ${item.percent}"></div>
								</div>
								<div class="progress-percentage">${item.percent}</div>
							</div>
						</div>`
    })
    $('.aside-timelife').html(htmlStr)
  },
  /* 激活侧边栏自定义倒计时 */
  initCustomCountdown() {
    if (!$('.countdown').length) {
      return
    }

    const dayText = {
      day: DreamConfig.countdown_today,
      week: DreamConfig.countdown_week,
      month: DreamConfig.countdown_month,
      year: DreamConfig.countdown_year,
    }

    /* 获取时间剩余（今日/本周/本月/本年的进度和剩余） */
    const getTimeRemaining = () => {
      const now = new Date()

      const getDifference = (unit) => {
        let start, end, total, passed, isDay

        if (unit === 'day') {
          isDay = true
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
          total = 24
          passed = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600
        } else if (unit === 'week') {
          isDay = false
          const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay()
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1)
          end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
          total = 7
          passed = (now - start) / (end - start) * 7
        } else if (unit === 'month') {
          isDay = false
          start = new Date(now.getFullYear(), now.getMonth(), 1)
          end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
          total = Math.round((end - start) / 86400000)
          passed = (now - start) / (end - start) * total
        } else {
          isDay = false
          start = new Date(now.getFullYear(), 0, 1)
          end = new Date(now.getFullYear() + 1, 0, 1)
          total = Math.round((end - start) / 86400000)
          passed = (now - start) / (end - start) * total
        }

        const remaining = total - passed
        const percentage = ((passed / total) * 100).toFixed(2)

        return {
          name: dayText[unit],
          total: Math.round(total),
          passed: Math.round(passed),
          remaining: Math.round(remaining),
          percentage: percentage,
          unit: isDay ? 'hour' : 'day',
        }
      }

      return {
        day: getDifference('day'),
        week: getDifference('week'),
        month: getDifference('month'),
        year: getDifference('year'),
      }
    }

    /* 计算两个日期之间的日历天数 */
    const getDaysBetween = (date1, date2) => {
      const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate())
      const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate())
      return Math.round((d2 - d1) / 86400000)
    }

    /* 获取某月的天数 */
    const getDaysInMonth = (year, month) => {
      return new Date(year, month + 1, 0).getDate()
    }

    /* 根据循环方式和计算方式计算目标日期 */
    const calculateTargetDate = (dateStr, cycle, mode) => {
      const now = new Date()
      const target = new Date(dateStr)
      if (isNaN(target.getTime())) return null

      if (cycle === 'none') {
        return target
      }

      const targetMonth = target.getMonth()
      const targetDay = target.getDate()

      if (mode === 'countdown') {
        /* 倒数：找下一个匹配日期 */
        if (cycle === 'yearly') {
          let next = new Date(now.getFullYear(), targetMonth, targetDay)
          if (getDaysBetween(now, next) < 0) {
            next = new Date(now.getFullYear() + 1, targetMonth, targetDay)
          }
          return next
        } else if (cycle === 'monthly') {
          /* 按月循环：月份替换为当月，日不超过当月天数 */
          let useMonth = now.getMonth()
          let useYear = now.getFullYear()
          let maxDay = getDaysInMonth(useYear, useMonth)
          let useDay = Math.min(targetDay, maxDay)
          let next = new Date(useYear, useMonth, useDay)
          if (getDaysBetween(now, next) < 0) {
            useMonth = useMonth + 1
            if (useMonth > 11) {
              useMonth = 0
              useYear = useYear + 1
            }
            maxDay = getDaysInMonth(useYear, useMonth)
            useDay = Math.min(targetDay, maxDay)
            next = new Date(useYear, useMonth, useDay)
          }
          return next
        }
      } else {
        /* 正数：找上一个匹配日期 */
        if (cycle === 'yearly') {
          let last = new Date(now.getFullYear(), targetMonth, targetDay)
          if (getDaysBetween(now, last) > 0) {
            last = new Date(now.getFullYear() - 1, targetMonth, targetDay)
          }
          return last
        } else if (cycle === 'monthly') {
          /* 按月循环：月份替换为当月，日不超过当月天数 */
          let useMonth = now.getMonth()
          let useYear = now.getFullYear()
          let maxDay = getDaysInMonth(useYear, useMonth)
          let useDay = Math.min(targetDay, maxDay)
          let last = new Date(useYear, useMonth, useDay)
          if (getDaysBetween(now, last) > 0) {
            useMonth = useMonth - 1
            if (useMonth < 0) {
              useMonth = 11
              useYear = useYear - 1
            }
            maxDay = getDaysInMonth(useYear, useMonth)
            useDay = Math.min(targetDay, maxDay)
            last = new Date(useYear, useMonth, useDay)
          }
          return last
        }
      }

      return target
    }

    /* 格式化日期，按月循环只显示月-日，其他显示完整 YYYY-MM-DD */
    const formatDate = (date, cycle) => {
      const monthDay = String(date.getMonth() + 1).padStart(2, '0') + '-' +
        String(date.getDate()).padStart(2, '0')
      if (cycle === 'monthly') {
        return monthDay
      }
      return date.getFullYear() + '-' + monthDay
    }

    /* 初始化倒计时（静态属性，仅执行一次） */
    $('.countdown').each(function () {
      const $widget = $(this)
      const dateStr = $widget.attr('data-date')

      /* 未设置data-date时，隐藏左侧，仅渲染右侧进度条 */
      if (!dateStr) {
        $widget.find('.count-left').hide()
        $widget.find('.count-right').addClass('not-margin')
        return
      }

      const mode = $widget.attr('data-mode') || 'countdown'
      $widget.find('.count-left .text').text(
        mode === 'countdown'
          ? (DreamConfig.countdown_distance)
          : (DreamConfig.countdown_passed)
      )

      const name = $widget.attr('data-name')
      if (name) {
        const $name = $widget.find('.count-left .name')
        const $inner = $widget.find('.name-inner')
        const innerEl = $inner[0]
        const clipEl = $widget.find('.name-clip')[0]
        $inner.text(name)
        $name.attr('title', name)
        // 检测溢出，设置滚动距离并启动CSS动画
        const textWidth = innerEl.scrollWidth
        const containerWidth = clipEl.clientWidth
        if (textWidth > containerWidth) {
          innerEl.style.setProperty('--distance', (textWidth - containerWidth + 5) + 'px')
          innerEl.classList.add('marquee')
        }
      }
    })

    /* 渲染倒计时 */
    const renderCountdown = () => {
      $('.countdown').each(function () {
        const $widget = $(this)
        const cycle = $widget.attr('data-cycle') || 'yearly'
        const mode = $widget.attr('data-mode') || 'countdown'
        const dateStr = $widget.attr('data-date')
        if (!dateStr) return

        const now = new Date()
        const targetDate = calculateTargetDate(dateStr, cycle, mode)
        if (!targetDate) return

        const days = mode === 'countdown'
          ? getDaysBetween(now, targetDate)
          : getDaysBetween(targetDate, now)

        if (days < 0) {
          /* 倒计时已结束，隐藏左侧，仅渲染右侧进度条 */
          $widget.find('.count-left').hide()
          $widget.find('.count-right').addClass('not-margin')
        } else {
          /* 恢复显示 */
          $widget.find('.count-left').show()
          $widget.find('.count-right').removeClass('not-margin')

          const displayDate = formatDate(targetDate, cycle)

          /* 更新左侧 */
          $widget.find('.count-left .time').text(days === 0 ? DreamConfig.countdown_today : days)
          $widget.find('.count-left .date').text(displayDate)
        }

        /* 更新右侧进度条 */
        const remainData = getTimeRemaining()
        const remainText = DreamConfig.countdown_remaining
        const hourText = DreamConfig.countdown_hour
        const dayUnitText = DreamConfig.countdown_day_unit
        let html = ''

        for (const [tag, item] of Object.entries(remainData)) {
          const pct = parseFloat(item.percentage)
          const unitText = item.unit === 'hour' ? hourText : dayUnitText
          html += `
            <div class="count-item">
              <div class="item-name">${item.name}</div>
              <div class="item-progress">
                <div class="progress-bar" style="width: ${item.percentage}%; opacity: ${item.percentage / 100};"></div>
                <span class="percentage ${pct >= 46 ? 'many' : ''}">${item.percentage}%</span>
                <span class="remaining ${pct >= 60 ? 'many' : ''}">
                  <span class="tip">${remainText}</span>${item.remaining}<span class="tip">${unitText}</span>
                </span>
              </div>
            </div>`
        }
        $widget.find('.count-right').html(html)
      })
    }

    renderCountdown()
    setInterval(renderCountdown, 1000)
  },
  /* 安全链接 */
  initSecurityLink() {
    if (!DreamConfig.enable_security_link || !DreamConfig.security_link_url || DreamConfig.security_link_url.length === 0) {
      return
    }
    $(document).on('click', 'a[href]:not([data-url-security]), hyperlink-inline-card[href]:not([data-url-security]), hyperlink-card[href]:not([data-url-security])', (event) => {
      var href = $(event.currentTarget).attr('href')
      if (!href || (!href.toLowerCase().startsWith('http://') && !href.toLowerCase().startsWith('https://'))) {
        return
      }
      // 判断是否为下载链接
      const isDownloadLink = (url) => {
        const downloadExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.dmg', '.exe', '.msi', '.iso', '.apk']
        return downloadExtensions.some(ext => url.toLowerCase().endsWith(ext))
      }
      const isInternalLink = (url, domainList) => {
        // 将URL转换为小写并去除前导和尾随空格
        url = url.toLowerCase().trim()
        // 处理协议相对路径或绝对路径，转换为完整URL
        if (url.startsWith('//')) {
          url = window.location.protocol + url
        } else if (url.startsWith('/')) {
          url = window.location.origin + url
        }
        // 去除以http/https开头的URL的尾部斜杠
        if (url.startsWith('http://') || url.startsWith('https://')) {
          url = url.replace(/\/$/, '')
        }
        let parsedHostname
        try {
          parsedHostname = new URL(url).hostname
        } catch (e) {
          // URL解析失败，视为外部链接
          return false
        }
        // 检查是否匹配任一域名
        return domainList.some(domain => {
          if (domain.startsWith('*.')) {
            // 处理泛域名
            const mainDomain = domain.slice(2) // 移除开头的*.
            const mainParts = mainDomain.split('.')
            const hostParts = parsedHostname.split('.')
            // 检查host的尾部是否与主域名匹配，并且存在子域
            return (
              hostParts.length > mainParts.length &&
              hostParts.slice(-mainParts.length).join('.') === mainDomain
            )
          } else {
            // 处理完整域名
            return parsedHostname === domain
          }
        })
      }
      if (isDownloadLink(href)) {
        event.preventDefault()
        // 如果是下载链接，直接跳转
        window.open(href, '_blank')
      } else if (!isInternalLink(href, DreamConfig.security_link_whitelist)) {
        event.preventDefault()
        window.open((DreamConfig.security_link_url + '?target=' + encodeURIComponent(href)), '_blank')
      }
    })
  },
  /* 灰色模式 */
  initGrayMode() {
    const grayMode = sessionStorage.getItem('gray-mode')
    const grayModeMessage = sessionStorage.getItem('gray-mode-message')
    const hasShownPopup = sessionStorage.getItem('gray-mode-show')
    if (grayMode === 'true' && grayModeMessage && grayModeMessage.trim() !== '' && !hasShownPopup && Qmsg) {
      Qmsg.info(grayModeMessage)
      // 标记为已显示，防止重复弹出
      sessionStorage.setItem('gray-mode-show', 'true')
    }
  },
  /* 初始化特效，只需要初始化一次，移动端设备不初始化 */
  initEffects() {
    if (Utils.isMobile() && !DreamConfig.mobile_special_effects) return
    DreamConfig.cursor_move && Utils.cachedScript(`${DreamConfig.theme_base}/js/cursor/move/${DreamConfig.cursor_move}.min.js?mew=${DreamConfig.theme_version}`)
    DreamConfig.cursor_click && Utils.cachedScript(`${DreamConfig.theme_base}/js/cursor/click/${DreamConfig.cursor_click}.min.js?mew=${DreamConfig.theme_version}`)
    DreamConfig.effects_lantern_mode && Utils.cachedScript(`${DreamConfig.theme_base}/js/effects/lantern.min.js?mew=${DreamConfig.theme_version}`)
    DreamConfig.effects_sakura_mode && Utils.cachedScript(`${DreamConfig.theme_base}/js/effects/sakura.min.js?mew=${DreamConfig.theme_version}`)
    DreamConfig.effects_snowflake_mode && Utils.cachedScript(`${DreamConfig.theme_base}/js/effects/snowflake.min.js?mew=${DreamConfig.theme_version}`)
    DreamConfig.effects_universe_mode && Utils.cachedScript(`${DreamConfig.theme_base}/js/effects/universe.min.js?mew=${DreamConfig.theme_version}`)
    DreamConfig.effects_circle_magic_mode && Utils.cachedScript(`${DreamConfig.theme_base}/js/effects/circleMagic.min.js?mew=${DreamConfig.theme_version}`)
    DreamConfig.effects_quantum_silk_thread_mode && Utils.cachedScript(`${DreamConfig.theme_base}/js/effects/quantum.min.js?mew=${DreamConfig.theme_version}`)
    DreamConfig.effects_rain_mode && Utils.cachedScript(`${DreamConfig.theme_base}/js/effects/rain.min.js?mew=${DreamConfig.theme_version}`)
  },
  /* 显示主题版本信息 */
  showThemeVersion() {
    window.logger(`%c页面加载耗时：${Math.round(performance.now())}ms | Theme By Dream2 Plus ${DreamConfig.theme_version} | https://github.com/hcjike/halo-theme-dream2.0-plus`,
      'color:#fff; background: linear-gradient(270deg, #986fee, #8695e6, #68b7dd, #18d7d3); padding: 8px 15px; border-radius: 0 15px 0 15px')
  },
  /* 控制是否显示Banner（section顶部内边距由CSS兄弟选择器根据hidden状态处理） */
  showBanner(pathname = location.pathname) {
    const isHome = pathname === '/'
    document.querySelectorAll('.banner').forEach(el => {
      el.classList.toggle('hidden', !isHome)
    })
  },
  /* 自动播放Banner视频 */
  playBannerVideo() {
    var bannerElement = document.querySelector('.banner')
    var videoElement = document.querySelector('.banner video')
    if (!videoElement || !bannerElement) {
      return
    }

    function playVideo() {
      if (!videoElement.src || videoElement.src === window.location.href || videoElement.getAttribute('src') === null) {
        return
      }
      try {
        if (videoElement.paused) {
          var playPromise = videoElement.play()
          // 处理可能返回的Promise
          if (playPromise !== undefined) {
            playPromise.catch(function (error) {
              console.log('视频播放失败:', error)
            })
          }
        }
      } catch (e) {
        console.log('播放错误:', e)
      }
    }

    // 确保循环播放正常工作
    videoElement.addEventListener('ended', function () {
      videoElement.currentTime = 0 // 重置播放位置
      playVideo() // 重新播放
    }, false)

    // 兼容IE11的事件监听
    function addOneTimeEventListener(element, event, callback) {
      var handler = function () {
        callback()
        // IE11不支持removeEventListener的useCapture参数
        if (element.removeEventListener) {
          element.removeEventListener(event, handler)
        } else if (element.detachEvent) { // 兼容IE8及更早版本
          element.detachEvent('on' + event, handler)
        }
      }

      if (element.addEventListener) {
        element.addEventListener(event, handler)
      } else if (element.attachEvent) { // 兼容IE8及更早版本
        element.attachEvent('on' + event, handler)
      }
    }

    // 添加点击/触摸事件监听
    addOneTimeEventListener(document, 'click', playVideo)
    // 为移动设备添加触摸事件支持
    addOneTimeEventListener(document, 'touchend', playVideo)
    // 尝试自动播放
    playVideo()
  },
}

window.commonContext = commonContext
let timeLifeHour = -1

!(function () {
  /* 首帧前同步执行：会改动 DOM 结构、文本或可见性，推迟会出现"先渲染再被替换"的跳动 */
  const IMMEDIATE = [
    'initWidget', 'initTocAndNotice', 'initBanner', 'initGallery', 'initMode', 'initNavbar',
    'mobileCloseNavbarMask', 'loveTime', 'webCopyright', 'initTimeCount', 'initCustomCountdown',
    'showBanner',
    /* 滚动状态（右下角按钮组、导航栏收起）依赖滚动距离，必须在首帧前定好最终形态 */
    'initScroll',
  ]

  /* 首帧之后：只做事件绑定与播放，晚一帧无感，不占用首屏绘制 */
  const AFTER_PAINT = [
    'searchDialog', 'initDropMenu', 'initLogonMenu', 'drawerMobile', 'back2Top',
    'maskClose', 'sideMenuMobile', 'initEvent', 'offscreenTip', 'closeFancybox',
    'initSecurityLink', 'initGrayMode', 'playBannerVideo',
  ]

  /* DOM 就绪后：依赖完整 DOM 或外部库 */
  const ON_READY = [
    'initCarousel', 'sparkInput', 'websiteTime', 'initEffects', 'iniTaskItemDisabled',
    'initPhotosGallery',
  ]

  /* 浏览器空闲时：不参与首屏 */
  const ON_IDLE = ['showThemeVersion', 'initMermaid']

  const GROUPS = [IMMEDIATE, AFTER_PAINT, ON_READY, ON_IDLE]

  // 单个初始化失败不影响后续，避免一个报错导致整批不执行
  const run = (group) => group.forEach((name) => {
    const init = commonContext[name]
    if (typeof init !== 'function') return
    try {
      init()
    } catch (e) {
      console.error(`[common] ${name} 初始化失败`, e)
    }
  })

  // 事件可能已经触发（异步脚本、pjax 替换等），这里统一兜底
  const onReady = (cb) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', cb, {once: true})
    } else {
      cb()
    }
  }

  const onLoad = (cb) => {
    if (document.readyState === 'complete') {
      cb()
    } else {
      window.addEventListener('load', cb, {once: true})
    }
  }

  const onIdle = (cb) => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(cb, {timeout: 2000})
    } else {
      setTimeout(cb, 200)
    }
  }

  // 漏写分组名时给出提示，避免新增方法静默不执行
  const missed = Object.keys(commonContext).filter((name) => !GROUPS.some((g) => g.includes(name)))
  if (missed.length) console.warn('[common] 未纳入执行分组的方法：', missed)

  // 1. 首帧前摘掉加载态：必须最早执行且不加动画，否则会命中 html:not(.loaded) 的兜底动画
  document.documentElement.classList.add('loaded')

  // 2. 首帧只做影响布局/可见性的初始化，保证首帧即最终形态（不跳动、不缩放）
  run(IMMEDIATE)

  // 3. 让出主线程，先让浏览器把首帧画出来，再执行其余初始化
  requestAnimationFrame(() => setTimeout(() => run(AFTER_PAINT), 0))

  // 4. DOM 就绪后初始化依赖库的模块，空闲时再做剩下的事
  onReady(() => {
    run(ON_READY)
    onIdle(() => run(ON_IDLE))
  })

  onLoad(() => document.documentElement.classList.add('ready'))
})()
