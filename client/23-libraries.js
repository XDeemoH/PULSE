    /* ── 来源库折叠 ──────────────────────────────────────────────────── */

    function SunIcon() {
      return h(
        'svg',
        { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', 'aria-hidden': 'true' },
        h('circle', { cx: 12, cy: 12, r: 4, stroke: 'currentColor', strokeWidth: 1.8 }),
        h('path', {
          d: 'M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
        }),
      )
    }

    function MoonIcon() {
      return h(
        'svg',
        { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', 'aria-hidden': 'true' },
        h('path', {
          d: 'M20 15.6A8.2 8.2 0 0 1 8.4 4a8.3 8.3 0 1 0 11.6 11.6Z',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinejoin: 'round',
        }),
      )
    }

    function RepoIcon() {
      return h(
        'svg',
        {
          className: '__rp_repoIcon',
          viewBox: '0 0 24 24',
          fill: 'none',
          'aria-hidden': 'true',
        },
        h('path', {
          d: 'M3.2 6.6h5.2l1.8 2.1h9.6v10.2H3.2Z',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinejoin: 'round',
        }),
        h('circle', { cx: 8.7, cy: 13.1, r: 1.7, stroke: 'currentColor', strokeWidth: 1.6 }),
        h('circle', { cx: 15.2, cy: 15.3, r: 1.7, stroke: 'currentColor', strokeWidth: 1.6 }),
        h('path', {
          d: 'M10.4 13.1l3.1 2.2M15.8 9.1l5-5M17.7 4.1h3.1v3.1',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )
    }

    function RepoButton(props) {
      var label = props.t('openRepo')
      return h(
        'a',
        {
          className: '__rp_repoBtn',
          href: props.href,
          target: '_blank',
          rel: 'noreferrer noopener',
          title: label + ' · ' + props.href,
          'aria-label': label,
          onClick: function (event) {
            event.stopPropagation()
          },
        },
        h(RepoIcon),
        h('span', { className: '__rp_repoText' }, props.t('repoShort')),
      )
    }

    /**
     * 同一个库的多项折叠成一行（Chrome DevTools · 32 项），点开才看单项。
     * 只有一项的库不套这一层，直接渲染能力行 —— 否则会多出一层没有意义的层级。
     */
    function LibraryGroup(props) {
      var t = props.t
      var items = props.items
      var phase = props.phase
      usePrefs()
      // 专注模式：组里没有一项在目标开始后被调用过，组标题也一起变淡（折叠时才看得出）。
      var focusSince = React.useContext(FocusContext)
      var libUnfocused = focusSince > 0 && !items.some(function (item) {
        return goalRelevant(item.state, focusSince)
      })
      var libPinned = props.kind === 'skill' && isPinnedLib(props.lib)
      var libMenu = useLibMenu(t, props.kind, props.lib)
      var foldId = 'lib:' + props.kind + ':' + props.lib
      var initialOpen = typeof prefs.folds[foldId] === 'boolean' ? prefs.folds[foldId] : false
      var pair = React.useState(initialOpen)
      var open = pair[0]
      var setOpen = pair[1]
      var expandedPair = React.useState(false)
      var expanded = expandedPair[0]
      var setExpanded = expandedPair[1]
      var busyPair = React.useState(false)
      var busy = busyPair[0]
      var setBusy = busyPair[1]
      var failPair = React.useState(false)
      var failed = failPair[0]
      var setFailed = failPair[1]
      var skippedPair = React.useState([])
      var skipped = skippedPair[0]
      var setSkipped = skippedPair[1]
      var aliveRef = React.useRef(true)
      React.useEffect(function () {
        return function () {
          aliveRef.current = false
        }
      }, [])

      var parkable = items.filter(function (item) {
        return item.parkable === true
      })

      var parkAll = function () {
        if (busy || !parkable.length) return
        setBusy(true)
        setFailed(false)
        setSkipped([])
        var names = parkable.map(function (item) {
          return item.name
        })
        var index = 0
        var skippedNow = []
        var step = function () {
          if (!aliveRef.current) return
          if (index >= names.length) {
            setBusy(false)
            setSkipped(skippedNow)
            return
          }
          var name = names[index]
          index += 1
          fetch('/dsh-running-panel/park', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: name, action: 'park', sessionId: sessionStore.id || '' }),
          })
            .then(function (response) {
              // 别的会话正在用的：整库停用时跳过（不强停），结束后列出来。
              if (response.status === 409) {
                return response.json().catch(function () { return {} }).then(function (value) {
                  if (!value || value.error !== 'in-use') throw new Error('park')
                  skippedNow.push(name)
                  return step()
                })
              }
              if (!response.ok) throw new Error('park')
              return step()
            })
            .catch(function () {
              if (!aliveRef.current) return
              setFailed(true)
              setBusy(false)
            })
        }
        step()
      }

      // 工具少于 4 项不值得多一层，直接平铺；技能按安装批次分组，
      // 只要不是孤零零一个就保留组标题——组名就是「这是哪次装的」的记忆锚点。
      if (items.length < (props.kind === 'skill' ? 2 : 4)) {
        return items.map(function (item) {
          return h(CapabilityRow, {
            key: item.name,
            t: t,
            kind: props.kind,
            lib: props.lib,
            repoUrl: item.repoUrl,
            parkable: item.parkable,
            name: item.name,
            label: nameOf(props.kind, item.name),
            alt: altNameOf(props.kind, item.name),
            description: item.description,
            tokens: item.tokens,
            state: item.state,
            phase: phase,
          })
        })
      }

      var active = items.reduce(function (sum, item) {
        return sum + ((item.state && item.state.round) || 0)
      }, 0)

      return h(
        'div',
        { className: '__rp_lib' },
        h(
          'div',
          { className: '__rp_libRow', 'data-unfocused': libUnfocused ? '1' : undefined },
          h(
            'button',
            {
              type: 'button',
              className: '__rp_libToggle',
              'data-active': active > 0 ? '1' : undefined,
              'aria-expanded': open ? 'true' : 'false',
              title: libTip(t, props.lib, items.length) || undefined,
              onContextMenu: libMenu[0],
              onClick: function (event) {
                var next = !open
                sfxFor(event, next ? 'expand' : 'collapse')
                setOpen(next)
                setFold(foldId, next)
              },
            },
            h('span', { className: '__rp_caret', 'aria-hidden': 'true' }, open ? '▾' : '▸'),
            h('span', { className: '__rp_libName' }, libLabel(props.lib)),
            h('span', { className: '__rp_libCount' }, fill(t('libCount'), 'n', items.length)),
            active ? h('span', { className: '__rp_rowMeta' }, fill(t('roundCount'), 'n', active)) : null,
          ),
          props.kind === 'skill'
            ? h(
                'button',
                {
                  type: 'button',
                  className: '__rp_libPin',
                  'data-on': libPinned ? '1' : undefined,
                  'aria-pressed': libPinned ? 'true' : 'false',
                  'aria-label': libPinned ? t('unpinLib') : t('pinLib'),
                  title: libPinned ? t('unpinLibTip') : t('pinLibTip'),
                  onClick: function (event) {
                    event.stopPropagation()
                    togglePin('lib', props.lib)
                  },
                },
                libPinned ? '★' : '☆',
              )
            : null,
          sourceOf(props.lib)
            ? h(RepoButton, { t: t, href: sourceOf(props.lib) })
            : null,
          props.kind === 'skill' && props.lib === 'user'
            ? h(
                'button',
                {
                  type: 'button',
                  className: '__rp_libRestore __rp_libDir',
                  'aria-label': t('openSkillsDir'),
                  title: t('openSkillsDirTip'),
                  onClick: function (event) {
                    event.stopPropagation()
                    fetch('/dsh-running-panel/reveal', {
                      method: 'POST',
                      keepalive: true,
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ kind: 'root' }),
                    }).catch(function () {})
                  },
                },
                t('openSkillsDir'),
              )
            : null,
          parkable.length
            ? h(
                'button',
                {
                  type: 'button',
                  className: '__rp_libPark',
                  'aria-label': t('parkLib'),
                  'data-failed': failed ? '1' : undefined,
                  disabled: busy,
                  title: failed ? t('parkLibFailed') : t('parkLibTip'),
                  onClick: parkAll,
                },
                busy ? t('parkingLib') : t('parkLib'),
              )
            : null,
        ),
        skipped.length
          ? h(
              'div',
              { className: '__rp_libSkipped', role: 'status', style: { fontSize: '12px', color: 'var(--dsw-alias-state-warn-primary)', padding: '2px 0 4px 22px' } },
              fill(t('parkSkippedInUse'), 'names', skipped.map(function (name) { return nameOf('skill', name) || name }).join('、')),
            )
          : null,
        open
          ? h(
              'div',
              { className: '__rp_libBody' },
              (expanded ? items : items.slice(0, 30)).map(function (item) {
                return h(CapabilityRow, {
                  key: item.name,
                  t: t,
                  kind: props.kind,
                  lib: props.lib,
                  repoUrl: item.repoUrl,
                  parkable: item.parkable,
                  name: item.name,
                  label: nameOf(props.kind, item.name),
                  alt: altNameOf(props.kind, item.name),
                  description: item.description,
                  tokens: item.tokens,
                  state: item.state,
                  phase: phase,
                })
              }),
              items.length > 30
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: '__rp_libMore',
                      onClick: function () {
                        setExpanded(!expanded)
                      },
                    },
                    expanded ? t('collapseRows') : fill(t('showAllRows'), 'n', items.length),
                  )
                : null,
            )
          : null,
        libMenu[1][0],
        libMenu[1][1],
        open
          ? null
          : null,
      )
    }

    /** 历史常用的一行：名字 + 「×次数 · 工时 p%」，完整口径放在悬停说明里。 */
    function historyMeta(t, row) {
      var timeText =
        row.timeShare == null
          ? t('historyUnmeasured')
          : row.timeShare === 0 && row.ms > 0
            ? t('timeShareUnder')
            : fill(t('timeShare'), 'p', row.timeShare)
      var full =
        fill(t('totalCount'), 'n', row.n) +
        (row.share != null ? ' · ' + fill(t('historyShare'), 'p', row.share) : '') +
        (row.ms ? ' · ' + formatMs(row.ms) : '') +
        ' · ' +
        timeText
      var short =
        row.timeShare == null
          ? ''
          : row.timeShare === 0
            ? row.ms > 0 ? t('historyTimeUnder') : ''
            : fill(t('historyTimeShort'), 'p', row.timeShare)
      return { full: full, count: fill(t('historyRowMeta'), 'n', row.n), time: short }
    }

    function HistoryRow(props) {
      var t = props.t
      var row = props.row
      var parts = String(row.key).split(':')
      var kind = parts[0] === 'skill' ? 'skill' : 'tool'
      var name = parts.slice(1).join(':')
      var meta = historyMeta(t, row)
      return h(
        'div',
        { className: '__rp_row __rp_historyRow', 'data-state': 'idle', title: meta.full + ' · ' + t('historyTimeTip') },
        h('span', { className: '__rp_name' }, nameOf(kind, name)),
        altNameOf(kind, name) ? h('span', { className: '__rp_nameAlt' }, altNameOf(kind, name)) : null,
        h(
          'span',
          { className: '__rp_rowMeta' },
          meta.count,
          meta.time ? h('span', { className: '__rp_histShare' }, ' · ' + meta.time) : null,
        ),
      )
    }

    function HistoryLib(props) {
      var t = props.t
      var libMenu = useLibMenu(t, 'skill', props.lib)
      var foldId = 'history:' + props.lib
      var initialOpen = typeof prefs.folds[foldId] === 'boolean' ? prefs.folds[foldId] : props.defaultOpen
      var pair = React.useState(initialOpen)
      var open = pair[0]
      var setOpen = pair[1]
      var total = props.rows.reduce(function (sum, row) {
        return sum + (row.n || 0)
      }, 0)
      var share = props.rows.reduce(function (sum, row) {
        return sum + (row.timeShare || 0)
      }, 0)
      return h(
        'div',
        { className: '__rp_lib' },
        h(
          'div',
          { className: '__rp_libRow' },
          h(
            'button',
            {
              type: 'button',
              className: '__rp_libToggle',
              'aria-expanded': open ? 'true' : 'false',
              title: libTip(t, props.lib, 0) || undefined,
              onContextMenu: libMenu[0],
              onClick: function (event) {
                var next = !open
                sfxFor(event, next ? 'expand' : 'collapse')
                setOpen(next)
                setFold(foldId, next)
              },
            },
            h('span', { className: '__rp_caret', 'aria-hidden': 'true' }, open ? '▾' : '▸'),
            h('span', { className: '__rp_libName' }, libLabel(props.lib)),
            h(
              'span',
              { className: '__rp_libCount' },
              fill(t('historyGroupMeta'), 'n', total) + (share ? ' · ' + fill(t('historyTimeShort'), 'p', share) : ''),
            ),
          ),
        ),
        open
          ? h(
              'div',
              { className: '__rp_libBody' },
              props.rows.map(function (row) {
                return h(HistoryRow, { key: row.key, t: t, row: row })
              }),
            )
          : null,
        libMenu[1][0],
        libMenu[1][1],
      )
    }

    /** 历史常用按安装批次分组；组按累计次数排序，排第一的组默认展开。 */
    function HistoryGroups(props) {
      var t = props.t
      var map = {}
      var order = []
      ;(props.rows || []).slice(0, 40).forEach(function (row) {
        var parts = String(row.key).split(':')
        var kind = parts[0] === 'skill' ? 'skill' : 'tool'
        var lib = libOfItem(kind, parts.slice(1).join(':'))
        if (!map[lib]) {
          map[lib] = []
          order.push(lib)
        }
        map[lib].push(row)
      })
      var total = function (lib) {
        return map[lib].reduce(function (sum, row) {
          return sum + (row.n || 0)
        }, 0)
      }
      order.sort(function (a, b) {
        return total(b) - total(a)
      })
      return h(
        'div',
        { className: '__rp_section' },
        order.map(function (lib, index) {
          return h(HistoryLib, { key: lib, t: t, lib: lib, rows: map[lib], defaultOpen: index === 0 })
        }),
      )
    }

    /**
     * 大项外壳：技能 / 工具 / 正在运行共用一个可折叠的分区头。
     * 收起只藏正文，标题、计数、tag 摘要仍留在头上——收起后还能判断里面有没有东西。
     */
    function GroupSection(props) {
      var initialOpen = typeof prefs.folds[props.id] === 'boolean' ? prefs.folds[props.id] : props.defaultOpen !== false
      var pair = React.useState(initialOpen)
      var open = pair[0]
      var setOpen = pair[1]
      return h(
        'section',
        { className: props.className || '__rp_group' },
        h(
          'div',
          { className: '__rp_groupHead __rp_groupHeadToggle' },
          h(
            'h3',
            { className: '__rp_groupTitle' },
            h(
              'button',
              {
                type: 'button',
                className: '__rp_groupToggle',
                'aria-expanded': open ? 'true' : 'false',
                title: props.t ? props.t(open ? 'collapse' : 'expand') : '',
                onClick: function (event) {
                  var next = !open
                  sfxFor(event, next ? 'expand' : 'collapse')
                  setOpen(next)
                  setFold(props.id, next)
                },
              },
              h('span', { className: '__rp_caret', 'aria-hidden': 'true' }, open ? '▾' : '▸'),
              h('span', { className: '__rp_groupToggleText' }, props.title),
            ),
          ),
          props.count != null ? h('span', { className: '__rp_groupCount' }, String(props.count)) : null,
          props.meta || null,
        ),
        open ? props.body : null,
      )
    }

