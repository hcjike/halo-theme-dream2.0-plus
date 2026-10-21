let journalContextInitial = false
const journalContext = {
  /* 初始化事件 */
  initEvent() {
    if (journalContextInitial) return
    /* pjax 整文档替换会换掉 <body>，委托必须挂在 document 上，否则导航后这些点击全部失效 */
    let $root = $(document)
    // 展开和关闭评论区事件
    $root.on('click', '.journal .comment', function () {
      $(this).parent().parent().siblings('.journal-comment').stop().slideToggle(200)
    })
    // 折叠日志区域
    $root.on('click', '.journal-content>.expand-done', function () {
      Utils.foldBlock($(this).parent())
    })
    $root.on('click', '.journal-operation-item>.share', function () {
      let $journal = $(this).parents('.journal')
      let title = DreamConfig.journals_share_title + $journal.find('.journal-date>em').text()
      let desc = $journal.children('.journal-content').children('.main-content').text()
      DShare.sharePoster({
        image: DreamConfig.journals_share_image,
        title: title,
        description: desc.length > 220 ? desc.substring(0, 220) + '...' :desc
      })
    })
    Utils.initLikeEvent('.journal .like', 'moments', ($elem) => $elem.find('em'))
    journalContextInitial = true
  },
  /* 点赞 */
  initLike() {
    Utils.initLikeButton('.journal .like', 'moments')
  },
  /* 折叠日志区域 */
  foldJournals() {
    const $journals = $('.journal .journal-content')
    $journals.each(function () {
      const $this = $(this)
      if (this.scrollHeight >= DreamConfig.journals_fold_height) {
        $this.append('<div class="expand-done"><i class="ri-arrow-up-double-line"></i></div>')
      } else {
        $this.removeClass('fold')
      }
    })
  },
}
window.journalPjax = function () {
  if ($('.card.journal').length === 0) return
  Object.keys(journalContext).forEach(
    (c) => journalContext[c]()
  )
}
!(function () {
  journalContext.initEvent()
  journalContext.initLike()

  document.addEventListener('DOMContentLoaded', function () {
    journalContext.foldJournals()
  })
})()