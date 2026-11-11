    /* ── SSE 订阅 ────────────────────────────────────────────────────── */

    function useSnapshot(url) {
      var pair = React.useState({ url: url, snapshot: null, failed: false })
      var state = pair[0]
      var setState = pair[1]
      React.useEffect(
        function () {
          var alive = true
          var status = function (failed) {
            if (!alive) return
            setState(function (previous) {
              return { url: url, snapshot: previous.url === url ? previous.snapshot : null, failed: failed }
            })
          }
          var onMessage = function (message) {
            if (!alive) return
            try {
              var parsed = JSON.parse(message.data)
              if (parsed && typeof parsed.pluginVersion === 'string') pluginVersionSeen = parsed.pluginVersion
              if (parsed && parsed.context && Number(parsed.context.contextWindow) > 0) contextWindowSeen = Number(parsed.context.contextWindow)
              // 记住最近一次见到的窗口：没有会话上报时预算线仍按它自动算，而不是退回固定值。
              if (parsed && parsed.context && Number(parsed.context.contextWindow) > 0 && Number(prefs.lastContextWindow) !== contextWindowSeen) {
                try {
                  setPref('lastContextWindow', contextWindowSeen)
                } catch (error) {
                  prefs.lastContextWindow = contextWindowSeen // 存不了就只记在内存里，不能挡住快照
                }
              }
              if (parsed && parsed.translate) {
                noteTranslate(parsed.translate)
                maybeAutoTranslate(parsed.translate)
              }
              setState({ url: url, snapshot: parsed, failed: false })
            } catch (error) {
              /* 非法分片忽略，等下一帧 */
            }
          }
          var source = null
          var timer = null
          var delay = 2000
          // 浏览器在 4xx/5xx（例如宿主认证服务尚未就绪时的 503、未登录的 401）后会关闭 EventSource 且不再自动重连，
          // 所以连接被关闭时由这里退避重开（2s 起，最长 30s）；网络中断这类可自动重连的错误仍交给浏览器。
          var connect = function () {
            timer = null
            if (!alive) return
            try {
              source = new EventSource(url)
            } catch (error) {
              status(true)
              return
            }
            source.onmessage = onMessage
            // 重连成功就把“重连中”撤掉，不必等下一帧数据。
            source.onopen = function () {
              delay = 2000
              status(false)
            }
            source.onerror = function () {
              status(true)
              if (alive && source && source.readyState === 2 && timer === null) {
                timer = setTimeout(connect, delay)
                delay = Math.min(delay * 2, 30000)
              }
            }
          }
          connect()
          return function () {
            alive = false
            if (timer !== null) clearTimeout(timer)
            if (source) source.close()
          }
        },
        [url],
      )
      return state.url === url ? [state.snapshot, state.failed] : [null, false]
    }

