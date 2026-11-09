    /* ── ECHO 现场重建：Echo 详情里还原收藏那一轮 ─────────────────────────── */

    /**
     * 默认收起，点「重建现场」才去取（旧会话要解压磁盘日志）。展示：
     * 触发指令、轮次 / 用时 / 步数 / 工具次数 / 模型 / token、当轮加载的技能、
     * 一条时间轨道（每次工具调用一个刻度，位置 = 开始时刻，宽度 = 耗时，失败标红），
     * 以及耗时最多的几个工具。只有名字、时间和计数，不显示工具参数和结果。
     */

    CSS += '\n' + [
      '.__rp_scene{margin:0 16px 10px;border:1px solid rgba(255,127,0,.32);border-left:2px solid #ff7f00;border-radius:4px;background:rgba(255,127,0,.04);font-size:12.5px;line-height:1.5}',
      '.__rp_sceneHead{display:flex;align-items:center;gap:8px;padding:6px 10px}',
      '.__rp_sceneTag{font-size:10px;letter-spacing:.18em;color:#ff7f00;font-weight:600}',
      '.__rp_sceneHint{flex:1 1 auto;min-width:0;color:#9aa2ad;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
      '.__rp_sceneBtn{flex:none;border:1px solid rgba(255,127,0,.5);background:transparent;color:#ff9a3c;border-radius:3px;font:inherit;font-size:12px;padding:1px 8px;cursor:pointer}',
      '.__rp_sceneBtn:hover{background:rgba(255,127,0,.12)}',
      '.__rp_sceneBtn:disabled{opacity:.5;cursor:default}',
      '.__rp_sceneBody{padding:0 10px 10px;display:flex;flex-direction:column;gap:8px}',
      '.__rp_sceneAsk{color:#e7e9ec;border-left:2px solid rgba(255,127,0,.6);padding-left:8px;white-space:pre-wrap;word-break:break-word}',
      '.__rp_sceneStats{display:flex;flex-wrap:wrap;gap:4px 14px;color:#b8bdbb;font-variant-numeric:tabular-nums}',
      '.__rp_sceneStats b{color:#e7e9ec;font-weight:600}',
      '.__rp_sceneSkills{display:flex;flex-wrap:wrap;gap:4px}',
      '.__rp_sceneSkill{border:1px solid rgba(255,127,0,.45);color:#ffb26b;border-radius:3px;padding:0 6px;font-size:11.5px}',
      '.__rp_sceneTrack{position:relative;height:18px;border-top:1px solid rgba(255,255,255,.14);border-bottom:1px solid rgba(255,255,255,.14);background:repeating-linear-gradient(90deg,rgba(255,255,255,.06) 0 1px,transparent 1px 10%)}',
      '.__rp_sceneTick{position:absolute;top:3px;bottom:3px;min-width:2px;background:#ff7f00;opacity:.8;border-radius:1px}',
      '.__rp_sceneTick[data-skill="1"]{background:#ffd27a;opacity:1}',
      '.__rp_sceneTick[data-ok="0"]{background:#e5533d;opacity:1}',
      '.__rp_sceneAxis{display:flex;justify-content:space-between;color:#7d858f;font-size:10.5px;font-variant-numeric:tabular-nums}',
      '.__rp_sceneTop{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:2px 12px;color:#b8bdbb;font-variant-numeric:tabular-nums}',
      '.__rp_sceneTop span:first-child{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:#e7e9ec}',
      '.__rp_sceneErr{color:#e5533d}',
    ].join('\n')

    function sceneDuration(ms) {
      return ms > 0 ? formatMs(ms) : '—'
    }

    function sceneToolLabel(row) {
      if (row.name === 'skill' && row.skill) return nameOf('skill', row.skill) || row.skill
      return nameOf('tool', row.name) || row.name
    }

    function sceneStatsLine(t, scene) {
      var parts = [
        [t('sceneTurn'), String(scene.turn)],
        [t('sceneDuration'), scene.durationMs ? sceneDuration(scene.durationMs) : t('sceneOpen')],
        [t('sceneSteps'), String(scene.steps)],
        [t('sceneTools'), String(scene.toolCount)],
      ]
      if (scene.model) parts.push([t('sceneModel'), scene.model.replace(/^[^/]+\//, '') + (scene.reasoningEffort ? ' · ' + scene.reasoningEffort : '')])
      if (scene.usage && (scene.usage.inputTokens || scene.usage.outputTokens)) {
        parts.push([t('sceneTokens'), formatTokens(scene.usage.inputTokens) + ' / ' + formatTokens(scene.usage.outputTokens)])
      }
      return parts
    }

    function EchoScene(props) {
      var t = props.t
      var pair = React.useState({ status: 'idle', scene: null, error: '' })
      var state = pair[0]
      var setState = pair[1]
      var aliveRef = React.useRef(true)
      React.useEffect(function () {
        return function () {
          aliveRef.current = false
        }
      }, [])
      var load = function () {
        setState({ status: 'loading', scene: null, error: '' })
        fetch('/dsh-running-panel/echo?scene=' + encodeURIComponent(props.echoId))
          .then(function (response) {
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
          .then(function (value) {
            if (aliveRef.current) setState({ status: 'ready', scene: value.scene, error: '' })
          })
          .catch(function (error) {
            if (aliveRef.current) setState({ status: 'error', scene: null, error: String((error && error.message) || error) })
          })
      }
      var scene = state.scene
      var head = h(
        'div',
        { className: '__rp_sceneHead' },
        h('span', { className: '__rp_sceneTag' }, 'ECHO //'),
        h(
          'span',
          { className: '__rp_sceneHint', role: state.status === 'error' ? 'alert' : undefined },
          state.status === 'error'
            ? state.error === 'session_gone'
              ? t('sceneGone')
              : state.error === 'session required' || hostOutdated()
                ? t('hostOutdatedShort') // 旧 Host 没有 ?scene= 分支，落到兜底的 session required
                : fill(t('sceneFailed'), 'reason', state.error)
            : state.status === 'loading'
              ? t('sceneLoading')
              : scene
                ? t('sceneReady')
                : t('sceneIdle'),
        ),
        state.status === 'ready'
          ? null
          : h('button', { type: 'button', className: '__rp_sceneBtn', disabled: state.status === 'loading', onClick: load }, state.status === 'error' ? t('sceneRetry') : t('sceneLoad')),
      )
      if (!scene) return h('div', { className: '__rp_scene' }, head)

      var span = Math.max(1, scene.durationMs || scene.tools.reduce(function (max, row) {
        return Math.max(max, row.offsetMs + row.ms)
      }, 0))
      var body = [
        scene.ask ? h('div', { key: 'ask', className: '__rp_sceneAsk', title: t('sceneAsk') }, scene.ask) : null,
        h(
          'div',
          { key: 'stats', className: '__rp_sceneStats' },
          sceneStatsLine(t, scene).map(function (part) {
            return h('span', { key: part[0] }, part[0] + ' ', h('b', null, part[1]))
          }),
        ),
        scene.skills.length
          ? h(
              'div',
              { key: 'skills', className: '__rp_sceneSkills', 'aria-label': t('sceneSkills') },
              scene.skills.map(function (name) {
                return h('span', { key: name, className: '__rp_sceneSkill', title: name }, nameOf('skill', name) || name)
              }),
            )
          : null,
        scene.tools.length
          ? h(
              'div',
              { key: 'track', className: '__rp_sceneTrack', role: 'img', 'aria-label': fill(t('sceneTrackLabel'), 'n', scene.toolCount) },
              scene.tools.map(function (row, index) {
                var left = Math.min(100, (row.offsetMs / span) * 100)
                var width = Math.min(100 - left, (row.ms / span) * 100)
                return h('span', {
                  key: index,
                  className: '__rp_sceneTick',
                  'data-ok': row.ok === false ? '0' : undefined,
                  'data-skill': row.name === 'skill' ? '1' : undefined,
                  title: sceneToolLabel(row) + ' · ' + sceneDuration(row.ms) + (row.ok === false ? ' · ' + t('sceneError') : ''),
                  style: { left: left + '%', width: width + '%' },
                })
              }),
            )
          : null,
        scene.tools.length
          ? h('div', { key: 'axis', className: '__rp_sceneAxis' }, h('span', null, '0'), h('span', null, sceneDuration(span)))
          : null,
        scene.summary.length
          ? h(
              'div',
              { key: 'top', className: '__rp_sceneTop' },
              scene.summary.slice(0, 6).reduce(function (cells, row) {
                var key = row.name + ':' + (row.skill || '')
                cells.push(h('span', { key: key + ':n', title: row.skill || row.name }, sceneToolLabel(row)))
                cells.push(h('span', { key: key + ':c' }, '×' + row.n + (row.errors ? ' ' : ''), row.errors ? h('span', { className: '__rp_sceneErr' }, fill(t('sceneErrors'), 'n', row.errors)) : null))
                cells.push(h('span', { key: key + ':ms' }, sceneDuration(row.ms)))
                return cells
              }, []),
            )
          : h('div', { key: 'none', className: '__rp_sceneHint' }, t('sceneNoTools')),
        scene.toolsTruncated ? h('div', { key: 'trunc', className: '__rp_sceneHint' }, fill(t('sceneTruncated'), 'n', scene.tools.length)) : null,
      ]
      return h('div', { className: '__rp_scene' }, head, h('div', { className: '__rp_sceneBody' }, body))
    }
