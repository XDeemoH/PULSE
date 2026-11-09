    /* ── 目标层：一行目标条 + 抽屉 + 专注模式 ──────────────────────────── */

    /**
     * 当前目标有两个来源，同一时间只显示一个：
     * 1) DSH 原生 /goal（会话投影 `goal`）：只读，阶段 / 轮数照抄；complete 时记进 PULSE 历史。
     * 2) PULSE 自己的工作区目标（快照 `goal`，存在 Echo 存储里）：可设、改写、完成、移除。
     * 都没有时，用会话标题给一个带 ? 的提议——不点「设为目标」就不写任何东西。
     *
     * 专注模式（设置里开，默认关）：目标开始之后没被调用过的技能 / 工具行降到 40% 不透明度。
     * 不隐藏、不改排序。没有目标时什么都不变淡。
     */

    CSS += '\n' + [
      /* 追踪任务（地图右侧任务栏的样式）：切角、左侧 琥珀橙竖条、「追踪中」小标签、菱形标记、底部分段进度。 */
      '.__rp_goal{position:relative;display:flex;align-items:center;gap:8px;min-height:28px;margin:6px 0 2px;padding:4px 10px 5px 8px;border:1px solid var(--dsw-alias-border-l1);border-left:2px solid var(--rp-amber);border-radius:0;background:linear-gradient(90deg,color-mix(in srgb,var(--rp-amber) 10%,transparent),color-mix(in srgb,var(--rp-amber) 3%,transparent) 60%);clip-path:polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,0 100%);font-size:13px;line-height:1.4;cursor:pointer;user-select:none}',
      '.__rp_goalTag{flex:none;font-size:9.5px;font-weight:600;letter-spacing:.2em;color:var(--rp-amber);text-transform:uppercase;opacity:.9}',
      '.__rp_goal[data-kind=empty] .__rp_goalTag{color:var(--dsw-alias-label-tertiary)}',
      '@container (max-width: 380px){.__rp_goal[data-kind=proposal] .__rp_goalTag{display:none}.__rp_goal{gap:6px}}',
      '.__rp_goalProgress{position:absolute;left:10px;right:12px;bottom:2px;height:2px;display:flex;gap:2px;pointer-events:none}',
      '.__rp_goalSeg{flex:1 1 0;background:color-mix(in srgb,var(--rp-amber) 18%,transparent)}',
      '.__rp_goalSeg[data-on="1"]{background:var(--rp-amber)}',
      '.__rp_goal[data-phase=blocked] .__rp_goalSeg[data-on="1"]{background:var(--rp-rust)}',
      '.__rp_goal:hover{background:color-mix(in srgb,var(--rp-amber) 9%,transparent)}',
      '.__rp_goal:focus-visible{outline:1px solid var(--rp-amber);outline-offset:1px}',
      '.__rp_goal[data-kind=empty]{border-left-color:var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary)}',
      '.__rp_goal[data-kind=proposal]{border-left-style:dashed;cursor:default}',
      '.__rp_goalMark{flex:none;width:14px;text-align:center;color:var(--rp-amber);font-size:11px}',
      '.__rp_goal[data-kind=empty] .__rp_goalMark{color:var(--dsw-alias-label-tertiary)}',
      '.__rp_goalText{flex:1 1 auto;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
      '.__rp_goalMeta{flex:none;color:var(--dsw-alias-label-tertiary);font-size:11px;letter-spacing:.04em;white-space:nowrap}',
      '.__rp_goalBadge{flex:none;font-size:10px;letter-spacing:.12em;color:var(--rp-amber);border:1px solid color-mix(in srgb,var(--rp-amber) 45%,transparent);border-radius:3px;padding:0 4px;line-height:1.5}',
      '.__rp_goal[data-phase=blocked] .__rp_goalMark,.__rp_goal[data-phase=blocked] .__rp_goalMeta{color:var(--rp-rust)}',
      '.__rp_goal[data-phase=paused] .__rp_goalMark{opacity:.55}',
      '.__rp_goalBtn{flex:none;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);border-radius:3px;font:inherit;font-size:12px;padding:1px 7px;cursor:pointer;line-height:1.5}',
      '.__rp_goalBtn:hover{color:var(--dsw-alias-label-primary);border-color:var(--rp-amber)}',
      '.__rp_goalBtn[data-primary="1"]{color:var(--rp-amber);border-color:color-mix(in srgb,var(--rp-amber) 55%,transparent)}',
      '.__rp_goalBtn[data-danger="1"]:hover{color:var(--rp-rust);border-color:var(--rp-rust)}',
      '.__rp_goalBtn:disabled{opacity:.45;cursor:default}',
      '.__rp_goalDrawer{margin:0 0 8px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-top:none;border-radius:0 0 3px 3px;background:var(--dsw-alias-bg-layer-1);font-size:13px;display:flex;flex-direction:column;gap:8px}',
      '.__rp_goalActions{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
      '.__rp_goalNote{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5}',
      '.__rp_goalInput{width:100%;box-sizing:border-box;height:28px;border:1px solid var(--dsw-alias-border-l2);border-radius:3px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:0 8px}',
      '.__rp_goalInput:focus{outline:none;border-color:var(--rp-amber)}',
      '.__rp_goalErr{color:var(--dsw-alias-state-error-primary);font-size:12px}',
      '.__rp_goalHistTitle{font-size:11px;letter-spacing:.14em;color:var(--dsw-alias-label-tertiary);text-transform:uppercase}',
      '.__rp_goalHist{display:flex;align-items:center;gap:6px;min-height:22px;color:var(--dsw-alias-label-secondary)}',
      '.__rp_goalHist[data-status=stale]{opacity:.6}',
      '.__rp_goalHist .__rp_goalText{font-size:12px}',
      '.__rp_goalHist .__rp_goalBtn{visibility:hidden}',
      '.__rp_goalHist:hover .__rp_goalBtn,.__rp_goalHist:focus-within .__rp_goalBtn{visibility:visible}',
      '.__rp_goalFocus{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      ':is(.__rp_row,.__rp_libRow)[data-unfocused="1"]{opacity:.4;transition:opacity .18s ease}',
      ':is(.__rp_row,.__rp_libRow)[data-unfocused="1"]:hover,:is(.__rp_row,.__rp_libRow)[data-unfocused="1"]:focus-within{opacity:1}',
      'html[data-rp-scheme="light"] .__rp_goalInput{background:#fffdf7}',
    ].join('\n')

    /** 专注模式的起点（毫秒）；0 = 不变淡。SessionBoard 提供，CapabilityRow 读。 */
    var FocusContext = React.createContext(0)

    function goalRelevant(state, since) {
      if (!(since > 0)) return true
      return Boolean(state && Number(state.at) >= since)
    }

    /* DSH 原生目标：会话绑定可能晚于面板出现，找不到就隔几秒再找。 */
    function dshGoalFace(sessionId) {
      try {
        var binding = clientSessions && typeof clientSessions.binding === 'function' ? clientSessions.binding(sessionId) : null
        var projections = binding && binding.session && binding.session.projections
        return projections && typeof projections.faceOf === 'function' ? projections.faceOf('goal') : null
      } catch (error) {
        return null
      }
    }

    function readDshGoal(face) {
      try {
        var value = face && typeof face.getSnapshot === 'function' ? face.getSnapshot() : null
        if (!value || !value.goal || typeof value.goal.objective !== 'string') return null
        return {
          id: String(value.goal.id || ''),
          revision: Number(value.goal.revision) || 0,
          objective: value.goal.objective,
          phase: String(value.goal.phase || 'active'),
          rounds: Number(value.roundsStarted) || 0,
          max: Number(value.goal.maxGoalRounds) || 0,
          createdAt: Number(value.createdAt) || 0,
          blocked: value.goal.blockedReason && value.goal.blockedReason.message ? String(value.goal.blockedReason.message) : '',
        }
      } catch (error) {
        return null
      }
    }

    function useDshGoal(sessionId) {
      var pair = React.useState(null)
      var goal = pair[0]
      var setGoal = pair[1]
      React.useEffect(
        function () {
          setGoal(null)
          if (!sessionId) return undefined
          var alive = true
          var timer = null
          var unsubscribe = null
          var last = ''
          var tries = 0
          var attach = function () {
            if (!alive) return
            var face = dshGoalFace(sessionId)
            if (!face) {
              // 没有会话服务就不等；有服务但绑定还没建好，等一分钟（20 × 3 s）就放弃。
              if (clientSessions && typeof clientSessions.binding === 'function' && tries < 20) {
                tries += 1
                timer = setTimeout(attach, 3000)
              }
              return
            }
            var sync = function () {
              if (!alive) return
              var next = readDshGoal(face)
              var key = JSON.stringify(next)
              if (key === last) return
              last = key
              setGoal(next)
            }
            sync()
            if (typeof face.subscribe === 'function') {
              var off = face.subscribe(sync)
              unsubscribe = typeof off === 'function' ? off : null
            }
          }
          attach()
          return function () {
            alive = false
            if (timer) clearTimeout(timer)
            if (unsubscribe) unsubscribe()
          }
        },
        [sessionId],
      )
      return goal
    }

    /** DSH 目标是否占着目标条：complete 之后让位给 PULSE 自己的目标。 */
    function dshGoalLive(dsh) {
      return Boolean(dsh && dsh.phase !== 'complete')
    }

    /** 专注起点：DSH 目标优先（它在跑就是当下的事），其次 PULSE 当前目标。 */
    function goalFocusSince(dsh, pulse) {
      if (dshGoalLive(dsh)) return dsh.createdAt || 0
      return pulse && pulse.current ? pulse.current.createdAt || 0 : 0
    }

    var recordedDshGoals = new Set()
    var requestedInference = new Set()

    /** 该不该请求推断：开关开着、没有 DSH 目标和 PULSE 目标、没被「不用」、这一轮已结束、上次不是失败。 */
    function shouldInferGoal(props, dismissed) {
      if (!modelAllowed('inferGoal') || dismissed || !props.sessionId) return false
      if (dshGoalLive(props.dsh)) return false
      if (!props.goal || props.goal.current) return false
      if (props.phase === 'active') return false
      var proposal = props.proposal
      if (proposal && (proposal.status === 'running' || proposal.status === 'error')) return false
      // 有待做灵感时，提议直接用灵感，不再花一次模型调用。
      if (props.ideas && props.ideas.counts && props.ideas.counts.open > 0) return false
      return true
    }

    function goalRequest(method, body, query) {
      return fetch('/dsh-running-panel/goal' + (query || ''), {
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

    /* 「不用」过的提议按会话记在本地，免得每次打开都问。 */
    var GOAL_DISMISS_KEY = '__rp_goal_dismissed'
    function goalDismissed(sessionId) {
      try {
        var raw = window.localStorage.getItem(GOAL_DISMISS_KEY)
        var map = raw ? JSON.parse(raw) : {}
        return Boolean(map && map[sessionId])
      } catch (error) {
        return false
      }
    }
    function dismissGoal(sessionId) {
      try {
        var raw = window.localStorage.getItem(GOAL_DISMISS_KEY)
        var map = (raw && JSON.parse(raw)) || {}
        map[sessionId] = Date.now()
        var keys = Object.keys(map).sort(function (a, b) { return map[b] - map[a] }).slice(0, 200)
        var trimmed = {}
        keys.forEach(function (key) { trimmed[key] = map[key] })
        window.localStorage.setItem(GOAL_DISMISS_KEY, JSON.stringify(trimmed))
      } catch (error) {
        /* 隐私模式：只在本次渲染里不再显示 */
      }
    }

    function goalErrorText(t, error) {
      var code = String((error && error.message) || error || '')
      // 旧 Host 没有 /goal 路由：给出能照着做的提示，而不是「HTTP 404」。
      if (hostOutdated()) return t('hostOutdatedShort')
      if (code === 'goal_title_too_long') return fill(t('goalTooLong'), 'n', GOAL_TITLE_MAX)
      if (code === 'goal_workspace_unknown') return t('goalNoWorkspace')
      if (code === 'echo_capacity_reached') return t('goalFull')
      return fill(t('goalFailed'), 'reason', code)
    }

    var GOAL_TITLE_MAX = 200

    function phaseText(t, phase) {
      if (phase === 'paused') return t('goalPhasePaused')
      if (phase === 'blocked') return t('goalPhaseBlocked')
      if (phase === 'complete') return t('goalPhaseComplete')
      return t('goalPhaseActive')
    }

    /** 一行输入：输入法组字时回车不提交，Esc 取消。 */
    function GoalInput(props) {
      var t = props.t
      var pair = React.useState(props.initial || '')
      var value = pair[0]
      var setValue = pair[1]
      var tooLong = Array.from(value.trim()).length > GOAL_TITLE_MAX
      var submit = function () {
        if (props.busy || tooLong || !value.trim()) return
        props.onSubmit(value.trim())
      }
      return h(
        'div',
        { className: '__rp_goalActions', style: { flexWrap: 'nowrap' } },
        h('input', {
          className: '__rp_goalInput',
          autoFocus: true,
          value: value,
          placeholder: props.placeholder || t('goalNewPlaceholder'),
          'aria-label': props.placeholder || t('goalNewPlaceholder'),
          disabled: props.busy,
          onChange: function (event) {
            setValue(event.target.value)
          },
          onKeyDown: function (event) {
            if (event.nativeEvent && (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) return
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              props.onCancel()
            }
          },
        }),
        h('button', { type: 'button', className: '__rp_goalBtn', 'data-primary': '1', disabled: props.busy || tooLong || !value.trim(), onClick: submit }, props.busy ? t('menuSaving') : t('menuSave')),
        h('button', { type: 'button', className: '__rp_goalBtn', disabled: props.busy, onClick: props.onCancel }, t('menuCancel')),
        tooLong ? h('span', { className: '__rp_goalErr' }, fill(t('goalTooLong'), 'n', GOAL_TITLE_MAX)) : null,
      )
    }

    function GoalBar(props) {
      var t = props.t
      var sessionId = props.sessionId
      var pulse = props.goal
      var dsh = props.dsh
      usePrefs()
      var openPair = React.useState(false)
      var open = openPair[0]
      var setOpen = openPair[1]
      var editPair = React.useState('')
      var editing = editPair[0] // '' | 'new' | 'edit'
      var setEditing = editPair[1]
      var busyPair = React.useState(false)
      var busy = busyPair[0]
      var setBusy = busyPair[1]
      var errPair = React.useState('')
      var error = errPair[0]
      var setError = errPair[1]
      var dismissPair = React.useState(function () {
        return goalDismissed(sessionId)
      })
      var dismissed = dismissPair[0]
      var setDismissed = dismissPair[1]
      var aliveRef = React.useRef(true)
      React.useEffect(function () {
        return function () {
          aliveRef.current = false
        }
      }, [])

      // DSH 目标完成：记一条 PULSE 历史（Host 按目标 id 去重，这里只是少发几次）。
      var dshDoneKey = dsh && dsh.phase === 'complete' ? dsh.id : ''
      React.useEffect(
        function () {
          if (!dshDoneKey || !sessionId || recordedDshGoals.has(dshDoneKey)) return
          recordedDshGoals.add(dshDoneKey)
          goalRequest('POST', { sessionId: sessionId, dsh: { id: dsh.id, objective: dsh.objective, createdAt: dsh.createdAt } }).catch(function () {
            recordedDshGoals.delete(dshDoneKey)
          })
        },
        [dshDoneKey, sessionId],
      )

      // 没有任何目标时，请 Host 用模型推断一个提议。只在一轮结束后（不在 agent 跑的时候），
      // 同一会话同一轮只请求一次；Host 再按「每 3 轮最多一次」节流。失败不自动重试。
      var proposal = props.proposal || null
      // 灵感收集：一轮结束（或面板打开）时请求一次。
      var captureKey = shouldCaptureIdeas(props) ? sessionId + ':' + (Number(props.round) || 0) : ''
      React.useEffect(
        function () {
          if (!captureKey || requestedCapture.has(captureKey)) return
          requestedCapture.add(captureKey)
          ideaFetch('POST', { sessionId: sessionId, capture: true }).catch(function () {})
        },
        [captureKey],
      )
      var inferKey = shouldInferGoal(props, dismissed) ? sessionId + ':' + (Number(props.round) || 0) : ''
      React.useEffect(
        function () {
          if (!inferKey || requestedInference.has(inferKey)) return
          requestedInference.add(inferKey)
          goalRequest('POST', { sessionId: sessionId, infer: true }).catch(function () {})
        },
        [inferKey],
      )

      var run = function (promise, after) {
        setBusy(true)
        setError('')
        return promise
          .then(function () {
            if (!aliveRef.current) return
            setBusy(false)
            setEditing('')
            if (after) after()
          })
          .catch(function (failure) {
            if (!aliveRef.current) return
            setBusy(false)
            setError(goalErrorText(t, failure))
          })
      }
      var create = function (title, source) {
        return run(goalRequest('POST', { sessionId: sessionId, title: title, source: source || 'owner' }))
      }
      var patch = function (id, body, after) {
        return run(goalRequest('PATCH', Object.assign({ id: id }, body)), after)
      }
      var remove = function (id) {
        return run(goalRequest('DELETE', null, '?id=' + encodeURIComponent(id)))
      }

      if (!pulse) return null // Echo 存储没就绪或读坏了：storageWarning 已经在报
      var current = pulse.current
      var live = dshGoalLive(dsh)
      var focusOn = prefs.focusMode === true
      var modelProposal = proposal && proposal.status === 'ready' && proposal.title ? String(proposal.title) : ''
      var ideaProposal = props.ideas && props.ideas.open && props.ideas.open[0] ? props.ideas.open[0] : null
      var proposalText = ideaProposal ? ideaProposal.text : modelProposal || String(props.sessionTitle || '').trim()
      var inferring = Boolean(proposal && proposal.status === 'running')
      var proposing = !live && !current && proposalText && !dismissed && !editing

      var kind = live ? 'dsh' : current ? 'pulse' : proposing ? 'proposal' : 'empty'
      var toggle = function () {
        if (kind === 'proposal') return
        setError('')
        if (kind === 'empty' && !open) {
          setOpen(true)
          setEditing('new')
          return
        }
        setOpen(!open)
        if (open) setEditing('')
      }

      var bar
      if (kind === 'proposal') {
        bar = h(
          'div',
          { className: '__rp_goal', 'data-kind': 'proposal', 'data-source': ideaProposal ? 'idea' : modelProposal ? 'model' : 'title', title: ideaProposal ? t('goalIdeaTip') : modelProposal ? t('goalInferredModelTip') : t('goalInferredTip') },
          h('span', { className: '__rp_goalTag' }, ideaProposal ? t('goalTagIdea') : t('goalTagProposal')),
          h('span', { className: '__rp_goalMark', 'aria-hidden': 'true' }, '◇'),
          h('span', { className: '__rp_goalText' }, proposalText),
          inferring && !ideaProposal ? h('span', { className: '__rp_goalMeta', role: 'status' }, t('goalInferring')) : null,
          props.ideas && props.ideas.counts && (props.ideas.counts.open || props.ideas.counts.done)
            ? h('button', { type: 'button', className: '__rp_goalBtn', 'aria-expanded': open ? 'true' : 'false', onClick: function (event) { sfxFor(event, open ? 'collapse' : 'expand'); setOpen(!open) } }, fill(t('ideaBarCount'), 'n', props.ideas.counts.open) + (open ? ' ▴' : ' ▾'))
            : null,
          h('button', { type: 'button', className: '__rp_goalBtn', 'data-primary': '1', disabled: busy, onClick: function () { ideaProposal ? run(ideaFetch('POST', { sessionId: sessionId, goalFrom: ideaProposal.id })) : create(proposalText.slice(0, GOAL_TITLE_MAX), 'inferred') } }, t('goalAccept')),
          h('button', { type: 'button', className: '__rp_goalBtn', disabled: busy, onClick: function () { setOpen(true); setEditing('new') } }, t('goalEdit')),
          h('button', { type: 'button', className: '__rp_goalBtn', 'aria-label': t('goalDismiss'), title: t('goalDismiss'), disabled: busy, onClick: function () { dismissGoal(sessionId); setDismissed(true) } }, '✕'),
        )
      } else {
        // 推断出的目标还没确认：「待确认 ◇」（空心）；确认后才是「追踪中 ◆」。
        var unconfirmed = kind === 'pulse' && current.source === 'inferred'
        var mark = kind === 'empty' ? '+' : unconfirmed ? '◇' : '◆'
        // DSH /goal 的轮数画成分段进度（最多 24 段，轮数更多时按比例点亮）。
        var segments = null
        if (kind === 'dsh' && dsh.max > 0) {
          var count = Math.min(24, dsh.max)
          var lit = Math.round((Math.min(dsh.rounds, dsh.max) / dsh.max) * count)
          segments = h(
            'span',
            { className: '__rp_goalProgress', 'aria-hidden': 'true' },
            Array.from({ length: count }, function (_, index) {
              return h('span', { key: index, className: '__rp_goalSeg', 'data-on': index < lit ? '1' : undefined })
            }),
          )
        }
        var text = kind === 'dsh' ? dsh.objective : kind === 'pulse' ? current.title : t('goalEmpty')
        var meta = ''
        if (kind === 'dsh') {
          meta = phaseText(t, dsh.phase)
          if (dsh.max) meta += ' · ' + fill(fill(t('goalRounds'), 'n', dsh.rounds), 'max', dsh.max)
        } else if (pulse.doneCount) {
          meta = fill(t('goalDoneCount'), 'n', pulse.doneCount)
        }
        if (props.ideas && props.ideas.counts && props.ideas.counts.open) meta = (meta ? meta + ' · ' : '') + fill(t('ideaBarCount'), 'n', props.ideas.counts.open)
        bar = h(
          'div',
          {
            className: '__rp_goal',
            'data-kind': kind,
            'data-phase': kind === 'dsh' ? dsh.phase : undefined,
            role: 'button',
            tabIndex: 0,
            'aria-expanded': open ? 'true' : 'false',
            title: kind === 'dsh' && dsh.blocked ? dsh.blocked : text,
            onClick: toggle,
            onKeyDown: function (event) {
              if (event.target !== event.currentTarget) return
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                toggle()
              }
            },
          },
          kind === 'empty' ? null : h('span', { className: '__rp_goalTag', title: unconfirmed ? t('goalInferredTip') : undefined }, unconfirmed ? t('goalTagUnconfirmed') : t('goalTagTracked')),
          h('span', { className: '__rp_goalMark', 'aria-hidden': 'true' }, mark),
          kind === 'dsh' ? h('span', { className: '__rp_goalBadge' }, t('goalDshBadge')) : null,
          h('span', { className: '__rp_goalText' }, text),
          focusOn && kind !== 'empty' ? h('span', { className: '__rp_goalBadge' }, t('goalFocusOn')) : null,
          meta ? h('span', { className: '__rp_goalMeta' }, meta) : null,
          segments,
        )
      }

      var drawer = null
      if (open || editing) {
        var parts = []
        if (kind === 'dsh') {
          parts.push(h('div', { key: 'dsh', className: '__rp_goalNote' }, dsh.blocked ? dsh.blocked + ' — ' + t('goalDshManaged') : t('goalDshManaged')))
        } else if (kind === 'pulse' && editing !== 'edit') {
          parts.push(
            h(
              'div',
              { key: 'acts', className: '__rp_goalActions' },
              current.source === 'inferred'
                ? h('button', { type: 'button', className: '__rp_goalBtn', 'data-primary': '1', disabled: busy, onClick: function () { patch(current.id, { confirm: true }) } }, t('goalConfirm'))
                : null,
              h('button', { type: 'button', className: '__rp_goalBtn', 'data-primary': current.source !== 'inferred' ? '1' : undefined, disabled: busy, onClick: function (event) { if (event && event.nativeEvent) event.nativeEvent.__rpSfx = true; patch(current.id, { status: 'done' }, function () { sfxPlay('done'); if (modelAllowed('collectIdeas') && props.ideas && props.ideas.counts && props.ideas.counts.open) ideaFetch('POST', { sessionId: sessionId, check: true }).catch(function () {}) }) } }, t('goalDone')),
              h('button', { type: 'button', className: '__rp_goalBtn', disabled: busy, onClick: function () { setEditing('edit') } }, t('goalEdit')),
              h('button', { type: 'button', className: '__rp_goalBtn', disabled: busy, onClick: function () { setEditing('new') } }, t('goalNew')),
              h('button', { type: 'button', className: '__rp_goalBtn', 'data-danger': '1', disabled: busy, onClick: function () { remove(current.id) } }, t('goalRemove')),
            ),
          )
        }
        if (editing === 'edit' && current) {
          parts.push(h(GoalInput, { key: 'edit', t: t, initial: current.title, busy: busy, onCancel: function () { setEditing('') }, onSubmit: function (title) { patch(current.id, { title: title, confirm: true }) } }))
        } else if (editing === 'new') {
          parts.push(h(GoalInput, { key: 'new', t: t, initial: !current && !live && !dismissed ? proposalText : '', busy: busy, onCancel: function () { setEditing(''); if (kind === 'empty' || kind === 'proposal') setOpen(false) }, onSubmit: function (title) { create(title, 'owner') } }))
          if (current || live) parts.push(h('div', { key: 'hint', className: '__rp_goalNote' }, live ? t('goalDshParallel') : t('goalReplaceHint')))
        } else if (kind === 'empty' || kind === 'dsh') {
          if (kind === 'empty') parts.push(h('div', { key: 'new-btn', className: '__rp_goalActions' }, h('button', { type: 'button', className: '__rp_goalBtn', 'data-primary': '1', onClick: function () { setEditing('new') } }, t('goalNew'))))
        }
        if (error) parts.push(h('div', { key: 'err', className: '__rp_goalErr', role: 'alert' }, error))
        parts.push(
          h(
            'label',
            { key: 'focus', className: '__rp_goalFocus' },
            h('input', {
              type: 'checkbox',
              checked: focusOn,
              onChange: function (event) {
                setPref('focusMode', event.target.checked)
              },
            }),
            h('span', null, t('goalFocusToggle')),
          ),
        )
        parts.push(h(IdeaPanel, { key: 'ideas', t: t, sessionId: sessionId, ideas: props.ideas }))
        if (pulse.history && pulse.history.length) {
          parts.push(h('div', { key: 'hist-title', className: '__rp_goalHistTitle' }, t('goalHistory')))
          pulse.history.slice(0, 10).forEach(function (item) {
            parts.push(
              h(
                'div',
                { key: item.id, className: '__rp_goalHist', 'data-status': item.status },
                h('span', { className: '__rp_goalMark', 'aria-hidden': 'true' }, item.status === 'done' ? '✓' : '↷'),
                item.dsh ? h('span', { className: '__rp_goalBadge' }, t('goalDshBadge')) : null,
                h('span', { className: '__rp_goalText', title: item.title }, item.title),
                h('span', { className: '__rp_goalMeta' }, (item.status === 'stale' ? t('goalStale') + ' · ' : '') + dateOnly(item.doneAt || item.updatedAt)),
                item.dsh ? null : h('button', { type: 'button', className: '__rp_goalBtn', disabled: busy, onClick: function () { patch(item.id, { status: 'open' }) } }, t('goalReopen')),
                h('button', { type: 'button', className: '__rp_goalBtn', 'data-danger': '1', 'aria-label': t('goalRemove'), title: t('goalRemove'), disabled: busy, onClick: function () { remove(item.id) } }, '✕'),
              ),
            )
          })
        }
        drawer = h('div', { className: '__rp_goalDrawer' }, parts)
      } else if (error) {
        drawer = h('div', { className: '__rp_goalDrawer' }, h('div', { className: '__rp_goalErr', role: 'alert' }, error))
      }
      return h('div', { className: '__rp_goalWrap' }, bar, drawer)
    }
