    /* ── 灵感与分支：目标抽屉里的一块 ───────────────────────────────────── */

    /**
     * 开发路上助手给的方向、你说的「以后再做」，按工作区收在这里：
     * 待做（带来源、可跳回原对话、可设为目标）/ 进行中（已是目标）/ 已完成（折叠）。
     * 「可能已完成」是模型对照最近对话的判断，要你点「确认完成」才算。
     * 收集在每轮结束后自动请求（设置里可关）；回填历史会先告诉你要调几次模型。
     */

    CSS += '\n' + [
      '.__rp_ideas{display:flex;flex-direction:column;gap:6px;border-top:1px dashed var(--dsw-alias-border-l1);padding-top:8px}',
      '.__rp_ideasHead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.__rp_ideasTitle{font-size:11px;letter-spacing:.14em;color:var(--rp-amber);font-weight:600}',
      '.__rp_ideasCount{font-size:11.5px;color:var(--dsw-alias-label-tertiary)}',
      '.__rp_ideasTools{margin-left:auto;display:flex;gap:4px;flex-wrap:wrap}',
      '.__rp_idea{display:flex;align-items:flex-start;gap:6px;min-width:0;padding:3px 0}',
      '.__rp_ideaMark{flex:none;width:12px;color:var(--rp-amber);font-size:10px;line-height:1.9}',
      '.__rp_idea[data-status=doing] .__rp_ideaMark{color:var(--rp-teal)}',
      '.__rp_idea[data-status=done]{opacity:.62}',
      '.__rp_ideaMain{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}',
      '.__rp_ideaText{font-size:12.5px;line-height:1.45;color:var(--dsw-alias-label-primary);word-break:break-word}',
      '.__rp_ideaMeta{display:flex;flex-wrap:wrap;gap:4px;align-items:center;font-size:11px;color:var(--dsw-alias-label-tertiary)}',
      '.__rp_ideaChip{border:1px solid var(--dsw-alias-border-l1);border-radius:3px;padding:0 4px;line-height:1.5}',
      '.__rp_ideaChip[data-kind=maybe]{color:var(--rp-amber);border-color:color-mix(in srgb,var(--rp-amber) 50%,transparent)}',
      '.__rp_ideaActs{flex:none;display:flex;gap:3px;visibility:hidden}',
      '.__rp_idea:hover .__rp_ideaActs,.__rp_idea:focus-within .__rp_ideaActs,.__rp_idea[data-maybe="1"] .__rp_ideaActs{visibility:visible}',
      '.__rp_ideaActs .__rp_goalBtn{padding:0 6px;font-size:11.5px}',
      '.__rp_ideasNote{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.5}',
      '.__rp_ideasErr{font-size:12px;color:var(--dsw-alias-state-error-primary)}',
    ].join('\n')

    // goalRequest 打的是 /goal；灵感走自己的路由。
    function ideaFetch(method, body, query) {
      return fetch('/dsh-running-panel/idea' + (query || ''), {
        method: method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      }).then(function (response) {
        return response
          .json()
          .catch(function () {
            return {}
          })
          .then(function (value) {
            if (!response.ok) throw new Error((value && value.error) || 'HTTP ' + response.status)
            return value
          })
      })
    }

    var requestedCapture = new Set()

    /** 一轮结束（或面板打开）时请求一次收集；同一会话同一轮只发一次，Host 自己记着扫到哪了。 */
    function shouldCaptureIdeas(props) {
      if (!modelAllowed('collectIdeas') || !props.sessionId) return false
      if (props.phase === 'active') return false
      return Boolean(props.ideas)
    }

    function ideaSourceText(t, source) {
      if (source === 'user') return t('ideaFromUser')
      if (source === 'history') return t('ideaFromHistory')
      if (source === 'manual') return t('ideaFromManual')
      return t('ideaFromAssistant')
    }

    function IdeaPanel(props) {
      var t = props.t
      var sessionId = props.sessionId
      var ideas = props.ideas
      var busyPair = React.useState('')
      var busy = busyPair[0]
      var setBusy = busyPair[1]
      var errPair = React.useState('')
      var error = errPair[0]
      var setError = errPair[1]
      var donePair = React.useState(false)
      var showDone = donePair[0]
      var setShowDone = donePair[1]
      var estimatePair = React.useState(null)
      var estimate = estimatePair[0]
      var setEstimate = estimatePair[1]
      var addPair = React.useState(false)
      var adding = addPair[0]
      var setAdding = addPair[1]
      var aliveRef = React.useRef(true)
      React.useEffect(function () {
        return function () {
          aliveRef.current = false
        }
      }, [])
      if (!ideas) return null
      var state = ideas.state || {}
      var counts = ideas.counts || { open: 0, doing: 0, done: 0 }

      var act = function (key, promise, after) {
        setBusy(key)
        setError('')
        return promise
          .then(function (value) {
            if (!aliveRef.current) return
            setBusy('')
            if (after) after(value)
          })
          .catch(function (failure) {
            if (!aliveRef.current) return
            setBusy('')
            var code = String((failure && failure.message) || failure)
            setError(hostOutdated() ? t('hostOutdatedShort') : code === 'echo_capacity_reached' ? t('goalFull') : fill(t('ideaFailed'), 'reason', code))
          })
      }
      var patch = function (idea, body, sound) {
        return act(idea.id, ideaFetch('PATCH', Object.assign({ id: idea.id }, body)), function () {
          if (sound) sfxPlay(sound)
        })
      }
      var toGoal = function (idea) {
        return act(idea.id, ideaFetch('POST', { sessionId: sessionId, goalFrom: idea.id }))
      }

      var row = function (idea) {
        var maybe = idea.status === 'open' && idea.maybeDone
        var canJump = Boolean(idea.sessionId && idea.messageId)
        return h(
          'div',
          { key: idea.id, className: '__rp_idea', 'data-status': idea.status, 'data-maybe': maybe ? '1' : undefined },
          h('span', { className: '__rp_ideaMark', 'aria-hidden': 'true' }, idea.status === 'done' ? '✓' : idea.status === 'doing' ? '◆' : '◇'),
          h(
            'div',
            { className: '__rp_ideaMain' },
            h('span', { className: '__rp_ideaText' }, idea.text),
            h(
              'span',
              { className: '__rp_ideaMeta' },
              h('span', { className: '__rp_ideaChip' }, ideaSourceText(t, idea.source)),
              idea.status === 'doing' ? h('span', { className: '__rp_ideaChip' }, t('ideaDoing')) : null,
              maybe ? h('span', { className: '__rp_ideaChip', 'data-kind': 'maybe', title: idea.maybeDone.evidence || '' }, t('ideaMaybeDone')) : null,
              h('span', null, dateOnly(idea.status === 'done' ? idea.doneAt : idea.createdAt)),
            ),
          ),
          h(
            'span',
            { className: '__rp_ideaActs' },
            maybe
              ? [
                  h('button', { key: 'yes', type: 'button', className: '__rp_goalBtn', 'data-primary': '1', disabled: busy === idea.id, onClick: function (event) { if (event && event.nativeEvent) event.nativeEvent.__rpSfx = true; patch(idea, { status: 'done' }, 'done') } }, t('ideaConfirmDone')),
                  h('button', { key: 'no', type: 'button', className: '__rp_goalBtn', disabled: busy === idea.id, onClick: function () { patch(idea, { dismissMaybe: true }) } }, t('ideaNotDone')),
                ]
              : null,
            idea.status === 'open' && !maybe
              ? [
                  h('button', { key: 'goal', type: 'button', className: '__rp_goalBtn', 'data-primary': '1', disabled: busy === idea.id, onClick: function () { toGoal(idea) } }, t('ideaToGoal')),
                  h('button', { key: 'done', type: 'button', className: '__rp_goalBtn', disabled: busy === idea.id, onClick: function (event) { if (event && event.nativeEvent) event.nativeEvent.__rpSfx = true; patch(idea, { status: 'done' }, 'done') } }, t('goalDone')),
                  h('button', { key: 'drop', type: 'button', className: '__rp_goalBtn', 'aria-label': t('ideaDrop'), title: t('ideaDrop'), disabled: busy === idea.id, onClick: function () { patch(idea, { status: 'dropped' }) } }, '✕'),
                ]
              : null,
            idea.status === 'done' ? h('button', { key: 'reopen', type: 'button', className: '__rp_goalBtn', disabled: busy === idea.id, onClick: function () { patch(idea, { status: 'open' }) } }, t('goalReopen')) : null,
            canJump
              ? h('button', { key: 'jump', type: 'button', className: '__rp_goalBtn', 'aria-label': t('ideaJump'), title: t('ideaJump'), onClick: function () { openEchoAnchor({ sessionId: idea.sessionId, messageId: idea.messageId }) } }, '↗')
              : null,
          ),
        )
      }

      var status = ''
      if (state.capturing) status = t('ideaCapturing')
      else if (state.checking) status = t('ideaChecking')
      else if (state.backfill && state.backfill.running) status = fill(fill(fill(t('ideaBackfilling'), 'done', state.backfill.done), 'total', state.backfill.total || '?'), 'added', state.backfill.added)
      else if (state.backfill && state.backfill.error) status = fill(t('ideaFailed'), 'reason', state.backfill.error)
      else if (state.backfill && state.backfill.total) status = fill(t('ideaBackfilled'), 'added', state.backfill.added)
      else if (state.lastError) status = fill(t('ideaFailed'), 'reason', state.lastError)

      var backfillRunning = Boolean(state.backfill && state.backfill.running)
      var nodes = [
        h(
          'div',
          { key: 'head', className: '__rp_ideasHead' },
          h('span', { className: '__rp_ideasTitle' }, t('ideaTitle')),
          h('span', { className: '__rp_ideasCount' }, fill(fill(t('ideaCounts'), 'open', counts.open), 'done', counts.done)),
          h(
            'span',
            { className: '__rp_ideasTools' },
            h('button', { type: 'button', className: '__rp_goalBtn', onClick: function () { setAdding(!adding) } }, t('ideaAdd')),
            counts.open
              ? h('button', { type: 'button', className: '__rp_goalBtn', disabled: state.checking, onClick: function () { act('check', ideaFetch('POST', { sessionId: sessionId, check: true })) } }, t('ideaCheck'))
              : null,
            h(
              'button',
              {
                type: 'button',
                className: '__rp_goalBtn',
                disabled: backfillRunning || busy === 'estimate',
                onClick: function () {
                  act('estimate', ideaFetch('GET', null, '?estimate=1&session=' + encodeURIComponent(sessionId)), function (value) {
                    setEstimate(value)
                  })
                },
              },
              t('ideaBackfill'),
            ),
          ),
        ),
      ]
      if (adding) {
        nodes.push(
          h(GoalInput, {
            key: 'add',
            t: t,
            placeholder: t('ideaAddPlaceholder'),
            busy: busy === 'add',
            onCancel: function () {
              setAdding(false)
            },
            onSubmit: function (text) {
              act('add', ideaFetch('POST', { sessionId: sessionId, text: text }), function () {
                setAdding(false)
              })
            },
          }),
        )
      }
      if (estimate) {
        nodes.push(
          h(
            'div',
            { key: 'estimate', className: '__rp_ideasNote' },
            estimate.calls
              ? fill(fill(fill(t('ideaEstimate'), 'sessions', estimate.sessions), 'turns', estimate.turns), 'calls', estimate.calls)
              : fill(t('ideaEstimateNone'), 'sessions', estimate.sessions),
            ' ',
            estimate.calls
              ? h('button', { type: 'button', className: '__rp_goalBtn', 'data-primary': '1', onClick: function () { setEstimate(null); act('backfill', ideaFetch('POST', { sessionId: sessionId, backfill: true })) } }, t('ideaBackfillStart'))
              : null,
            ' ',
            h('button', { type: 'button', className: '__rp_goalBtn', onClick: function () { setEstimate(null) } }, t('menuCancel')),
          ),
        )
      }
      if (status) nodes.push(h('div', { key: 'status', className: '__rp_ideasNote', role: 'status' }, status))
      if (error) nodes.push(h('div', { key: 'err', className: '__rp_ideasErr', role: 'alert' }, error))
      ;(ideas.doing || []).forEach(function (idea) {
        nodes.push(row(idea))
      })
      ;(ideas.open || []).forEach(function (idea) {
        nodes.push(row(idea))
      })
      if (!counts.open && !counts.doing) nodes.push(h('div', { key: 'empty', className: '__rp_ideasNote' }, t('ideaEmpty')))
      if (counts.done) {
        nodes.push(
          h('button', { key: 'done-toggle', type: 'button', className: '__rp_linkBtn', style: { alignSelf: 'flex-start', fontSize: '12px' }, onClick: function (event) { sfxFor(event, showDone ? 'collapse' : 'expand'); setShowDone(!showDone) } }, (showDone ? '▾ ' : '▸ ') + fill(t('ideaDoneList'), 'n', counts.done)),
        )
        if (showDone)
          (ideas.done || []).forEach(function (idea) {
            nodes.push(row(idea))
          })
      }
      return h('div', { className: '__rp_ideas', role: 'region', 'aria-label': t('ideaTitle') }, nodes)
    }
