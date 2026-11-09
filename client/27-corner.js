    /* ── 对话右上角圆盘：和面板同一个 RingSvg，浮在会话列右上角 ───── */

    /**
     * 不打开右侧栏也能看到本轮调用构成。
     * 位置跟着 `[data-conversation-session]` 的矩形算；数据 4s 轮询，页面隐藏时停。
     */
    function PulseCorner(props) {
      var t = props.t
      var sessionId = useActiveSession()
      usePrefs()
      var size = 128
      var openPair = React.useState(false)
      var panelOpen = openPair[0]
      var setPanelOpen = openPair[1]
      var snapPair = React.useState(null)
      var snapshot = snapPair[0]
      var setSnapshot = snapPair[1]
      var posPair = React.useState(null)
      var pos = posPair[0]
      var setPos = posPair[1]
      React.useEffect(function () {
        if (!sessionId) {
          setSnapshot(null)
          return
        }
        var alive = true
        var load = function () {
          fetch('/dsh-running-panel/snapshot?view=corner&session=' + encodeURIComponent(sessionId))
            .then(function (response) {
              return response.ok ? response.json() : null
            })
            .then(function (value) {
              if (alive && value) setSnapshot(value)
            })
            .catch(function () {})
        }
        load()
        var timer = window.setInterval(function () {
          if (!document.hidden) load()
        }, 4000)
        return function () {
          alive = false
          window.clearInterval(timer)
        }
      }, [sessionId])
      React.useEffect(function () {
        var measure = function () {
          var host = document.querySelector('[data-conversation-session]')
          // 右侧栏收起时面板节点还在 DOM 里，只是宽度为 0；用可见宽度判断。
          var docked = document.querySelector('[data-sidebar-right-session] .__rp_root')
          setPanelOpen(Boolean(docked && docked.getBoundingClientRect().width > 0))
          if (!host) {
            setPos(null)
            return
          }
          var rect = host.getBoundingClientRect()
          var top = Math.round(rect.top + 12)
          var left = Math.round(rect.right - size - 18)
          // 每 1.5s 测一次：位置没变就沿用旧对象，别让整块圆盘白白重渲染。
          setPos(function (previous) {
            return previous && previous.top === top && previous.left === left ? previous : { top: top, left: left }
          })
        }
        measure()
        window.addEventListener('resize', measure)
        var timer = window.setInterval(measure, 1500)
        return function () {
          window.removeEventListener('resize', measure)
          window.clearInterval(timer)
        }
      }, [])
      if (prefs.corner === false || panelOpen || !sessionId || !snapshot || !pos || !snapshot.session || snapshot.session.id !== sessionId) return null
      var categories = snapshot.categories || []
      var budget = snapshot.budget ? Object.assign({}, snapshot.budget, { limit: budgetLimitChars() }) : null
      return h(
        'div',
        { className: '__rp_corner', style: { top: pos.top + 'px', left: pos.left + 'px' } },
        h(
          'button',
          {
            type: 'button',
            className: '__rp_cornerBtn',
            title: t('openRight'),
            'aria-label': t('openRight'),
            onClick: function () {
              setPanelOpen(true)
              if (!openRightDock()) setPanelOpen(false)
            },
          },
          h(RingSvg, {
            t: t,
            categories: categories,
            model: ringModel(categories),
            size: size,
            active: snapshot.session && snapshot.session.phase === 'active',
            budget: budget,
          }),
        ),
      )
    }

