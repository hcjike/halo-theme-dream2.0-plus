const Utils = {
  /**
   * 是否移动设备
   */
  isMobile() {
    const ua = navigator.userAgent.toLowerCase()
    const width = window.innerWidth
    // 1. 优先检测平板设备，平板视为电脑
    if (/ipad|android(?!.*mobile)|tablet|silk/i.test(ua)) {
      return false
    }
    // 2. 检测移动设备和鸿蒙系统
    if (/android|webos|iphone|ipod|blackberry|windows phone|mobile|harmonyos|hmos/i.test(ua)) {
      return true
    }
    // 3. 最后用屏幕宽度兜底判断
    // 小屏幕（<=768px）且非平板的情况，视为移动设备
    return width <= 768
  },
  /**
   * 安全压缩HTML（防御XSS/注入攻击）
   * @param {string} html - 待处理的HTML字符串
   * @param {boolean} [keepBasicTags=true] - 是否保留基础标签
   * @returns {string} 安全压缩后的HTML
   */
  secureCompressHTML(html, keepBasicTags = true) {
    if (typeof html !== 'string') return ''

    // 防御层1：先进行实体化转义（关键步骤）
    const escapeMap = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      '\'': '&#x27;',
      '/': '&#x2F;'
    }

    let safeHtml = html.replace(/[<>&"'\/]/g, char => escapeMap[char])

    // 防御层2：选择性允许安全标签（白名单机制）
    if (keepBasicTags) {
      const tagWhitelist = ['p', 'br', 'div', 'span', 'a', 'b', 'i', 'strong', 'em']
      tagWhitelist.forEach(tag => {
        const regex = new RegExp(`&lt;(${tag})([^&]*)&gt;`, 'gi')
        safeHtml = safeHtml.replace(regex, `<${tag}$2>`)

        const closeRegex = new RegExp(`&lt;\\/(${tag})&gt;`, 'gi')
        safeHtml = safeHtml.replace(closeRegex, `</${tag}>`)
      })
    }

    // 防御层3：安全压缩（在转义后的内容上操作）
    return safeHtml
      .replace(/&lt;!--[\s\S]*?--&gt;/g, '')  // 处理转义后的注释
      .replace(/\s+/g, ' ')
      .replace(/&gt;\s+&lt;/g, '&gt;&lt;')
      .replace(/\s+&gt;/g, '&gt;')
      .replace(/&lt;\s+/g, '&lt;')
  },
  /**
   * 有缓存的方式加载js
   */
  cachedScript(url, callback) {
    return $.ajax(jQuery.extend({
      url: url,
      type: 'get',
      dataType: 'script',
      cache: true,
      success: callback
    }, $.isPlainObject(url) && url))
  },
  /**
   * 时间格式化
   * @param {*} time
   */
  formatDate(date, fmt = 'yyyy-MM-dd') {
    date = new Date(date)
    if (/(y+)/.test(fmt)) {
      fmt = fmt.replace(
        RegExp.$1,
        (date.getFullYear() + '').substr(4 - RegExp.$1.length)
      )
    }
    let o = {
      'M+': date.getMonth() + 1,
      'd+': date.getDate(),
      'h+': date.getHours(),
      'm+': date.getMinutes(),
      's+': date.getSeconds(),
    }
    for (let k in o) {
      if (new RegExp(`(${k})`).test(fmt)) {
        let str = o[k] + ''
        fmt = fmt.replace(
          RegExp.$1,
          RegExp.$1.length === 1 ? str : str.padStart(2, '0')
        )
      }
    }
    return fmt
  },
  /* 获取URL中带的链接参数
   * @param search 链接后缀
   * @return {{}} 对象
   */
  getUrlParams() {
    var search = location.search

    // 判断是否为字符串类型
    if (typeof search !== 'string') {
      search = search.toString()
    }

    var paramsSplit = search.replace(/^[^\?]*\?/i, '').split(/&/)
    var params = {}

    // 数据为空
    if (paramsSplit.length < 1) {
      return params
    }

    if (Array.isArray(paramsSplit)) {
      paramsSplit.forEach(function (item) {
        // 数据为空, 退出方法
        if (!item) {
          return false
        }
        var itemSplit = item.split(/=/)

        // 判断字符串中是否有多个=
        if (itemSplit.length >= 2) {
          // 是
          var key = itemSplit.splice(0, 1)
          params[key] = itemSplit.join('=')
        }
      })
    }
    return params
  },
  /* 随机颜色 */
  randomColor(factor) {
    const colors = ['#F8D800', '#0396FF', '#EA5455', '#7367F0', '#32CCBC', '#F6416C', '#28C76F', '#9F44D3', '#F55555', '#736EFE', '#E96D71', '#DE4313', '#D939CD', '#4C83FF', '#F072B6', '#C346C2', '#5961F9', '#FD6585', '#465EFB', '#FFC600', '#FA742B', '#5151E5', '#BB4E75', '#FF52E5', '#49C628', '#00EAFF', '#F067B4', '#F067B4', '#ff9a9e', '#00f2fe', '#4facfe', '#f093fb', '#6fa3ef', '#bc99c4', '#46c47c', '#f9bb3c', '#e8583d', '#f68e5f']
    return colors[factor % colors.length]
  },
  /* 请求封装 */
  request({
    url = '',
    method = 'GET',
    data,
    headers = {},
    timeout = 10000,
    returnRaw = false,
    contentType,
    resultType = 'json',
    noErrorTip = false,
  }) {
    return new Promise((resolve, reject) => {
      method = method.toUpperCase()
      $.ajax({
        url,
        type: method,
        headers: {
          'API-Authorization': DreamConfig.access_key || 'dream',
          ...headers,
        },
        async: true,
        dataType: resultType,
        contentType,
        timeout,
        data,
        success(res) {
          if (returnRaw) {
            resolve(res)
          } else {
            if (res.status === 200) {
              resolve(res.data || '')
            } else {
              reject(res)
            }
          }
        },
        error(err) {
          const errMsg = err
            ? err.responseJSON
              ? err.responseJSON.title
              : DreamConfig.global_request_fail
            : DreamConfig.global_request_fail
          if (!noErrorTip) {
            Qmsg.error(errMsg)
          }
          reject(errMsg)
        },
      })
    })
  },
  /**
   * 初始化喜欢按钮
   * @param buttonSelect 喜欢按钮的选择器
   * @param type 喜欢的类型
   */
  initLikeButton(buttonSelect, type) {
    const name = encrypt('agree-' + type)
    let agrees = localStorage.getItem(name)
    agrees = agrees ? JSON.parse(decrypt(agrees)) : []
    $(buttonSelect).each(function () {
      let $this = $(this)
      let id = $this.attr('data-id')
      // 已经喜欢过了
      agrees.includes(id) && $this.removeClass('like')
    })
  },
  /**
   * 初始化喜欢按钮点击事件
   */
  initLikeEvent(buttonSelect, type, likeNumFunc) {
    let name = encrypt('agree-' + type)
    $('body').on('click', buttonSelect, function (e) {
      e.stopPropagation()
      let $this = $(this)
      let id = $this.attr('data-id')
      let type2 = $this.attr('data-type')
      Utils.request({
        url: '/apis/api.halo.run/v1alpha1/trackers/upvote',
        method: 'POST',
        contentType: 'application/json;charset=UTF-8',
        returnRaw: true,
        resultType: 'text',
        data: JSON.stringify({
          group: type2 === 'Moments' ? 'moment.halo.run' : (type2 === 'Post' ? 'content.halo.run' : 'content.halo.run'),
          plural: type2 === 'Moments' ? 'moments' : (type2 === 'Post' ? 'posts' : ''),
          name: id
        })
      })
        .then((_res) => {
          let agrees = localStorage.getItem(name)
          agrees = agrees ? JSON.parse(decrypt(agrees)) : []
          let likes = +($this.attr('data-likes') || 0) + 1
          agrees.push(id)
          $this.removeClass('like')
          const val = encrypt(JSON.stringify(agrees))
          localStorage.setItem(name, val)
          // $this.off('click');
          likeNumFunc($this).html(likes)
          Qmsg.success(DreamConfig.global_like_success)
        })
    })
  },
  /* sleep */
  sleep(ms = 250) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  },
  /* 折叠代码块或者日志块 */
  foldBlock($container) {
    const oldHeight = $container.height()
    if ($container.is('.fold')) {
      $container.removeClass('fold').addClass('unfold')
    } else {
      const oldScrollTop = document.documentElement.scrollTop || document.body.scrollTop || window.pageYOffset
      $container.addClass('fold').removeClass('unfold')
      // 跳转位置，保证折叠后没有过大的位置偏移
      $('body,html').scrollTop(oldScrollTop - oldHeight + $container.height())
    }
  },
  /**
   * 删除元素的 class，可根据前缀来删除
   * @param {*} el 需要删除的 dom 元素
   * @param {*} prefix 需要删除的 class，可以仅为前缀
   */
  removeClassByPrefix(el, prefix) {
    const classes = el.className.split(' ').filter(function (c) {
      return c.lastIndexOf(prefix, 0) !== 0
    })

    el.className = classes.join(' ').trim()
  },

  /**
   * 滚动到指定控件
   * @param element 需要被跳转到的控件
   * @param time 跳转时间
   * @param headingsOffset 控件距离页面顶部的距离
   * @param callback 跳转完成后执行的函数
   */
  animateScroll(element, time, headingsOffset, callback) {
    let rect = element.getBoundingClientRect()
    let currentY = window.scrollY
    let targetY = currentY + rect.top - headingsOffset
    let speed = (targetY - currentY) / time
    let offset = currentY > targetY ? -1 : 1
    let requestId

    function step() {
      currentY += speed
      if (currentY * offset < targetY * offset) {
        window.scrollTo(0, currentY)
        requestId = window.requestAnimationFrame(step)
      } else {
        window.scrollTo(0, targetY)
        window.cancelAnimationFrame(requestId)
        callback && callback()
      }
    }

    requestId = window.requestAnimationFrame(step)
  },
  /**
   * djb2哈希算法
   */
  djb2Hash(str) {
    let hash = 5381 // 初始种子
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i) // djb2 算法
    }
    return (hash >>> 0).toString()
  },

}

window.Utils = Utils
