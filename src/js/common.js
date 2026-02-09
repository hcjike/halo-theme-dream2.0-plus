window.encrypt = (str) => window.btoa(unescape(encodeURIComponent(str)))
window.decrypt = (str) => decodeURIComponent(escape(window.atob(str)))

const commonContext = {
  /* 初始化widget */
  initWidget() {
    const BREAKPOINT = 1216
    const $rightCol = $('.column-right')
    const $shadowCol = $('.column-right-shadow')
    // 检查元素是否存在
    if (!$rightCol.length || !$shadowCol.length) return
    const $window = $(window)
    // 监听窗口大小变化（使用防抖优化性能）
    $(window).on('resize', debounce(checkWidgetPosition, 50))

    function checkWidgetPosition() {
      const windowWidth = $window.width()
      const isMoved = $shadowCol.children().length > 0

      // 移动到左侧的条件
      if (windowWidth < BREAKPOINT && !isMoved) {
        $rightCol.children().detach().appendTo($shadowCol)
        $shadowCol.addClass('is-active')
      }
      // 移回右侧的条件
      else if (windowWidth >= BREAKPOINT && isMoved) {
        $shadowCol.children().detach().appendTo($rightCol)
        $shadowCol.removeClass('is-active')
      }
    }

    // 防抖函数
    function debounce(func, wait) {
      let timeout
      return function () {
        const context = this
        const args = arguments
        clearTimeout(timeout)
        timeout = setTimeout(function () {
          func.apply(context, args)
        }, wait)
      }
    }

    // 初始检查窗口大小
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
    const bannerDesc = $bannerInfoDesc.text()
    $bannerInfoDesc.text('')
    let currentBannerDesc = ''
    let isWrite = true
    let animationId = null
    let lastTime = 0

    const updateDesc = function (currentTime) {
      // 初始化时间
      if (lastTime === 0) {
        lastTime = currentTime
      }
      // 计算时间差
      const elapsed = currentTime - lastTime
      const currentInterval = isWrite ? 500 : 80
      // 如果时间差大于等于间隔时间，执行一次更新
      if (elapsed >= currentInterval) {
        let num = currentBannerDesc.length
        if (isWrite && num < bannerDesc.length) {
          currentBannerDesc += bannerDesc.charAt(num)
          $bannerInfoDesc.text(currentBannerDesc)
        } else if (!isWrite && num > 0) {
          currentBannerDesc = currentBannerDesc.slice(0, num - 1)
          $bannerInfoDesc.text(currentBannerDesc)
        } else {
          // 当前方向完成，切换方向并重置时间
          cancelAnimationFrame(animationId)
          isWrite = !isWrite
          lastTime = 0 // 重置时间，让下一帧重新开始计时
          // 直接继续动画，不需要 setTimeout
          animationId = requestAnimationFrame(updateDesc)
          return
        }
        // 更新最后执行时间（减去多余的时间，保持节奏）
        lastTime = currentTime - (elapsed % currentInterval)
      }
      // 继续动画循环
      animationId = requestAnimationFrame(updateDesc)
    }
    // 启动动画
    animationId = requestAnimationFrame(updateDesc)
  },
  /* 激活图片预览功能 */
  initGallery() {
    // 用链接和标题包装图像
    $('.main-content img:not(.not-gallery)').each(function () {
      const $img = $(this)
      const src = $img.attr('src')
      const alt = $img.attr('alt')
      const srcset = $img.attr('srcset')

      if (DreamConfig.lazy_enable) {
        if (src) {
          $img.attr('data-src', src)
        }
        if (srcset) {
          $img.attr('data-srcset', srcset)
        }
        $img.addClass('lazyload')
      }

      if ($(this).parents('[data-fancybox],mew-photos').length === 0) {
        if (DreamConfig.lazy_enable) {
          // 移除 src 并用 data-src 替代（避免立即加载）
          $img.removeAttr('src')
          $img.removeAttr('srcset')
        }

        $(this).wrap(`<div class="gallery-item"><div data-fancybox="gallery" data-options='{"hash": false}' ${this.alt ? `data-caption="${this.alt}"` : ''} href="${src
        }"></div></div>`)
      }
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
          e.stopPropagation()
        })
      }
    })
  },
  /* 处理滚动 */
  initScroll() {
    window.initTop = 0

    // true：上划，false：下滑
    function scrollDirection(currentTop) {
      const result = currentTop > window.initTop
      window.initTop = currentTop
      return result
    }

    const handleScroll = () => {
      const scrollTop = $(document).scrollTop()
      const direction = scrollDirection(scrollTop)
      const $body = $('body')
      const $actions = $('.actions')
      if (scrollTop > 50 && direction) {
        $body.addClass('move-up')
      } else {
        $body.removeClass('move-up')
      }
      if (scrollTop > 100) {
        $actions.addClass('show')
      } else {
        $actions.removeClass('show')
      }
    }
    document.addEventListener('scroll', handleScroll)
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
    let $elem = $('.love .love-time')
    if ($elem.length === 0 || !DreamConfig.love_time_template || !DreamConfig.love_time_template_year) return
    let loveTime = $elem.attr('data-time')
    if (!/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/.test(loveTime)) {
      $elem.text(loveTime)
      return
    }
    const grt = new Date(loveTime)
    let animationId = null
    let lastTime = 0
    function updateLoveTime(currentTime) {
      // 初始化时间
      if (lastTime === 0) {
        lastTime = currentTime
      }
      // 计算时间差，大约300毫秒更新一次
      const elapsed = currentTime - lastTime
      if (elapsed >= 300) {
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
        if (year !== 0) {
          $elem.html(DreamConfig.love_time_template_year
            .replace(/\{(\d+)\}/g, (match, p1) => {
              const values = [year, days, hours, minutes, seconds]
              return values[p1]
            }))
        } else {
          $elem.html(DreamConfig.love_time_template
            .replace(/\{(\d+)\}/g, (match, p1) => {
              const values = [days, hours, minutes, seconds]
              return values[p1]
            }))
        }
        // 更新最后执行时间（简单重置，不校正多余时间）
        lastTime = currentTime
      }
      // 继续动画循环
      animationId = requestAnimationFrame(updateLoveTime)
    }
    // 启动动画
    animationId = requestAnimationFrame(updateLoveTime)
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
    let animationId = null
    let lastTime = 0
    function updateSiteTime(currentTime) {
      // 初始化时间
      if (lastTime === 0) {
        lastTime = currentTime
      }
      // 计算时间差，大约300毫秒更新一次
      const elapsed = currentTime - lastTime
      if (elapsed >= 300) {
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
        websiteDate.forEach(element => {
          element.innerHTML = timeText
        })
        // 更新最后执行时间（简单重置，不校正多余时间）
        lastTime = currentTime
      }
      // 继续动画循环
      animationId = requestAnimationFrame(updateSiteTime)
    }
    // 启动动画
    animationId = requestAnimationFrame(updateSiteTime)
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
  /* 控制是否显示Banner */
  showBanner(pathname = location.pathname) {
    const bannerElement = document.querySelector('.banner')
    const sectionElement = document.querySelector('.section')
    if (bannerElement) {
      if (pathname !== '/') {
        bannerElement.classList.add('hidden')
        if (sectionElement && DreamConfig.header_fixed) {
          sectionElement.classList.add('section-top')
        }
      } else {
        bannerElement.classList.remove('hidden')
        if (sectionElement && DreamConfig.header_fixed) {
          sectionElement.classList.remove('section-top')
        }
      }
    }
  },
  /* 自动播放Banner视频 */
  playBannerVideo() {
    var bannerElement = document.querySelector('.banner')
    var videoElement = document.querySelector('.banner video')
    if (!videoElement || !bannerElement) {
      return
    }

    // 设置循环播放相关属性
    videoElement.loop = true // 关键属性：启用循环
    videoElement.muted = true // 静音更易自动播放
    videoElement.setAttribute('playsinline', '') // iOS内联播放
    videoElement.setAttribute('webkit-playsinline', '') // 旧版iOS支持

    function playVideo() {
      try {
        if (videoElement.paused) {
          var playPromise = videoElement.play()
          // 处理可能返回的Promise
          if (playPromise !== undefined) {
            playPromise.catch(function (error) {
              console.log('视频播放失败:', error)
              bannerElement.style.backgroundImage = `url(${DreamConfig.banner_image})`
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
  const loads = ['initCarousel', 'sparkInput', 'websiteTime', 'playBannerVideo', 'initEffects', 'iniTaskItemDisabled']
  const omits = ['showThemeVersion']

  Object.keys(commonContext).forEach(
    (c) => !loads.includes(c) && !omits.includes(c) && commonContext[c]()
  )

  // 当前html加载完执行
  document.addEventListener('DOMContentLoaded', function () {
    $('html').addClass('loaded')
    loads.forEach((c) => commonContext[c] && commonContext[c]())
  })

  // 所有内容加载完执行
  window.addEventListener('load', function () {
    omits.forEach((c) => commonContext[c] && commonContext[c]())
    $('html').addClass('ready')
  })
})()
