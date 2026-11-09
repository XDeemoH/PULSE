    /* ── 自动提议收藏：「可能值得收藏」的回合，点了才收藏 ───────────────── */

    /**
     * Host 按信号打分（用户的肯定、交付了文件、失败后修好、大回合），这里只展示前 3 条。
     * 没有提议时整块不渲染，不占面板位置。「忽略」按会话记在本地，不再出现。
     * 收藏走和对话里书签按钮同一个 POST /echo。
     */

    CSS += '\n' + [
      '.__rp_suggest{margin:8px 0;border:1px dashed color-mix(in srgb,var(--rp-amber) 45%,transparent);border-radius:4px;padding:6px 8px;display:flex;flex-direction:column;gap:6px;font-size:13px}',
      '.__rp_suggestHead{display:flex;align-items:baseline;gap:8px}',
      '.__rp_suggestTitle{font-size:11px;letter-spacing:.14em;color:var(--rp-amber);font-weight:600}',
      '.__rp_suggestHint{flex:1 1 auto;min-width:0;color:var(--dsw-alias-label-tertiary);font-size:11.5px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
      '.__rp_suggestRow{display:flex;align-items:center;gap:8px;min-width:0}',
      '.__rp_suggestMain{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}',
      '.__rp_suggestAsk{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:var(--dsw-alias-label-primary)}',
      '.__rp_suggestWhy{display:flex;flex-wrap:wrap;gap:4px}',
      '.__rp_suggestChip{font-size:11px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:3px;padding:0 5px;line-height:1.5}',
      '.__rp_suggestChip[data-reason=praised]{color:var(--rp-amber);border-color:color-mix(in srgb,var(--rp-amber) 45%,transparent)}',
      '.__rp_suggestErr{color:var(--dsw-alias-state-error-primary);font-size:12px}',
    ].join('\n')

    var ECHO_DISMISS_KEY = '__rp_echo_dismissed'

    function echoDismissedSet() {
      try {
        var raw = window.localStorage.getItem(ECHO_DISMISS_KEY)
        var map = raw ? JSON.parse(raw) : {}
        return new Set(Object.keys(map && typeof map === 'object' ? map : {}))
      } catch (error) {
        return new Set()
      }
    }

    function dismissEchoSuggestion(sessionId, messageId) {
      try {
        var raw = window.localStorage.getItem(ECHO_DISMISS_KEY)
        var map = (raw && JSON.parse(raw)) || {}
        map[sessionId + ':' + messageId] = Date.now()
        var keys = Object.keys(map).sort(function (a, b) { return map[b] - map[a] }).slice(0, 500)
        var trimmed = {}
        keys.forEach(function (key) { trimmed[key] = map[key] })
        window.localStorage.setItem(ECHO_DISMISS_KEY, JSON.stringify(trimmed))
      } catch (error) {
        /* 隐私模式：本次渲染里隐藏即可 */
      }
    }

    function suggestReasonText(t, reason, item) {
      if (reason === 'praised') return item.feedback ? fill(t('suggestPraised'), 'q', item.feedback) : t('suggestPraisedPlain')
      if (reason === 'approved') return t('suggestApproved')
      if (reason === 'delivered') return t('suggestDelivered')
      if (reason === 'recovered') return t('suggestRecovered')
      if (reason === 'big') return fill(t('suggestBig'), 'n', item.tools || 0)
      return reason
    }

    function EchoSuggestions(props) {
      var t = props.t
      var sessionId = props.sessionId
      var pair = React.useState([])
      var items = pair[0]
      var setItems = pair[1]
      var hiddenPair = React.useState({})
      var hidden = hiddenPair[0]
      var setHidden = hiddenPair[1]
      var busyPair = React.useState('')
      var busy = busyPair[0]
      var setBusy = busyPair[1]
      var errPair = React.useState('')
      var error = errPair[0]
      var setError = errPair[1]
      var aliveRef = React.useRef(true)
      React.useEffect(function () {
        return function () {
          aliveRef.current = false
        }
      }, [])
      // 一轮结束（阶段 / 轮次变化）或收藏库变化时重取；Host 按事件数缓存，重取很便宜。
      var trigger = String(props.phase || '') + ':' + String(props.round || 0)
      React.useEffect(
        function () {
          if (!sessionId) return undefined
          var cancelled = false
          var load = function () {
            fetch('/dsh-running-panel/echo?suggest=' + encodeURIComponent(sessionId), { cache: 'no-store' })
              .then(function (response) {
                return response.ok ? response.json() : { suggestions: [] }
              })
              .then(function (body) {
                if (!cancelled && aliveRef.current) setItems(Array.isArray(body && body.suggestions) ? body.suggestions : [])
              })
              .catch(function () {})
          }
          load()
          var changed = function () {
            load()
          }
          window.addEventListener('dsh-running-panel:echo-changed', changed)
          return function () {
            cancelled = true
            window.removeEventListener('dsh-running-panel:echo-changed', changed)
          }
        },
        [sessionId, trigger],
      )

      var dismissed = echoDismissedSet()
      var visible = items
        .filter(function (item) {
          return !hidden[item.messageId] && !dismissed.has(sessionId + ':' + item.messageId)
        })
        .slice(0, 3)
      if (!visible.length) return null

      var save = function (item) {
        setBusy(item.messageId)
        setError('')
        fetch('/dsh-running-panel/echo', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionId, messageId: item.messageId }),
        })
          .then(function (response) {
            return response
              .json()
              .catch(function () {
                return {}
              })
              .then(function (body) {
                if (!response.ok) throw new Error((body && body.error) || 'HTTP ' + response.status)
                return body
              })
          })
          .then(function () {
            sfxPlay('done')
            if (!aliveRef.current) return
            setBusy('')
            setHidden(function (previous) {
              var next = Object.assign({}, previous)
              next[item.messageId] = true
              return next
            })
            try {
              window.dispatchEvent(new CustomEvent('dsh-running-panel:echo-changed', { detail: { sessionId: sessionId } }))
            } catch (failure) {
              /* ignore */
            }
          })
          .catch(function (failure) {
            if (!aliveRef.current) return
            setBusy('')
            var code = String((failure && failure.message) || failure)
            setError(code === 'echo_capacity_reached' ? t('goalFull') : fill(t('suggestFailed'), 'reason', code))
          })
      }
      var dismiss = function (item) {
        dismissEchoSuggestion(sessionId, item.messageId)
        setHidden(function (previous) {
          var next = Object.assign({}, previous)
          next[item.messageId] = true
          return next
        })
      }

      return h(
        'div',
        { className: '__rp_suggest', role: 'region', 'aria-label': t('suggestTitle') },
        h(
          'div',
          { className: '__rp_suggestHead' },
          h('span', { className: '__rp_suggestTitle' }, t('suggestTitle')),
          h('span', { className: '__rp_suggestHint' }, t('suggestHint')),
        ),
        visible.map(function (item) {
          return h(
            'div',
            { key: item.messageId, className: '__rp_suggestRow' },
            h(
              'div',
              { className: '__rp_suggestMain' },
              h('span', { className: '__rp_suggestAsk', title: item.answer || item.ask }, fill(t('suggestTurn'), 'n', item.turn) + ' · ' + (item.ask || item.answer || '')),
              h(
                'span',
                { className: '__rp_suggestWhy' },
                item.reasons.map(function (reason) {
                  return h('span', { key: reason, className: '__rp_suggestChip', 'data-reason': reason }, suggestReasonText(t, reason, item))
                }),
              ),
            ),
            h('button', { type: 'button', className: '__rp_goalBtn', 'data-primary': '1', disabled: busy === item.messageId, onClick: function () { save(item) } }, busy === item.messageId ? t('menuSaving') : t('suggestSave')),
            h('button', { type: 'button', className: '__rp_goalBtn', 'aria-label': t('suggestDismiss'), title: t('suggestDismiss'), onClick: function () { dismiss(item) } }, '✕'),
          )
        }),
        error ? h('div', { className: '__rp_suggestErr', role: 'alert' }, error) : null,
      )
    }
