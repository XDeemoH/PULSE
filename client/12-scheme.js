    /* ── 跟随 DSH 主题：宿主把 bg-base 换成亮色时整层换纸白 ─────────────── */

    var schemeObserver = null
    var schemeMedia = null
    var schemeTimer = 0

    /** 只认 #rgb / #rrggbb / rgb() / rgba()；解析不了返回 null。 */
    function parseCssColor(value) {
      var text = String(value || '').trim().toLowerCase()
      if (!text) return null
      var hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/)
      if (hex) {
        var raw = hex[1]
        if (raw.length === 3) raw = raw.charAt(0) + raw.charAt(0) + raw.charAt(1) + raw.charAt(1) + raw.charAt(2) + raw.charAt(2)
        return [parseInt(raw.slice(0, 2), 16), parseInt(raw.slice(2, 4), 16), parseInt(raw.slice(4, 6), 16)]
      }
      var rgb = text.match(/^rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/)
      if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
      return null
    }

    function relativeLuminance(rgb) {
      var channels = rgb.map(function (value) {
        var v = Math.min(255, Math.max(0, value)) / 255
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
      })
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
    }

    /** 背景色亮度 → light / dark；解析不了返回 null，交给系统偏好兜底。 */
    function schemeFromColor(value) {
      var rgb = parseCssColor(value)
      if (!rgb) return null
      return relativeLuminance(rgb) > 0.5 ? 'light' : 'dark'
    }

    /** 宿主可能把令牌挂在 body 上，也可能只用 data-theme / class 标记：都试一遍。 */
    function schemeHintFromDom() {
      if (typeof document === 'undefined') return null
      var body = document.body
      // DSH 把暗色主题挂在 body 上：body[data-ds-dark-theme]。亮色是「没有这个属性」。
      if (body && body.hasAttribute && body.hasAttribute('data-ds-dark-theme')) return 'dark'
      var targets = [body, document.documentElement]
      for (var i = 0; i < targets.length; i += 1) {
        var node = targets[i]
        if (!node || typeof window === 'undefined') continue
        try {
          var value = window.getComputedStyle(node).getPropertyValue('--dsw-alias-bg-base')
          var fromToken = schemeFromColor(value)
          if (fromToken) return fromToken
        } catch (error) {
          /* 这个节点上没有令牌 */
        }
      }
      var html = document.documentElement
      if (!html) return null
      var marks = [
        html.getAttribute('data-theme'),
        html.getAttribute('data-color-scheme'),
        html.getAttribute('data-dsw-theme'),
        html.className,
        body && body.getAttribute ? body.getAttribute('data-theme') : '',
        body ? body.className : '',
      ]
      var text = marks.filter(Boolean).join(' ').toLowerCase()
      if (/\blight\b/.test(text)) return 'light'
      if (/\bdark\b/.test(text)) return 'dark'
      return null
    }

    function detectDshScheme() {
      if (typeof document !== 'undefined' && typeof window !== 'undefined') {
        var hinted = schemeHintFromDom()
        if (hinted) return hinted
        try {
          if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
        } catch (error) {
          /* 没有 matchMedia */
        }
      }
      return 'dark'
    }

    /** 面板配色：auto 跟 DSH；light / dark 是用户在设置里手动锁定的。 */
    function effectiveScheme() {
      if (prefs.scheme === 'light' || prefs.scheme === 'dark') return prefs.scheme
      return detectDshScheme()
    }

    /** 把判定写到 <html> 上，CSS 用 html[data-rp-scheme="light"] 收口。 */
    function applyDshScheme() {
      if (typeof document === 'undefined' || !document.documentElement) return
      var scheme = effectiveScheme()
      if (document.documentElement.getAttribute('data-rp-scheme') !== scheme) {
        document.documentElement.setAttribute('data-rp-scheme', scheme)
      }
    }

    /** 宿主切主题不会通知插件：盯 html + body 的属性变化（DSH 把暗色标记在 body 上）。 */
    function installSchemeWatch() {
      if (typeof document === 'undefined' || typeof window === 'undefined') return null
      applyDshScheme()
      var schedule = function () {
        if (schemeTimer) window.clearTimeout(schemeTimer)
        schemeTimer = window.setTimeout(function () {
          schemeTimer = 0
          applyDshScheme()
        }, 60)
      }
      try {
        schemeObserver = new MutationObserver(schedule)
        schemeObserver.observe(document.documentElement, { attributes: true })
        if (document.body) schemeObserver.observe(document.body, { attributes: true })
      } catch (error) {
        schemeObserver = null
      }
      try {
        schemeMedia = window.matchMedia('(prefers-color-scheme: light)')
        if (schemeMedia && schemeMedia.addEventListener) schemeMedia.addEventListener('change', schedule)
      } catch (error) {
        schemeMedia = null
      }
      return function uninstallSchemeWatch() {
        if (schemeTimer) window.clearTimeout(schemeTimer)
        schemeTimer = 0
        if (schemeObserver) schemeObserver.disconnect()
        schemeObserver = null
        try {
          if (schemeMedia && schemeMedia.removeEventListener) schemeMedia.removeEventListener('change', schedule)
        } catch (error) {
          /* ignore */
        }
        schemeMedia = null
        document.documentElement.removeAttribute('data-rp-scheme')
      }
    }

