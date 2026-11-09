    /* ── 冷层开关 ────────────────────────────────────────────────────── */

    /**
     * 冷层里的来源库分组：和上面技能区用同一套库名与折叠壳，
     * 这样用户能看出「上古卷轴调试」原本属于哪个库。
     */
    function ColdGroup(props) {
      var t = props.t
      var items = props.items
      var foldId = 'cold:' + props.lib
      var libMenu = useLibMenu(t, 'skill', props.lib)
      var initialOpen = typeof prefs.folds[foldId] === 'boolean' ? prefs.folds[foldId] : false
      var pair = React.useState(initialOpen)
      var open = pair[0]
      var setOpen = pair[1]
      var busyPair = React.useState(false)
      var busy = busyPair[0]
      var setBusy = busyPair[1]
      var failedPair = React.useState(false)
      var failed = failedPair[0]
      var setFailed = failedPair[1]
      var restoreAll = function () {
        if (busy) return
        var names = items.map(function (item) {
          return item.name
        })
        var directoryNames = items.every(function (item) { return Boolean(item.directoryName) })
          ? items.map(function (item) { return item.directoryName })
          : null
        if (!names.length) return
        setBusy(true)
        setFailed(false)
        fetch('/dsh-running-panel/park', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(directoryNames ? { directoryNames: directoryNames, action: 'restore' } : { names: names, action: 'restore' }),
        })
          .then(function (response) {
            if (!response.ok) throw new Error('restore')
            return response.json()
          })
          .then(function (value) {
            if (!value || value.ok !== true) setFailed(true)
          })
          .catch(function () {
            setFailed(true)
          })
          .then(function () {
            setBusy(false)
          })
      }
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
              title: libTip(t, props.lib, items.length) || undefined,
              onContextMenu: libMenu[0],
              onClick: function () {
                var next = !open
                setOpen(next)
                setFold(foldId, next)
              },
            },
            h('span', { className: '__rp_caret', 'aria-hidden': 'true' }, open ? '▾' : '▸'),
            h('span', { className: '__rp_libName' }, libLabel(props.lib)),
            h('span', { className: '__rp_libCount' }, fill(t('libCount'), 'n', items.length)),
          ),
          h(
            'button',
            {
              type: 'button',
              className: '__rp_libRestore',
              disabled: busy,
              'data-failed': failed ? '1' : undefined,
              title: failed ? t('restoreLibFailed') : t('restoreLibTip'),
              'aria-label': t('restoreLib'),
              onClick: restoreAll,
            },
            busy ? t('restoringLib') : t('restoreLib'),
          ),
          sourceOf(props.lib)
            ? h(RepoButton, { t: t, href: sourceOf(props.lib) })
            : null,
        ),
        open
          ? h(
              'div',
              { className: '__rp_libBody' },
              items.map(function (item) {
                return h(ColdRow, { key: item.directoryName || item.name, t: t, item: item })
              }),
            )
          : null,
        libMenu[1][0],
        libMenu[1][1],
      )
    }

    /**
     * 冷层的一行：名字 + 中文用途 + 一个「启用」小按钮。
     * 只调 Host 的 /park 接口；快照会自动刷新，不需要手动重拉。
     */
    function ColdRow(props) {
      var t = props.t
      var pair = React.useState(false)
      var busy = pair[0]
      var setBusy = pair[1]
      var failPair = React.useState(false)
      var failed = failPair[0]
      var setFailed = failPair[1]
      return h(
        'div',
        { className: '__rp_row __rp_coldRow', 'data-state': 'idle', 'data-warn': failed ? '1' : undefined },
        h('span', { className: '__rp_name' }, nameOf('skill', props.item.name)),
        h('span', { className: '__rp_nameAlt' }, altNameOf('skill', props.item.name) || props.item.name),
        h(
          'button',
          {
            type: 'button',
            className: '__rp_linkBtn',
            disabled: busy,
            title: props.item.name,
            onClick: function () {
              setBusy(true)
              setFailed(false)
              fetch('/dsh-running-panel/park', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name: props.item.name, directoryName: props.item.directoryName, action: 'restore' }),
              })
                .then(function (response) {
                  if (!response.ok) setFailed(true)
                })
                .catch(function () {
                  setFailed(true)
                })
                .then(function () {
                  setBusy(false)
                })
            },
          },
          busy ? '…' : t('restore'),
        ),
      )
    }

    /**
     * 预算方案弹层：只读一份 dryRun 结果，确认后才动文件。
     * 排版：顶部预算条（保留 vs 停用占比），下面逐条点名 + 理由。
     */
    /** 从面板根节点复制到 body 弹层的主题令牌。 */
    var PANEL_THEME_TOKENS = [
      '--dsw-alias-bg-base',
      '--dsw-alias-label-primary',
      '--dsw-alias-label-secondary',
      '--dsw-alias-label-tertiary',
      '--dsw-alias-border-l1',
      '--dsw-alias-border-l2',
      '--dsw-alias-bg-layer-1',
      '--dsw-alias-bg-layer-2',
      '--dsw-alias-bg-overlay',
      '--dsw-alias-brand-primary',
      '--rp-amber',
      '--rp-teal',
      '--rp-rust',
      '--rp-sand',
      '--rp-slate',
    ]

    function BudgetPlanDialog(props) {
      var t = props.t
      var plan = props.plan
      var busy = props.busy === true
      var applied = props.applied === true
      var failed = props.failed === true
      /* 弹层挂到 body，脱离面板的容器查询/包含块；把面板主题令牌复制过来，
       * 纸白/墨黑都能跟着变，不会出现暗底暗字。 */
      var shellRef = React.useRef(null)
      React.useEffect(function () {
        var el = shellRef.current
        var panel = document.querySelector('.__rp_root')
        if (!el || !panel) return
        var cs = getComputedStyle(panel)
        PANEL_THEME_TOKENS.forEach(function (name) {
          var value = cs.getPropertyValue(name).trim()
          if (value) el.style.setProperty(name, value)
        })
      }, [])
      var park = (plan && plan.park) || []
      var keep = (plan && plan.keep) || []
      var before = (plan && plan.before) || { chars: 0, tokens: 0, skills: 0 }
      var byName = {}
      var order = []
      keep.concat(park).forEach(function (row) {
        if (!byName[row.name]) order.push(row.name)
        byName[row.name] = row
      })
      var selectPair = React.useState(function () {
        var set = {}
        if (applied && Array.isArray(plan.applied)) {
          plan.applied.forEach(function (name) { set[name] = true })
        } else {
          park.forEach(function (row) { set[row.name] = true })
        }
        return set
      })
      var selected = selectPair[0]
      var setSelected = selectPair[1]
      var selectedNames = order.filter(function (name) {
        return selected[name] === true
      })
      var savedChars = selectedNames.reduce(function (sum, name) {
        return sum + (byName[name].chars || 0) - (name.length + 22)
      }, 0)
      var afterChars = Math.max(0, before.chars - savedChars)
      var afterTokens = Math.round(afterChars / 4)
      var total = Math.max(1, before.chars)
      var reason = function (row) {
        // 别的打开着的会话正在用：默认保留；手动挪到停用栏也可以，但标题里写明会影响谁。
        if (row.why === 'inUse') return fill(t('whyInUse'), 'sessions', (row.inUse || []).map(function (s) { return s.title }).join('、'))
        if (row.why === 'pinned') return t('whyPinned')
        if (row.why === 'library') return t('whyLibrary')
        if (row.why === 'recent') return t('whyRecent')
        return row.days >= 0 ? fill(t('whyDays'), 'n', row.days) : t('whyNever')
      }
      var toggle = function (name) {
        var row = byName[name]
        if (!row || row.movable !== true || busy || applied) return
        var next = Object.assign({}, selected)
        if (next[name]) delete next[name]
        else next[name] = true
        setSelected(next)
      }
      var item = function (row, parked) {
        var locked = row.movable !== true
        return h(
          'button',
          {
            key: (parked ? 'p:' : 'k:') + row.name,
            type: 'button',
            className: '__rp_planItem',
            'data-parked': parked ? '1' : undefined,
            'data-locked': locked ? '1' : undefined,
            'aria-pressed': parked ? 'true' : 'false',
            disabled: locked || busy || applied,
            title: row.name + ' · ' + (locked ? t('planLocked') : reason(row)),
            onClick: function () {
              toggle(row.name)
            },
          },
          h('span', { className: '__rp_planItemName' }, nameOf('skill', row.name) || row.name),
          locked ? h('span', { className: '__rp_planLock' }, '🔒') : null,
          !locked && !parked && (row.why === 'pinned' || row.why === 'library')
            ? h('span', { className: '__rp_planPin' }, '★')
            : null,
          h('span', { className: '__rp_planItemMeta' }, locked ? t('planLocked') : reason(row)),
          h('span', { className: '__rp_planItemChars' }, (parked ? '−' : '') + formatChars(row.chars || 0)),
        )
      }
      var column = function (title, rows, parked) {
        return h(
          'div',
          { className: '__rp_planCol' },
          h(
            'div',
            { className: '__rp_planColHead' },
            h('span', { className: '__rp_planColTitle' }, title),
            h('span', { className: '__rp_planColCount' }, fill(t('planCount'), 'n', rows.length)),
          ),
          h(
            'div',
            { className: '__rp_planColList' },
            rows.length
              ? rows.map(function (row) {
                  return item(row, parked)
                })
              : h('div', { className: '__rp_planEmpty' }, parked ? t('planEmptyPark') : t('planEmptyKeep')),
          ),
        )
      }
      var keptRows = order
        .filter(function (name) {
          return !selected[name]
        })
        .map(function (name) {
          return byName[name]
        })
      var parkedRows = selectedNames.map(function (name) {
        return byName[name]
      })
      var body = h(
        'div',
        { className: '__rp_planBody' },
        h(
          'div',
          { className: '__rp_planBar', title: fill(fill(t('planBarTitle'), 'a', formatChars(afterChars)), 'b', formatChars(before.chars)) },
          h('span', { className: '__rp_planBarFill', style: { width: Math.max(2, Math.round((afterChars / total) * 100)) + '%' } }),
          h('span', { className: '__rp_planBarRest' }),
        ),
        h(
          'div',
          { className: '__rp_planBarLabel' },
          h('span', null, fill(t('planKeep'), 'n', keptRows.length)),
          h('span', null, fill(t('planPark'), 'n', parkedRows.length)),
        ),
        h('div', { className: '__rp_planDual' }, column(t('planColKeep'), keptRows, false), column(t('planColPark'), parkedRows, true)),
      )
      var dialog = h(
        'div',
        { className: '__rp_planWrap', ref: shellRef, role: 'dialog', 'aria-modal': 'true', 'aria-label': t('planTitle') },
        h(
          'div',
          { className: '__rp_plan' },
          h(
            'div',
            { className: '__rp_planHead' },
            h('span', { className: '__rp_planTitle' }, t('planTitle')),
            h(
              'button',
              {
                type: 'button',
                className: '__rp_planClose',
                'aria-label': t('planCancel'),
                onClick: props.onClose,
              },
              '✕',
            ),
          ),
          h(
            'div',
            { className: '__rp_planMeta' },
            h('span', null, fill(fill(t('planMeta'), 'a', formatTokens(before.tokens)), 'b', formatTokens(afterTokens))),
            h('span', { className: '__rp_planSaved' }, fill(t('planSaved'), 'c', formatChars(Math.max(0, savedChars)))),
          ),
          body,
          failed ? h('div', { className: '__rp_planError' }, t('planFailed')) : null,
          props.undoFailed ? h('div', { className: '__rp_planError' }, t('planUndoFailed')) : null,
          applied && props.failedNames && props.failedNames.length
            ? h('div', { className: '__rp_planError' }, fill(t('planPartial'), 'n', props.failedNames.length))
            : null,
          applied
            ? h(
                'div',
                { className: '__rp_planDone' },
                h('span', null, fill(t('planApplied'), 'n', props.moved == null ? selectedNames.length : props.moved)),
                h('button', { type: 'button', className: '__rp_linkBtn', disabled: busy, onClick: props.onUndo }, t('planUndo')),
              )
            : h(
                'div',
                { className: '__rp_planFoot' },
                h('button', { type: 'button', className: '__rp_linkBtn', onClick: props.onClose }, t('planCancel')),
                h(
                  'button',
                  {
                    type: 'button',
                    className: '__rp_planApply',
                    disabled: busy || selectedNames.length === 0,
                    onClick: function () {
                      props.onApply(selectedNames)
                    },
                  },
                  busy ? t('planBusy') : fill(t('planApply'), 'n', selectedNames.length),
                ),
              ),
        ),
      )
      return portalToBody(dialog)
    }

