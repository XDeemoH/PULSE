    /* ── 能力行（右侧当前会话用） ─────────────────────────────────────── */

    /** 统一把浮层挂到 body，避免被面板的 overflow 裁掉。 */
    function portalToBody(node) {
      if (ReactDOM && typeof ReactDOM.createPortal === 'function' && typeof document !== 'undefined' && document.body) {
        // React 合成事件沿组件树冒泡，不沿 DOM 树：不拦住的话，在对话框里右键会再弹行菜单，
        // 回车、点击也会落到能力行 / 分组标题等祖先的处理函数上。
        // 外层 .__rp_portal 同时携带面板的设计令牌（--rp-amber 等），body 下也拿得到。
        return ReactDOM.createPortal(h('div', PORTAL_PROPS, node), document.body)
      }
      return node
    }

    var stopPortalEvent = function (event) {
      event.stopPropagation()
    }
    /* Esc 要继续冒到 window：菜单 / Echo 详情的关闭监听挂在 window 上。 */
    var stopPortalKey = function (event) {
      if (event.key !== 'Escape') event.stopPropagation()
    }
    var PORTAL_PROPS = {
      className: '__rp_portal',
      onClick: stopPortalEvent,
      onDoubleClick: stopPortalEvent,
      onMouseDown: stopPortalEvent,
      onMouseUp: stopPortalEvent,
      onPointerDown: stopPortalEvent,
      onPointerUp: stopPortalEvent,
      onContextMenu: stopPortalEvent,
      onKeyDown: stopPortalKey,
      onKeyUp: stopPortalKey,
      onFocus: stopPortalEvent,
      onBlur: stopPortalEvent,
      onDragStart: stopPortalEvent,
      onCopy: stopPortalEvent,
    }

    /** Electron 里 window.prompt 是空实现，所有输入都走这个对话框。 */
    function EntryEditor(props) {
      var t = props.t
      var valuePair = React.useState(props.value || '')
      var value = valuePair[0]
      var setValue = valuePair[1]
      var max = props.maxLength || (props.multiline ? 400 : 60)
      var trimmed = String(value || '').trim()
      var tooLong = trimmed.length > max
      var busy = Boolean(props.busy)
      var canSave = Boolean(trimmed) && !tooLong && !busy
      var submit = function () {
        if (canSave) props.onSave(trimmed)
      }
      var onKeyDown = function (event) {
        // 输入法正在组字时的回车是「选词」，不是「保存」——中文改名的必经路径。
        var composing = event.nativeEvent && (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)
        if (composing) return
        if (event.key === 'Escape') {
          event.preventDefault()
          props.onCancel()
          return
        }
        if (event.key === 'Enter' && (!props.multiline || event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          submit()
        }
      }
      var fieldProps = {
        value: value,
        autoFocus: true,
        maxLength: max + 20,
        'aria-invalid': tooLong ? 'true' : undefined,
        onChange: function (event) {
          setValue(event.target.value)
        },
        onKeyDown: onKeyDown,
      }
      return portalToBody(
        h(
          'div',
          {
            className: '__rp_confirmWrap',
            onMouseDown: function (event) {
              if (event.target === event.currentTarget && !busy) props.onCancel()
            },
          },
          h(
            'div',
            { className: '__rp_confirm', role: 'dialog', 'aria-modal': 'true', 'aria-label': props.title },
            h('h3', null, props.title),
            props.multiline
              ? h('textarea', Object.assign({ className: '__rp_editorArea', rows: 5 }, fieldProps))
              : h('input', Object.assign({ className: '__rp_editorInput' }, fieldProps)),
            tooLong
              ? h('p', { className: '__rp_editorError', role: 'alert' }, fill(t('editorTooLong'), 'n', max))
              : props.error
                ? h('p', { className: '__rp_editorError', role: 'alert' }, fill(t('editorSaveFailed'), 'reason', props.error))
                : null,
            h(
              'div',
              { className: '__rp_confirmActions' },
              h('button', { type: 'button', className: '__rp_editorBtn', onClick: props.onCancel }, t('menuCancel')),
              h(
                'button',
                { type: 'button', className: '__rp_editorBtn', 'data-primary': '1', disabled: !canSave, onClick: submit },
                busy ? t('menuSaving') : t('menuSave'),
              ),
            ),
          ),
        ),
      )
    }

    /** 通用确认框（面板内，不用 window.confirm）。Esc / 点外面 = 取消。 */
    function ConfirmDialog(props) {
      var t = props.t
      return portalToBody(
        h(
          'div',
          {
            className: '__rp_confirmWrap',
            onMouseDown: function (event) {
              if (event.target === event.currentTarget) props.onCancel()
            },
            onKeyDown: function (event) {
              if (event.key === 'Escape') props.onCancel()
            },
          },
          h(
            'div',
            { className: '__rp_confirm', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': props.title },
            h('h3', null, props.title),
            props.message ? h('p', null, props.message) : null,
            h(
              'div',
              { className: '__rp_confirmActions' },
              h('button', { type: 'button', className: '__rp_editorBtn', autoFocus: true, onClick: props.onCancel }, t('menuCancel')),
              h(
                'button',
                { type: 'button', className: '__rp_editorBtn', 'data-primary': '1', 'data-danger': props.danger ? '1' : undefined, onClick: props.onConfirm },
                props.confirmLabel || t('menuSave'),
              ),
            ),
          ),
        ),
      )
    }

    /** 调用记录：本会话来自行状态，跨会话来自快照 history。 */
    function EntryCalls(props) {
      var t = props.t
      var dataPair = React.useState(null)
      var data = dataPair[0]
      var setData = dataPair[1]
      React.useEffect(
        function () {
          var alive = true
          fetch('/dsh-running-panel/snapshot', { cache: 'no-store' })
            .then(function (response) {
              return response && response.ok ? response.json() : null
            })
            .then(function (json) {
              if (alive) setData(json || {})
            })
            .catch(function () {
              if (alive) setData({})
            })
          return function () {
            alive = false
          }
        },
        [],
      )
      var key = props.kind + ':' + props.name
      var lifetime = null
      if (data) {
        var list = props.kind === 'skill' ? (data.history && data.history.top) || [] : (data.history && data.history.toolTop) || []
        for (var i = 0; i < list.length; i += 1) {
          if (list[i] && list[i].key === key) {
            lifetime = list[i]
            break
          }
        }
      }
      var st = props.state || null
      var rows = [
        [t('callsRound'), st ? fill(t('roundCount'), 'n', st.round || 0) : '—'],
        [t('callsTotal'), st && st.total ? fill(t('totalCount'), 'n', st.total) : '—'],
        [t('callsLast'), st && st.at ? formatTime(st.at) : '—'],
        [t('callsMs'), st && st.lastMs ? formatMs(st.lastMs) : '—'],
        [
          t('callsLifetime'),
          lifetime ? String(lifetime.n || 0) + (lifetime.ms ? ' · ' + formatMs(lifetime.ms) : '') : t('callsNone'),
        ],
      ]
      return portalToBody(
        h(
          'div',
          {
            className: '__rp_confirmWrap',
            onMouseDown: function (event) {
              if (event.target === event.currentTarget) props.onClose()
            },
          },
          h(
            'div',
            { className: '__rp_confirm', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('menuCalls') },
            h('h3', null, (props.label || props.name) + ' · ' + t('menuCalls')),
            h(
              'dl',
              { className: '__rp_calls' },
              rows.map(function (row, index) {
                return h(
                  'div',
                  { key: index, className: '__rp_callsRow' },
                  h('dt', null, row[0]),
                  h('dd', null, row[1]),
                )
              }),
            ),
            h('p', { className: '__rp_callsHint' }, t('callsHint')),
            h(
              'div',
              { className: '__rp_confirmActions' },
              h('button', { type: 'button', className: '__rp_editorBtn', onClick: props.onClose }, t('menuCancel')),
            ),
          ),
        ),
      )
    }

    /** 条目右键菜单：定位到鼠标点，点外面或 Esc 关；方向键在菜单项之间移动。 */
    function RowMenu(props) {
      var t = props.t
      var items = props.items || []
      var boxRef = React.useRef(null)
      var onCloseRef = React.useRef(props.onClose)
      onCloseRef.current = props.onClose
      React.useEffect(function () {
        var close = function (event) {
          var box = boxRef.current
          if (event && event.target && box && box.contains(event.target)) return
          onCloseRef.current()
        }
        var onKey = function (event) {
          if (event.key === 'Escape') onCloseRef.current()
        }
        window.addEventListener('mousedown', close, true)
        window.addEventListener('keydown', onKey)
        window.addEventListener('scroll', close, true)
        window.addEventListener('resize', close)
        window.addEventListener('blur', close)
        return function () {
          window.removeEventListener('mousedown', close, true)
          window.removeEventListener('keydown', onKey)
          window.removeEventListener('scroll', close, true)
          window.removeEventListener('resize', close)
          window.removeEventListener('blur', close)
        }
      }, [])
      var width = 212
      var viewportW = (typeof window !== 'undefined' && window.innerWidth) || 1280
      var viewportH = (typeof window !== 'undefined' && window.innerHeight) || 800
      var left = Math.max(8, Math.min(props.x, viewportW - width - 8))
      var top = Math.max(8, Math.min(props.y, viewportH - items.length * 31 - 14))
      // 按条数估算只是首帧位置；挂载后按真实高度再夹一次（长标签换行 / 字体缩放时估算会偏）。
      var layoutEffect = React.useLayoutEffect || React.useEffect
      layoutEffect(function () {
        var box = boxRef.current
        if (!box || typeof box.getBoundingClientRect !== 'function') return
        var rect = box.getBoundingClientRect()
        var nextTop = Math.max(8, Math.min(props.y, viewportH - rect.height - 8))
        var nextLeft = Math.max(8, Math.min(props.x, viewportW - rect.width - 8))
        box.style.top = nextTop + 'px'
        box.style.left = nextLeft + 'px'
        var first = box.querySelector('[role="menuitem"]:not([disabled])')
        if (first && typeof first.focus === 'function') first.focus({ preventScroll: true })
      }, [props.x, props.y])
      var onMenuKey = function (event) {
        var box = boxRef.current
        if (!box || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End')) return
        event.preventDefault()
        var list = Array.prototype.slice.call(box.querySelectorAll('[role="menuitem"]:not([disabled])'))
        if (!list.length) return
        var index = list.indexOf(document.activeElement)
        var next = event.key === 'Home' ? 0
          : event.key === 'End' ? list.length - 1
            : event.key === 'ArrowDown' ? (index + 1) % list.length
              : (index - 1 + list.length) % list.length
        list[next].focus()
      }
      var node = h(
        'div',
        {
          className: '__rp_menu',
          role: 'menu',
          'aria-label': t('rowMenu'),
          ref: boxRef,
          style: { left: left + 'px', top: top + 'px', width: width + 'px' },
          onKeyDown: onMenuKey,
          onContextMenu: function (event) {
            event.preventDefault()
          },
        },
        items.map(function (item, index) {
          return h(
            'button',
            {
              key: index,
              type: 'button',
              role: 'menuitem',
              className: '__rp_menuItem',
              'data-danger': item.danger ? '1' : undefined,
              disabled: item.disabled ? true : undefined,
              title: item.title || undefined,
              onClick: function () {
                if (item.disabled) return
                props.onClose()
                item.onSelect()
              },
            },
            item.label,
          )
        }),
      )
      return portalToBody(node)
    }

    /** 复制纯文本：异步剪贴板失败时退回 execCommand。 */
    function copyPlain(text) {
      var legacy = function () {
        try {
          var area = document.createElement('textarea')
          area.value = text
          area.setAttribute('readonly', 'readonly')
          area.style.position = 'fixed'
          area.style.opacity = '0'
          document.body.appendChild(area)
          area.select()
          document.execCommand('copy')
          document.body.removeChild(area)
        } catch (error) {
          /* 复制失败不报错 */
        }
      }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).catch(legacy)
          return
        }
      } catch (error) {
        /* 退回 execCommand */
      }
      legacy()
    }

    /**
     * 分组标题的右键菜单 + 改名对话框（技能组、冷层组、历史常用组共用）。
     * 返回 [onContextMenu, 浮层节点]；组名写进覆盖层 names['lib:<id>']。
     */
    function useLibMenu(t, kind, lib) {
      var menuPair = React.useState(null)
      var menu = menuPair[0]
      var setMenu = menuPair[1]
      var editorPair = React.useState(null)
      var editor = editorPair[0]
      var setEditor = editorPair[1]
      var aliveRef = React.useRef(true)
      React.useEffect(function () {
        return function () {
          aliveRef.current = false
        }
      }, [])
      var open = function (event) {
        event.preventDefault()
        event.stopPropagation()
        setMenu({ x: event.clientX, y: event.clientY })
      }
      var save = function (text) {
        if (!text || (editor && editor.busy)) return
        var locale = overlayLocale()
        var key = 'lib:' + lib
        setEditor(function (previous) {
          return previous ? Object.assign({}, previous, { busy: true, error: '' }) : previous
        })
        fetch('/dsh-running-panel/name', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: 'lib', name: lib, field: 'name', text: text, locale: locale }),
        })
          .then(function (response) {
            if (!response.ok) {
              return response.json().catch(function () { return {} }).then(function (body) {
                throw new Error((body && body.error) || 'HTTP ' + response.status)
              })
            }
            entryOverrides.names[key] = text
            bumpCatalog()
            if (aliveRef.current) setEditor(null)
            return refreshCatalog().then(function (ok) {
              if (!ok || entryOverrides.names[key] !== text) return
              delete entryOverrides.names[key]
              if (libLabel(lib) !== text) entryOverrides.names[key] = text
              else bumpCatalog()
            })
          })
          .catch(function (error) {
            if (!aliveRef.current) return
            setEditor(function (previous) {
              return previous ? Object.assign({}, previous, { busy: false, error: String((error && error.message) || error) }) : previous
            })
          })
      }
      var items = [
        {
          label: t('libRename'),
          onSelect: function () {
            setEditor({ value: libLabel(lib), busy: false, error: '' })
          },
        },
        {
          label: t('libCopyName'),
          onSelect: function () {
            copyPlain(libLabel(lib))
          },
        },
      ]
      if (sourceOf(lib)) {
        items.push({
          label: t('libOpenRepo'),
          onSelect: function () {
            try {
              window.open(sourceOf(lib), '_blank', 'noopener,noreferrer')
            } catch (error) {
              /* 打不开就算了 */
            }
          },
        })
      }
      if (kind === 'skill') {
        items.push({
          label: isPinnedLib(lib) ? t('unpinLib') : t('pinLib'),
          onSelect: function () {
            togglePin('lib', lib)
          },
        })
      }
      var nodes = [
        menu
          ? h(RowMenu, {
              key: 'lib-menu',
              t: t,
              x: menu.x,
              y: menu.y,
              items: items,
              onClose: function () {
                setMenu(null)
              },
            })
          : null,
        editor
          ? h(EntryEditor, {
              key: 'lib-editor',
              t: t,
              title: t('libRenameTitle'),
              value: editor.value,
              busy: editor.busy,
              error: editor.error,
              onCancel: function () {
                setEditor(null)
              },
              onSave: save,
            })
          : null,
      ]
      return [open, nodes]
    }

    function CapabilityRow(props) {
      var t = props.t
      var state = props.state
      var stateName = rowStateOf(state, props.phase)
      usePrefs()
      var focusSince = React.useContext(FocusContext)
      var unfocused = !goalRelevant(state, focusSince)
      var pinned = props.kind === 'skill' && isPinnedSkill(props.name)
      var repoUrl = props.repoUrl || (props.lib ? sourceOf(props.lib) : '')
      var busyPair = React.useState(false)
      var busy = busyPair[0]
      var setBusy = busyPair[1]
      var failPair = React.useState(false)
      var failed = failPair[0]
      var setFailed = failPair[1]
      var insertPair = React.useState(false)
      var insertFailed = insertPair[0]
      var setInsertFailed = insertPair[1]
      // 停用时发现别的会话正在用：[{ sessionId, title }]，弹确认框。
      var inUsePair = React.useState(null)
      var inUseBy = inUsePair[0]
      var setInUseBy = inUsePair[1]
      var aliveRef = React.useRef(true)
      React.useEffect(function () {
        return function () {
          aliveRef.current = false
        }
      }, [])
      var menuPair = React.useState(null)
      var menu = menuPair[0]
      var setMenu = menuPair[1]
      var openMenu = function (event) {
        event.preventDefault()
        event.stopPropagation()
        setMenu({ x: event.clientX, y: event.clientY })
      }
      var copyText = function (text) {
        // 异步剪贴板在窗口失焦 / 权限不足时会 reject：那时再退回 execCommand，而不是静默失败。
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(function () {
              copyTextLegacy(text)
            })
            return
          }
        } catch (error) {
          /* 退回 execCommand */
        }
        copyTextLegacy(text)
      }
      var copyTextLegacy = function (text) {
        try {
          var area = document.createElement('textarea')
          area.value = text
          area.setAttribute('readonly', 'readonly')
          area.style.position = 'fixed'
          area.style.opacity = '0'
          document.body.appendChild(area)
          area.select()
          document.execCommand('copy')
          document.body.removeChild(area)
        } catch (error) {
          /* 复制失败不报错 */
        }
      }
      var revealItem = function (file) {
        fetch('/dsh-running-panel/reveal', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: props.kind, name: props.name, file: Boolean(file) }),
        }).catch(function () {})
      }
      var editorPair = React.useState(null)
      var editor = editorPair[0]
      var setEditor = editorPair[1]
      var callsPair = React.useState(false)
      var callsOpen = callsPair[0]
      var setCallsOpen = callsPair[1]
      var openEditor = function (field) {
        setEditor({
          busy: false,
          error: '',
          field: field,
          value: field === 'desc'
            ? tipOf(props.kind, props.name, props.description)
            : props.label || props.name,
        })
      }
      var saveEntry = function (raw) {
        var field = editor && editor.field === 'desc' ? 'desc' : 'name'
        var text = String(raw || '').trim()
        if (!text || (editor && editor.busy)) return
        var locale = overlayLocale()
        var key = props.kind + ':' + props.name
        setEditor(function (previous) {
          return previous ? Object.assign({}, previous, { busy: true, error: '' }) : previous
        })
        fetch('/dsh-running-panel/name', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: props.kind, name: props.name, field: field, text: text, locale: locale }),
        })
          .then(function (response) {
            if (response.ok) return response.json().catch(function () { return {} })
            return response
              .json()
              .catch(function () { return {} })
              .then(function (body) {
                throw new Error((body && body.error) || 'HTTP ' + response.status)
              })
          })
          .then(function () {
            var section = field === 'desc' ? 'descs' : 'names'
            // 先本地生效：覆盖值立即显示，同时写进当前语言那一列的词典缓存。
            entryOverrides[section][key] = text
            if (catalogStore.data) {
              if (!catalogStore.data[section]) catalogStore.data[section] = {}
              var patch = {}
              patch[locale] = text
              catalogStore.data[section][key] = Object.assign({}, catalogStore.data[section][key] || {}, patch)
            }
            bumpCatalog()
            if (aliveRef.current) setEditor(null)
            // 再和 Host 对齐：词典拿到新值后撤掉本地覆盖，之后以服务端（含外部编辑）为准。
            return refreshCatalog().then(function (ok) {
              if (!ok || entryOverrides[section][key] !== text) return
              delete entryOverrides[section][key]
              // 只有词典 / locale 服务真的给出新值时才撤覆盖；否则留着，免得名字闪回旧值。
              var resolved = field === 'desc' ? tipOf(props.kind, props.name, props.description) : nameOf(props.kind, props.name)
              if (resolved !== text) entryOverrides[section][key] = text
              else bumpCatalog()
            })
          })
          .catch(function (error) {
            if (!aliveRef.current) return
            setEditor(function (previous) {
              return previous
                ? Object.assign({}, previous, { busy: false, error: String((error && error.message) || error) })
                : previous
            })
          })
      }
      var park = function (force) {
        if (busy) return
        setBusy(true)
        setFailed(false)
        fetch('/dsh-running-panel/park', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          // 带上当前会话：Host 只拿「别的」会话正在用来拦，当前会话里停用是你自己的决定。
          body: JSON.stringify({ name: props.name, action: 'park', sessionId: sessionStore.id || '', force: force === true }),
        })
          .then(function (response) {
            if (response.ok) return null
            return response.json().catch(function () { return {} }).then(function (value) {
              if (response.status === 409 && value && value.error === 'in-use' && Array.isArray(value.sessions)) return value.sessions
              throw new Error('park')
            })
          })
          .then(function (sessions) {
            // 成功时把最后的 busy 留着：快照一到这一行就会消失，不需要再写状态。
            if (!sessions || !aliveRef.current) return
            setBusy(false)
            setInUseBy(sessions)
          })
          .catch(function () {
            if (!aliveRef.current) return
            setFailed(true)
            setBusy(false)
          })
      }
      var meta = ''
      if (stateName !== 'idle') {
        meta = fill(t('roundCount'), 'n', state.round)
        if (state.total > state.round) meta += ' · ' + fill(t('totalCount'), 'n', state.total)
        if (state.lastMs) meta += ' · ' + formatMs(state.lastMs)
        if (state.at) meta += ' · ' + fill(t('lastAt'), 't', formatTime(state.at))
      }
      var menuItems = []
      if (props.kind === 'skill') {
        menuItems.push({
          label: t('menuInsert'),
          onSelect: function () {
            Promise.resolve(insertSkillReference(props.name)).then(function (ok) {
              if (aliveRef.current && !ok) setInsertFailed(true)
            })
          },
        })
      }
      menuItems.push({
        label: t('menuRename'),
        onSelect: function () {
          openEditor('name')
        },
      })
      menuItems.push({
        label: t('menuEditDesc'),
        onSelect: function () {
          openEditor('desc')
        },
      })
      menuItems.push({
        label: t('menuCalls'),
        onSelect: function () {
          setCallsOpen(true)
        },
      })
      // 只有 ~/.agents/skills 里的自装技能有本地目录；内置 / 预设技能点了只会 404。
      var localSkill = props.kind === 'skill' && props.parkable === true
      if (props.kind === 'skill') {
        menuItems.push({
          label: t('menuReveal'),
          disabled: !localSkill,
          onSelect: function () {
            revealItem(false)
          },
        })
        menuItems.push({
          label: t('menuOpenFile'),
          disabled: !localSkill,
          onSelect: function () {
            revealItem(true)
          },
        })
      }
      menuItems.push({
        label: t('menuCopyName'),
        onSelect: function () {
          copyText(props.label || props.name)
        },
      })
      menuItems.push({
        label: t('menuCopyId'),
        onSelect: function () {
          copyText(props.name)
        },
      })
      if (props.kind === 'skill') {
        menuItems.push({
          label: pinned ? t('menuUnpin') : t('menuPin'),
          onSelect: function () {
            togglePin('skill', props.name)
          },
        })
        menuItems.push({ label: t('menuPark'), danger: true, disabled: !localSkill || busy, onSelect: park })
      }
      return h(
        'div',
        {
          className: props.kind === 'skill' ? '__rp_row __rp_rowSkill' : '__rp_row',
          'data-state': stateName,
          'data-unfocused': unfocused ? '1' : undefined,
          'data-warn': state && state.error ? '1' : undefined,
          'data-desc': tipOf(props.kind, props.name, props.description) || undefined,
          title: meta || undefined,
          onContextMenu: openMenu,
        },
        h('span', { className: '__rp_dot', 'aria-hidden': 'true' }),
        h('span', { className: '__rp_name' }, props.label || props.name),
        props.alt ? h('span', { className: '__rp_nameAlt' }, props.alt) : null,
        props.tokens ? h('span', { className: '__rp_costTag', title: t('costRowTip') }, '~' + formatTokens(props.tokens) + ' tok') : null,
        state && state.error ? h('span', { className: '__rp_warnTag' }, t('hasError')) : null,
        props.kind === 'skill'
          ? h(
              'span',
              { className: '__rp_rowActions', 'data-pinned': pinned ? '1' : undefined },
              h(
                'button',
                {
                  type: 'button',
                  className: '__rp_rowAct',
                  'aria-label': t('callSkill'),
                  title: t('callSkillTip'),
                  'data-failed': insertFailed ? '1' : undefined,
                  onClick: function () {
                    Promise.resolve(insertSkillReference(props.name)).then(function (ok) {
                      if (!aliveRef.current) return
                      setInsertFailed(!ok)
                      if (ok) {
                        window.setTimeout(function () {
                          if (aliveRef.current) setInsertFailed(false)
                        }, 900)
                      }
                    })
                  },
                },
                '↪',
              ),
              repoUrl
                ? h(
                    'a',
                    {
                      className: '__rp_rowAct',
                      href: repoUrl,
                      target: '_blank',
                      rel: 'noreferrer noopener',
                      title: t('openRepo'),
                      'aria-label': t('openRepo'),
                      onClick: function (event) {
                        event.stopPropagation()
                      },
                    },
                    '↗',
                  )
                : null,
              props.parkable === true
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: '__rp_rowAct',
                      'aria-label': t('parkSkill'),
                      disabled: busy,
                      'data-failed': failed ? '1' : undefined,
                      title: failed ? t('parkSkillFailed') : t('parkSkillTip'),
                      onClick: park,
                    },
                    busy ? '…' : '⊘',
                  )
                : null,
              h(
                'button',
                {
                  type: 'button',
                  className: '__rp_rowPin',
                  'data-on': pinned ? '1' : undefined,
                  'aria-label': pinned ? t('unpinSkill') : t('pinSkill'),
                  'aria-pressed': pinned ? 'true' : 'false',
                  title: pinned ? t('unpinSkillTip') : t('pinSkillTip'),
                  onClick: function () {
                    togglePin('skill', props.name)
                  },
                },
                pinned ? '★' : '☆',
              ),
            )
          : null,
        menu
          ? h(RowMenu, {
              t: t,
              x: menu.x,
              y: menu.y,
              onClose: function () {
                setMenu(null)
              },
              items: menuItems,
            })
          : null,
        editor
          ? h(EntryEditor, {
              t: t,
              title: editor.field === 'desc' ? t('editorDescTitle') : t('editorNameTitle'),
              value: editor.value,
              multiline: editor.field === 'desc',
              busy: editor.busy,
              error: editor.error,
              onCancel: function () {
                setEditor(null)
              },
              onSave: saveEntry,
            })
          : null,
        callsOpen
          ? h(EntryCalls, {
              t: t,
              kind: props.kind,
              name: props.name,
              label: props.label,
              state: state,
              onClose: function () {
                setCallsOpen(false)
              },
            })
          : null,
        inUseBy
          ? h(ConfirmDialog, {
              t: t,
              title: t('inUseTitle'),
              message: fill(t('inUseMessage'), 'sessions', inUseBy.map(function (row) { return '「' + row.title + '」' }).join('、')),
              confirmLabel: t('inUseConfirm'),
              danger: true,
              onCancel: function () {
                setInUseBy(null)
              },
              onConfirm: function () {
                setInUseBy(null)
                park(true)
              },
            })
          : null,
      )
    }

