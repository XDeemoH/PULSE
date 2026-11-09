    /* ── 动效与音效：战术风格的圆盘状态、首次打开的马赛克显现、合成音效 ──────── */

    /**
     * 节奏参考加载圆盘、地图展开和菜单打开的录像（逐帧分析，见 CHANGELOG 1.0.18）。
     * - 圆盘：闲置时圆心心跳 + 12 点小亮标；工作时内圈三段、亮弧带拖尾每 1.2 s 扫一圈；
     *   闲置→工作「点燃」一下；结束时扫描在 1.5 s 内褪成余辉。
     * - 每次启动 DSH 第一次打开侧栏：各分区先成色块、再从马赛克变清晰，带一次过曝白闪，
     *   从上到下错开；圆盘外圈顺时针画出、数字逐位解码。之后不再播。
     * - 音效：Web Audio 现场合成，不带任何音频文件、不用游戏原声；默认关。
     * 全部尊重「性能模式 / 关闭动效 / 系统减少动态效果」。
     */

    CSS += '\n' + [
      /* 圆盘：12 点亮标、心跳、三段缺口、扫描、点燃闪光、预算环的亮外沿和前端刻度 */
      '.__rp_ringMark{stroke:var(--rp-amber);stroke-width:.8;opacity:.9}',
      '.__rp_ringInnerHair{stroke:color-mix(in srgb,var(--rp-amber) 70%,transparent);opacity:.24}',
      '.__rp_ringSvg[data-phase=idle] .__rp_ringInnerHair,.__rp_ringSvg[data-phase=spent] .__rp_ringInnerHair{animation:__rp_heart 2.4s ease-out infinite}',
      '@keyframes __rp_heart{0%,100%{opacity:.22}5%{opacity:.85}12%{opacity:.28}18%{opacity:.6}32%{opacity:.22}}',
      '.__rp_ringSweep{transform-origin:50px 50px;animation:__rp_ringSpin 1.2s linear infinite;opacity:1;transition:opacity 1.5s ease-out,visibility 0s linear 1.5s;visibility:visible}',
      '.__rp_ringSvg:not([data-phase=active]) .__rp_ringSweep{opacity:0;visibility:hidden}',
      '.__rp_ringSvg[data-phase=active] .__rp_ringSweep{transition:opacity .25s ease-out,visibility 0s}',
      '.__rp_sweepLead{stroke:var(--rp-amber);opacity:.95}',
      '.__rp_sweepMid{stroke:var(--rp-amber);opacity:.38}',
      '.__rp_sweepTail{stroke:var(--rp-amber);opacity:.14}',
      '.__rp_sweepTick{stroke:#fff;stroke-width:.7;opacity:.95}',
      '.__rp_ringFlash{stroke:var(--rp-amber);opacity:0;pointer-events:none}',
      '.__rp_ringSvg[data-ignite="1"] .__rp_ringFlash{animation:__rp_ignite .7s cubic-bezier(.2,.7,.3,1) both}',
      '.__rp_ringSvg[data-ignite="1"] .__rp_ringCore{animation:__rp_igniteCore .7s ease-out both}',
      '@keyframes __rp_ignite{0%{opacity:.9;stroke-width:9}100%{opacity:0;stroke-width:6.5}}',
      '@keyframes __rp_igniteCore{0%{opacity:1}100%{opacity:.85}}',
      '.__rp_budgetEdge{stroke:var(--rp-amber);stroke-width:.35;opacity:.95}',
      '.__rp_budgetTick{stroke:#fff;stroke-width:.6;opacity:.9}',
      /* 首次打开：圆盘外圈顺时针画出 */
      '.__rp_ringSvg[data-intro="1"] .__rp_ringIntroMask{animation:__rp_ringDraw 1.6s cubic-bezier(.3,.6,.2,1) .25s both}',
      '@keyframes __rp_ringDraw{from{stroke-dashoffset:302}to{stroke-dashoffset:0}}',
      /* 首次打开：分区的马赛克显现（只改动画名 / 时长 / 曲线，保留原有的逐个延迟） */
      /* 1.0.20：放慢到约 2 s——先是 0.25 s 的空玻璃，再逐块（每块隔 90 ms）由色块变清晰。 */
      '.__rp_root[data-reveal="1"] .__rp_inner > *{animation-name:__rp_mosaicIn;animation-duration:1.5s;animation-timing-function:steps(6,end)}',
      ...[1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return '.__rp_root[data-reveal="1"] .__rp_inner > *:nth-child(' + n + '){animation-delay:' + (250 + (n - 1) * 90) + 'ms}' }),
      '.__rp_root[data-reveal="1"] .__rp_inner > *:nth-child(n+9){animation-delay:950ms}',
      '@keyframes __rp_mosaicIn{0%{opacity:0;filter:brightness(2.8) saturate(0) blur(5px)}12%{opacity:.9;filter:brightness(2.6) saturate(0) blur(4px)}30%{opacity:1;filter:brightness(2) saturate(.2) blur(3px)}60%{filter:brightness(1.35) saturate(.6) blur(1.4px)}85%{filter:brightness(1.08) saturate(.9) blur(.4px)}100%{opacity:1;filter:none}}',
      '.__rp_pxDefs{position:absolute;width:0;height:0;overflow:hidden}',
      /* 关掉动效时：扫描停在一个静止的亮弧，心跳和点燃都不播 */
      '.__rp_root[data-motion=off] .__rp_ringSweep,.__rp_root[data-performance="1"] .__rp_ringSweep{animation:none}',
      '.__rp_root[data-motion=off] .__rp_ringInnerHair,.__rp_root[data-effect-status="off"] .__rp_ringInnerHair{animation:none!important}',
      '.__rp_root[data-effect-reveal="off"][data-reveal="1"] .__rp_inner > *{animation:none!important}',
      '@media (prefers-reduced-motion:reduce){.__rp_ringSweep,.__rp_ringInnerHair,.__rp_ringFlash,.__rp_ringIntroMask{animation:none!important}.__rp_root[data-reveal="1"] .__rp_inner > *{animation:none!important}}',
    ].join('\n')

    /* ── 首次打开（每次启动 DSH 一次） ─────────────────────────────────── */

    var revealPlayed = false
    var REVEAL_START = 250
    var REVEAL_STEP = 150
    var REVEAL_TOTAL = 2100
    var REVEAL_KEY = '__rp_revealed'

    /**
     * 「每次启动 DSH 只播一次」：模块变量管同一次加载；sessionStorage 管侧栏被拆掉重挂、
     * 页面被刷新的情况（DSH 重启后 sessionStorage 是新的，所以下次启动还会播）。
     */
    function revealAlreadyPlayed() {
      if (revealPlayed) return true
      try {
        return window.sessionStorage && window.sessionStorage.getItem(REVEAL_KEY) === '1'
      } catch (error) {
        return false
      }
    }

    function markRevealPlayed() {
      revealPlayed = true
      try {
        if (window.sessionStorage) window.sessionStorage.setItem(REVEAL_KEY, '1')
      } catch (error) {
        /* 存不了就只靠模块变量 */
      }
    }

    function revealAllowed() {
      try {
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
      } catch (error) {
        /* 老环境没有 matchMedia */
      }
      return activeEffects().reveal !== false
    }

    /**
     * 侧栏面板第一次拿到快照时返回 true（约 2 s），之后一直 false。
     * 马赛克：.__rp_inner 套一个 SVG 像素化滤镜，格子从 20px 逐级降到 2px 再撤掉。
     */
    function useFirstReveal(ready) {
      var pair = React.useState(false)
      var on = pair[0]
      var setOn = pair[1]
      React.useEffect(
        function () {
          if (!ready || revealAlreadyPlayed()) return undefined
          markRevealPlayed()
          if (!revealAllowed()) return undefined
          setOn(true)
          sfxPlay('open')
          // 1.0.20：格子 20 → 2 px 分 8 级，从 0.25 s 起每 150 ms 一级，整个显现约 2 s。
          var sizes = [20, 16, 12, 9, 6, 4, 3, 2]
          var timers = sizes.map(function (size, index) {
            return setTimeout(function () {
              setPixelSize(size)
            }, REVEAL_START + index * REVEAL_STEP)
          })
          timers.push(
            setTimeout(function () {
              setOn(false)
            }, REVEAL_TOTAL),
          )
          return function () {
            timers.forEach(clearTimeout)
          }
        },
        [ready],
      )
      return on
    }

    /** 像素化滤镜：flood 一个小方块 → 平铺成网格采样 → 膨胀回格子大小。 */
    function setPixelSize(size) {
      try {
        var flood = document.getElementById('__rp_pxFlood')
        var composite = document.getElementById('__rp_pxTileSize')
        var dilate = document.getElementById('__rp_pxDilate')
        if (!flood || !composite || !dilate) return
        var half = Math.max(1, Math.floor(size / 2))
        flood.setAttribute('x', String(half))
        flood.setAttribute('y', String(half))
        composite.setAttribute('width', String(size))
        composite.setAttribute('height', String(size))
        dilate.setAttribute('radius', String(half))
      } catch (error) {
        /* 滤镜只是装饰 */
      }
    }

    function PixelateDefs() {
      return h(
        'svg',
        { className: '__rp_pxDefs', 'aria-hidden': 'true', focusable: 'false' },
        h(
          'filter',
          { id: '__rp_px', x: '0', y: '0', width: '100%', height: '100%' },
          h('feFlood', { id: '__rp_pxFlood', x: '10', y: '10', width: '2', height: '2' }),
          h('feComposite', { id: '__rp_pxTileSize', width: '20', height: '20' }),
          h('feTile', { result: 'grid' }),
          h('feComposite', { in: 'SourceGraphic', in2: 'grid', operator: 'in' }),
          h('feMorphology', { id: '__rp_pxDilate', operator: 'dilate', radius: '10' }),
        ),
      )
    }

    /* ── 圆盘数字的逐位解码（首次打开时） ──────────────────────────────── */

    var DECODE_GLYPHS = '0123456789#%/<>'

    /** step 0..steps：已经「解开」的位从左往右增加，其余位显示随机字形。 */
    function decodeText(text, step, steps, random) {
      var value = String(text)
      var rnd = typeof random === 'function' ? random : Math.random
      if (step >= steps) return value
      var settled = Math.floor((step / steps) * value.length)
      var out = ''
      for (var i = 0; i < value.length; i += 1) {
        out += i < settled ? value.charAt(i) : DECODE_GLYPHS.charAt(Math.floor(rnd() * DECODE_GLYPHS.length))
      }
      return out
    }

    /* ── 合成音效 ───────────────────────────────────────────────────────── */

    var sfxState = { ctx: null, last: {} }

    function sfxEnabled() {
      return prefs.sfx === true && (Number(prefs.sfxVolume) || 0) > 0
    }

    function sfxContext() {
      if (sfxState.ctx) return sfxState.ctx
      var Ctor = window.AudioContext || window.webkitAudioContext
      if (!Ctor) return null
      try {
        sfxState.ctx = new Ctor()
      } catch (error) {
        sfxState.ctx = null
      }
      return sfxState.ctx
    }

    /** 一个音：振荡器 + 指数衰减包络。freq 可以是 [起, 止] 做滑音。 */
    function sfxTone(ctx, out, at, options) {
      var osc = ctx.createOscillator()
      var gain = ctx.createGain()
      osc.type = options.type || 'sine'
      var from = Array.isArray(options.freq) ? options.freq[0] : options.freq
      var to = Array.isArray(options.freq) ? options.freq[1] : options.freq
      osc.frequency.setValueAtTime(from, at)
      if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + options.dur)
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(options.gain, at + Math.min(0.006, options.dur / 4))
      gain.gain.exponentialRampToValueAtTime(0.0001, at + options.dur)
      osc.connect(gain)
      gain.connect(out)
      osc.start(at)
      osc.stop(at + options.dur + 0.02)
    }

    /** 一段带通滤波噪声（气流 / 扫描声）。 */
    function sfxNoise(ctx, out, at, options) {
      var length = Math.ceil(ctx.sampleRate * options.dur)
      var buffer = ctx.createBuffer(1, length, ctx.sampleRate)
      var data = buffer.getChannelData(0)
      for (var i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1
      var src = ctx.createBufferSource()
      src.buffer = buffer
      var filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.Q.value = options.q || 1.2
      filter.frequency.setValueAtTime(options.from, at)
      filter.frequency.exponentialRampToValueAtTime(options.to, at + options.dur)
      var gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(options.gain, at + options.dur * 0.3)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + options.dur)
      src.connect(filter)
      filter.connect(gain)
      gain.connect(out)
      src.start(at)
      src.stop(at + options.dur + 0.02)
    }

    /** 音色表：都很短、偏高频、不刺耳。gain 是相对值，再乘总音量。 */
    var SFX = {
      click: function (ctx, out, t0) {
        sfxTone(ctx, out, t0, { freq: [2600, 1900], dur: 0.035, gain: 0.5, type: 'sine' })
      },
      expand: function (ctx, out, t0) {
        sfxTone(ctx, out, t0, { freq: 880, dur: 0.05, gain: 0.35, type: 'triangle' })
        sfxTone(ctx, out, t0 + 0.055, { freq: 1320, dur: 0.06, gain: 0.35, type: 'triangle' })
      },
      collapse: function (ctx, out, t0) {
        sfxTone(ctx, out, t0, { freq: 1320, dur: 0.05, gain: 0.3, type: 'triangle' })
        sfxTone(ctx, out, t0 + 0.055, { freq: 880, dur: 0.06, gain: 0.3, type: 'triangle' })
      },
      open: function (ctx, out, t0) {
        sfxNoise(ctx, out, t0, { from: 380, to: 2400, dur: 0.32, gain: 0.35, q: 0.9 })
        sfxTone(ctx, out, t0 + 0.24, { freq: 1600, dur: 0.07, gain: 0.4, type: 'sine' })
        sfxTone(ctx, out, t0 + 0.33, { freq: 2400, dur: 0.05, gain: 0.25, type: 'sine' })
      },
      done: function (ctx, out, t0) {
        sfxTone(ctx, out, t0, { freq: 990, dur: 0.09, gain: 0.35, type: 'sine' })
        sfxTone(ctx, out, t0 + 0.085, { freq: 1480, dur: 0.14, gain: 0.35, type: 'sine' })
      },
      ignite: function (ctx, out, t0) {
        sfxTone(ctx, out, t0, { freq: [110, 165], dur: 0.32, gain: 0.55, type: 'sine' })
        sfxNoise(ctx, out, t0, { from: 300, to: 900, dur: 0.22, gain: 0.12, q: 2 })
      },
    }

    /** 播一个音效。没开、没有 AudioContext、或者同一个音 60 ms 内重复，都直接返回 false。 */
    function sfxPlay(name) {
      if (!sfxEnabled() || !SFX[name]) return false
      var ctx = sfxContext()
      if (!ctx) return false
      var now = Date.now()
      if (sfxState.last[name] && now - sfxState.last[name] < 60) return false
      sfxState.last[name] = now
      try {
        if (ctx.state === 'suspended' && typeof ctx.resume === 'function') ctx.resume()
        var master = ctx.createGain()
        master.gain.value = Math.min(1, Math.max(0, Number(prefs.sfxVolume) || 0)) * 0.35
        master.connect(ctx.destination)
        SFX[name](ctx, master, ctx.currentTime + 0.005)
        return true
      } catch (error) {
        return false
      }
    }

    /**
     * 面板根节点上的点击委托：按钮 / role=button 发一声「嗒」。
     * 展开收起、完成之类自己发声的地方会在事件上打标记，这里就不再重复。
     */
    function sfxClickDelegate(event) {
      if (!sfxEnabled()) return
      var native = event && event.nativeEvent
      if (native && native.__rpSfx) return
      var target = event && event.target
      var hit = target && typeof target.closest === 'function' ? target.closest('button,[role=button],summary,input[type=checkbox]') : null
      if (hit && !hit.disabled) sfxPlay('click')
    }

    /** 自己发声的交互调用它：播指定音效，并让根节点的点击委托跳过这一次。 */
    function sfxFor(event, name) {
      if (event && event.nativeEvent) event.nativeEvent.__rpSfx = true
      return sfxPlay(name)
    }

    /** 设置窗口里的音效一行：开关 + 音量 + 试听。 */
    function SfxSettings(props) {
      var t = props.t
      var on = prefs.sfx === true
      return h(
        'div',
        { className: '__rp_sheetRow', style: { flexDirection: 'column', alignItems: 'stretch', gap: '6px' } },
        h(
          'label',
          { className: '__rp_checkRow', style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          h('input', {
            type: 'checkbox',
            name: 'rp-sfx',
            'aria-label': t('sfxToggle'),
            checked: on,
            onChange: function (event) {
              setPref('sfx', event.target.checked)
              if (event.target.checked) sfxPlay('open')
            },
          }),
          h('span', { className: '__rp_sheetLabel' }, t('sfxToggle')),
        ),
        on
          ? h(StudioSlider, {
              label: t('sfxVolume'),
              text: Math.round((Number(prefs.sfxVolume) || 0) * 100) + '%',
              min: 0,
              max: 1,
              step: 0.05,
              value: Number(prefs.sfxVolume) || 0,
              onChange: function (value) {
                setPref('sfxVolume', value)
              },
            })
          : null,
        on
          ? h(
              'div',
              { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } },
              ['click', 'expand', 'collapse', 'open', 'done', 'ignite'].map(function (name) {
                return h(
                  'button',
                  {
                    key: name,
                    type: 'button',
                    className: '__rp_goalBtn',
                    onClick: function () {
                      sfxPlay(name)
                    },
                  },
                  t('sfx.' + name),
                )
              }),
            )
          : null,
      )
    }
