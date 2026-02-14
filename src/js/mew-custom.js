class MewElement extends HTMLElement {
  constructor() {
    super()
    if (this.hasAttribute('draw')) return
    this.init()
  }

  drawComplete() {
    this.setAttribute('draw', true)
  }
}

document.addEventListener('DOMContentLoaded', () => {
  customElements.define(
    'mew-hide',
    class MewHide extends MewElement {
      init() {
        let $this = $(this)
        const $mainContent = $this.closest('.main-content')
        this.options = {
          target: $mainContent.attr('data-target'),
          id: $mainContent.attr('data-id')
        }
        if (this.options.target && this.options.id) {
          let commentIds = localStorage.getItem(window.encrypt('mew-hide-' + this.options.target))
          commentIds = commentIds ? JSON.parse(window.decrypt(commentIds)) : []
          if (commentIds.includes(this.options.id)) {
            $this.before(this.innerHTML)
            $this.remove()
          } else {
            let isToc = $this.find('h1,h2,h3,h4,h5').length !== 0
            this.setAttribute('hide', window.encrypt(this.innerHTML))
            this.innerHTML = ''
            if (isToc) {
              this.setAttribute('toc', true)
              commonContext.initTocAndNotice()
            }
            this.onclick = function () {
              let $haloComment = $(`halo-comment[id='${this.options.id}'][type='${this.options.target.substring(0, this.options.target.length - 1)}']`)
              if ($haloComment.length === 0 || $haloComment.is(':hidden')) {
                return
              }
              Utils.animateScroll($haloComment[0], 20, (window.innerHeight || document.documentElement.clientHeight) / 4)
            }
          }
        }
        this.drawComplete()
      }
    }
  )

  customElements.define(
    'mew-subtitle',
    class MewSubtitle extends MewElement {
      init() {
        this.innerHTML = `<span>${this.innerText || DreamConfig.mew_subtitle_default_title}</span>`
        this.drawComplete()
      }
    }
  )

  customElements.define(
    'mew-music',
    class MewMusic extends HTMLElement {

      constructor() {
        super()
        this.innerHTML = this.getAttribute('prompt') || 'Loading'
        this.options = {
          container: this,
          fixed: this.hasAttribute('fixed') || false,
          mutex: this.hasAttribute('mutex') || true,
          theme: this.getAttribute('theme') || 'var(--theme)',
          loop: this.getAttribute('loop') || 'all',
          autoplay: this.hasAttribute('autoplay') && this.getAttribute('autoplay') !== 'false',
          lrcType: this.getAttribute('lrcType') || 3,
          listFolded: this.getAttribute('listFolded') || false,
          volume: this.getAttribute('volume') || 0.7,
          listMaxHeight: this.getAttribute('listMaxHeight') || '450px',
          mini: this.getAttribute('mini') || false,
          order: this.getAttribute('order') || 'list',
          storageName: this.getAttribute('storageName') || 'aplayer-setting',
        }
        if (!('APlayer' in window)) {
          if (!MewMusic.prototype.load) {
            MewMusic.prototype.load = true
            MewMusic.prototype.await = []
            new Promise((resolve) => {
              const $head = $('head')
              $head.append('<link rel="stylesheet" href="/themes/theme-dream2-plus/assets/lib/aplayer@1.10.1/APlayer.min.css">')
              Utils.cachedScript('/themes/theme-dream2-plus/assets/lib/aplayer@1.10.1/APlayer.min.js')
                .done(() => resolve())
                .fail(() => resolve())
            }).then(() => {
              this.render()
              MewMusic.prototype.await && MewMusic.prototype.await.forEach(n => n())
            })
          } else {
            MewMusic.prototype.await.push(() => this.render())
          }
        } else {
          this.render()
        }
      }

      render() {
        if (!('APlayer' in window)) {
          this.innerHTML = DreamConfig.mew_music_not_enabled_tip
          return
        }
        // eslint-disable-next-line no-async-promise-executor
        new Promise(async (resolve) => {
          if (this.hasAttribute('meetingUrl')) {
            this.options.audio = await fetch(this.getAttribute('meetingUrl'))
              .then((response) => response.json())
          } else if (this.hasAttribute('song')) {
            this.options.audio = await fetch(
              'https://api.i-meto.com/meting/api?server=netease&type=song&id=' +
              this.getAttribute('song')
            ).then((response) => response.json())
          } else if (this.hasAttribute('playlist')) {
            this.options.audio = await fetch(
              'https://api.i-meto.com/meting/api?server=netease&type=playlist&id=' +
              this.getAttribute('playlist')
            ).then((response) => response.json())
          } else if (this.hasAttribute('url')) {
            this.options.audio = [{
              name: this.getAttribute('name') || DreamConfig.mew_music_default_name,
              url: this.getAttribute('url'),
              artist: this.getAttribute('artist') || DreamConfig.mew_music_default_artist,
              cover: this.getAttribute('cover'),
              lrc: this.getAttribute('lrc') || (this.options.lrcType = undefined),
            }]
          } else if (this.hasAttribute('music-list')) {
            var musicList = JSON.parse(this.getAttribute('music-list'))
            musicList.forEach((item) => {
              item.lrc = item.lrc || ''
              item.name = item.name || DreamConfig.mew_music_default_name
              item.artist = item.artist || DreamConfig.mew_music_default_artist
              item.cover = item.cover || '/themes/theme-dream2-plus/assets/img/music.webp'
            })
            this.options.audio = musicList
          } else {
            this.innerHTML = DreamConfig.mew_music_not_music_tip
            return resolve()
          }
          this.aplayer = new APlayer(this.options)
          resolve()
        })
          .catch((e) => {
          })
      }

      getAPlayer() {
        return this.aplayer
      }

      disconnectedCallback() {
        this.aplayer && this.aplayer.destroy()
      }
    }
  )

  customElements.define(
    'mew-bilibili',
    class MewBilibili extends MewElement {
      init() {
        this.options = {
          bvid: this.getAttribute('bvid'),
          width: /^\d{1,3}%$/.test(this.getAttribute('width'))
            ? this.getAttribute('width')
            : '100%',
        }
        if (this.options.bvid) {
          this.style.padding = `calc(${this.options.width} * 0.3) 0`
          this.innerHTML = `<iframe allowfullscreen="true" src="//player.bilibili.com/player.html?bvid=${this.options.bvid}&page=1" style="width: ${this.options.width};"></iframe>`
        } else this.innerHTML = DreamConfig.mew_bilibili_not_bvid_tip
        this.drawComplete()
      }
    }
  )

  customElements.define(
    'mew-tabs',
    class MewTabs extends MewElement {
      init() {
        const $tabPage = $(this).children('mew-tab-page')
        if ($tabPage.length === 0) {
          this.innerHTML = DreamConfig.mew_tabs_not_tab_tip
          this.drawComplete()
          return
        }
        let navs = ''
        let contents = ''
        let active = false
        $tabPage.each((index, elem) => {
          let title = elem.getAttribute('title') || DreamConfig.mew_tabs_default_title
          let id = `${index}-${new Date().getTime()}`
          if (!active && elem.hasAttribute('active')) {
            active = true
            navs += `<div class="active" data-id="#${id}">${title}</div>`
            contents += `<div class="active" id="${id}">${elem.innerHTML}</div>`
          } else {
            navs += `<div data-id="#${id}">${title}</div>`
            contents += `<div id="${id}">${elem.innerHTML}</div>`
          }
        })
        this.innerHTML = `<div class="tabs-head">${navs}</div><div class="tabs-body">${contents}</div>`
        !active && $(this).find('div>div:first-child').addClass('active')
        this.drawComplete()
      }

      connectedCallback() {
        $(this).find('.tabs-head').on('click', 'div:not(.active)', function () {
          const $container = $(this).parent().parent()
          $container.find('.active').removeClass('active')
          $(this).addClass('active')
          $container.find($(this).attr('data-id')).addClass('active')
        })
      }
    }
  )

  customElements.define(
    'mew-cloud',
    class MewCloud extends MewElement {
      init() {
        this.options = {
          type: this.getAttribute('type') || 'default',
          title: this.innerText || DreamConfig.mew_cloud_title,
          url: this.getAttribute('url'),
          password: this.getAttribute('password'),
        }
        const type = {
          default: DreamConfig.mew_cloud_default_name,
          360: DreamConfig.mew_cloud_360_name,
          115: DreamConfig.mew_cloud_115_name,
          123: DreamConfig.mew_cloud_123_name,
          kk: DreamConfig.mew_cloud_kk_name,
          xl: DreamConfig.mew_cloud_xl_name,
          onedrive: DreamConfig.mew_cloud_onedrive_name,
          yd: DreamConfig.mew_cloud_yd_name,
          ty: DreamConfig.mew_cloud_ty_name,
          lt: DreamConfig.mew_cloud_lt_name,
          uc: DreamConfig.mew_cloud_uc_name,
          pan: DreamConfig.mew_cloud_pan_name,
          oss: DreamConfig.mew_cloud_oss_name,
          bd: DreamConfig.mew_cloud_bd_name,
          wy: DreamConfig.mew_cloud_wy_name,
          ali: DreamConfig.mew_cloud_ali_name,
          github: DreamConfig.mew_cloud_github_name,
          gitee: DreamConfig.mew_cloud_gitee_name,
          gitlab: DreamConfig.mew_cloud_gitlab_name,
          gitea: DreamConfig.mew_cloud_gitea_name,
          git: DreamConfig.mew_cloud_git_name,
          lz: DreamConfig.mew_cloud_lz_name,
        }
        this.innerHTML = `
					<div class="mew-cloud-logo type-${type[this.options.type] ? this.options.type : 'default'}"></div>
					<div class="mew-cloud-desc">
						<div class="mew-cloud-desc-title">${this.options.title}</div>
						<div class="mew-cloud-desc-type">${DreamConfig.mew_cloud_source + (type[this.options.type] || DreamConfig.mew_cloud_default_name)}${this.options.password ? ' | ' + DreamConfig.mew_cloud_extraction + this.options.password : ''}</div>
					</div>
					<a class="mew-cloud-link" href="${this.options.url}" target="_blank" aria-label="${this.options.title}" title="${this.options.title}" rel="noopener noreferrer nofollow">
						<i class="ri-download-line"></i>
					</a>
				`
        this.drawComplete()
      }
    }
  )

  customElements.define(
    'mew-progress',
    class MewProgress extends MewElement {
      init() {
        this.options = {
          value: /^\d{1,3}%$/.test(this.getAttribute('value'))
            ? this.getAttribute('value')
            : '50%',
          color: this.getAttribute('color') || 'var(--theme)',
        }
        this.innerHTML = `<div class="mew-progress-bar">
									<div class="mew-progress-bar-inner" style="width: ${this.options.value}; background: ${this.options.color};"></div>
								</div>
								<div class="mew-progress-value">${this.options.value}</div>`
        this.drawComplete()
      }
    })

  customElements.define(
    'mew-panel',
    class MewPanel extends MewElement {
      init() {
        this.options = {
          title: this.getAttribute('title') || '',
          color: this.getAttribute('color') || 'var(--theme)',
        }
        this.innerHTML = `
                <div class="mew-panel-title">${this.options.title}</div>
                <div class="mew-panel-body">${this.innerHTML}</div>`
        this.style.background = this.options.color
        this.style.color = this.options.color
        this.drawComplete()
      }
    })

  customElements.define(
    'mew-message',
    class MewMessage extends MewElement {
      init() {
        this.options = {
          type: /^(success|info|warning|error)$/.test(
            this.getAttribute('type')
          )
            ? this.getAttribute('type')
            : 'info',
          content: this.innerHTML || '',
        }
        this.innerHTML = this.options.content
        this.setAttribute('type', this.options.type)
        this.drawComplete()
      }
    })

  customElements.define(
    'mew-hr',
    class MewHr extends MewElement {
      init() {
        this.startColor = this.getAttribute('startColor') || '#01d0ff'
        this.endColor = this.getAttribute('endColor') || '#fc3e85'
        this.style.backgroundImage = `repeating-linear-gradient(-45deg, ${this.startColor} 0,${this.startColor} 20%, transparent 0,transparent 35%, ${this.endColor} 0,${this.endColor} 65%, transparent 0,transparent 80%, ${this.startColor} 0,${this.startColor} 100%)`
        this.drawComplete()
      }
    })

  customElements.define(
    'mew-timeline',
    class MewTimeline extends MewElement {
      init() {
        let content = ''
        let child = this.firstChild
        while (child) {
          if (child.tagName === 'MEW-TIMELINE-TITLE') {
            content += `<div class="mew-timeline-title ${child.getAttribute('type') || ''}"><span class="mew-timeline-title-elem">${child.innerHTML}</span></div>`
          } else if (child.tagName === 'MEW-TIMELINE-ITEM') {
            const type = child.getAttribute('type') || ''
            const title = child.getAttribute('title') ? `<span class="mew-timeline-item-title">${child.getAttribute('title')}</span>` : ''
            content += `<div class="mew-timeline-item ${child.getAttribute('type') || ''}">${title}<div class="mew-timeline-item-content">${child.innerHTML}</div></div>`
          }
          child = child.nextElementSibling
        }
        this.innerHTML = content
        this.drawComplete()
      }
    }
  )

  customElements.define(
    'mew-btn',
    class MewBtn extends MewElement {
      init() {
        this.options = {
          color: this.getAttribute('color') || 'var(--theme)',
          href: this.getAttribute('href'),
          target: this.getAttribute('target') || '_blank',
          icon: this.getAttribute('icon'),
        }
        this.innerHTML = `<a class="mew-btn" aria-label="${this.options.href}">${this.options.icon ? `<i class="${this.options.icon}"></i>` : ''}${this.innerHTML}</a>`
        const btn = this.querySelector('a.mew-btn')
        this.options.href && (btn.href = this.options.href, btn.target = this.options.target)
        this.drawComplete()
      }
    })

  customElements.define(
    'mew-quote',
    class MewQuote extends MewElement {
      init() {
        this.options = {
          avatar: this.getAttribute('avatar'),
          href: this.getAttribute('href'),
          name: this.getAttribute('name'),
        }
        const avatarElem = this.options.avatar ? `<a class="mew-quote-href" aria-label="${this.options.name}" title="${this.options.name}" target="_blank" ${this.options.href ? `href="${this.options.href}"` : ''}><img class="quote-avatar-hexagon not-gallery" src="${this.options.avatar}"/></a>` : ''
        const nameElem = this.options.name ? `<a class="mew-quote-name" aria-label="${this.options.name}" title="${this.options.name}" target="_blank" ${this.options.href ? `href="${this.options.href}"` : ''}>${this.options.name}</a>` : ''
        this.innerHTML = `<div class="mew-quote"><div class="quote-container">${avatarElem}<div class="mew-quote-info"><p class="mew-quote-content">${this.innerHTML}</p>${nameElem}</div></div></div>`
        this.drawComplete()
      }
    })

  // customElements.define(
  //   'mew-link',
  //   class MewLink extends MewElement {
  //     async init() {
  //       this.options = {
  //         img: this.getAttribute('img'),
  //         href: this.getAttribute('href') || '',
  //         title: this.getAttribute('title'),
  //         slug: this.getAttribute('slug'),
  //         id: this.getAttribute('id'),
  //         type: this.getAttribute('type') || 'post',
  //         desc: this.innerHTML
  //       }
  //       if (this.options.id || this.options.slug) {
  //         await Utils.request({
  //           url: this.options.id ? `/api/content/${this.options.type}s/${this.options.id}` : `/api/content/${this.options.type}s/slug?slug=${this.options.slug}`,
  //           method: 'GET',
  //         })
  //           .then(res => {
  //             this.options.img = this.options.img || res.thumbnail
  //             this.options.href = this.options.title || res.fullPath
  //             this.options.title = this.options.title || res.title
  //             this.options.desc = this.options.desc || res.summary
  //           })
  //           .catch(error => {
  //             this.options.desc = `Error: ${error}`
  //           })
  //       }
  //       const imageElem = this.options.img ? `<span class="mew-link-image"><img class="link-image not-gallery" src="${this.options.img}"/></span>` : ''
  //       const descElem = this.options.desc ? `<span class="info-desc">${this.options.desc}</span>` : `<span class="mew-link-href info-desc">${this.options.href}</span>`
  //       this.innerHTML = `<a class="mew-link" target="_blank" href="${this.options.href}" aria-label="${this.options.title || '我分享了一个网站'}" title="${this.options.title || '我分享了一个网站'}"><span class="mew-link-info"><p class="info-title">${this.options.title || '我分享了一个网站'}</p>${descElem}</span>${imageElem}</a>`
  //       this.drawComplete()
  //     }
  //   })

  customElements.define(
    'mew-video',
    class MewVideo extends MewElement {
      init() {
        this.options = {
          src: this.getAttribute('src'),
          type: this.getAttribute('type'),
          autoplay: this.hasAttribute('autoplay') && this.getAttribute('autoplay') !== 'false',
          controls: this.getAttribute('controls') !== 'false',
          loop: this.hasAttribute('loop') && this.getAttribute('loop') !== 'false',
          muted: this.hasAttribute('muted') && this.getAttribute('muted') !== 'false',        // 静音播放
          preload: this.hasAttribute('preload') && this.getAttribute('preload') !== 'false',
          poster: this.getAttribute('poster'),        // 加载图片
          width: /^\d{1,3}%$/.test(this.getAttribute('width'))
            ? this.getAttribute('width')
            : '100%',
        }
        this.innerHTML = `<video width="${this.options.width}" ${this.options.poster ? `poster="${this.options.poster}"` : ''}${this.options.autoplay ? ' autoplay' : ''}${this.options.controls ? ' controls' : ''}${this.options.loop ? ' loop' : ''}${this.options.muted ? ' muted' : ''}${this.options.preload ? ' preload' : ''}><source src="${this.options.src}" ${this.options.type ? `type="${this.options.type}"` : ''}>${DreamConfig.global_browser_not_supported}</video>`
        this.drawComplete()
      }
    })

  customElements.define(
    'mew-photos',
    class MewPhotos extends MewElement {
      init() {
        if (!($.fn.justifiedGallery)) {
          if (!MewPhotos.prototype.load) {
            MewPhotos.prototype.load = true
            MewPhotos.prototype.await = []
            new Promise((resolve) => {
              Utils.cachedScript('/themes/theme-dream2-plus/assets/lib/justifiedGallery@3.8.1/jquery.justifiedGallery.min.js')
                .done(() => resolve())
                .fail(() => resolve())
            }).then(() => {
              this.render()
              MewPhotos.prototype.await && MewPhotos.prototype.await.forEach(n => n())
            })
          } else {
            MewPhotos.prototype.await.push(() => this.render())
          }
        } else {
          this.render()
        }
      }

      render() {
        this.options = {
          captions: this.hasAttribute('captions') && this.getAttribute('captions') !== 'false',
          margins: this.getAttribute('margins') || '4'
        }
        $(this).find('img').each((i, elem) => {
          var wrapper = document.createElement('div')
          wrapper.setAttribute('data-fancybox', 'gallery')
          wrapper.setAttribute('data-options', JSON.stringify({hash: false}))
          if (elem.alt) {
            wrapper.setAttribute('data-caption', elem.alt)
          }
          wrapper.setAttribute('href', elem.src)
          $(elem).wrap(wrapper)
        })
        $(this).justifiedGallery({captions: this.options.captions, margins: this.options.margins})
        this.drawComplete()
      }
    })

  customElements.define(
    'mew-raw',
    class MewRaw extends MewElement {
      init() {
        let html = this.innerHTML
        this.innerHTML = ''
        const shadowRoot = this.attachShadow({mode: 'closed'})
        shadowRoot.innerHTML = html
        this.drawComplete()
      }
    }
  )
})