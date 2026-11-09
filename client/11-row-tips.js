    /* ── 悬停说明：body 层固定浮层，不参与任何 overflow 裁切 ─────────── */

    var TIP_SHOW_DELAY = 500
    var TIP_GAP = 6
    var TIP_EDGE = 8
    var tipEl = null
    var tipTimer = 0
    var tipAnchor = null
    var rowTipsInstalled = false

    /** 纯函数：算出浮层位置，永远留在视口内（下方放不下就翻到上方）。 */
    function clampTipPlacement(rect, size, view) {
      var gap = TIP_GAP
      var edge = TIP_EDGE
      var width = Math.max(0, Number(size && size.width) || 0)
      var height = Math.max(0, Number(size && size.height) || 0)
      var viewW = Math.max(edge * 2, Number(view && view.width) || 0)
      var viewH = Math.max(edge * 2, Number(view && view.height) || 0)
      var left = Math.min(Math.max(Number(rect.left) || 0, edge), Math.max(edge, viewW - width - edge))
      var top = (Number(rect.bottom) || 0) + gap
      if (top + height > viewH - edge && (Number(rect.top) || 0) - height - gap >= edge) {
        top = (Number(rect.top) || 0) - height - gap
      }
      top = Math.max(edge, Math.min(top, Math.max(edge, viewH - height - edge)))
      return { left: Math.round(left), top: Math.round(top) }
    }

    function currentViewport() {
      if (typeof window === 'undefined') return { width: 0, height: 0 }
      return {
        width: window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 0,
        height: window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 0,
      }
    }

    function ensureTipEl() {
      if (typeof document === 'undefined' || !document.body) return null
      if (tipEl && tipEl.parentNode) return tipEl
      var el = document.createElement('div')
      el.className = '__rp_tipLayer'
      el.setAttribute('role', 'tooltip')
      el.setAttribute('aria-hidden', 'true')
      document.body.appendChild(el)
      tipEl = el
      return el
    }

    /** 隐藏并清空浮层；定时器一起清掉，防止离开后还弹出来。 */
    function hideRowTip() {
      if (tipTimer) {
        clearTimeout(tipTimer)
        tipTimer = 0
      }
      tipAnchor = null
      if (!tipEl) return
      tipEl.removeAttribute('data-open')
      tipEl.setAttribute('aria-hidden', 'true')
      tipEl.textContent = ''
    }

    function showRowTip(anchor) {
      var text = anchor && anchor.getAttribute ? anchor.getAttribute('data-desc') : ''
      if (!text) return
      var el = ensureTipEl()
      if (!el) return
      el.textContent = text
      var placement = clampTipPlacement(anchor.getBoundingClientRect(), { width: el.offsetWidth, height: el.offsetHeight }, currentViewport())
      el.style.left = placement.left + 'px'
      el.style.top = placement.top + 'px'
      el.setAttribute('data-open', '1')
      el.setAttribute('aria-hidden', 'false')
    }

    /** 事件委托装一次就够了；返回卸载函数，插件停用时把监听和浮层一起收走。 */
    function installRowTips() {
      if (typeof document === 'undefined' || rowTipsInstalled) return null
      rowTipsInstalled = true

      function anchorOf(node) {
        return node && node.closest ? node.closest('[data-desc]') : null
      }
      function onOver(event) {
        var anchor = anchorOf(event.target)
        if (anchor === tipAnchor) return
        hideRowTip()
        tipAnchor = anchor
        if (!anchor) return
        tipTimer = setTimeout(function () {
          tipTimer = 0
          showRowTip(anchor)
        }, TIP_SHOW_DELAY)
      }
      function onOut(event) {
        if (!tipAnchor) return
        var next = event.relatedTarget
        if (next && tipAnchor.contains(next)) return
        hideRowTip()
      }
      function onScroll() {
        if (tipAnchor || tipEl) hideRowTip()
      }
      function onKey(event) {
        if (event.key === 'Escape') hideRowTip()
      }

      document.addEventListener('mouseover', onOver, true)
      document.addEventListener('mouseout', onOut, true)
      document.addEventListener('scroll', onScroll, true)
      document.addEventListener('keydown', onKey, true)
      window.addEventListener('resize', onScroll)
      return function uninstallRowTips() {
        document.removeEventListener('mouseover', onOver, true)
        document.removeEventListener('mouseout', onOut, true)
        document.removeEventListener('scroll', onScroll, true)
        document.removeEventListener('keydown', onKey, true)
        window.removeEventListener('resize', onScroll)
        hideRowTip()
        if (tipEl && tipEl.parentNode) tipEl.parentNode.removeChild(tipEl)
        tipEl = null
        rowTipsInstalled = false
      }
    }

