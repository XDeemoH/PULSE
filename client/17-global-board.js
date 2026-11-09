    /* ── 全局看板（左侧主要栏位） ─────────────────────────────────────── */

    function GlobalCard(props) {
      var t = props.t
      var row = props.row
      var calls = row.active && row.active.length ? row.active : []
      var warn = calls.some(function (call) {
        return call.error
      })
      return h(
        'div',
        { className: '__rp_card', 'data-running': row.running ? '1' : undefined, 'data-warn': warn ? '1' : undefined },
        h(
          'div',
          { className: '__rp_cardHead' },
          h('span', { className: '__rp_dot', 'aria-hidden': 'true' }),
          h('span', { className: '__rp_cardTitle', title: row.title || row.id }, row.title || shortId(row.id)),
          h('span', { className: '__rp_cardId' }, shortId(row.id)),
          h(
            'span',
            { className: '__rp_chip', 'data-phase': row.running ? 'active' : row.phase },
            row.running ? t('phaseRunning') : phaseLabel(t, row.phase),
            row.round ? ' · ' + fill(t('round'), 'n', row.round) : '',
          ),
          h('span', { className: '__rp_rowMeta' }, row.lastAt ? fill(t('lastAt'), 't', formatTime(row.lastAt)) : ''),
          row.tokens && (row.tokens.input || row.tokens.output)
            ? h(
                'span',
                { className: '__rp_rowMeta', title: t('tokenTip') },
                t('tokenTotal') + ' ' + formatTokens(row.tokens.input) + ' / ' + formatTokens(row.tokens.output),
              )
            : null,
          row.alerts && row.alerts.length
            ? h('span', { className: '__rp_alertChip' }, t('alertsTitle') + ' ' + String(row.alerts.length))
            : null,
        ),
        h(
          'div',
          { className: '__rp_calls' },
          calls.length
            ? calls.map(function (call) {
                return h(CallRow, { key: call.name, t: t, call: call })
              })
            : h('span', { className: '__rp_empty' }, t('noCalls')),
        ),
        (row.children || []).length
          ? h(
              'div',
              { className: '__rp_calls' },
              row.children.map(function (child) {
                return h(ChildNode, { key: child.id, t: t, child: child })
              }),
            )
          : null,
      )
    }

    function SessionSearch(props) {
      var t = props.t
      var pair = React.useState({ query: '', items: [], loading: false, error: false })
      var state = pair[0]
      var setState = pair[1]
      var controllerRef = React.useRef(null)
      var timerRef = React.useRef(0)

      React.useEffect(
        function () {
          if (timerRef.current) window.clearTimeout(timerRef.current)
          var query = state.query.trim()
          if (query.length < 2) {
            if (controllerRef.current) controllerRef.current.abort()
            setState(function (previous) {
              return Object.assign({}, previous, { items: [], loading: false, error: false })
            })
            return undefined
          }
          timerRef.current = window.setTimeout(function () {
            if (controllerRef.current) controllerRef.current.abort()
            var controller = new AbortController()
            controllerRef.current = controller
            setState(function (previous) {
              return Object.assign({}, previous, { loading: true, error: false })
            })
            fetch('/dsh-running-panel/search?q=' + encodeURIComponent(query), {
              cache: 'no-store',
              signal: controller.signal,
            })
              .then(function (response) {
                return response.json().then(function (body) {
                  if (!response.ok) throw new Error((body && body.error) || 'search failed')
                  return body
                })
              })
              .then(function (body) {
                setState(function (previous) {
                  return Object.assign({}, previous, {
                    items: Array.isArray(body.items) ? body.items : [],
                    loading: false,
                    error: false,
                  })
                })
              })
              .catch(function (error) {
                if (error && error.name === 'AbortError') return
                console.error('[running-panel] session search error', error)
                setState(function (previous) {
                  return Object.assign({}, previous, { loading: false, error: true })
                })
              })
          }, 280)
          return function () {
            if (timerRef.current) window.clearTimeout(timerRef.current)
          }
        },
        [state.query],
      )

      function titleFor(sessionId) {
        try {
          if (!clientSessions || !clientSessions.list) return sessionId
          var snapshot = clientSessions.list.getSnapshot()
          var row = snapshot && snapshot.byId ? snapshot.byId[sessionId] : null
          return (row && row.title) || sessionId
        } catch (error) {
          return sessionId
        }
      }

      function openResult(item) {
        openEchoAnchor(item)
      }

      return h(
        GroupSection,
        {
          id: 'session-search',
          title: t('sessionSearchTitle'),
          count: state.items.length,
          defaultOpen: false,
          body: h(
            'div',
            { className: '__rp_section' },
            h(
              'div',
              { className: '__rp_echoSearch' },
              h('input', {
                type: 'search',
                className: '__rp_echoSearchInput',
                value: state.query,
                placeholder: t('sessionSearchPlaceholder'),
                'aria-label': t('sessionSearchPlaceholder'),
                onChange: function (event) {
                  setState(function (previous) {
                    return Object.assign({}, previous, { query: event.target.value })
                  })
                },
              }),
            ),
            h('div', { className: '__rp_sheetHint' }, t('sessionSearchTip')),
            state.loading
              ? h('div', { className: '__rp_sheetHint' }, t('sessionSearchLoading'))
              : state.error
                ? h('div', { className: '__rp_sheetHint' }, t('sessionSearchError'))
                : state.items.length
                  ? state.items.map(function (item) {
                      return h(
                        'button',
                        {
                          key: item.sessionId + ':' + String(item.snippet || '').slice(0, 12),
                          type: 'button',
                          className: '__rp_sessionHit',
                          onClick: function () {
                            openResult(item)
                          },
                        },
                        h(
                          'span',
                          { className: '__rp_sessionHitTitle' },
                          item.sessionTitle || titleFor(item.sessionId),
                        ),
                        item.floor
                          ? h('span', { className: '__rp_sessionHitMeta' }, fill(t('echoFloor'), 'n', item.floor))
                          : null,
                        h('span', { className: '__rp_sessionHitSnippet' }, item.snippet),
                      )
                    })
                  : state.query.trim().length >= 2
                    ? h('div', { className: '__rp_sheetHint' }, t('sessionSearchNoResult'))
                    : null,
          ),
        },
      )
    }

    function storageWarning(snapshot, t) {
      var storage = snapshot && snapshot.storage
      if (!storage && !(snapshot && snapshot.undoError)) return null
      var messages = []
      var details = []
      ;['usage', 'echoes', 'catalog'].forEach(function (kind) {
        if (!storage || !storage[kind] || !storage[kind].error) return
        messages.push(t(kind === 'usage' ? 'storageUsageError' : kind === 'catalog' ? 'storageCatalogError' : 'storageEchoError'))
        details.push(String(storage[kind].error))
      })
      if (snapshot.undoError) {
        messages.push(t('undoStoreError'))
        details.push(String(snapshot.undoError))
      }
      return messages.length
        ? h('div', { key: 'storage-warning', className: '__rp_warnBox', role: 'alert', title: details.join('\n') }, messages.join(' '))
        : null
    }

    function GlobalBoard(props) {
      var t = props.t
      var snapshot = props.snapshot
      var nodes = []
      nodes.push(storageWarning(snapshot, t))

      nodes.push(
        h(
          'header',
          { className: '__rp_head', key: 'head' },
          h('h2', { className: '__rp_title' }, t('globalTitle')),
          h('span', { className: '__rp_sub' }, t('globalSubtitle')),
        ),
      )

      nodes.push(
        h(
          'div',
          { className: '__rp_stats', key: 'stats' },
          h(
            'div',
            { className: '__rp_stat' },
            h('span', { className: '__rp_statValue' }, String(snapshot.summary.running)),
            h('span', { className: '__rp_statLabel' }, t('runningLabel')),
          ),
          h(
            'div',
            { className: '__rp_stat' },
            h('span', { className: '__rp_statValue' }, String(snapshot.summary.observed)),
            h('span', { className: '__rp_statLabel' }, t('observedLabel')),
          ),
        ),
      )

      nodes.push(
        h(
          'section',
          { className: '__rp_group', key: 'running' },
          h(
            'div',
            { className: '__rp_groupHead' },
            h('h3', { className: '__rp_groupTitle' }, t('runningLabel')),
            h('span', { className: '__rp_groupCount' }, String(snapshot.running.length)),
          ),
          snapshot.running.length
            ? snapshot.running.map(function (row) {
                return h(GlobalCard, { key: row.id, t: t, row: row })
              })
            : h('span', { className: '__rp_empty' }, t('noRunning')),
        ),
      )

      nodes.push(
        h(
          'section',
          { className: '__rp_group', key: 'recent' },
          h(
            'div',
            { className: '__rp_groupHead' },
            h('h3', { className: '__rp_groupTitle' }, t('recentLabel')),
            h('span', { className: '__rp_groupCount' }, String(snapshot.recent.length)),
          ),
          snapshot.recent.length
            ? snapshot.recent.map(function (row) {
                return h(GlobalCard, { key: row.id, t: t, row: row })
              })
            : h('span', { className: '__rp_empty' }, t('noRecent')),
        ),
      )



      nodes.push(h(SessionSearch, { key: 'session-search', t: t }))
      nodes.push(h(EchoGroup, { key: 'echo', t: t }))

      return shell(nodes, t)
    }

