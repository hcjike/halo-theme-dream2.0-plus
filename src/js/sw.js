(function () {
  if (self.document) {
    const currentScriptUrl = document.currentScript.src
    const uninstall = new URLSearchParams(currentScriptUrl.split('?')[1]).get('uninstall')
    if (uninstall) {
      console.log('uninstall service worker.')
      navigator.serviceWorker.getRegistrations().then(function (registrations) {
        for (let registration of registrations) {
          registration.active && registration.active.scriptURL && registration.active.scriptURL.indexOf('/sw.min.js') !== -1 && registration.unregister()
        }
      })
      window.caches && caches.keys && caches.keys().then(function (keys) {
        keys.forEach(function (key) {
          /* 只删本主题的缓存，别把同域下其它应用/插件的 Cache Storage 一起清掉 */
          if (key.indexOf('Dream2-plus-') !== 0) return
          console.log('delete cache', key)
          caches.delete(key)
        })
      })
    } else if (!('serviceWorker' in navigator)) {
      console.warn('[SW] 当前浏览器或非 HTTPS 环境不支持 Service Worker，已跳过')
    } else {
      navigator.serviceWorker.register(document.currentScript.src)
        .catch(function (error) {
          /* 最常见的原因是反向代理没配好：/sw.min.js 返回 404，注册直接失败 */
          console.warn('[SW] 注册失败，请检查 /sw.min.js 是否已按文档代理', error)
        })
    }
  } else {
    // 取得请求参数（SW 脚本自身的 URL 上带着配置）
    const envParams = new URLSearchParams(location.href.split('?')[1])
    /*
     * 缓存版本直接取脚本 URL 上的 mew（主题版本号），由模板注入，不需要手改。
     * 主题一升级 mew 就变，旧的整份缓存会在 activate 时被清掉，避免长期吃陈旧资源。
     */
    const version = envParams.get('mew') || '1'
    // 取得缓存名称
    const cacheName = `Dream2-plus-${version}`
    // 是否开启多cdn源并发请求
    const isCdnConcurrentRequest = envParams.get('concurrent')
    // 是否开启全站缓存
    const isGlobalCache = envParams.get('cache')
    // 主题路径
    const themePath = location.origin + '/themes/theme-dream2-plus'
    /*
     * cdn源站点，一行一个。
     * 这里要对每一项做 trim：文本域在 Windows 上可能带 \r，不处理的话第 2 条之后的地址
     * 都会以 \r 开头而被过滤掉，表现就是"配了多个源却只走第一个"。
     */
    const cdnSource = (envParams.get('cdn') || '')
      .split(',')
      .map(item => item.trim())
      .filter(item => item.indexOf('http') === 0)

    // 禁止被处理（优先级别最高）
    // 后端 api 不进行缓存
    const notHandleList = [
      location.origin + '/api',
      location.origin + '/apis',
    ]

    // 需要走cdn和缓存的请求（cdn优先于缓存）
    const cdnAndCacheList = [
      themePath,
      ...cdnSource
    ]

    //对这里面的请求只会走缓存，先缓存后下载
    // jsdeliver cdn 不稳定，只走缓存
    const onlyCacheList = [
      location.origin + '/upload',
      'https://cdn.jsdelivr.net/'
    ]

    const cdnHandle = {
      theme: {
        handleRequest: url => {
          if (url.indexOf(themePath) !== 0) return
          const path = url.substring(themePath.length)
          const version = new URLSearchParams(url.split('?')[1]).get('mew') || 'latest'
          return [
            url,
            ...cdnSource.map(value => `${value}/halo-theme-dream2.0-plus@${version}/templates${path}`)
          ]
        },
      },
      npm: {
        handleRequest: url => {
          for (let index in cdnSource) {
            if (url.indexOf(cdnSource[index]) === 0) {
              const path = url.substring(cdnSource[index].length)
              return cdnSource.map(value => value + path)
            }
          }
        }
      },
    }

    /**
     * 判断ur是否符合list列表中的要求
     *
     * @param list
     * @param url
     * @returns {boolean}
     */
    function isExitInUrlList(list, url) {
      return list.some(function (value) {
        return url.indexOf(value) === 0
      })
    }

    /**
     * 判断两个url是否属于同一个请求，过滤掉部分参数
     *
     * @param urla
     * @param urlb
     * @returns {boolean}
     */
    function isSameRequest(urla, urlb) {
      // 除了这这些参数，其它的查询参数必须要一致，才认为是同一个请求
      const white_query = new Set([
        'mew',  // 自定义的版本号
        'v',
        'version',
        't',
        'time',
        'ts',
        'timestamp'
      ])

      const a_url = urla.split('?')
      const b_url = urlb.split('?')
      if (a_url[0] !== b_url[0]) {
        return false
      }

      const a_params = new URLSearchParams('?' + a_url[1])
      const b_params = new URLSearchParams('?' + b_url[1])

      // 显示所有的键
      for (const key of a_params.keys()) {
        if (white_query.has(key)) {//对于版本号的key 忽略
          continue
        }
        if (a_params.get(key) !== b_params.get(key)) {//其它key的值必须相等，比如type=POST 这种
          return false
        }
      }

      return true
    }

    //添加缓存
    self.addEventListener('install', function (event) {
      console.log('install service worker.')
      event.waitUntil(self.skipWaiting()) //这样会触发activate事件
    })

    // 激活
    self.addEventListener('activate', function (event) {
      console.log('service worker activate.')
      const mainCache = [cacheName]
      event.waitUntil(
        caches.keys().then(function (cacheNames) {
          return Promise.all(
            cacheNames.map(function (cacheName) {
              /* 只处理本主题的缓存：同域下别的应用/插件有自己的 Cache Storage，不能顺手删掉 */
              if (cacheName.indexOf('Dream2-plus-') !== 0) return
              if (mainCache.indexOf(cacheName) === -1) {//没有找到该版本号下面的缓存
                // When it doesn't match any condition, delete it.
                console.info('version changed, clean the cache, SW: deleting ' + cacheName)
                return caches.delete(cacheName)
              }
            })
          )
        })
      )
      return self.clients.claim()
    })

    // 拦截请求使用缓存的内容
    self.addEventListener('fetch', function (event) {
      // 非 get 请求不处理，被禁止处理的地址不处理
      if (event.request.method !== 'GET'
        || isExitInUrlList(notHandleList, event.request.url)) {
        return false
      }
      // 检查请求协议是否为 http 或 https
      if (!event.request.url.startsWith('http://') && !event.request.url.startsWith('https://')) {
        return false
      }
      const isCdnAndCache = isExitInUrlList(cdnAndCacheList, event.request.url)
      const isOnlyCacheList = isExitInUrlList(onlyCacheList, event.request.url)
      /*
       * 主题资源 / CDN 资源 / 上传文件都带版本号或内容固定，命中缓存就直接返回。
       * 这里不再要求同时开启「并发 CDN」：之前只有 concurrent 才走缓存，
       * 只开「全站离线」时这些静态资源仍然每次都走网络，所以开启后几乎感觉不到提速。
       */
      if (!(isCdnAndCache || isOnlyCacheList)) {
        // 不需要全站离线
        if (!isGlobalCache) {
          return false
        }
        // 先发起请求，如果请求失败则读取离线缓存
        event.respondWith(caches.open(cacheName)
          .then(cache => {
            return fetch(event.request)
              .then((response) => {
                if (response.status === 200) cache.put(event.request, response.clone())
                return response
              })
              .catch(() => cache.match(event.request))
          })
        )
        return true
      }
      // 劫持 HTTP Request
      event.respondWith(
        caches.open(cacheName).then(function (cache) {
          // 查找缓存
          return cache.match(event.request).then(function (cacheResponse) {
            // 直接返回缓存
            if (cacheResponse) return cacheResponse

            return handleRequest(event.request, isCdnAndCache)
              .then((response) => {
                const responseClone = response.clone()
                //忽略 206 状态码，因为 206 状态码是分片下载，会导致缓存失效
                if (response.status === 206) {
                  return response
                }
                // ignoreSearch 忽略请求参数进行查找，用于匹配不同版本
                cache.matchAll(event.request, {'ignoreSearch': true})
                  .then(function (cache_response_list) {
                    // 删除旧版本的缓存文件
                    if (cache_response_list) {
                      for (const cache_response of cache_response_list) {
                        const responseUrl = cache_response.url || cache_response.headers.get('service-worker-origin')
                        if (isSameRequest(responseUrl, event.request.url)) {
                          cache.delete(responseUrl)
                        }
                      }
                    }
                    cache.put(event.request, responseClone)
                  })
                return response
              })
              .catch(error => {
                console.error(error)
                return cache.matchAll(event.request, {'ignoreSearch': true})
                  .then(function (cache_response_list) {
                    // 从缓存中取得历史版本的文件
                    if (cache_response_list) {
                      for (const cache_response of cache_response_list) {
                        if (isSameRequest(cache_response.url || cache_response.headers.get('service-worker-origin'), event.request.url)) {
                          return cache_response
                        }
                      }
                    }
                    /*
                     * 所有 CDN 都失败、也没有可用的历史缓存时，回落到直接请求原地址。
                     * 不回落的后果是 respondWith(undefined) 直接抛错，资源表现为加载失败
                     * （一个 CDN 抽风就可能让整页样式/脚本挂掉）。
                     */
                    return fetch(event.request)
                  })
              })
          })
        })
      )
    })

    /**
     * 处理匹配的请求
     * @param req
     * @param isCdnAndCache
     * @returns {Promise<Response>|*}
     */
    function handleRequest(req, isCdnAndCache) {
      // 不是cdn缓存或者未开启cdn并发，直接进行查询并返回
      if (!isCdnAndCache || !isCdnConcurrentRequest) return fetch(req)

      // 匹配 cdn
      for (const type in cdnHandle) {
        const urls = cdnHandle[type].handleRequest(req.url)
        if (urls) return fetchAny(req.url, urls)
      }
      // 没有匹配到url，直接发起请求
      return fetch(req)
    }

    // Promise.any 的 polyfill
    function createPromiseAny() {
      Promise.any = function (promises) {
        return new Promise((resolve, reject) => {
          promises = Array.isArray(promises) ? promises : []
          let len = promises.length
          let errs = []
          if (len === 0)
            return reject(new AggregateError('All promises were rejected'))
          promises.forEach((p) => {
            if (!(p instanceof Promise)) return reject(p)
            p.then(
              (res) => resolve(res),
              (err) => {
                len--
                errs.push(err)
                if (len === 0) reject(new AggregateError(errs))
              }
            )
          })
        })
      }
    }

    // 发送所有请求
    function fetchAny(originUrl, urls) {
      // 中断一个或多个请求
      const controller = new AbortController()
      const signal = controller.signal

      // 遍历将所有的请求地址转换为promise
      const PromiseAll = urls.map((url) => {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
          fetch(url, {signal})
            .then(async res => {    // 重新封装响应
              const newHeaders = new Headers(res.headers)
              newHeaders.set('service-worker-origin', originUrl)
              return new Response(await res.arrayBuffer(), {
                status: res.status,
                headers: newHeaders,
              })
            })
            .then((res) => {
              if (res.status !== 200) {
                reject(res)
                return
              }
              controller.abort() // 中断
              resolve(res)
            })
            .catch(() => reject(null)) // 去除中断的错误信息
        })
      })

      // 判断浏览器是否支持 Promise.any
      if (!Promise.any) createPromiseAny()

      // 谁先返回"成功状态"则返回谁的内容
      return Promise.any(PromiseAll)
    }
  }
})()
