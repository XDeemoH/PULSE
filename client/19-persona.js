    /* ── 会话看板（右侧栏） ──────────────────────────────────────────── */

    function SoulPersonaBlock(props) {
      var t = props.t
      var scope = props.scope
      var sessionId = props.sessionId
      var pair = React.useState(function () {
        return scope.getSnapshot()
      })
      var snapshot = pair[0]
      var setSnapshot = pair[1]
      var busyPair = React.useState(false)
      var busy = busyPair[0]
      var setBusy = busyPair[1]
      var failPair = React.useState(false)
      var failed = failPair[0]
      var setFailed = failPair[1]

      React.useEffect(
        function () {
          var alive = true
          var sync = function () {
            if (alive) setSnapshot(scope.getSnapshot())
          }
          var unsubscribe = typeof scope.subscribe === 'function' ? scope.subscribe(sync) : null
          return function () {
            alive = false
            if (unsubscribe) unsubscribe()
          }
        },
        [scope],
      )

      if (!snapshot || snapshot.status !== 'ready' || !snapshot.value) return null
      var value = snapshot.value
      if (value.showPersonaSwitcher === false) return null
      var cards = value.cards && typeof value.cards === 'object' ? value.cards : {}
      var sessions = value.sessions && typeof value.sessions === 'object' ? value.sessions : {}
      var choice = sessions[sessionId] || ''
      if (choice && choice !== 'none' && !(choice in cards)) choice = ''
      var names = Object.keys(cards).sort()

      function onChange(event) {
        if (busy) return
        var nextChoice = event.target.value
        var current = scope.getSnapshot()
        if (!current || current.status !== 'ready' || !current.value) {
          setFailed(true)
          return
        }
        var next = Object.assign({}, current.value.sessions || {})
        if (nextChoice === '') delete next[sessionId]
        else next[sessionId] = nextChoice
        setBusy(true)
        setFailed(false)
        var run =
          typeof scope.mutate === 'function'
            ? scope.mutate([{ op: 'set', path: ['sessions'], value: next }], current.revision)
            : scope.set('sessions', next)
        Promise.resolve(run)
          .then(function () {
            setSnapshot(scope.getSnapshot())
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
        { className: '__rp_section', key: 'soul' },
        h('div', { className: '__rp_sectionTitle' }, t('soulTitle')),
        h(
          'label',
          { className: '__rp_soulRow', title: t('soulHint') },
          h('span', { className: '__rp_soulBadge' }, 'SOUL'),
          h(
            'select',
            {
              className: '__rp_soulSelect',
              value: choice,
              disabled: busy,
              'aria-label': t('soulTitle'),
              onChange: onChange,
            },
            h('option', { value: '' }, t('soulAuto')),
            h('option', { value: 'none' }, t('soulNone')),
            names.map(function (name) {
              return h('option', { key: name, value: name }, name)
            }),
          ),
          failed ? h('span', { className: '__rp_warnTag' }, t('soulError')) : null,
        ),
        !names.length ? h('div', { className: '__rp_sheetHint' }, t('soulEmpty')) : null,
      )
    }

