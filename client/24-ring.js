    /* ── 圆环统计（四个大类，实时按调用次数分） ────────────────────── */

    /** 圆环的口径：本轮有调用就用本轮，否则退回本会话累计。 */
    function ringModel(categories) {
      var roundSum = categories.reduce(function (sum, cat) {
        return sum + (cat.round || 0)
      }, 0)
      var totalSum = categories.reduce(function (sum, cat) {
        return sum + (cat.total || 0)
      }, 0)
      var basis = roundSum > 0 ? 'round' : 'total'
      return {
        basis: basis,
        sum: basis === 'round' ? roundSum : totalSum,
        roundSum: roundSum,
        totalSum: totalSum,
      }
    }

    function ringValue(cat, basis) {
      return basis === 'round' ? cat.round || 0 : cat.total || 0
    }

    /** 只有 SVG；尺寸与视差由外层负责，图例单独一排放在下面。 */
    function RingSvg(props) {
      var t = props.t
      var categories = props.categories || []
      var model = props.model
      var size = props.size || 190
      var budget = props.budget
      var active = props.active === true
      // 阶段：active 扫描、spent 余辉褪去、idle 心跳。老调用方只传 active 也能用。
      var phase = props.phase === 'active' || props.phase === 'spent' || props.phase === 'idle' ? props.phase : active ? 'active' : 'idle'
      var ignitePair = React.useState(false)
      var ignite = ignitePair[0]
      var setIgnite = ignitePair[1]
      var previousPhase = React.useRef(phase)
      React.useEffect(
        function () {
          var was = previousPhase.current
          previousPhase.current = phase
          if (phase !== 'active' || was === 'active') return undefined
          // 闲置 / 结束 → 工作：点燃一下（主圆盘才发声，右上角小圆盘不重复）。
          setIgnite(true)
          if (props.sound) sfxPlay('ignite')
          var timer = setTimeout(function () {
            setIgnite(false)
          }, 700)
          return function () {
            clearTimeout(timer)
          }
        },
        [phase],
      )
      // 首次打开：中间的数字逐位解码（约 0.5 s）。
      var decodePair = React.useState(props.intro ? 0 : -1)
      var decodeStep = decodePair[0]
      var setDecodeStep = decodePair[1]
      React.useEffect(
        function () {
          if (!props.intro) return undefined
          var step = 0
          var timer = setInterval(function () {
            step += 1
            setDecodeStep(step)
            if (step >= 10) clearInterval(timer)
          }, 110)
          return function () {
            clearInterval(timer)
          }
        },
        [props.intro],
      )
      var budgetPct = budget && budget.limit ? Math.min(100, Math.round((budget.chars / budget.limit) * 100)) : 0
      var budgetAngle = (budgetPct / 100) * 2 * Math.PI - Math.PI / 2
      var innerRadius = 27
      var innerCircumference = 2 * Math.PI * innerRadius
      var radius = 36
      var center = 50
      var stroke = 6.5
      var circumference = 2 * Math.PI * radius
      var gap = 2
      var offset = 0
      var segments = []

      categories.forEach(function (cat) {
        var value = ringValue(cat, model.basis)
        if (!value || !model.sum) return
        var fraction = value / model.sum
        var length = Math.max(0, fraction * circumference - gap)
        segments.push(
          h('circle', {
            key: cat.id,
            className: '__rp_ringSeg',
            'data-cat': cat.id,
            cx: center,
            cy: center,
            r: radius,
            fill: 'none',
            strokeWidth: stroke,
            strokeDasharray: length + ' ' + (circumference - length),
            strokeDashoffset: -offset,
            transform: 'rotate(-90 ' + center + ' ' + center + ')',
            strokeLinecap: 'butt',
          }),
        )
        offset += fraction * circumference
      })

      var summary = categories
        .map(function (cat) {
          return t('cat.' + cat.id) + ' ' + String(ringValue(cat, model.basis))
        })
        .join(' · ')

      // 同一页面里有主圆盘和右上角小圆盘，mask id 要各自唯一。
      var uid = React.useRef('rp' + Math.random().toString(36).slice(2, 8)).current
      var introId = uid + '-intro'
      // 内圈保持一整圈（1.0.20 起取消了三段缺口），扫描弧照常绕整圈跑。
      // 扫描弧：前端在 12 点方向（组内坐标），亮段 / 中段 / 拖尾依次往后，整组由 CSS 旋转。
      var sweepArc = function (deg, from, cls) {
        var len = (circumference * deg) / 360
        return h('circle', {
          className: cls,
          cx: center,
          cy: center,
          r: radius,
          fill: 'none',
          strokeWidth: stroke,
          strokeDasharray: len.toFixed(2) + ' ' + (circumference - len).toFixed(2),
          // 占 [-(from+deg), -from]：前端停在 -from，往后铺 deg 度。
          transform: 'rotate(' + (-90 - from - deg) + ' ' + center + ' ' + center + ')',
          strokeLinecap: 'butt',
        })
      }
      // 只在入场那段时间里显示解码字形；入场一结束（哪怕解码被拖慢、没走完）就回到真实数字，绝不停在乱码上。
      var ringNumber = props.intro && decodeStep >= 0 && decodeStep < 10 ? decodeText(String(model.sum), decodeStep, 10) : String(model.sum)

      return h(
        'svg',
        {
          className: '__rp_ringSvg',
          'data-active': active ? '1' : '0',
          'data-phase': phase,
          'data-ignite': ignite ? '1' : undefined,
          'data-intro': props.intro ? '1' : undefined,
          width: size,
          height: size,
          viewBox: '0 0 100 100',
          role: 'img',
          'aria-label': summary,
        },
        h(
          'defs',
          null,
          h(
            'radialGradient',
            { id: '__rp_coreGlow' },
            h('stop', { offset: '0%', stopColor: '#ffb25c', stopOpacity: '0.42' }),
            h('stop', { offset: '52%', stopColor: '#ff7f00', stopOpacity: '0.14' }),
            h('stop', { offset: '100%', stopColor: '#ff7f00', stopOpacity: '0' }),
          ),
          props.intro
            ? h(
                'mask',
                { id: introId, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 100, height: 100 },
                h('circle', { className: '__rp_ringIntroMask', cx: center, cy: center, r: 46.5, fill: 'none', stroke: '#fff', strokeWidth: 7, strokeDasharray: '302 302', transform: 'rotate(-90 ' + center + ' ' + center + ')' }),
              )
            : null,
        ),
        h('circle', { className: '__rp_ringCore', cx: center, cy: center, r: 23, fill: 'url(#__rp_coreGlow)' }),
        h(
          'g',
          { mask: props.intro ? 'url(#' + introId + ')' : undefined },
          h('circle', { className: '__rp_ringHair', cx: center, cy: center, r: 48.4, fill: 'none' }),
          h(
            'g',
            { className: '__rp_ringSpin' },
            h('circle', { className: '__rp_ringTickBand', cx: center, cy: center, r: 45.4, fill: 'none' }),
          ),
          h('circle', { className: '__rp_ringTicks', cx: center, cy: center, r: 47, fill: 'none' }),
        ),
        h('line', { className: '__rp_ringMark', x1: center, y1: 1.4, x2: center, y2: 4.6 }),
        h('circle', { className: '__rp_ringInnerHair', cx: center, cy: center, r: 20.5, fill: 'none' }),
        budget && budget.limit
          ? h('circle', {
              className: '__rp_budgetTrackInner',
              cx: center,
              cy: center,
              r: innerRadius,
              fill: 'none',
              strokeWidth: 1.4,
            })
          : null,
        budget && budget.limit
          ? h('circle', {
              className: '__rp_budgetArc',
              'data-warn': budgetPct >= 90 && budgetPct < 100 ? '1' : undefined,
              'data-over': budgetPct >= 100 ? '1' : undefined,
              cx: center,
              cy: center,
              r: innerRadius,
              fill: 'none',
              strokeWidth: 1.4,
              strokeDasharray:
                ((innerCircumference * budgetPct) / 100).toFixed(2) + ' ' + innerCircumference.toFixed(2),
              transform: 'rotate(-90 ' + center + ' ' + center + ')',
              strokeLinecap: 'butt',
            })
          : null,
        // 预算环按战术百分比圆盘画：亮外沿 + 前端白刻度。
        budget && budget.limit && budgetPct > 0
          ? h('circle', {
              className: '__rp_budgetEdge',
              cx: center,
              cy: center,
              r: innerRadius + 1.1,
              fill: 'none',
              strokeDasharray:
                ((2 * Math.PI * (innerRadius + 1.1) * budgetPct) / 100).toFixed(2) + ' ' + (2 * Math.PI * (innerRadius + 1.1)).toFixed(2),
              transform: 'rotate(-90 ' + center + ' ' + center + ')',
            })
          : null,
        budget && budget.limit && budgetPct > 0 && budgetPct < 100
          ? h('line', {
              className: '__rp_budgetTick',
              x1: (center + (innerRadius - 1.6) * Math.cos(budgetAngle)).toFixed(2),
              y1: (center + (innerRadius - 1.6) * Math.sin(budgetAngle)).toFixed(2),
              x2: (center + (innerRadius + 1.8) * Math.cos(budgetAngle)).toFixed(2),
              y2: (center + (innerRadius + 1.8) * Math.sin(budgetAngle)).toFixed(2),
            })
          : null,
        budget && budget.limit && budgetPct >= 100
          ? h('circle', { className: '__rp_overDot', cx: center, cy: center - innerRadius, r: 1.8 })
          : null,
        h(
          'g',
          null,
          h('circle', {
            className: '__rp_ringTrack',
            cx: center,
            cy: center,
            r: radius,
            fill: 'none',
            strokeWidth: stroke,
          }),
          segments,
          h('circle', { className: '__rp_ringFlash', cx: center, cy: center, r: radius, fill: 'none', strokeWidth: stroke }),
          h(
            'g',
            { className: '__rp_ringSweep', 'aria-hidden': 'true' },
            sweepArc(70, 62, '__rp_sweepTail'),
            sweepArc(40, 22, '__rp_sweepMid'),
            sweepArc(22, 0, '__rp_sweepLead'),
            h('line', { className: '__rp_sweepTick', x1: center, y1: center - radius - stroke / 2, x2: center, y2: center - radius + stroke / 2 }),
          ),
        ),
        h('text', { className: '__rp_ringNum', x: center, y: center - 3 }, ringNumber),
        h('text', { className: '__rp_ringCap', x: center, y: center + 7 }, t('ringCalls')),
        budget && budget.limit
          ? h(
              'text',
              { className: '__rp_ringBudget', x: center, y: center + 16 },
              t('budgetPct') + ' ' + Math.min(999, Math.round((budget.chars / budget.limit) * 100)) + '%',
            )
          : null,
      )
    }

    function RingLegend(props) {
      var t = props.t
      var categories = props.categories || []
      var model = props.model
      return h(
        'div',
        { className: '__rp_legend' },
        categories.map(function (cat) {
          return h(
            'div',
            { key: cat.id, className: '__rp_legendRow' },
            h('span', { className: '__rp_legendChip', 'data-cat': cat.id }),
            h('span', { className: '__rp_legendLabel' }, t('cat.' + cat.id)),
            h('span', { className: '__rp_legendValue' }, String(ringValue(cat, model.basis))),
          )
        }),
      )
    }

    /**
     * 鼠标在面板里移动时，圆盘按指针位置轻微倾斜；离开面板回到静止。
     * 直接写 CSS 变量 + rAF，不经过 React state —— 否则每次移动都会重渲染整棵树。
     * 尊重 prefers-reduced-motion 与 MOTION=off。
     */
    function useRingTilt(nodeRef) {
      var version = usePrefs()
      React.useEffect(
        function () {
          var node = nodeRef.current
          var host = panelRootEl
          if (!node || !host || typeof window === 'undefined') return undefined
          var frame = 0
          var last = null
          var target = { rx: 0, ry: 0 }
          var cur = { rx: 0, ry: 0 }
          var vel = { rx: 0, ry: 0 }
          var write = function () {
            node.style.setProperty('--rp-rx', cur.rx.toFixed(2) + 'deg')
            node.style.setProperty('--rp-ry', cur.ry.toFixed(2) + 'deg')
          }
          /* 弹簧：和终末地菜单同一套做法——目标角度变，速度追，停稳就退出 rAF。 */
          var tick = function () {
            var dx = target.rx - cur.rx
            var dy = target.ry - cur.ry
            vel.rx = (vel.rx + dx * 0.11) * 0.82
            vel.ry = (vel.ry + dy * 0.11) * 0.82
            cur.rx += vel.rx
            cur.ry += vel.ry
            var settled =
              Math.abs(dx) < 0.02 && Math.abs(dy) < 0.02 && Math.abs(vel.rx) < 0.02 && Math.abs(vel.ry) < 0.02
            if (settled) {
              cur.rx = target.rx
              cur.ry = target.ry
              vel.rx = 0
              vel.ry = 0
              write()
              frame = 0
              return
            }
            write()
            frame = requestAnimationFrame(tick)
          }
          var aim = function (rx, ry) {
            target.rx = rx
            target.ry = ry
            if (!frame) frame = requestAnimationFrame(tick)
          }
          var reset = function () {
            last = null
            aim(0, 0)
          }
          if (
            !activeEffects().tilt ||
            MOTION === 'off' ||
            (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
          ) {
            cur.rx = 0
            cur.ry = 0
            write()
            return undefined
          }
          var clamp = function (value) {
            return Math.max(-1, Math.min(1, value))
          }
          var move = function (event) {
            last = event
            var rect = node.getBoundingClientRect()
            if (!rect.width || !rect.height) return
            var dx = (last.clientX - rect.left) / rect.width - 0.5
            var dy = (last.clientY - rect.top) / rect.height - 0.5
            aim(-clamp(dy) * 13, clamp(dx) * 17)
          }
          host.addEventListener('pointermove', move)
          host.addEventListener('pointerleave', reset)
          return function () {
            host.removeEventListener('pointermove', move)
            host.removeEventListener('pointerleave', reset)
            if (frame) cancelAnimationFrame(frame)
            frame = 0
          }
        },
        [nodeRef, version],
      )
    }

