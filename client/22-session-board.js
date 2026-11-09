    function SessionBoard(props) {
      var t = props.t
      var snapshot = props.snapshot
      var nodes = []
      nodes.push(storageWarning(snapshot, t))
      var phase = snapshot.session.phase
      var pinned = sortRunning(snapshot.running || [])
      var isPinned = function (item) {
        return Boolean(item && item.state && item.state.pinned)
      }
      var freeSkills = snapshot.skills.items.filter(function (item) {
        return !isPinned(item)
      })
      var categories = snapshot.categories || []
      var model = ringModel(categories)
      var tiltRef = React.useRef(null)
      useRingTilt(tiltRef)
      var dshGoal = useDshGoal(snapshot.session.id)
      var focusSince = prefs.focusMode === true ? goalFocusSince(dshGoal, snapshot.goal) : 0
      var searchPair = React.useState('')
      var query = searchPair[0]
      var setQuery = searchPair[1]
      var noticePair = React.useState('')
      var notice = noticePair[0]
      var setNotice = noticePair[1]
      var handleInsert = function (entry) {
        if (insertIntoComposer(composerToken(entry))) {
          setNotice('')
        } else {
          setNotice(t('insertFailed'))
        }
      }

      /* 预算方案：先 dryRun 看单，再确认应用；应用后可撤销一次。 */
      var planPair = React.useState(null)
      var planState = planPair[0]
      var setPlanState = planPair[1]
      var planBody = function (extra) {
        return Object.assign(
          {
            sessionId: snapshot.session.id || '',
            pins: prefs.pins,
            limitTokens: budgetLimitTokens(),
          },
          extra || {},
        )
      }
      var openPlan = function () {
        setPlanState({ status: 'loading' })
        fetch('/dsh-running-panel/optimize', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(planBody({ dryRun: true })),
        })
          .then(function (response) {
            if (!response.ok) throw new Error('plan')
            return response.json()
          })
          .then(function (plan) {
            if (!plan || !plan.id) throw new Error('plan')
            setPlanState({ status: 'ready', plan: plan })
          })
          .catch(function () {
            setPlanState({ status: 'error' })
          })
      }
      var openSavedUndo = function () {
        var saved = snapshot.undoPlan
        if (!saved || !saved.id || !Array.isArray(saved.applied) || !saved.applied.length) return
        setPlanState({ status: 'applied', plan: saved, moved: saved.applied.length })
      }
      var planAction = function (extra, done) {
        var state = planState
        if (!state || !state.plan) return
        setPlanState({ status: 'applying', plan: state.plan, undoing: extra && extra.undo === true, moved: state.moved })
        fetch('/dsh-running-panel/optimize', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(planBody(Object.assign({ planId: state.plan.id }, extra || {}))),
        })
          .then(function (response) {
            if (!response.ok) throw new Error('plan action')
            return response.json()
          })
          .then(function (value) {
            done(value && value.ok === true, state.plan, value)
          })
          .catch(function () {
            done(false, state.plan)
          })
      }
      var applyPlan = function (names) {
        planAction({ park: Array.isArray(names) ? names : [] }, function (ok, plan, value) {
          var movedNames = value && Array.isArray(value.movedNames)
            ? value.movedNames
            : (Array.isArray(names) ? names.slice(0, (value && value.moved) || 0) : [])
          var applied = Array.from(new Set((plan.applied || []).concat(movedNames)))
          setPlanState(
            ok || (value && value.moved > 0)
              ? { status: 'applied', plan: Object.assign({}, plan, { applied: applied }), moved: applied.length, failedNames: (value && value.failed) || [] }
              : { status: 'failed', plan: plan },
          )
        })
      }
      var undoPlan = function () {
        planAction({ undo: true }, function (ok, plan, value) {
          var restored = value && Array.isArray(value.movedNames) ? value.movedNames : []
          var remaining = Array.isArray(plan.applied)
            ? plan.applied.filter(function (name) { return restored.indexOf(name) === -1 })
            : null
          setPlanState(ok ? null : {
            status: 'applied', plan: remaining ? Object.assign({}, plan, { applied: remaining }) : plan, undoFailed: true,
            moved: remaining && Array.isArray(value && value.movedNames)
              ? remaining.length
              : Math.max(0, (planState.moved || 0) - ((value && value.moved) || 0)),
            failedNames: (value && value.failed) || [],
          })
        })
      }
      if (planState && planState.plan) {
        nodes.push(
          h(BudgetPlanDialog, {
            key: planState.plan.id + ':' + JSON.stringify(planState.plan.applied || []),
            t: t,
            plan: planState.plan,
            busy: planState.status === 'applying',
            applied: planState.status === 'applied' || (planState.status === 'applying' && planState.undoing),
            moved: planState.moved || 0,
            failedNames: planState.failedNames || [],
            failed: planState.status === 'failed',
            undoFailed: planState.undoFailed === true,
            onApply: applyPlan,
            onUndo: undoPlan,
            onClose: function () {
              setPlanState(null)
            },
          }),
        )
      } else if (planState && planState.status === 'error') {
        nodes.push(h('div', { key: 'plan-error', className: '__rp_planError' }, t('planFailed')))
      }

      // 搜索：多关键词并集；一有查询就把下面所有分区（含英雄区）让位给结果。
      nodes.push(
        h(SearchBar, {
          key: 'search',
          t: t,
          value: query,
          onChange: function (value) {
            setNotice('')
            setQuery(value)
          },
        }),
      )
      if (query.trim()) {
        nodes.push(
          h(SearchResults, {
            key: 'search-results',
            t: t,
            results: searchEntries(buildSearchEntries(snapshot), query),
            onInsert: handleInsert,
            notice: notice,
          }),
        )
        return h(React.Fragment, null, nodes)
      }

      // 第一次用：后台模型调用要先征得同意（决定之后这块不再出现）。
      nodes.push(h(ModelConsent, { key: 'consent', t: t }))

      // 目标条：一行，点开是抽屉。在圆盘上方，先回答「现在该看什么」。
      nodes.push(
        h(GoalBar, {
          key: 'goal',
          t: t,
          sessionId: snapshot.session.id,
          sessionTitle: snapshot.session.title,
          goal: snapshot.goal,
          dsh: dshGoal,
          proposal: snapshot.goalProposal,
          ideas: snapshot.ideas,
          phase: phase,
          round: snapshot.session.round,
        }),
      )

      // 顶部英雄区：大圆盘居中，鼠标在面板里时按指针位置轻微倾斜。
      nodes.push(
        h(
          'div',
          { className: '__rp_hero', key: 'hero' },
          h(
            'div',
            { className: '__rp_heroTop' },
            h('span', { className: '__rp_heroCap' }, t('heroCaption')),
            h(
              'button',
              {
                type: 'button',
                className: '__rp_themeBtn',
                title: effectiveScheme() === 'light' ? t('themeDark') : t('themeLight'),
                'aria-label': effectiveScheme() === 'light' ? t('themeDark') : t('themeLight'),
                'data-scheme': effectiveScheme(),
                onClick: function () {
                  setPanelScheme(effectiveScheme() === 'light' ? 'dark' : 'light')
                },
                style: {
                  border: '1px solid var(--dsw-alias-border-l2)',
                  background: 'transparent',
                  color: 'var(--rp-amber)',
                  borderRadius: '4px',
                  minWidth: '26px',
                  minHeight: '26px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0',
                  cursor: 'pointer',
                  lineHeight: 1,
                },
              },
              effectiveScheme() === 'light' ? h(MoonIcon) : h(SunIcon),
            ),
            h(
              'button',
              {
                type: 'button',
                title: t('settingsTitle'),
                'aria-label': t('settingsTitle'),
                onClick: function () {
                  uiStore.set(!uiStore.open)
                },
                style: {
                  border: '1px solid var(--dsw-alias-border-l2)',
                  background: 'transparent',
                  color: 'var(--dsw-alias-label-secondary)',
                  borderRadius: '4px',
                  fontSize: '13px',
                  padding: '4px 7px',
                  minWidth: '26px',
                  minHeight: '26px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  lineHeight: 1.2,
                },
              },
              '⚙',
            ),
              h(SettingsHost, { t: t }),
              h(
                'span',
                { className: '__rp_chip', 'data-phase': phase },
                phaseLabel(t, phase),
                snapshot.session.round
                  ? h('span', { className: '__rp_chipRound' }, ' · ' + fill(t('round'), 'n', snapshot.session.round))
                  : null,
              ),
          ),
          h(
            'div',
            { className: '__rp_heroRow __rp_heroTilt', ref: tiltRef },
            h(
              'div',
              { className: '__rp_side __rp_sideLeft' },
              h('div', { className: '__rp_sideLabel' }, t('ringTitle')),
              h(RingLegend, { t: t, categories: categories, model: model }),
            ),
            h(
              'div',
              { className: '__rp_heroRing' },
              h(RingSvg, { t: t, categories: categories, model: model, size: 224, active: phase === 'active', phase: phase, sound: true, intro: props.reveal === true, budget: snapshot.budget ? Object.assign({}, snapshot.budget, { limit: budgetLimitChars() }) : null }),
            ),
            snapshot.budget
              ? h(
                  'div',
                  { className: '__rp_side __rp_sideRight', title: t('budgetTip') },
                  h('div', { className: '__rp_sideLabel' }, t('budgetLabel')),
                  h(
                    'div',
                    { className: '__rp_sideValue' },
                    Math.min(999, Math.round((snapshot.budget.chars / budgetLimitChars()) * 100)) + '%',
                  ),
                  h(
                    'div',
                    { className: '__rp_sideSub' },
                    formatTokens(Math.round(snapshot.budget.chars / 4)) + ' / ' + formatTokens(budgetLimitTokens()),
                  ),
                  // 技能装配：战术风格装配窗口（配置页签、预算条、磁贴、详情、预演应用）。
                  h(LoadoutButton, { t: t, sessionId: snapshot.session.id }),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: '__rp_optimize',
                      title: t('optimizeTip'),
                      onClick: openPlan,
                    },
                    t('optimize'),
                  ),
                  snapshot.undoPlan && Array.isArray(snapshot.undoPlan.applied) && snapshot.undoPlan.applied.length > 0
                    ? h(
                        'button',
                        {
                          type: 'button',
                          className: '__rp_optimize',
                          title: t('planRecoverUndoTip'),
                          disabled: Boolean(planState && planState.status === 'applying'),
                          onClick: openSavedUndo,
                        },
                        t('planRecoverUndo'),
                      )
                    : null,
                )
              : null,
          ),
          snapshot.context || (snapshot.tokens && (snapshot.tokens.roundInput || snapshot.tokens.roundOutput))
            ? h(
                'div',
                { className: '__rp_telemetry', key: 'telemetry' },
                snapshot.context
                  ? h(
                      'div',
                      { className: '__rp_telemetryCard', title: t('contextTip') },
                      h(
                        'div',
                        { className: '__rp_telemetryHead' },
                        h('span', { className: '__rp_telemetryKicker' }, 'CONTEXT'),
                        h('span', { className: '__rp_telemetryName' }, t('contextLabel')),
                        h(
                          'span',
                          { className: '__rp_telemetryValue' },
                          snapshot.context.pct != null ? snapshot.context.pct + '%' : t('contextUnknown'),
                        ),
                      ),
                      h(
                        'div',
                        { className: '__rp_telemetryBar' },
                        h('i', {
                          style: {
                            width: (snapshot.context.pct != null ? Math.min(100, snapshot.context.pct) : 0) + '%',
                          },
                        }),
                      ),
                      h(
                        'div',
                        { className: '__rp_telemetryFoot' },
                        formatTokens(snapshot.context.pressureTokens) +
                          ' / ' +
                          formatTokens(snapshot.context.contextWindow) +
                          ' tokens',
                      ),
                    )
                  : null,
                snapshot.tokens && (snapshot.tokens.roundInput || snapshot.tokens.roundOutput)
                  ? h(
                      'div',
                      { className: '__rp_telemetryCard', title: t('tokenTip') },
                      h(
                        'div',
                        { className: '__rp_telemetryHead' },
                        h('span', { className: '__rp_telemetryKicker' }, 'ROUND I/O'),
                        h('span', { className: '__rp_telemetryName' }, t('tokenRound')),
                        h(
                          'span',
                          { className: '__rp_telemetryValue' },
                          formatTokens(snapshot.tokens.roundInput) +
                            ' / ' +
                            formatTokens(snapshot.tokens.roundOutput),
                        ),
                      ),
                      h(
                        'div',
                        { className: '__rp_telemetryIO' },
                        h('span', { className: '__rp_telemetryIOKey' }, 'IN'),
                        h('b', null, formatTokens(snapshot.tokens.roundInput)),
                        h('span', { className: '__rp_telemetryIOKey' }, 'OUT'),
                        h('b', null, formatTokens(snapshot.tokens.roundOutput)),
                      ),
                    )
                  : null,
              )
            : null,
        ),
      )

      // 诊断：可能卡住的信号排在最前面，因为它是唯一“需要你现在处理”的信息。
      if (snapshot.alerts && snapshot.alerts.length) {
        nodes.push(
          h(
            'section',
            { className: '__rp_group __rp_alerts', key: 'alerts' },
            h(
              'div',
              { className: '__rp_groupHead' },
              h('h3', { className: '__rp_groupTitle' }, t('alertsTitle')),
              h('span', { className: '__rp_groupCount' }, String(snapshot.alerts.length)),
            ),
            h(
              'div',
              { className: '__rp_section' },
              snapshot.alerts.map(function (alert) {
                var template = alert.kind === 'errors' ? t('alertErrors') : t('alertRepeat')
                var text = fill(fill(template, 'tool', nameOf('tool', alert.tool)), 'n', alert.count)
                return h(
                  'div',
                  { key: alert.kind + ':' + alert.tool, className: '__rp_alertRow' },
                  h('span', { className: '__rp_warnTag', 'aria-hidden': 'true' }, '!'),
                  h('span', null, text),
                )
              }),
            ),
          ),
        )
      }

      // 成本估算：明确标注是提示词估算，不是供应商账单。
      if (snapshot.cost && snapshot.cost.top && snapshot.cost.top.length) {
        nodes.push(
          h(GroupSection, {
            key: 'cost',
            id: 'cost',
            t: t,
            defaultOpen: false,
            title: t('costTitle'),
            count:
              fill(t('costTotal'), 'n', formatTokens(snapshot.cost.totalTokens)) +
              (prefs.pricing.inputPerM > 0
                ? ' · ≈¥' + formatRmb((snapshot.cost.totalTokens / 1000000) * prefs.pricing.inputPerM) + ' ' + t('costRmbTip')
                : ' · ' + t('costRmbUnset')),
            body: h(
              'div',
              { className: '__rp_section' },
              h('div', { className: '__rp_sheetHint' }, t('costHint')),
              snapshot.cost.top.map(function (row) {
                return h(
                  'div',
                  { key: row.kind + ':' + row.name, className: '__rp_row', 'data-state': 'idle' },
                  h('span', { className: '__rp_dot', 'aria-hidden': 'true' }),
                  h('span', { className: '__rp_name' }, nameOf(row.kind, row.name)),
                  h('span', { className: '__rp_costTag', title: t('costRowTip') }, '~' + formatTokens(row.tokens) + ' tok'),
                  h('span', { className: '__rp_rowMeta' }, row.kind === 'skill' ? t('costKindSkill') : t('costKindTool')),
                )
              }),
            ),
          }),
        )
      }

      // 置顶区：技能与工具混排，谁被调用过就浮到这里；回合结束变淡，4 轮没再调用回落原分组。
      if (pinned.length) {
        nodes.push(
          h(GroupSection, {
            key: 'running',
            id: 'running',
            t: t,
            className: '__rp_group __rp_pinned',
            title: t('runningSection'),
            count: pinned.length,
            meta: h('span', { className: '__rp_groupTags' }, tagSummaryOf(t, pinned)),
            body: h(
              'div',
              { className: '__rp_section' },
              pinned.map(function (entry) {
                var record = entry.state || {}
                var stateName = record.round ? (phase === 'spent' ? 'spent' : 'active') : 'spent'
                var meta = record.round ? fill(t('roundCount'), 'n', record.round) : ''
                if (record.total > (record.round || 0)) {
                  meta += (meta ? ' · ' : '') + fill(t('totalCount'), 'n', record.total)
                }
                if (record.lastMs) meta += (meta ? ' · ' : '') + formatMs(record.lastMs)
                if (record.at) meta += (meta ? ' · ' : '') + fill(t('lastAt'), 't', formatTime(record.at))
                var hint =
                  record.misses > 0
                    ? fill(t('fadingTip'), 'n', Math.max(0, PIN_LIMIT - record.misses))
                    : t('runningHint')
                return h(
                  'div',
                  {
                    key: entry.kind + ':' + entry.name,
                    className: '__rp_row',
                    'data-state': stateName,
                    'data-warn': record.error ? '1' : undefined,
                    style: { opacity: fadeOf(record.misses, !record.round || phase === 'spent') },
                    title: hint,
                  },
                  h('span', { className: '__rp_dot', 'aria-hidden': 'true' }),
                  h('span', { className: '__rp_name' }, nameOf(entry.kind, entry.name)),
                  altNameOf(entry.kind, entry.name)
                    ? h('span', { className: '__rp_nameAlt' }, altNameOf(entry.kind, entry.name))
                    : null,
                  h('span', { className: '__rp_rowMeta' }, meta),
                )
              }),
            ),
          }),
        )
      }

      nodes.push(
        h(GroupSection, {
          key: 'skills',
          id: 'skills',
          t: t,
          title: t('skills'),
          count: snapshot.skills.count,
          meta: [
            snapshot.skills.items.length
              ? h('span', { key: 'tags', className: '__rp_groupTags' }, tagSummary(t, 'skill', snapshot.skills.items))
              : null,
            snapshot.skills.observable
              ? null
              : h('span', { key: 'unobs', className: '__rp_unobservable' }, t('unobservable')),
          ],
          body: h(
            'div',
            { className: '__rp_section' },
            freeSkills.length
              ? bucketByLib('skill', freeSkills).map(function (bucket) {
                  return h(LibraryGroup, {
                    key: bucket.lib,
                    t: t,
                    kind: 'skill',
                    lib: bucket.lib,
                    items: bucket.items,
                    phase: phase,
                  })
                })
              : snapshot.skills.items.length
                ? null
                : h('span', { className: '__rp_empty' }, t('emptyGroup')),
          ),
        }),
      )

      nodes.push(
        h(GroupSection, {
          key: 'tools',
          id: 'tools',
          t: t,
          title: t('tools'),
          count: snapshot.tools.total,
          meta: snapshot.tools.observable ? null : h('span', { className: '__rp_unobservable' }, t('unobservable')),
          body: snapshot.tools.groups.map(function (group) {
            var items = group.items.filter(function (item) {
              return !isPinned(item)
            })
            return h(
              'div',
              { className: '__rp_section', key: group.id },
              h(
                'div',
                { className: '__rp_sectionTitle' },
                groupTitle(t, group) + ' · ' + String(group.items.length),
                group.items.length ? h('span', { className: '__rp_groupTags' }, '  ' + tagSummary(t, 'tool', group.items)) : null,
              ),
              items.length
                ? bucketByLib('tool', items).map(function (bucket) {
                    return h(LibraryGroup, {
                      key: bucket.lib,
                      t: t,
                      kind: 'tool',
                      lib: bucket.lib,
                      items: bucket.items,
                      phase: phase,
                    })
                  })
                : null,
            )
          }),
        }),
      )

      nodes.push(
        h(GroupSection, {
          key: 'agents',
          id: 'agents',
          t: t,
          title: t('agents'),
          meta: snapshot.agents.observable ? null : h('span', { className: '__rp_unobservable' }, t('unobservable')),
          body: [
            h(
              'div',
              { className: '__rp_section', key: 'persona' },
              h('div', { className: '__rp_sectionTitle' }, t('persona')),
              h(
                'div',
                { className: '__rp_row', 'data-state': snapshot.agents.persona.observable ? 'active' : 'idle' },
                h('span', { className: '__rp_dot', 'aria-hidden': 'true' }),
                h('span', { className: '__rp_name' }, snapshot.agents.persona.label || t('noPersona')),
                h(
                  'span',
                  { className: '__rp_desc' },
                  snapshot.agents.persona.preset
                    ? fill(t('agentPresetLine'), 'x', snapshot.agents.persona.preset)
                    : snapshot.agents.persona.source || '',
                ),
              ),
            ),
            soulScope
              ? h(SoulPersonaBlock, {
                  key: 'soul',
                  t: t,
                  scope: soulScope,
                  sessionId: snapshot.session.id,
                })
              : null,
            h(
              'div',
              { className: '__rp_section', key: 'subagents' },
              h('div', { className: '__rp_sectionTitle' }, t('subagents') + ' · ' + String(snapshot.agents.children.length)),
              snapshot.agents.children.length
                ? snapshot.agents.children.map(function (child) {
                    return h(ChildNode, { key: child.id, t: t, child: child })
                  })
                : h('span', { className: '__rp_empty' }, t('noSubagents')),
            ),
          ],
        }),
      )


      // 冷层：已停用的技能可以在这里一键移回来（预算会随之上升）。
      if (snapshot.cold && snapshot.cold.items && snapshot.cold.items.length) {
        nodes.push(
          h(GroupSection, {
            key: 'cold',
            id: 'cold',
            t: t,
            title: t('coldTitle'),
            count: String(snapshot.cold.count) + ' · ' + String(snapshot.cold.chars) + ' 字符',
            body: h(
              'div',
              { className: '__rp_section' },
              bucketByLib('skill', snapshot.cold.items).map(function (bucket) {
                return h(ColdGroup, { key: bucket.lib, t: t, lib: bucket.lib, items: bucket.items })
              }),
            ),
          }),
        )
      }

      // 历史：落盘后的跨会话累计，重启不丢。按安装批次分组，每行直接显示累计次数与工时占比。
      if (snapshot.history && snapshot.history.top && snapshot.history.top.length) {
        nodes.push(
          h(GroupSection, {
            key: 'history',
            id: 'history',
            t: t,
            title: t('historyTitle'),
            count: fill(t('historySince'), 'd', dateOnly(snapshot.history.since)),
            body: h(HistoryGroups, { t: t, rows: snapshot.history.top }),
          }),
        )
      }

      // 自动提议收藏：没有提议时不渲染。
      nodes.push(
        h(EchoSuggestions, {
          key: 'echo-suggest',
          t: t,
          sessionId: snapshot.session.id,
          phase: phase,
          round: snapshot.session.round,
        }),
      )

      nodes.push(
        h(EchoGroup, {
          key: 'echo',
          t: t,
          sessionId: snapshot.session.id,
          sessionTitle: snapshot.title,
        }),
      )

      return h(FocusContext.Provider, { value: focusSince }, nodes)
    }

