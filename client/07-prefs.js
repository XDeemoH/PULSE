    /* ── 显示偏好（本地保存，不经过 Host） ───────────────────────────── */

    /**
     * 等高线工坊的默认参数（和 GPT 交付的 DEFAULT_OPTIONS 对齐）。
     * 线色改成面板的灰白，掠光改成面板的琥珀 #ff7f00，默认给 35% 让流光可见。
     */
    var DEFAULT_STUDIO = {
      field: { scale: [3.7, 4.93], octaves: 3, bands: 48, warp: 1.35, speed: 0.006, seed: 721 },
      style: {
        color: '#b8bdbb',
        background: '#111416',
        alpha: 0.64,
        lineWidth: 0.85,
        softness: 0.8,
        fade: [0.48, 0.82],
        edgeFade: 0.1,
        dashed: true,
        accentColor: '#ff7f00',
        accent: 0.35,
      },
      motion: true,
      fps: 30,
      maxDpr: 2,
      renderer: 'auto',
      respectReducedMotion: true,
    }

    function studioDefaults() {
      return JSON.parse(JSON.stringify(DEFAULT_STUDIO))
    }

    var DEFAULT_FROST = { enabled: true, blur: 20, opacity: 0.06, saturation: 140 }

    function frostDefaults() {
      return JSON.parse(JSON.stringify(DEFAULT_FROST))
    }

    var DEFAULT_PRICING = { inputPerM: 0, outputPerM: 0 }

    function pricingDefaults() {
      return JSON.parse(JSON.stringify(DEFAULT_PRICING))
    }

    /**
     * 性能模式的“效果开关”注册表。
     * 以后新增窗口动画时，把 id 加进 EFFECT_DEFS：visual 默认开、performance 默认关；
     * 动画元素加 `.__rp_fx`，CSS 会按 data-effect-window 自动停掉。
     */
    var EFFECT_DEFS = [
      { id: 'contourMotion', key: 'effectContour' },
      { id: 'tilt', key: 'effectTilt' },
      { id: 'scan', key: 'effectScan' },
      { id: 'blur', key: 'effectBlur' },
      { id: 'reveal', key: 'effectReveal' },
      { id: 'flow', key: 'effectFlow' },
      { id: 'windowAnimations', key: 'effectWindow' },
      { id: 'statusPulse', key: 'effectPulse' },
      // 战术网格（地图模式）：静态 CSS，没有动画开销，性能模式默认也关掉只为「更素」。
      { id: 'grid', key: 'effectGrid' },
    ]
    var EFFECT_KEYS = EFFECT_DEFS.map(function (effect) {
      return effect.id
    })

    function visualEffects() {
      var out = {}
      EFFECT_KEYS.forEach(function (key) {
        out[key] = true
      })
      return out
    }

    function performanceEffects() {
      var out = {}
      EFFECT_KEYS.forEach(function (key) {
        out[key] = false
      })
      return out
    }

    function effectsForMode(mode) {
      return mode === 'performance' ? performanceEffects() : visualEffects()
    }

    function normalizeEffects(input, mode) {
      var out = effectsForMode(mode)
      if (input && typeof input === 'object') {
        EFFECT_KEYS.forEach(function (key) {
          if (typeof input[key] === 'boolean') out[key] = input[key]
        })
      }
      return out
    }

    function activeEffects() {
      return normalizeEffects(prefs.effects, prefs.mode)
    }

    function defaultProfile(mode) {
      var studio = studioDefaults()
      if (mode === 'performance') {
        studio.motion = false
      }
      return {
        contour: 'studio',
        surface: mode === 'performance' ? 0.5 : 0.45,
        studio: studio,
        frost: frostDefaults(),
        effects: effectsForMode(mode),
      }
    }

    var PREFS_KEY = 'dsh-running-panel:prefs'
    var soulScope = null
    var echoT = null
    var echoWorkspace = null
    var echoConversation = null
    var clientSessions = null
    var prefs = {
      mode: 'visual',
      scheme: 'auto',
      contour: 'studio',
      surface: 0.45,
      studio: studioDefaults(),
      frost: frostDefaults(),
      pricing: pricingDefaults(),
      budgetTokens: 3000,
      /** 预算线：'auto' = 上下文窗口 × budgetRatio，夹在 budgetMin～budgetMax；'fixed' = 用 budgetTokens。 */
      budgetMode: 'auto',
      budgetRatio: 0.01,
      budgetMin: 3000,
      budgetMax: 20000,
      /** 最近一次会话上报的上下文窗口（tok）；没有会话上报时预算线按它算。 */
      lastContextWindow: 0,
      /** 菜单（设置、装配窗口）开关时的淡入淡出时长（毫秒，0 = 即时）和背景模糊半径（px）。 */
      menuFadeMs: 140,
      menuBlurPx: 10,
      corner: true,
      /** 专注模式：目标开始后没用过的行变淡。默认关。 */
      focusMode: false,
      /** 新技能自动翻译：后台用 DSH 默认模型补中文名和说明。默认开。 */
      autoTranslate: true,
      /** 没有目标时用模型推断一个目标提议（点了才算数）。默认开。 */
      inferGoal: true,
      /**
       * 后台模型调用的总同意：'' 未决定（面板顶部出说明卡）| 'granted' | 'declined'。
       * 没同意之前，翻译 / 推断目标 / 灵感收集都不会自动调用模型（单项开关默认开，只在同意后生效）。
       */
      modelConsent: '',
      /** 每轮结束后自动收集灵感与分支（关键词预筛，命中才调模型）。默认开。 */
      collectIdeas: true,
      /** 合成音效：默认关（长时间开着干活的工具，声音默认开容易烦）。音量 0..1。 */
      sfx: false,
      sfxVolume: 0.6,
      pins: { skills: [], libs: [] },
      effects: visualEffects(),
      profiles: {},
      folds: {},
    }
    var prefsStore = { version: 0, listeners: new Set() }

    function clamp01(value) {
      return Math.min(1, Math.max(0, Number(value) || 0))
    }

    function loadPrefs() {
      try {
        var raw = window.localStorage.getItem(PREFS_KEY)
        if (raw) {
          var parsed = JSON.parse(raw)
          if (parsed && typeof parsed === 'object') {
            if (parsed.mode === 'performance' || parsed.mode === 'visual') prefs.mode = parsed.mode
            if (parsed.effects && typeof parsed.effects === 'object') {
              prefs.effects = normalizeEffects(parsed.effects, prefs.mode)
            } else {
              prefs.effects = effectsForMode(prefs.mode)
            }
            if (parsed.profiles && typeof parsed.profiles === 'object') prefs.profiles = parsed.profiles
            // 旧版本只有 gl / svg；全面接入工坊后统一迁移到 studio。
            if (parsed.contour === 'studio' || parsed.contour === 'off') prefs.contour = parsed.contour
            else if (parsed.contour) prefs.contour = 'studio'
            if (typeof parsed.surface === 'number') prefs.surface = clamp01(parsed.surface)
            if (parsed.folds && typeof parsed.folds === 'object') prefs.folds = Object.assign({}, parsed.folds)
            if (parsed.frost && typeof parsed.frost === 'object') {
              prefs.frost = Object.assign(frostDefaults(), parsed.frost)
              prefs.frost.blur = Math.min(32, Math.max(0, Number(prefs.frost.blur) || 0))
              prefs.frost.opacity = Math.min(0.3, Math.max(0, Number(prefs.frost.opacity) || 0))
              prefs.frost.saturation = Math.min(200, Math.max(100, Number(prefs.frost.saturation) || 100))
            }
            if (parsed.pricing && typeof parsed.pricing === 'object') {
              prefs.pricing = Object.assign(pricingDefaults(), parsed.pricing)
              prefs.pricing.inputPerM = Math.max(0, Number(prefs.pricing.inputPerM) || 0)
              prefs.pricing.outputPerM = Math.max(0, Number(prefs.pricing.outputPerM) || 0)
            }
            if (parsed.budgetMode === 'fixed' || parsed.budgetMode === 'auto') prefs.budgetMode = parsed.budgetMode
            if (parsed.budgetTokens != null) {
              var budgetTokens = Math.round(Number(parsed.budgetTokens))
              if (Number.isFinite(budgetTokens) && budgetTokens > 0) prefs.budgetTokens = budgetTokens
            }
            ;['budgetRatio', 'budgetMin', 'budgetMax', 'lastContextWindow', 'menuFadeMs', 'menuBlurPx'].forEach(function (key) {
              var n = Number(parsed[key])
              if (parsed[key] != null && Number.isFinite(n) && n >= 0) prefs[key] = n
            })
            if (parsed.corner != null) prefs.corner = parsed.corner !== false
            prefs.focusMode = parsed.focusMode === true
            prefs.autoTranslate = parsed.autoTranslate !== false
            prefs.inferGoal = parsed.inferGoal !== false
            prefs.collectIdeas = parsed.collectIdeas !== false
            if (parsed.modelConsent === 'granted' || parsed.modelConsent === 'declined') prefs.modelConsent = parsed.modelConsent
            prefs.sfx = parsed.sfx === true
            if (parsed.sfxVolume != null) prefs.sfxVolume = clamp01(parsed.sfxVolume)
            if (parsed.scheme === 'light' || parsed.scheme === 'dark') prefs.scheme = parsed.scheme
            if (parsed.pins && typeof parsed.pins === 'object') {
              prefs.pins = {
                skills: Array.isArray(parsed.pins.skills) ? parsed.pins.skills.filter(function (v) { return typeof v === 'string' }) : [],
                libs: Array.isArray(parsed.pins.libs) ? parsed.pins.libs.filter(function (v) { return typeof v === 'string' }) : [],
              }
            }
            if (parsed.studio && typeof parsed.studio === 'object') {
              var saved = parsed.studio
              var base = studioDefaults()
              prefs.studio = Object.assign(base, saved)
              prefs.studio.field = Object.assign(base.field, saved.field || {})
              prefs.studio.style = Object.assign(base.style, saved.style || {})
              // 旧默认 0.018 对“微动”来说偏快；一次性降到 0.006。
              if (prefs.studio.field.speed === 0.018) prefs.studio.field.speed = 0.006
            }
          }
        }
      } catch (error) {
        /* 隐私模式下 localStorage 不可用，保持默认 */
      }
    }

    function savePrefs() {
      try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
      } catch (error) {
        /* 存不了也不影响本次会话 */
      }
    }

    function notifyPrefs() {
      prefsStore.version += 1
      prefsStore.listeners.forEach(function (listener) {
        try {
          listener()
        } catch (error) {
          /* 单个订阅者失败不影响其他 */
        }
      })
    }

    function setPref(key, value) {
      prefs[key] = value
      savePrefs()
      notifyPrefs()
    }

    /** 只改工坊参数的一小块，保留其余字段；主题切换不能重置 motion/fps/未来字段。 */
    function setStudio(patch) {
      var base = prefs.studio && typeof prefs.studio === 'object' ? prefs.studio : studioDefaults()
      var next = Object.assign({}, base)
      next.field = Object.assign({}, base.field || {}, (patch && patch.field) || {})
      next.style = Object.assign({}, base.style || {}, (patch && patch.style) || {})
      if (patch) {
        Object.keys(patch).forEach(function (key) {
          if (key !== 'field' && key !== 'style') next[key] = patch[key]
        })
      }
      setPref('studio', next)
    }

    function captureProfile() {
      return {
        contour: prefs.contour,
        surface: prefs.surface,
        studio: JSON.parse(JSON.stringify(prefs.studio)),
        frost: JSON.parse(JSON.stringify(prefs.frost)),
        effects: normalizeEffects(prefs.effects, prefs.mode),
      }
    }

    function applyProfile(profile, mode) {
      var next = profile && typeof profile === 'object' ? profile : defaultProfile(mode)
      prefs.contour = next.contour === 'off' ? 'off' : 'studio'
      prefs.surface = clamp01(next.surface == null ? 0.45 : next.surface)
      var studio = next.studio && typeof next.studio === 'object' ? next.studio : studioDefaults()
      prefs.studio = Object.assign(studioDefaults(), studio)
      prefs.studio.field = Object.assign(studioDefaults().field, studio.field || {})
      prefs.studio.style = Object.assign(studioDefaults().style, studio.style || {})
      prefs.frost = Object.assign(frostDefaults(), next.frost || {})
      prefs.frost.blur = Math.min(32, Math.max(0, Number(prefs.frost.blur) || 0))
      prefs.frost.opacity = Math.min(0.3, Math.max(0, Number(prefs.frost.opacity) || 0))
      prefs.frost.saturation = Math.min(200, Math.max(100, Number(prefs.frost.saturation) || 100))
      prefs.effects = normalizeEffects(next.effects, mode)
    }

    /**
     * 切视效/性能模式：
     * 先保存当前模式的所有效果相关设置，再载入目标模式的存档；主题（黑白）作为全局偏好
     * 复制到目标，避免切模式把纸白/墨黑重置掉。
     */
    function switchMode(mode) {
      var target = mode === 'performance' ? 'performance' : 'visual'
      if (target === prefs.mode) return
      var profiles = Object.assign({}, prefs.profiles || {})
      profiles[prefs.mode] = captureProfile()
      var profile = profiles[target]
        ? JSON.parse(JSON.stringify(profiles[target]))
        : defaultProfile(target)
      var palette = {
        background: prefs.studio.style.background,
        color: prefs.studio.style.color,
        accentColor: prefs.studio.style.accentColor,
      }
      profile.studio = Object.assign({}, studioDefaults(), profile.studio || {})
      profile.studio.style = Object.assign({}, studioDefaults().style, profile.studio.style || {}, palette)
      profiles[target] = profile
      prefs.profiles = profiles
      prefs.mode = target
      applyProfile(profile, target)
      savePrefs()
      notifyPrefs()
    }

    function setEffect(id, enabled) {
      if (EFFECT_KEYS.indexOf(id) === -1) return
      var next = Object.assign({}, activeEffects())
      next[id] = Boolean(enabled)
      prefs.effects = next
      savePrefs()
      notifyPrefs()
    }

    function resetPrefs() {
      prefs.mode = 'visual'
      prefs.contour = 'studio'
      prefs.surface = 0.45
      prefs.studio = studioDefaults()
      prefs.frost = frostDefaults()
      prefs.effects = visualEffects()
      prefs.profiles = { performance: defaultProfile('performance') }
      prefs.folds = {}
      prefs.pricing = pricingDefaults()
      prefs.budgetMode = 'auto'
      prefs.budgetTokens = 3000
      prefs.budgetRatio = 0.01
      prefs.budgetMin = 3000
      prefs.budgetMax = 20000
      prefs.menuFadeMs = 140
      prefs.menuBlurPx = 10
      savePrefs()
      notifyPrefs()
    }

    /** 记住分组/库的展开状态；id 形如 `tools`、`lib:skill:addyosmani`。 */
    function setFold(id, open) {
      if (!id) return
      var next = Object.assign({}, prefs.folds)
      next[id] = open
      setPref('folds', next)
    }

    function setFrost(patch) {
      var next = Object.assign({}, frostDefaults(), prefs.frost, patch || {})
      next.blur = Math.min(32, Math.max(0, Number(next.blur) || 0))
      next.opacity = Math.min(0.3, Math.max(0, Number(next.opacity) || 0))
      next.saturation = Math.min(200, Math.max(100, Number(next.saturation) || 100))
      setPref('frost', next)
    }

    function setPricing(patch) {
      var next = Object.assign({}, pricingDefaults(), prefs.pricing, patch || {})
      next.inputPerM = Math.max(0, Number(next.inputPerM) || 0)
      next.outputPerM = Math.max(0, Number(next.outputPerM) || 0)
      setPref('pricing', next)
    }

    /** 手动锁定面板配色；传 auto 交还给 DSH 主题。 */
    function setPanelScheme(value) {
      prefs.scheme = value === 'light' || value === 'dark' ? value : 'auto'
      savePrefs()
      notifyPrefs()
      applyDshScheme()
    }

    function setStudioPalette(dark) {
      setStudio({
        style: dark
          ? { background: '#111416', color: '#b8bdbb', accentColor: '#ff7f00' }
          : { background: '#f4f2ed', color: '#434b50', accentColor: '#b9701a' },
      })
    }

    function usePrefs() {
      var pair = React.useState(prefsStore.version)
      var version = pair[0]
      var setVersion = pair[1]
      React.useEffect(function () {
        var sync = function () {
          setVersion(prefsStore.version)
        }
        prefsStore.listeners.add(sync)
        return function () {
          prefsStore.listeners.delete(sync)
        }
      }, [])
      return version
    }

    /**
     * 工坊连续场直接当面板背景。
     * 引擎从 Host 路由动态 import，不把 23KB 模块抄进 client.js。
     */
    function ContourStudioBackground() {
      var version = usePrefs()
      var canvasRef = React.useRef(null)
      var fieldRef = React.useRef(null)
      var prefsRef = React.useRef(prefs.studio)
      prefsRef.current = prefs.studio
      var failPair = React.useState('')
      var failed = failPair[0]
      var setFailed = failPair[1]

      React.useEffect(function () {
        var canvas = canvasRef.current
        if (!canvas) return undefined
        var motion = activeEffects().contourMotion
        var field
        try {
          field = ContourEngine.createContourField(
            Object.assign({}, prefsRef.current, {
              canvas: canvas,
              motion: motion,
              style: Object.assign({}, prefsRef.current.style, { tile: false }),
            }),
          )
        } catch (error) {
          setFailed(String((error && error.message) || error))
          return undefined
        }
        if (field.getState().backend !== 'webgl') {
          field.destroy()
          setFailed('WebGL unavailable')
          return undefined
        }
        fieldRef.current = field
        if (motion) field.start()
        else field.renderAt(0)
        return function () {
          field.destroy()
          fieldRef.current = null
        }
      }, [])

      React.useEffect(
        function () {
          if (!fieldRef.current) return
          var motion = activeEffects().contourMotion
          fieldRef.current.setOptions(
            Object.assign({}, prefsRef.current, {
              motion: motion,
              style: Object.assign({}, prefsRef.current.style, { tile: false }),
            }),
          )
          if (motion) fieldRef.current.start()
          else {
            fieldRef.current.stop()
            fieldRef.current.renderAt(0)
          }
        },
        [version],
      )

      if (failed) return h(ContourGL)

      var edgeFade = Math.min(0.4, Math.max(0, Number(prefs.studio.style.edgeFade) || 0.1))
      var fadePct = Math.min(40, Math.max(2, edgeFade * 200))
      var edgeMask =
        'radial-gradient(ellipse at center, #000 0%, #000 ' + (100 - fadePct) + '%, transparent 100%)'

      return h('canvas', {
        className: '__rp_studioCanvas',
        ref: canvasRef,
        'aria-hidden': 'true',
        title: failed || undefined,
        style: { maskImage: edgeMask, WebkitMaskImage: edgeMask },
      })
    }

