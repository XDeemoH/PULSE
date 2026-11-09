    /* ── 格式化 ──────────────────────────────────────────────────────── */

    function formatTime(at) {
      if (!at) return ''
      try {
        return new Date(at).toLocaleTimeString(undefined, {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      } catch (error) {
        return ''
      }
    }

    function fill(template, key, value) {
      return String(template).split('{' + key + '}').join(String(value))
    }

    /** 字符数缩写：3742 → 3.7k。预算条用它，避免两位以上数字撑破窄栏。 */
    function formatChars(value) {
      var n = Number(value) || 0
      if (n < 1000) return String(n)
      return (n / 1000).toFixed(1) + 'k'
    }

    function formatTokens(value) {
      var n = Number(value) || 0
      if (n < 1000) return String(n)
      return (n / 1000).toFixed(1) + 'k'
    }

    /**
     * 预算线按 token 记；比字符更接近真实成本（中英混排时 1 字符 ≠ 1 token）。
     * 自动模式（默认）：上下文窗口 × 比例（默认 1%），夹在下限～上限（默认 3000～20000）之间——
     * 模型窗口变大，预算跟着放宽；但技能多了模型会挑错，所以不无限放宽。三个数都能在设置里改。
     * 窗口大小来自会话上报；这会儿没有会话上报时用上次见过的（记在 prefs 里），都没有才退回固定值。
     * 这只是软目标：超了只变色提示，不会停用任何技能（会动文件的是「自动配装」，要确认、可撤销）。
     */
    var contextWindowSeen = 0
    var BUDGET_AUTO_RATIO = 0.01
    var BUDGET_AUTO_MIN = 3000
    var BUDGET_AUTO_MAX = 20000
    function clampNumber(value, min, max, fallback) {
      var n = Number(value)
      if (!Number.isFinite(n) || n <= 0) return fallback
      return Math.min(max, Math.max(min, n))
    }
    function budgetRule() {
      var ratio = clampNumber(prefs.budgetRatio, 0.001, 0.05, BUDGET_AUTO_RATIO)
      var min = Math.round(clampNumber(prefs.budgetMin, 500, 100000, BUDGET_AUTO_MIN))
      var max = Math.max(min, Math.round(clampNumber(prefs.budgetMax, 1000, 200000, BUDGET_AUTO_MAX)))
      return { ratio: ratio, min: min, max: max }
    }
    function autoBudgetTokens(contextWindow) {
      var window = Number(contextWindow) || 0
      if (window <= 0) return 0
      var rule = budgetRule()
      return Math.min(rule.max, Math.max(rule.min, Math.round(window * rule.ratio)))
    }
    /** 用来算预算线的窗口大小，以及它从哪来：live = 会话刚上报，remembered = 上次见过，none = 没有。 */
    function budgetWindow() {
      if (contextWindowSeen > 0) return { tokens: contextWindowSeen, source: 'live' }
      var last = Number(prefs.lastContextWindow) || 0
      if (last > 0) return { tokens: last, source: 'remembered' }
      return { tokens: 0, source: 'none' }
    }
    function budgetFixedTokens() {
      var n = Number(prefs.budgetTokens)
      return Math.min(200000, Math.max(500, Math.round(Number.isFinite(n) && n > 0 ? n : 3000)))
    }
    function budgetLimitTokens() {
      if (prefs.budgetMode !== 'fixed') {
        var auto = autoBudgetTokens(budgetWindow().tokens)
        if (auto) return auto
      }
      return budgetFixedTokens()
    }
    function budgetLimitChars() {
      return budgetLimitTokens() * 4
    }

    /** 图钉：钉住的技能/库进核心集，预算方案默认不碰。 */
    function pinnedSkills() {
      return prefs.pins && Array.isArray(prefs.pins.skills) ? prefs.pins.skills : []
    }
    function pinnedLibs() {
      return prefs.pins && Array.isArray(prefs.pins.libs) ? prefs.pins.libs : []
    }
    function isPinnedSkill(name) {
      return pinnedSkills().indexOf(name) >= 0
    }
    function isPinnedLib(lib) {
      return pinnedLibs().indexOf(lib) >= 0
    }
    function togglePin(kind, name) {
      var skills = pinnedSkills().slice()
      var libs = pinnedLibs().slice()
      var list = kind === 'lib' ? libs : skills
      var at = list.indexOf(name)
      if (at >= 0) list.splice(at, 1)
      else list.push(name)
      setPref('pins', { skills: skills, libs: libs })
    }

    function formatRmb(value) {
      var n = Number(value) || 0
      if (n < 0.01) return n.toFixed(4)
      if (n < 1) return n.toFixed(3)
      return n.toFixed(2)
    }

    /** 只显示日期，历史窗口的起点用。 */
    function dateOnly(ms) {
      if (!ms) return ''
      try {
        return new Date(ms).toLocaleDateString()
      } catch (error) {
        return ''
      }
    }

    /** 回声卡片时间：对话发生日期 + 分钟，不显示秒。 */
    function formatEchoWhen(ms) {
      if (!ms) return ''
      return dateOnly(ms) + ' ' + formatTime(ms).slice(0, 5)
    }

    /** 毫秒 → 320ms / 3.2s / 1m 05s。空值返回空串，调用方据此决定要不要显示。 */    function formatMs(ms) {
      if (!ms || ms < 0) return ''
      if (ms < 1000) return Math.round(ms) + 'ms'
      if (ms < 60000) return (ms / 1000).toFixed(1) + 's'
      var minutes = Math.floor(ms / 60000)
      var seconds = Math.round((ms % 60000) / 1000)
      return minutes + 'm ' + (seconds < 10 ? '0' + seconds : String(seconds)) + 's'
    }

    function shortId(id) {
      var body = String(id || '').replace(/^session-/, '')
      return body.length > 8 ? body.slice(0, 8) : body
    }

    /** 面板根节点：圆盘的指针视差挂在这里（整个面板算“运行中区域”）。 */
    var panelRootEl = null

    /**
     * 面板外壳：根容器 + 一条扫描带 + 滚动层。
     * 扫描带是**一个**覆盖层（不是每行一条），只做 translateY，pointer-events:none，contain:strict。
     */
    /**
     * 等高线艺术背景：预烘焙的同心等高线 + 极慢漂移 + 径向 mask 渐隐到边缘。
     * 只动 transform（合成器），不跑滤镜、不跑 rAF、不依赖主题色——currentColor。
     */
    /**
     * 等高线背景：不规则地形线（不是同心圆）平铺 + 极慢漂移，按到窗口边缘的距离渐隐。
     * 两层用同一套路径、不同的速度/方向/缩放叠出“在蠕动”的视差；只动 transform。
     */
    var CONTOUR_RINGS = [
      'M60 12C78 12 96 26 98 44C100 62 86 82 66 90C46 98 24 88 16 68C8 48 20 24 38 16C45 13 52 12 60 12Z',
      'M60 26C72 26 84 34 85 46C86 58 76 70 63 72C50 74 38 66 36 54C34 42 44 30 55 27C57 26 58 26 60 26Z',
      'M60 40C67 40 74 45 74 52C74 59 68 64 61 64C54 64 48 59 47 52C46 45 52 40 60 40Z',
      'M60 51C63 51 65 53 65 56C65 59 63 60 60 60C57 60 55 59 55 56C55 53 57 51 60 51Z',
    ]
    var CONTOUR_STRAYS = [
      'M18 92C22 90 26 92 26 96C26 100 21 102 18 100C15 98 15 94 18 92Z',
      'M92 22C96 20 100 23 99 27C98 31 93 32 90 29C88 26 89 23 92 22Z',
      'M104 74C108 72 112 75 111 79C110 83 104 84 102 80C100 77 101 75 104 74Z',
    ]

    /**
     * 把同一套等高线路径序列化成 CSS mask 用的 data URI。
     * 皮肤里的流光就是「等高线地图当 mask + 一条橙色亮带平移」；这里不搬它那份
     * 225KB 的底图，直接用面板自己的线稿，视觉语言一致、体积只有几 KB。
     */
    var contourMaskCache = ''
    function contourMaskUri() {
      if (contourMaskCache) return contourMaskCache
      var paths = CONTOUR_RINGS.concat(CONTOUR_STRAYS)
      var body = paths
        .map(function (d) {
          return '<path d="' + d + '"/>'
        })
        .join('')
      var svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480">' +
        '<defs><pattern id="p" width="148" height="148" patternUnits="userSpaceOnUse">' +
        '<g fill="none" stroke="white" stroke-width="1" stroke-linejoin="round">' +
        body +
        '</g></pattern></defs><rect width="480" height="480" fill="url(#p)"/></svg>'
      contourMaskCache = 'data:image/svg+xml,' + encodeURIComponent(svg)
      return contourMaskCache
    }

    /** 橙色流光层：只让亮带穿过等高线，静态线稿本身不重绘。 */
    function ContourFlow() {
      var mask = 'url("' + contourMaskUri() + '")'
      return h(
        'div',
        {
          className: '__rp_flow',
          'aria-hidden': 'true',
          style: { maskImage: mask, WebkitMaskImage: mask },
        },
        h('div', { className: '__rp_flowBand' }),
      )
    }

    function ContourLayer(props) {
      var layer = props && props.layer === 1 ? 1 : 0
      var patternId = 'rpContour' + layer
      var paths = CONTOUR_RINGS.concat(layer === 0 ? CONTOUR_STRAYS : [])
      return h(
        'div',
        {
          className: layer === 1 ? '__rp_contour __rp_contourAlt' : '__rp_contour',
          'aria-hidden': 'true',
        },
        h(
          'svg',
          { className: '__rp_contourSvg', viewBox: '0 0 480 480', preserveAspectRatio: 'xMidYMid slice' },
          h(
            'defs',
            null,
            h(
              'pattern',
              { id: patternId, width: 148, height: 148, patternUnits: 'userSpaceOnUse' },
              paths.map(function (d, index) {
                return h('path', {
                  key: index,
                  d: d,
                  fill: 'none',
                  stroke: 'currentColor',
                  strokeWidth: 0.5,
                  strokeLinejoin: 'round',
                })
              }),
            ),
          ),
          h('rect', { width: '100%', height: '100%', fill: 'url(#' + patternId + ')' }),
        ),
      )
    }

