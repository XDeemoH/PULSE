    /* ── 面板总入口 ──────────────────────────────────────────────────── */

    function Panel(props) {
      var t = props.t
      var mode = props.mode === 'global' ? 'global' : 'session'
      useCatalogVersion() // 词典到达后重渲染一次，让显示名生效
      usePrefs() // WebGL 开关变化后重渲染
      var stored = useActiveSession()
      var sessionId = mode === 'global' ? '' : props.sessionId || stored
      var url = React.useMemo(
        function () {
          if (mode === 'global') return '/dsh-running-panel/stream?scope=global'
          return '/dsh-running-panel/stream?session=' + encodeURIComponent(sessionId || '')
        },
        [mode, sessionId],
      )
      var pair = useSnapshot(url)
      var snapshot = pair[0]
      var failed = pair[1]
      // 新装技能 / 分组变化 / 外部改了覆盖层：快照里的词典版本变了就重拉一次。
      var catalogVersion = snapshot && snapshot.catalogVersion
      React.useEffect(
        function () {
          if (!catalogVersion || !catalogStore.data || catalogStore.data.stamp === catalogVersion) return
          refreshCatalog()
        },
        [catalogVersion],
      )
      var dockPair = React.useState(false)
      var dockFailed = dockPair[0]
      var setDockFailed = dockPair[1]
      // 每次启动 DSH 第一次在右侧栏打开面板：马赛克显现 + 圆盘入场（只播一次）。
      var reveal = useFirstReveal(mode !== 'global' && Boolean(props.sessionId) && Boolean(snapshot))

      if (!snapshot) {
        // EventSource 会自己重连；这里只给一条“重连中”，不把瞬间断流渲染成红色错误。
        if (failed) {
          return shell([
            h(
              'div',
              { className: '__rp_pending', role: 'status', key: 'pending' },
              h('span', { className: '__rp_pendingDot', 'aria-hidden': 'true' }),
              h('span', null, t('reconnecting')),
            ),
            h('div', { className: '__rp_note', key: 'retry' }, t('retry')),
          ], t)
        }
        return shell([h('div', { className: '__rp_note', key: 'loading' }, t('loading'))], t)
      }

      if (mode === 'global') return h(GlobalBoard, { t: t, snapshot: snapshot })

      var nodes = []
      if (failed) {
        // 已有数据时，断流只降级为一条状态提示，保留上一帧内容。
        nodes.push(
          h(
            'div',
            { className: '__rp_pending', key: 'pending', role: 'status' },
            h('span', { className: '__rp_pendingDot', 'aria-hidden': 'true' }),
            h('span', null, t('reconnecting')),
          ),
        )
      }
      nodes.push(h(SessionBoard, { key: sessionId || 'board', t: t, snapshot: snapshot, reveal: reveal }))
      if (!props.sessionId) {
        nodes.push(
          h(
            'div',
            { className: '__rp_rightHint', key: 'dock' },
            h(
              'button',
              {
                type: 'button',
                className: '__rp_linkBtn',
                onClick: function () {
                  setDockFailed(!openRightDock())
                },
              },
              t('openRight'),
            ),
            t('rightHint'),
            dockFailed ? h('span', { className: '__rp_warnBox' }, t('openFailed')) : null,
          ),
        )
      }
      return shell(nodes, t, { reveal: reveal })
    }

    /**
     * 对话标题栏上的「运行中」按钮：当前会话的工具条里一键停靠右侧栏。
     * 这是右侧栏之外的第二个入口 —— 不依赖它自己的「新标签页」菜单列没列出这种类型。
     */
    function HeaderButton(props) {
      var t = props.t
      var pair = React.useState(false)
      var failed = pair[0]
      var setFailed = pair[1]
      return h(
        'button',
        {
          type: 'button',
          className: '__rp_headerBtn',
          'data-failed': failed ? '1' : undefined,
          title: failed ? t('openFailed') : t('openRight'),
          onClick: function () {
            setFailed(!openRightDock())
          },
        },
        h(PanelIcon, { size: 14, active: false }),
        h('span', null, t('nav')),
      )
    }

