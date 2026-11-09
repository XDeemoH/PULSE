    /* ── 当前会话登记（root 作用域的面板拿不到会话绑定） ────────────────── */
    var sessionStore = { id: '', listeners: new Set() }

    function setActiveSession(id) {
      if (!id || sessionStore.id === id) return
      sessionStore.id = id
      sessionStore.listeners.forEach(function (listener) {
        try {
          listener()
        } catch (error) {
          /* 渲染层自己的错误不扩散 */
        }
      })
    }

    function useActiveSession() {
      var pair = React.useState(sessionStore.id)
      var id = pair[0]
      var setId = pair[1]
      React.useEffect(function () {
        var sync = function () {
          setId(sessionStore.id)
        }
        sessionStore.listeners.add(sync)
        sync()
        return function () {
          sessionStore.listeners.delete(sync)
        }
      }, [])
      return id
    }

    function SessionReporter(props) {
      var sessionId = props && props.sessionId
      React.useEffect(
        function () {
          if (sessionId) setActiveSession(sessionId)
        },
        [sessionId],
      )
      return null
    }

