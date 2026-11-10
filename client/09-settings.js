    /* ── 显示设置面板 ────────────────────────────────────────────────── */

    var uiStore = {
      open: false,
      version: 0,
      listeners: new Set(),
      set: function (value) {
        uiStore.open = value
        uiStore.version += 1
        uiStore.listeners.forEach(function (listener) {
          try {
            listener()
          } catch (error) {
            /* 单个订阅者失败不影响其他 */
          }
        })
      },
    }

    function useUiVersion() {
      var pair = React.useState(uiStore.version)
      var setVersion = pair[1]
      React.useEffect(function () {
        var sync = function () {
          setVersion(uiStore.version)
        }
        uiStore.listeners.add(sync)
        return function () {
          uiStore.listeners.delete(sync)
        }
      }, [])
      return pair[0]
    }

    /** 只有它订阅 uiStore，齿轮点下去才会真的重渲染。 */
    function SettingsHost(props) {
      useUiVersion()
      if (!uiStore.open) return null
      var sheet = h(SettingsSheet, { t: props.t })
      // 设置浮层必须挂到 body：面板里父级有 transform/动画，会把 fixed + z-index
      // 关在一个低层 stacking context 里，底下的列表就会画到浮层上面。
      if (ReactDOM && typeof ReactDOM.createPortal === 'function' && typeof document !== 'undefined' && document.body) {
        return ReactDOM.createPortal(sheet, document.body)
      }
      return sheet
    }

    function StudioSlider(props) {
      return h(
        'div',
        { className: '__rp_sheetRow __rp_sheetRowStack' },
        h(
          'div',
          { className: '__rp_sheetLabelRow' },
          h('span', { className: '__rp_sheetLabel' }, props.label),
          h('span', { className: '__rp_sheetValue' }, props.text),
        ),
        h('input', {
          type: 'range',
          className: '__rp_range',
          name: 'rp-studio-slider',
          'aria-label': props.label,
          min: props.min,
          max: props.max,
          step: props.step,
          value: props.value,
          onChange: function (event) {
            props.onChange(Number(event.target.value))
          },
        }),
      )
    }

    function SettingsFold(props) {
      var initialOpen =
        typeof prefs.folds[props.id] === 'boolean' ? prefs.folds[props.id] : props.defaultOpen === true
      var pair = React.useState(initialOpen)
      var open = pair[0]
      var setOpen = pair[1]
      return h(
        'div',
        { className: '__rp_setFold' },
        h(
          'button',
          {
            type: 'button',
            className: '__rp_setFoldHead',
            'aria-expanded': open ? 'true' : 'false',
            onClick: function (event) {
              var next = !open
              sfxFor(event, next ? 'expand' : 'collapse')
              setOpen(next)
              setFold(props.id, next)
            },
          },
          h('span', { className: '__rp_caret', 'aria-hidden': 'true' }, open ? '▾' : '▸'),
          h('span', null, props.title),
        ),
        open ? h('div', { className: '__rp_setFoldBody' }, props.children) : null,
      )
    }

    function FrostSettings(props) {
      var t = props.t
      usePrefs()
      var frost = prefs.frost
      return h(
        'div',
        { className: '__rp_studioSettings' },
        h(
          'label',
          { className: '__rp_sheetRow __rp_checkRow' },
          h('input', {
            type: 'checkbox',
            name: 'rp-frost-enabled',
            checked: frost.enabled,
            onChange: function (event) {
              setFrost({ enabled: event.target.checked })
            },
          }),
          h('span', { className: '__rp_sheetLabel' }, t('frostEnabled')),
        ),
        h(StudioSlider, {
          label: t('frostBlur'),
          text: String(Math.round(frost.blur)) + ' px',
          min: 0,
          max: 32,
          step: 1,
          value: frost.blur,
          onChange: function (value) {
            setFrost({ blur: value })
          },
        }),
        h(StudioSlider, {
          label: t('frostOpacity'),
          text: Math.round(frost.opacity * 100) + '%',
          min: 0,
          max: 0.3,
          step: 0.01,
          value: frost.opacity,
          onChange: function (value) {
            setFrost({ opacity: value })
          },
        }),
        h(StudioSlider, {
          label: t('frostSaturation'),
          text: String(Math.round(frost.saturation)) + '%',
          min: 100,
          max: 200,
          step: 5,
          value: frost.saturation,
          onChange: function (value) {
            setFrost({ saturation: value })
          },
        }),
        h('div', { className: '__rp_sheetHint' }, t('frostHint')),
      )
    }

    function PricingSettings(props) {
      var t = props.t
      usePrefs()
      var pricing = prefs.pricing
      return h(
        'div',
        { className: '__rp_studioSettings' },
        h('div', { className: '__rp_sheetHint' }, t('pricingHint')),
        h(
          'div',
          { className: '__rp_sheetRow' },
          h('span', { className: '__rp_sheetLabel' }, t('pricingInput')),
          h('div', { className: '__rp_priceRow' },
            h('input', {
              type: 'number',
              className: '__rp_priceInput',
              name: 'rp-pricing-input',
              'aria-label': t('pricingInput'),
              min: 0,
              step: 0.01,
              value: pricing.inputPerM,
              onChange: function (event) {
                setPricing({ inputPerM: Number(event.target.value) || 0 })
              },
            }),
            h('span', { className: '__rp_priceUnit' }, t('pricingUnit')),
          ),
        ),
        h(
          'div',
          { className: '__rp_sheetRow' },
          h('span', { className: '__rp_sheetLabel' }, t('pricingOutput')),
          h('div', { className: '__rp_priceRow' },
            h('input', {
              type: 'number',
              className: '__rp_priceInput',
              name: 'rp-pricing-output',
              'aria-label': t('pricingOutput'),
              min: 0,
              step: 0.01,
              value: pricing.outputPerM,
              onChange: function (event) {
                setPricing({ outputPerM: Number(event.target.value) || 0 })
              },
            }),
            h('span', { className: '__rp_priceUnit' }, t('pricingUnit')),
          ),
        ),
      )
    }

    /**
     * 预算线设置：软目标，只影响提示，不触发任何停用。
     * 自动档把规则（比例、下限、上限）摊开给人看，并说清窗口大小从哪来、代入几档窗口是多少。
     */
    function BudgetSettings(props) {
      var t = props.t
      usePrefs()
      var auto = prefs.budgetMode !== 'fixed'
      var rule = budgetRule()
      var win = budgetWindow()
      var limit = budgetLimitTokens()
      var numberRow = function (key, label, value, min, max, step, onValue, dim) {
        return h(
          'div',
          { key: key, className: '__rp_sheetRow', style: dim ? { opacity: 0.55 } : undefined },
          h('span', { className: '__rp_sheetLabel' }, label),
          h(
            'div',
            { className: '__rp_priceRow' },
            h('input', {
              type: 'number',
              className: '__rp_priceInput',
              name: 'rp-' + key,
              'aria-label': label,
              min: min,
              max: max,
              step: step,
              value: value,
              onChange: function (event) {
                var n = Math.round(Number(event.target.value))
                if (Number.isFinite(n) && n > 0) onValue(Math.min(max, Math.max(min, n)))
              },
            }),
            h('span', { className: '__rp_priceUnit' }, 'tok'),
          ),
        )
      }
      var status = !auto
        ? t('budgetFixedHint')
        : win.source === 'none'
          ? fill(t('budgetAutoUnknown'), 'n', formatTokens(limit))
          : fill(fill(fill(fill(fill(t(win.source === 'live' ? 'budgetAutoLive' : 'budgetAutoRemembered'), 'window', formatTokens(win.tokens)), 'pct', budgetPct(rule.ratio)), 'raw', formatTokens(Math.round(win.tokens * rule.ratio))), 'range', formatTokens(rule.min) + '～' + formatTokens(rule.max)), 'n', formatTokens(limit))
      var examples = [['128k', 128000], ['512k', 512000], ['1M', 1000000], ['2M', 2000000]].map(function (pair) {
        return pair[0] + ' → ' + formatTokens(autoBudgetTokens(pair[1]))
      })
      return h(
        'div',
        { className: '__rp_studioSettings' },
        h('div', { className: '__rp_sheetHint' }, t('budgetHint')),
        h(
          'div',
          { className: '__rp_sheetRow' },
          h('span', { className: '__rp_sheetLabel' }, t('budgetModeLabel')),
          h(
            'div',
            { className: '__rp_seg' },
            [['auto', t('budgetModeAuto')], ['fixed', t('budgetModeFixed')]].map(function (mode) {
              return h('button', { key: mode[0], type: 'button', 'aria-pressed': (auto ? 'auto' : 'fixed') === mode[0] ? 'true' : 'false', onClick: function () { setPref('budgetMode', mode[0]) } }, mode[1])
            }),
          ),
        ),
        h('div', { className: '__rp_sheetHint __rp_budgetStatus' }, status),
        auto
          ? h(StudioSlider, {
              label: t('budgetRatio'),
              text: budgetPct(rule.ratio),
              min: 0.0025,
              max: 0.03,
              step: 0.0025,
              value: rule.ratio,
              onChange: function (value) { setPref('budgetRatio', Math.round(value * 10000) / 10000) },
            })
          : null,
        auto ? numberRow('budget-min', t('budgetMin'), rule.min, 500, 100000, 500, function (n) { setPref('budgetMin', n); if (n > rule.max) setPref('budgetMax', n) }) : null,
        auto ? numberRow('budget-max', t('budgetMax'), rule.max, 1000, 200000, 1000, function (n) { setPref('budgetMax', Math.max(n, rule.min)) }) : null,
        auto ? h('div', { className: '__rp_sheetHint' }, fill(t('budgetExamples'), 'list', examples.join(' · '))) : null,
        numberRow('budget-tokens', auto ? t('budgetFallback') : t('budgetTarget'), prefs.budgetTokens, 500, 200000, 100, function (n) { setPref('budgetTokens', n) }, auto),
      )
    }
    function budgetPct(ratio) {
      return Math.round(ratio * 10000) / 100 + '%'
    }

    /** 菜单（设置、装配窗口）开关的淡入淡出时长与背景模糊。 */
    function menuFadeMs() {
      var n = Number(prefs.menuFadeMs)
      return Number.isFinite(n) ? Math.max(0, Math.min(600, Math.round(n))) : 140
    }
    function menuBlurPx() {
      var n = Number(prefs.menuBlurPx)
      return Number.isFinite(n) ? Math.max(0, Math.min(24, Math.round(n))) : 10
    }
    function menuMotionStyle() {
      return { '--rp-menu-fade': menuFadeMs() + 'ms', '--rp-menu-blur': menuBlurPx() + 'px' }
    }
    /** 关菜单时先淡出再卸载；时长为 0 时立刻关。返回 [正在关, 请求关闭]。 */
    function useMenuClose(close) {
      var pair = React.useState(false)
      var timer = React.useRef(0)
      var closeRef = React.useRef(close)
      closeRef.current = close
      React.useEffect(function () {
        return function () { clearTimeout(timer.current) }
      }, [])
      var request = function () {
        if (pair[0]) return
        var ms = menuFadeMs()
        if (!ms) {
          closeRef.current()
          return
        }
        pair[1](true)
        timer.current = setTimeout(function () { closeRef.current() }, ms)
      }
      return [pair[0], request]
    }
    function MenuMotionSettings(props) {
      var t = props.t
      usePrefs()
      var ms = menuFadeMs()
      return h(
        'div',
        { className: '__rp_studioSettings' },
        h(StudioSlider, {
          label: t('menuFade'),
          text: ms ? ms + ' ms' : t('menuFadeInstant'),
          min: 0,
          max: 600,
          step: 20,
          value: ms,
          onChange: function (value) { setPref('menuFadeMs', value) },
        }),
        h(StudioSlider, {
          label: t('menuBlur'),
          text: menuBlurPx() ? menuBlurPx() + ' px' : t('menuBlurOff'),
          min: 0,
          max: 24,
          step: 1,
          value: menuBlurPx(),
          onChange: function (value) { setPref('menuBlurPx', value) },
        }),
        h('div', { className: '__rp_sheetHint' }, t('menuMotionHint')),
      )
    }

    var CONTOUR_WORKSHOP_URL = 'https://xdeemoh.github.io/contour-workshop/' // online version (GitHub Pages); source: https://github.com/XDeemoH/contour-workshop

    /** 设置浮层里的「等高线设置」：直接改 prefs.studio，背景实时重绘。 */
    function ContourStudioSettings(props) {
      var t = props.t
      usePrefs()
      var studio = prefs.studio
      var field = studio.field
      var style = studio.style
      var setField = function (patch) {
        setStudio({ field: patch })
      }
      var setStyle = function (patch) {
        setStudio({ style: patch })
      }
      var palette = function (dark) {
        setStudioPalette(dark)
      }
      var percent = function (value) {
        return Math.round(value * 100) + '%'
      }
      return h(
        SettingsFold,
        { id: 'settings:studio', title: t('studioSection'), defaultOpen: true },
        h(
          'div',
          { className: '__rp_studioSettings' },
        h(
          'div',
          { className: '__rp_sheetRow' },
          h('span', { className: '__rp_sheetLabel' }, t('studioPalette')),
          h(
            'div',
            { className: '__rp_seg' },
            h(
              'button',
              {
                type: 'button',
                className: '__rp_segBtn',
                'data-on': String(style.background || '').toLowerCase() === '#111416' ? '1' : undefined,
                onClick: function () {
                  palette(true)
                },
              },
              t('studioDark'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: '__rp_segBtn',
                'data-on': String(style.background || '').toLowerCase() === '#f4f2ed' ? '1' : undefined,
                onClick: function () {
                  palette(false)
                },
              },
              t('studioLight'),
            ),
          ),
        ),
        h(
          'div',
          { className: '__rp_sheetRow' },
          h('span', { className: '__rp_sheetLabel' }, t('studioSeed')),
          h(
            'div',
            { className: '__rp_seedRow' },
            h('input', {
              type: 'number',
              className: '__rp_seedInput',
              name: 'rp-studio-seed',
              'aria-label': t('studioSeed'),
              min: 0,
              max: 999999,
              value: field.seed,
              onChange: function (event) {
                setField({ seed: Math.max(0, Math.min(999999, Math.floor(Number(event.target.value) || 0))) })
              },
            }),
            h(
              'button',
              {
                type: 'button',
                className: '__rp_linkBtn',
                onClick: function () {
                  setField({ seed: Math.floor(Math.random() * 1000000) })
                },
              },
              t('studioReroll'),
            ),
          ),
        ),
        h(StudioSlider, {
          label: t('studioSurface'),
          text: percent(prefs.surface),
          min: 0,
          max: 1,
          step: 0.01,
          value: prefs.surface,
          onChange: function (value) {
            setPref('surface', value)
          },
        }),
        h(StudioSlider, {
          label: t('studioSpeed'),
          text: field.speed.toFixed(3),
          min: 0,
          max: 0.05,
          step: 0.001,
          value: field.speed,
          onChange: function (value) {
            setField({ speed: value })
          },
        }),
        h(StudioSlider, {
          label: t('studioEdge'),
          text: percent(style.edgeFade),
          min: 0.02,
          max: 0.3,
          step: 0.01,
          value: style.edgeFade,
          onChange: function (value) {
            setStyle({ edgeFade: value })
          },
        }),
        h(StudioSlider, {
          label: t('studioScale'),
          text: field.scale[0].toFixed(1),
          min: 1,
          max: 7,
          step: 0.1,
          value: field.scale[0],
          onChange: function (value) {
            setField({ scale: [value, Math.round(value * 1.333 * 100) / 100] })
          },
        }),
        h(StudioSlider, {
          label: t('studioBands'),
          text: String(field.bands),
          min: 10,
          max: 80,
          step: 1,
          value: field.bands,
          onChange: function (value) {
            setField({ bands: value })
          },
        }),
        h(StudioSlider, {
          label: t('studioWarp'),
          text: field.warp.toFixed(2),
          min: 0,
          max: 3,
          step: 0.05,
          value: field.warp,
          onChange: function (value) {
            setField({ warp: value })
          },
        }),
        h(StudioSlider, {
          label: t('studioOctaves'),
          text: String(field.octaves),
          min: 1,
          max: 5,
          step: 1,
          value: field.octaves,
          onChange: function (value) {
            setField({ octaves: value })
          },
        }),
        h(StudioSlider, {
          label: t('studioLineWidth'),
          text: style.lineWidth.toFixed(2) + ' px',
          min: 0.35,
          max: 2,
          step: 0.05,
          value: style.lineWidth,
          onChange: function (value) {
            setStyle({ lineWidth: value })
          },
        }),
        h(StudioSlider, {
          label: t('studioAlpha'),
          text: percent(style.alpha),
          min: 0.02,
          max: 1,
          step: 0.01,
          value: style.alpha,
          onChange: function (value) {
            setStyle({ alpha: value })
          },
        }),
        h(StudioSlider, {
          label: t('studioAccent'),
          text: percent(style.accent),
          min: 0,
          max: 1,
          step: 0.01,
          value: style.accent,
          onChange: function (value) {
            setStyle({ accent: value })
          },
        }),
        h(
          'div',
          { className: '__rp_sheetRow' },
          h('span', { className: '__rp_sheetLabel' }, t('studioLineColor')),
          h('input', {
            type: 'color',
            className: '__rp_color',
            name: 'rp-studio-line-color',
            'aria-label': t('studioLineColor'),
            value: style.color,
            onChange: function (event) {
              setStyle({ color: event.target.value })
            },
          }),
        ),
        h(
          'label',
          { className: '__rp_sheetRow __rp_checkRow' },
          h('input', {
            type: 'checkbox',
            name: 'rp-studio-dashed',
            'aria-label': t('studioDashed'),
            checked: style.dashed,
            onChange: function (event) {
              setStyle({ dashed: event.target.checked })
            },
          }),
          h('span', { className: '__rp_sheetLabel' }, t('studioDashed')),
        ),
        // 完整版工坊（独立仓库）：照片转等高线、轮廓发光、PNG/SVG 导出
        h(
          'div',
          { className: '__rp_sheetRow' },
          h('span', { className: '__rp_sheetLabel' }, t('studioMore')),
          h('a', { className: '__rp_linkBtn', href: CONTOUR_WORKSHOP_URL, target: '_blank', rel: 'noopener noreferrer', style: { textDecoration: 'none' } }, t('studioMoreLink')),
        ),
      )
    )
  }

    function SettingsModeBar(props) {
      var t = props.t
      usePrefs()
      var effects = activeEffects()
      var modes = [
        ['visual', t('modeVisual')],
        ['performance', t('modePerformance')],
      ]
      return h(
        'div',
        { className: '__rp_modeBar' },
        h(
          'div',
          { className: '__rp_modeSwitch' },
          modes.map(function (mode) {
            return h(
              'button',
              {
                key: mode[0],
                type: 'button',
                className: '__rp_segBtn',
                'data-on': prefs.mode === mode[0] ? '1' : undefined,
                'aria-pressed': prefs.mode === mode[0] ? 'true' : 'false',
                onClick: function () {
                  switchMode(mode[0])
                },
              },
              mode[1],
            )
          }),
        ),
        h(
          'div',
          { className: '__rp_modeHint' },
          t(prefs.mode === 'performance' ? 'modePerformanceHint' : 'modeVisualHint'),
        ),
        h(
          'div',
          { className: '__rp_effectGrid' },
          EFFECT_DEFS.map(function (effect) {
            return h(
              'label',
              { key: effect.id, className: '__rp_effect', title: t(effect.key) },
              h('input', {
                type: 'checkbox',
                name: 'rp-effect-' + effect.id,
                checked: effects[effect.id] !== false,
                onChange: function (event) {
                  setEffect(effect.id, event.target.checked)
                },
              }),
              h('span', null, t(effect.key)),
            )
          }),
        ),
      )
    }

    function SettingsResetDialog(props) {
      var t = props.t
      var dialog = h(
        'div',
        {
          className: '__rp_confirmWrap',
          onClick: function (event) {
            if (event.target === event.currentTarget) props.onCancel()
          },
        },
        h(
          'div',
          {
            className: '__rp_confirm',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': t('resetTitle'),
          },
          h('h3', null, t('resetTitle')),
          h('p', null, t('resetBody')),
          h(
            'div',
            { className: '__rp_confirmActions' },
            h(
              'button',
              {
                type: 'button',
                className: '__rp_linkBtn',
                autoFocus: true,
                onClick: props.onCancel,
              },
              t('resetCancel'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: '__rp_resetBtn',
                onClick: props.onConfirm,
              },
              t('resetConfirm'),
            ),
          ),
        ),
      )
      return portalToBody(dialog)
    }

    /** Host 报的插件版本（每帧快照都带 pluginVersion）；设置窗口右下角显示。 */
    var pluginVersionSeen = ''
    /** 界面自己的版本：构建时由 tools/build-client.mjs 写入。 */
    var CLIENT_VERSION = '__PULSE_CLIENT_VERSION__'

    /**
     * 界面每次刷新都换新，Host 只在 DSH 进程启动时加载一次：装完新包只刷新页面，
     * 两半就会不一致，新功能打到旧 Host 上只会得到看不懂的报错。对不上就在面板顶部说清楚。
     */
    function hostOutdated() {
      return Boolean(pluginVersionSeen) && pluginVersionSeen !== CLIENT_VERSION
    }

    function VersionMismatch(props) {
      var t = props.t
      if (!hostOutdated()) return null
      return h(
        'div',
        { className: '__rp_warnBox __rp_versionWarn', role: 'alert', key: 'version-mismatch' },
        fill(fill(t('versionMismatch'), 'client', CLIENT_VERSION), 'host', pluginVersionSeen),
      )
    }

    /**
     * 设置窗口：左侧分类列表、右侧当前分类的设置行（标签在左、值在右，开关、滑条带数值）、
     * 底部按键提示；背景虚化，和装配窗口同一套 PULSE 视觉（「PULSE //」标头、琥珀色左边条、下划线页签）。
     * 里面的控件沿用原来的组件，只换外观。
     */
    var SETTINGS_CATS = [
      ['general', 'setCatGeneral'],
      ['visual', 'setCatVisual'],
      ['model', 'setCatModel'],
      ['sound', 'setCatSound'],
      ['background', 'setCatBackground'],
      ['budget', 'setCatBudget'],
      ['pricing', 'setCatPricing'],
    ]
    var settingsCatSeen = 'general'

    CSS += '\n' + [
      '.__rp_setWrap{position:fixed;inset:0;z-index:430;display:flex;align-items:center;justify-content:center;padding:32px;box-sizing:border-box;overscroll-behavior:contain;color:#d9dee2;font-size:13.5px;line-height:1.45;background:rgba(6,9,11,.34);-webkit-backdrop-filter:blur(var(--rp-menu-blur,10px)) saturate(.8) brightness(.62);backdrop-filter:blur(var(--rp-menu-blur,10px)) saturate(.8) brightness(.62);animation:__rp_loIn var(--rp-menu-fade,.14s) ease-out both}',
      '.__rp_setWrap[data-closing="1"],.__rp_lo[data-closing="1"]{animation:__rp_loOut var(--rp-menu-fade,.14s) ease-in both;pointer-events:none}',
      '@keyframes __rp_loOut{to{opacity:0}}',
      '.__rp_setWin{box-sizing:border-box;width:min(1080px,100%);height:min(720px,100%);display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;gap:14px}',
      '.__rp_setTop{display:flex;align-items:flex-start;gap:18px}',
      '.__rp_setHeading{display:flex;flex-direction:column;gap:4px}',
      '.__rp_setKicker{color:var(--rp-amber,#ff8a1f);letter-spacing:.2em;font-size:11px;font-weight:600}',
      '.__rp_setTitle{font-size:22px;font-weight:600;letter-spacing:.04em;line-height:1.1}',
      '.__rp_setClose{margin-left:auto;background:none;border:1px solid #3a4248;border-radius:4px;color:#d9dee2;width:30px;height:30px;cursor:pointer;font:inherit}',
      '.__rp_setClose:hover{border-color:var(--rp-amber,#ff8a1f)}',
      '.__rp_setTabs{display:flex;align-items:flex-end;gap:22px;border-bottom:1px solid #2b3338}',
      '.__rp_setTab{padding:4px 2px 8px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:none;color:#8a949b;font:inherit;font-size:14px;cursor:pointer}',
      '.__rp_setTab:hover{color:#e7e9ec}',
      '.__rp_setTab[aria-selected="true"]{color:#e7e9ec;border-bottom-color:var(--rp-amber,#ff8a1f)}',
      '.__rp_setBody{display:grid;grid-template-columns:200px minmax(0,1fr);gap:24px;min-height:0}',
      '.__rp_setCats{display:flex;flex-direction:column;gap:2px;padding-top:4px;overflow:auto}',
      '.__rp_setCat{flex:none;padding:8px 12px;border:0;border-left:2px solid transparent;border-radius:0 4px 4px 0;background:none;color:#aab3b9;font:inherit;font-size:14px;cursor:pointer;text-align:left;animation:__rp_mosaicIn .9s steps(5,end) both}',
      '.__rp_setCat:hover{background:rgba(255,255,255,.04);color:#e7e9ec}',
      '.__rp_setCat:focus-visible{outline:2px solid #fff;outline-offset:-2px}',
      '.__rp_setCat[aria-selected="true"]{border-left-color:var(--rp-amber,#ff8a1f);background:rgba(255,138,31,.09);color:var(--rp-amber,#ff8a1f)}',
      '.__rp_setPane{min-height:0;overflow:auto;overscroll-behavior:contain;padding:0 8px 4px 0;display:flex;flex-direction:column;gap:0;animation:__rp_mosaicIn .8s steps(5,end) both}',
      '.__rp_setPaneTitle{font-size:18px;font-weight:600;letter-spacing:.03em;margin:2px 0 10px}',
      // 设置行：细分隔线列表，标签在左，值在右。
      '.__rp_setPane .__rp_sheetRow{display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:14px;min-height:44px;box-sizing:border-box;padding:6px 10px;border-bottom:1px solid rgba(217,222,226,.08);border-radius:4px}',
      '.__rp_setPane .__rp_sheetRow:hover{background:rgba(255,255,255,.03)}',
      '.__rp_setPane .__rp_sheetRowStack{display:grid;grid-template-columns:minmax(0,1fr) 70px minmax(120px,40%);align-items:center}',
      '.__rp_setPane .__rp_sheetRowStack .__rp_sheetLabelRow{display:contents}',
      '.__rp_setPane .__rp_sheetLabel{font-size:14px;color:#d9dee2}',
      '.__rp_setPane .__rp_sheetValue{font-size:13px;color:#aab3b9;text-align:right;font-variant-numeric:tabular-nums}',
      '.__rp_setPane .__rp_sheetHint{font-size:12px;color:#8a949b;opacity:1;padding:6px 10px}',
      '.__rp_setPane .__rp_checkRow{flex-direction:row-reverse!important;justify-content:space-between!important;cursor:pointer}',
      // 嵌套的开关行（翻译、音效里的）：外层已有分隔线，里层不再叠。
      '.__rp_setPane .__rp_sheetRow .__rp_checkRow{width:100%;padding:0;border:0;min-height:30px}',
      '.__rp_setPane .__rp_sheetRow[style]{align-items:stretch}',
      // 开关：圆角滑块，打开时琥珀色。
      '.__rp_setPane input[type="checkbox"]{-webkit-appearance:none;appearance:none;flex:none;margin:0;width:36px;height:20px;border-radius:10px;position:relative;cursor:pointer;background:#3a4248;border:0;transition:background .15s}',
      '.__rp_setPane input[type="checkbox"]::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#d9dee2;transition:transform .15s cubic-bezier(.22,1,.36,1)}',
      '.__rp_setPane input[type="checkbox"]:checked{background:var(--rp-amber,#ff8a1f)}',
      '.__rp_setPane input[type="checkbox"]:checked::after{transform:translateX(16px);background:#1b1206}',
      '.__rp_setPane input[type="checkbox"]:focus-visible{outline:2px solid #fff;outline-offset:2px}',
      '.__rp_setPane input[type="checkbox"]:disabled{opacity:.4;cursor:default}',
      // 滑条：圆角细轨 + 琥珀色圆点。
      '.__rp_setPane .__rp_range{-webkit-appearance:none;appearance:none;width:100%;height:16px;margin:0;background:linear-gradient(#3a4248,#3a4248) center/100% 3px no-repeat;border-radius:2px}',
      '.__rp_setPane .__rp_range::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:var(--rp-amber,#ff8a1f);border:0}',
      '.__rp_setPane .__rp_range::-moz-range-thumb{width:13px;height:13px;border-radius:50%;background:var(--rp-amber,#ff8a1f);border:0}',
      '.__rp_setPane .__rp_seg{flex-wrap:nowrap;gap:4px}',
      '.__rp_setPane .__rp_segBtn,.__rp_setPane .__rp_seg > button{flex:0 0 auto;min-width:64px;border:1px solid #3a4248;border-radius:4px;background:transparent;color:#aab3b9;padding:3px 12px;font:inherit;font-size:13px;cursor:pointer}',
      '.__rp_setPane .__rp_segBtn:hover,.__rp_setPane .__rp_seg > button:hover{color:#e7e9ec}',
      '.__rp_setPane .__rp_segBtn[data-on="1"],.__rp_setPane .__rp_seg > button[aria-pressed="true"]{border-color:var(--rp-amber,#ff8a1f);background:rgba(255,138,31,.1);color:var(--rp-amber,#ff8a1f)}',
      '.__rp_setPane .__rp_priceInput{background:rgba(0,0,0,.3);border:1px solid #3a4248;color:#e7e9ec;padding:4px 8px;width:110px;font:inherit}',
      '.__rp_setPane .__rp_priceUnit{color:#8a949b}',
      '.__rp_setPane .__rp_modeBar{display:flex;flex-direction:column;gap:6px}',
      '.__rp_setPane .__rp_modeSwitch{display:flex;gap:4px}',
      '.__rp_setPane .__rp_modeSwitch .__rp_segBtn{flex:1 1 0;padding:7px 10px}',
      '.__rp_setPane .__rp_modeHint{font-size:12px;color:#8a949b;padding:4px 10px 6px}',
      '.__rp_setPane .__rp_effectGrid{display:flex;flex-direction:column;gap:0}',
      '.__rp_setPane .__rp_effect{display:flex;flex-direction:row-reverse;justify-content:space-between;align-items:center;gap:14px;min-height:44px;box-sizing:border-box;padding:6px 10px;font-size:14px;color:#d9dee2;border-bottom:1px solid rgba(217,222,226,.08)}',
      '.__rp_setPane .__rp_setFold{border-top:0;margin-top:10px;padding-top:0}',
      '.__rp_setPane .__rp_setFoldHead{color:var(--rp-amber,#ff8a1f);font-size:12px;letter-spacing:.16em}',
      '.__rp_setPane .__rp_studioSettings{display:flex;flex-direction:column;gap:0}',
      '.__rp_setPane .__rp_goalBtn{border:1px solid #3a4248;background:transparent;color:#d9dee2;padding:4px 10px;font:inherit;cursor:pointer}',
      '.__rp_setFoot{display:flex;align-items:center;gap:16px;flex-wrap:wrap;border-top:1px solid #2b3338;padding-top:10px;color:#8a949b;font-size:12px}',
      '.__rp_setKey{display:flex;align-items:center;gap:6px;padding:0;border:0;background:none;color:#8a949b;font:inherit;cursor:pointer}',
      'button.__rp_setKey:hover{color:#e7e9ec}',
      'span.__rp_setKey{cursor:default}',
      '.__rp_setKey kbd{font:inherit;font-size:11px;padding:0 5px;border:1px solid #3a4248;border-radius:3px;color:#d9dee2}',
      '.__rp_setWin .__rp_sheetVersion{margin:0 0 0 auto;font-size:12px;color:#8a949b}',
      '@media (max-width:760px){.__rp_setWrap{padding:16px}.__rp_setBody{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}.__rp_setCats{flex-direction:row;flex-wrap:wrap;padding-top:6px;overflow:visible}.__rp_setCat{flex:1 1 auto;padding:7px 10px}.__rp_setCat{border-left:0;border-bottom:2px solid transparent;border-radius:0}.__rp_setCat[aria-selected="true"]{border-bottom-color:var(--rp-amber,#ff8a1f)}span.__rp_setKey{display:none}}',
      '@media (prefers-reduced-motion:reduce){.__rp_setWrap,.__rp_setCat,.__rp_setPane{animation:none!important}}',
    ].join('\n')

    function settingsPane(t, cat, modes) {
      var row = function (name, key, checked, onChange) {
        return h(
          'label',
          { key: name, className: '__rp_sheetRow __rp_checkRow' },
          h('input', { type: 'checkbox', name: name, 'aria-label': t(key), checked: checked, onChange: function (event) { onChange(event.target.checked) } }),
          h('span', { className: '__rp_sheetLabel' }, t(key)),
        )
      }
      var seg = function (key, label, options, current, onPick) {
        return h(
          'div',
          { key: key, className: '__rp_sheetRow' },
          h('span', { className: '__rp_sheetLabel' }, label),
          h(
            'div',
            { className: '__rp_seg' },
            options.map(function (option) {
              return h('button', { key: option[0], type: 'button', className: '__rp_segBtn', 'data-on': current === option[0] ? '1' : undefined, onClick: function () { onPick(option[0]) } }, option[1])
            }),
          ),
        )
      }
      if (cat === 'visual') return [h(SettingsModeBar, { key: 'mode', t: t }), h(SettingsFold, { key: 'menu', id: 'settings:menu', title: t('menuMotionSection'), defaultOpen: true }, h(MenuMotionSettings, { t: t }))]
      if (cat === 'model') {
        // 后台模型调用：总开关在上，下面三项只在总开关打开时生效。
        return [
          h(ModelConsentSetting, { key: 'consent', t: t }),
          // 总开关没开时下面三项不生效：调暗，免得看起来已经在跑。
          h(
            'div',
            { key: 'gated', style: { display: 'flex', flexDirection: 'column', gap: '6px', opacity: prefs.modelConsent === 'granted' ? 1 : 0.45 } },
            row('rp-infer-goal', 'inferGoalToggle', prefs.inferGoal !== false, function (v) { setPref('inferGoal', v) }),
            row('rp-collect-ideas', 'collectIdeasToggle', prefs.collectIdeas !== false, function (v) { setPref('collectIdeas', v) }),
            h(TranslateSettings, { t: t }),
          ),
        ]
      }
      if (cat === 'sound') return [h(SfxSettings, { key: 'sfx', t: t })]
      if (cat === 'background') {
        return [
          seg('contour', t('contourLabel'), modes, prefs.contour, function (mode) { setPref('contour', mode) }),
          prefs.contour === 'studio' ? h(ContourStudioSettings, { key: 'studio', t: t }) : null,
          h(SettingsFold, { key: 'frost', id: 'settings:frost', title: t('frostSection'), defaultOpen: true }, h(FrostSettings, { t: t })),
        ]
      }
      if (cat === 'budget') return [h(BudgetSettings, { key: 'budget', t: t })]
      if (cat === 'pricing') return [h(PricingSettings, { key: 'pricing', t: t })]
      return [
        row('rp-corner', 'cornerToggle', prefs.corner !== false, function (v) { setPref('corner', v) }),
        row('rp-focus', 'goalFocusToggle', prefs.focusMode === true, function (v) { setPref('focusMode', v) }),
        seg('scheme', t('schemeLabel'), [['auto', t('schemeAuto')], ['light', t('themeLight')], ['dark', t('themeDark')]], prefs.scheme || 'auto', function (mode) { setPanelScheme(mode) }),
      ]
    }

    function SettingsSheet(props) {
      var t = props.t
      usePrefs()
      var resetPair = React.useState(false)
      var resetOpen = resetPair[0]
      var setResetOpen = resetPair[1]
      var closing = useMenuClose(function () { uiStore.set(false) })
      var requestClose = closing[1]
      var requestCloseRef = React.useRef(requestClose)
      requestCloseRef.current = requestClose
      var catPair = React.useState(settingsCatSeen)
      var cat = catPair[0]
      var tabPair = React.useState('options')
      var tab = tabPair[0]
      var setTab = tabPair[1]
      var modes = [
        ['studio', t('contourStudio')],
        ['off', t('contourOff')],
      ]
      var pickCat = function (next, event) {
        if (next === cat) return
        settingsCatSeen = next
        if (event) sfxFor(event, 'expand')
        catPair[1](next)
      }
      var stepCat = function (delta) {
        var ids = SETTINGS_CATS.map(function (c) { return c[0] })
        var index = ids.indexOf(cat)
        pickCat(ids[(index + delta + ids.length) % ids.length])
      }
      var stateRef = React.useRef(null)
      stateRef.current = { resetOpen: resetOpen, tab: tab, stepCat: stepCat }
      // 按键：Esc 关闭、← → 切换页签、↑ ↓ 切换分类、R 恢复默认值；正在输入时只认 Esc。
      React.useEffect(function () {
        if (typeof document === 'undefined') return undefined
        var onKey = function (event) {
          var state = stateRef.current
          if (!state || state.resetOpen || event.ctrlKey || event.metaKey || event.altKey) return
          var target = event.target || {}
          var typing = (target.tagName === 'INPUT' && target.type !== 'checkbox' && target.type !== 'range') || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable
          if (event.key === 'Escape') {
            event.preventDefault()
            requestCloseRef.current()
            return
          }
          if (typing) return
          var key = String(event.key || '').toLowerCase()
          if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && target.type !== 'range') {
            event.preventDefault()
            setTab(state.tab === 'options' ? 'about' : 'options')
          } else if (key === 'r') {
            event.preventDefault()
            setResetOpen(true)
          } else if (state.tab === 'options' && (event.key === 'ArrowDown' || event.key === 'ArrowUp') && target.type !== 'range') {
            event.preventDefault()
            state.stepCat(event.key === 'ArrowDown' ? 1 : -1)
          }
        }
        document.addEventListener('keydown', onKey, true)
        return function () {
          document.removeEventListener('keydown', onKey, true)
        }
      }, [])
      var catLabel = (SETTINGS_CATS.filter(function (c) { return c[0] === cat })[0] || SETTINGS_CATS[0])[1]
      var tabButton = function (id, key) {
        return h(
          'button',
          {
            key: id,
            type: 'button',
            role: 'tab',
            className: '__rp_setTab',
            'aria-selected': tab === id ? 'true' : 'false',
            onClick: function (event) {
              if (tab === id) return
              sfxFor(event, 'expand')
              setTab(id)
            },
          },
          t(key),
        )
      }
      var about = h(
        'div',
        { key: 'about', className: '__rp_setPane' },
        h('h2', { className: '__rp_setPaneTitle' }, 'PULSE'),
        h(VersionMismatch, { t: t }),
        h('div', { className: '__rp_sheetRow' }, h('span', { className: '__rp_sheetLabel' }, t('setAboutClient')), h('span', { className: '__rp_sheetValue' }, 'v' + CLIENT_VERSION)),
        h('div', { className: '__rp_sheetRow' }, h('span', { className: '__rp_sheetLabel' }, t('setAboutHost')), h('span', { className: '__rp_sheetValue' }, pluginVersionSeen ? 'v' + pluginVersionSeen : t('setAboutHostUnknown'))),
        h('div', { className: '__rp_sheetHint' }, t('setAboutBody')),
      )
      var options = h(
        'div',
        { className: '__rp_setBody' },
        h(
          'div',
          { className: '__rp_setCats', role: 'tablist', 'aria-orientation': 'vertical' },
          SETTINGS_CATS.map(function (c, index) {
            return h(
              'button',
              {
                key: c[0],
                type: 'button',
                role: 'tab',
                className: '__rp_setCat',
                style: { animationDelay: 80 + index * 60 + 'ms' },
                'aria-selected': cat === c[0] ? 'true' : 'false',
                onClick: function (event) {
                  pickCat(c[0], event)
                },
              },
              t(c[1]),
            )
          }),
        ),
        h(
          'div',
          { key: cat, className: '__rp_setPane', role: 'tabpanel' },
          h('h2', { className: '__rp_setPaneTitle' }, t(catLabel) + t('setTitleSuffix')),
          settingsPane(t, cat, modes),
        ),
      )
      return h(
        'div',
        {
          className: '__rp_setWrap',
          'data-closing': closing[0] ? '1' : undefined,
          style: menuMotionStyle(),
          onClick: function (event) {
            if (event.target === event.currentTarget) requestClose()
          },
        },
        h(
          'div',
          { className: '__rp_setWin', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('setTitle') },
          h(
            'div',
            { className: '__rp_setTop' },
            h('div', { className: '__rp_setHeading' }, h('span', { className: '__rp_setKicker' }, 'PULSE //'), h('span', { className: '__rp_setTitle' }, t('setTitle'))),
            h('button', { type: 'button', className: '__rp_setClose', 'aria-label': t('setKeyBack'), onClick: requestClose }, '✕'),
          ),
          h(
            'div',
            { className: '__rp_setTabs', role: 'tablist' },
            tabButton('options', 'setTabOptions'),
            tabButton('about', 'setTabAbout'),
          ),
          tab === 'about' ? about : options,
          h(
            'div',
            { className: '__rp_setFoot' },
            h('span', { className: '__rp_setKey', 'aria-hidden': 'true' }, h('kbd', null, '← →'), t('setKeyTabs')),
            h('span', { className: '__rp_setKey', 'aria-hidden': 'true' }, h('kbd', null, '↑ ↓'), t('setKeyCats')),
            h('button', { type: 'button', className: '__rp_setKey', onClick: requestClose }, h('kbd', null, 'Esc'), t('setKeyBack')),
            h('button', { type: 'button', className: '__rp_setKey', onClick: function () { setResetOpen(true) } }, h('kbd', null, 'R'), t('setKeyReset')),
            pluginVersionSeen
              ? h('div', { className: '__rp_sheetVersion', 'aria-label': 'PULSE ' + pluginVersionSeen }, 'PULSE v' + pluginVersionSeen)
              : null,
          ),
          resetOpen
            ? h(SettingsResetDialog, {
                t: t,
                onCancel: function () {
                  setResetOpen(false)
                },
                onConfirm: function () {
                  resetPrefs()
                  setResetOpen(false)
                },
              })
            : null,
        ),
      )
    }

    function isLightHex(hex) {
      if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return false
      var r = parseInt(hex.slice(1, 3), 16)
      var g = parseInt(hex.slice(3, 5), 16)
      var b = parseInt(hex.slice(5, 7), 16)
      return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150
    }
    function shell(children, t, opts) {
      var fx = activeEffects()
      var studioLight = prefs.contour === 'studio' && isLightHex(prefs.studio.style.background)
      var frostOn = prefs.frost.enabled && fx.blur
      return h(
        'div',
        {
          className: '__rp_root',
          'data-motion': MOTION,
          'data-studio': prefs.contour === 'studio' ? '1' : undefined,
          'data-studio-light': studioLight ? '1' : undefined,
          'data-performance': prefs.mode === 'performance' ? '1' : undefined,
          'data-effect-scan': fx.scan ? 'on' : 'off',
          'data-effect-grid': fx.grid ? 'on' : 'off',
          'data-effect-reveal': fx.reveal ? 'on' : 'off',
          'data-effect-flow': fx.flow ? 'on' : 'off',
          'data-effect-window': fx.windowAnimations ? 'on' : 'off',
          'data-effect-status': fx.statusPulse ? 'on' : 'off',
          'data-reveal': opts && opts.reveal ? '1' : undefined,
          // 合成音效：按钮点击统一在这里发一声；展开收起等自己发声的会打标记跳过。
          onClick: sfxClickDelegate,
          style: {
            '--rp-frost-alpha': frostOn ? String(prefs.frost.opacity) : '0',
            '--rp-frost-blur': (frostOn ? prefs.frost.blur : 0) + 'px',
            '--rp-frost-saturate': (frostOn ? prefs.frost.saturation : 100) + '%',
          },
          ref: function (node) {
            panelRootEl = node
          },
        },
        prefs.contour === 'studio' ? h(ContourStudioBackground) : null,
        prefs.contour === 'studio'
          ? h('div', {
              className: '__rp_surface',
              'aria-hidden': 'true',
              style: { background: prefs.studio.style.background, opacity: prefs.surface },
            })
          : null,
        h('div', { className: '__rp_scanWrap', 'aria-hidden': 'true' }, h('div', { className: '__rp_scanBar' })),
        opts && opts.reveal ? h(PixelateDefs) : null,
        h(
          'div',
          { className: '__rp_scroll' },
          h(
            'div',
            { className: '__rp_inner', style: opts && opts.reveal ? { filter: 'url(#__rp_px)' } : undefined },
            h(VersionMismatch, { t: t }),
            children,
          ),
        ),
        null,
      )
    }

    function rowStateOf(state, phase) {
      if (!state || !state.round) return 'idle'
      return phase === 'spent' ? 'spent' : 'active'
    }

    function phaseLabel(t, phase) {
      if (phase === 'active') return t('phaseActive')
      if (phase === 'spent') return t('phaseSpent')
      return t('phaseIdle')
    }

    /** 分组标题：优先用本地化键，退回 Host 给的中文标题。 */
    function groupTitle(t, group) {
      var key = 'group.' + group.id
      var text = t(key)
      return text && text !== key ? text : group.title
    }

    /** 一组 {kind,name} 条目按 tag 聚合，形如「代码 5 · 设计 2」；tag 文本随语言变化。 */
    function tagSummaryOf(t, entries) {
      var counts = {}
      entries.forEach(function (entry) {
        var tag = tagOfItem(entry.kind, entry.name)
        counts[tag] = (counts[tag] || 0) + 1
      })
      var tags = Object.keys(counts).sort(function (a, b) {
        return counts[b] - counts[a] || a.localeCompare(b)
      })
      return tags
        .map(function (tag) {
          return tagLabel(tag) + ' ' + String(counts[tag])
        })
        .join(' · ')
    }

    function tagSummary(t, kind, items) {
      return tagSummaryOf(
        t,
        items.map(function (item) {
          return { kind: kind, name: item.name }
        }),
      )
    }

    /** 置顶区的淡出程度：连续几轮没调用就淡几分，满 4 轮已回落（不会画到这里）。 */
    function fadeOf(misses, spent) {
      // 本轮调用过的满亮；回合结束先退一档，之后每空转一轮再退一档，最低 0.32。
      var level = Math.max(0, misses || 0) + (spent ? 0.5 : 0)
      return Math.max(0.32, 1 - level * 0.17)
    }

    /**
     * 「正在运行」的阅读顺序：本轮在调用的浮在最上（最近一次调用在前），
     * 其余按空转轮数由少到多往下沉，同档再按最近调用时间。
     */
    function sortRunning(list) {
      return list.slice().sort(function (a, b) {
        var ra = (a.state && a.state.round) > 0 ? 1 : 0
        var rb = (b.state && b.state.round) > 0 ? 1 : 0
        if (ra !== rb) return rb - ra
        var ma = (a.state && a.state.misses) || 0
        var mb = (b.state && b.state.misses) || 0
        if (ma !== mb) return ma - mb
        return ((b.state && b.state.at) || 0) - ((a.state && a.state.at) || 0)
      })
    }

