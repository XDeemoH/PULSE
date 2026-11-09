    /* ── 技能装配窗口（战术装备界面式） ─────────────────────────────── */

    /**
     * 打开时整个 DSH 界面模糊压暗成景深背景；左边是一个向右倾斜的大圆盘（视觉 / 编码 / 思考 / 执行
     * 四类占比 + 内圈预算），右边是装配窗口：顶部配置页签、四张数据卡、按占用分段的预算条、
     * 按类别分列的技能磁贴、详情栏、底部按键提示。
     * 拖磁贴到预算条或圆盘上 = 装上，把预算条上的段拖回技能区 = 卸下，点一下也能装卸。
     * 「应用」先预演（停用 / 恢复 / 保留别的对话在用的），确认才搬目录，可撤销。
     */

    CSS += '\n' + [
      '.__rp_lo{position:fixed;inset:0;z-index:440;display:flex;align-items:center;justify-content:center;gap:36px;padding:28px 32px;box-sizing:border-box;overscroll-behavior:contain;color:#d9dee2;font-size:13px;line-height:1.45;background:rgba(6,9,11,.32);animation:__rp_loIn var(--rp-menu-fade,.14s) ease-out both}',
      '.__rp_lo[data-blur="1"]{-webkit-backdrop-filter:blur(var(--rp-menu-blur,10px)) saturate(.8) brightness(.62);backdrop-filter:blur(var(--rp-menu-blur,10px)) saturate(.8) brightness(.62)}',
      // 只淡入不透明度：模糊半径从 0 动画到 12px 要每帧重新模糊整个 DSH 页面，打开时明显发慢。
      '@keyframes __rp_loIn{from{opacity:0}}',
      '.__rp_loStage{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:14px;perspective:1100px}',
      '.__rp_loRing{transform:rotateY(18deg);transform-origin:center;transition:transform .3s ease-out,filter .2s ease-out}',
      '.__rp_loRing[data-drop="1"]{filter:drop-shadow(0 0 18px rgba(255,138,31,.45))}',
      '.__rp_loLegend{width:260px;transform:rotateY(18deg);display:flex;flex-direction:column;gap:3px}',
      '.__rp_loLegendRow{display:flex;align-items:center;gap:8px}',
      '.__rp_loLegendRow i{width:9px;height:9px;flex:none}',
      '.__rp_loLegendRow b{margin-left:auto;font-weight:500;font-variant-numeric:tabular-nums}',
      '.__rp_loLegendRow[data-bias="1"] b{color:var(--rp-amber,#ff8a1f)}',
      '.__rp_loPanel{box-sizing:border-box;flex:0 1 1280px;min-width:0;max-height:calc(100vh - 56px);overflow:hidden;background:rgba(14,19,23,.92);border:1px solid #2b3338;border-radius:6px;padding:18px 22px;display:flex;flex-direction:column;gap:14px}',
      '.__rp_loPanel > *{animation:__rp_mosaicIn 1.1s steps(5,end) both}',
      ...[1, 2, 3, 4, 5, 6, 7].map(function (n) { return '.__rp_loPanel > *:nth-child(' + n + '){animation-delay:' + (120 + (n - 1) * 90) + 'ms}' }),
      '.__rp_loHead{display:flex;align-items:center;gap:14px;flex-wrap:wrap;border-bottom:1px solid #2b3338;padding-bottom:8px}',
      '.__rp_loKicker{color:var(--rp-amber,#ff8a1f);letter-spacing:.18em;font-size:11px;font-weight:600}',
      '.__rp_loTitle{font-size:16px;font-weight:600}',
      '.__rp_loTab{background:none;border:0;border-bottom:2px solid transparent;color:#8a949b;font:inherit;padding:2px 2px 4px;cursor:pointer}',
      '.__rp_loTab[aria-selected="true"]{color:#e7e9ec;border-bottom-color:var(--rp-amber,#ff8a1f)}',
      '.__rp_loTab:hover{color:#e7e9ec}',
      '.__rp_loStats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}',
      '.__rp_loStat{border:1px solid #2b3338;padding:8px 12px}',
      '.__rp_loStat span{display:block;color:#8a949b;font-size:11px}',
      '.__rp_loStat strong{font-size:22px;font-weight:600;font-variant-numeric:tabular-nums}',
      '.__rp_loStat small{color:#8a949b;font-size:11px;margin-left:4px}',
      '.__rp_loStat[data-over="1"] strong{color:var(--rp-rust,#e5533d)}',
      '.__rp_loBar{position:relative;height:30px;border:1px solid #2b3338;display:flex;gap:2px;padding:2px;overflow:hidden;box-sizing:border-box;transition:border-color .15s}',
      '.__rp_loBar[data-drop="1"]{border-color:var(--rp-amber,#ff8a1f)}',
      '.__rp_loSeg{flex:0 1 auto;min-width:2px;cursor:grab;transition:filter .12s}',
      '.__rp_loSeg:hover,.__rp_loSeg[data-focus="1"]{filter:brightness(1.35)}',
      '.__rp_loSeg[data-builtin="1"]{background:repeating-linear-gradient(45deg,#3a4248 0 4px,#30373c 4px 8px);cursor:default}',
      '.__rp_loLimit{position:absolute;top:0;bottom:0;width:2px;background:#fff;pointer-events:none;box-shadow:0 0 0 1px rgba(0,0,0,.5)}',
      '.__rp_loBarHint{display:flex;justify-content:space-between;gap:10px;color:#8a949b;font-size:11px}',
      '.__rp_loPanel > *{flex-shrink:0}',
      // 只有磁贴 + 详情这一块滚动，标题、预算条、底部按键始终可见、不被压住。
      '.__rp_loPanel > .__rp_loBody{flex:1 1 auto;min-height:200px;overflow:auto;overscroll-behavior:contain;padding-right:6px}',
      '.__rp_loBody{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:20px;align-items:start}',
      '.__rp_loBody > .__rp_loDetail{position:sticky;top:0}',
      '.__rp_loCols{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px 18px;align-content:start}',
      '.__rp_loLibs{display:flex;flex-direction:column;gap:6px;min-height:120px}',
      '.__rp_loLibs[data-drop="1"]{outline:1px dashed var(--rp-amber,#ff8a1f);outline-offset:4px}',
      '.__rp_loLib{border:1px solid #2b3338;background:rgba(160,170,178,.04)}',
      '.__rp_loLib[data-open="1"]{border-color:#3a4248}',
      '.__rp_loLibHead{display:flex;align-items:center;gap:8px;padding:2px 8px 2px 0}',
      '.__rp_loLibToggle{flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:10px;padding:9px 12px;border:0;background:none;color:#d9dee2;font:inherit;font-size:14px;text-align:left;cursor:pointer}',
      '.__rp_loLibToggle:hover{background:rgba(160,170,178,.08)}',
      '.__rp_loLibToggle:focus-visible{outline:2px solid #fff;outline-offset:-2px}',
      '.__rp_loLibCaret{width:12px;color:#8a949b}',
      '.__rp_loLibName{flex:1 1 auto;min-width:7em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}',
      '.__rp_loLibCount{flex:none;color:#8a949b;font-size:12px;font-variant-numeric:tabular-nums}',
      '.__rp_loLibStripe{flex:0 4 140px;min-width:24px;height:5px;display:flex;gap:1px}',
      '.__rp_loLibStripe i{display:block;height:5px;flex-basis:0}',
      '.__rp_loLibTok{flex:none;width:70px;text-align:right;color:#8a949b;font-size:12px;font-variant-numeric:tabular-nums}',
      '.__rp_loLibAll{flex:none;font-size:12px;padding:3px 10px}',
      '.__rp_loLib > .__rp_loCols{padding:4px 12px 10px;animation:__rp_mosaicIn .6s steps(4,end) both}',
      '.__rp_loColHead{color:#8a949b;font-size:11px;border-bottom:1px solid #2b3338;margin-bottom:8px;padding-bottom:3px;display:flex;justify-content:space-between}',
      '.__rp_loTile{display:flex;align-items:center;gap:6px;width:100%;box-sizing:border-box;margin-bottom:6px;padding:7px 10px;border:1px solid #3a4248;background:transparent;color:#d9dee2;font:inherit;font-size:13px;text-align:left;cursor:pointer;transition:transform .1s cubic-bezier(.22,1,.36,1),filter .14s ease-out .05s}',
      '.__rp_loTile:hover{transform:translateY(-1px);filter:brightness(1.12)}',
      '.__rp_loTile:active{transform:scale(.97)}',
      '.__rp_loTile:focus-visible,.__rp_loTile[data-focus="1"]{outline:2px solid #fff;outline-offset:-2px}',
      '.__rp_loTile[data-on="1"]{border-color:transparent;color:#1b1206}',
      '.__rp_loTile[data-locked="1"]{opacity:.6;cursor:not-allowed}',
      '.__rp_loTile[data-missing="1"]{opacity:.4}',
      '.__rp_loTileName{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.__rp_loTileTok{flex:none;font-variant-numeric:tabular-nums;font-size:11.5px;opacity:.85}',
      '.__rp_loDetail{border:1px solid #2b3338;padding:12px 14px;display:flex;flex-direction:column;gap:7px;align-self:start;position:sticky;top:0}',
      '.__rp_loDetailKicker{color:var(--rp-amber,#ff8a1f);font-size:11px;letter-spacing:.12em}',
      '.__rp_loDetailName{font-size:15px;font-weight:600}',
      '.__rp_loKV{display:flex;justify-content:space-between;gap:8px}',
      '.__rp_loKV span:first-child{color:#8a949b}',
      '.__rp_loCmp{height:4px;background:#2b3338}',
      '.__rp_loCmp i{display:block;height:4px}',
      '.__rp_loSub{color:#8a949b;font-size:11px;border-top:1px solid #2b3338;padding-top:4px;margin-top:2px}',
      '.__rp_loFoot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;border-top:1px solid #2b3338;padding-top:8px}',
      '.__rp_loKeys{display:flex;gap:12px;color:#8a949b;font-size:11px;flex-wrap:wrap;margin-right:auto}',
      '.__rp_loKeys kbd{font:inherit;color:#d9dee2}',
      '.__rp_loBtn{border:1px solid #3a4248;background:transparent;color:#d9dee2;font:inherit;padding:6px 14px;cursor:pointer}',
      '.__rp_loBtn:hover{border-color:var(--rp-amber,#ff8a1f)}',
      '.__rp_loBtn[data-primary="1"]{border-color:var(--rp-amber,#ff8a1f);color:var(--rp-amber,#ff8a1f)}',
      '.__rp_loBtn:disabled{opacity:.45;cursor:default}',
      '.__rp_loNote{color:#8a949b;font-size:12px}',
      '.__rp_loErr{color:#e5533d;font-size:12px}',
      '.__rp_loPreview{border:1px solid #2b3338;padding:9px 11px;display:flex;flex-direction:column;gap:6px}',
      '@media (max-width:1180px){.__rp_lo{flex-direction:column;justify-content:flex-start;overflow:auto}.__rp_loRing,.__rp_loLegend{transform:none}.__rp_loPanel{flex:0 0 auto;width:100%;max-height:none}.__rp_loPanel > .__rp_loBody{overflow:visible}.__rp_loBody > .__rp_loDetail{position:static}.__rp_loBody{grid-template-columns:minmax(0,1fr)}.__rp_loStats{grid-template-columns:repeat(2,minmax(0,1fr))}}',
      '@media (prefers-reduced-motion:reduce){.__rp_lo,.__rp_loPanel > *{animation:none!important}}',
    ].join('\n')

    var LO_GROUPS = ['visual', 'code', 'thought', 'ops']
    var LO_COLORS = { visual: '#ff8a1f', code: '#2f8f8d', thought: '#e8b93c', ops: '#c8553a' }
    var LO_DRAG = 'text/x-pulse-skill'

    function loadoutFetch(query) {
      return fetch('/dsh-running-panel/loadout' + (query || ''), { cache: 'no-store' }).then(function (response) {
        return response.json().catch(function () { return {} }).then(function (value) {
          if (!response.ok) throw new Error((value && value.error) || 'HTTP ' + response.status)
          return value
        })
      })
    }

    /** 装配的纯计算：分组占比、预算、偏向（导出给测试）。 */
    function loadoutStats(skills, equipped, builtinTokens, limit) {
      var byGroup = { visual: 0, code: 0, thought: 0, ops: 0 }
      var used = Number(builtinTokens) || 0
      var count = 0
      var week = Date.now() - 7 * 86400000
      var recent = 0
      skills.forEach(function (skill) {
        if (!equipped[skill.name]) return
        count += 1
        used += skill.tokens
        byGroup[LO_GROUPS.indexOf(skill.group) >= 0 ? skill.group : 'ops'] += skill.tokens
        if (skill.lastAt >= week) recent += 1
      })
      var userTotal = byGroup.visual + byGroup.code + byGroup.thought + byGroup.ops
      var bias = ''
      var best = 0
      LO_GROUPS.forEach(function (group) {
        if (byGroup[group] > best) {
          best = byGroup[group]
          bias = group
        }
      })
      return {
        used: used,
        count: count,
        recent: recent,
        byGroup: byGroup,
        share: LO_GROUPS.reduce(function (out, group) { out[group] = userTotal ? byGroup[group] / userTotal : 0; return out }, {}),
        bias: userTotal ? bias : '',
        limit: limit,
        over: used > limit,
      }
    }

    /** 按常用补满：在剩余预算里按累计使用次数从高到低装上（跳过找不到的）。 */
    function fillByUsage(skills, equipped, builtinTokens, limit) {
      var next = Object.assign({}, equipped)
      var used = (Number(builtinTokens) || 0) + skills.reduce(function (sum, s) { return sum + (next[s.name] ? s.tokens : 0) }, 0)
      skills
        .filter(function (s) { return !next[s.name] && s.movable !== false && s.uses > 0 })
        .sort(function (a, b) { return b.uses - a.uses || b.lastAt - a.lastAt })
        .forEach(function (s) {
          if (used + s.tokens > limit) return
          next[s.name] = true
          used += s.tokens
        })
      return next
    }

    function LoadoutRing(props) {
      var stats = props.stats
      var r = 36
      var c = 2 * Math.PI * r
      var offset = 0
      var arcs = []
      LO_GROUPS.forEach(function (group) {
        var share = stats.share[group]
        if (!share) return
        var len = Math.max(0, share * c - 1.2)
        arcs.push(h('circle', { key: group, cx: 50, cy: 50, r: r, fill: 'none', stroke: LO_COLORS[group], strokeWidth: 7, strokeDasharray: len.toFixed(2) + ' ' + (c - len).toFixed(2), strokeDashoffset: (-offset).toFixed(2), transform: 'rotate(-90 50 50)' }))
        offset += share * c
      })
      var ir = 27
      var ic = 2 * Math.PI * ir
      var pct = stats.limit ? Math.min(1, stats.used / stats.limit) : 0
      return h(
        'svg',
        { width: props.size, height: props.size, viewBox: '0 0 100 100', role: 'img', 'aria-label': props.label },
        h('circle', { cx: 50, cy: 50, r: 47, fill: 'none', stroke: '#2b3338', strokeWidth: 0.4 }),
        h('circle', { cx: 50, cy: 50, r: 45, fill: 'none', stroke: 'rgba(255,138,31,.35)', strokeWidth: 1.6, strokeDasharray: '.4 1.4' }),
        h('circle', { cx: 50, cy: 50, r: r, fill: 'none', stroke: '#252d32', strokeWidth: 7 }),
        arcs,
        h('circle', { cx: 50, cy: 50, r: ir, fill: 'none', stroke: '#2b3338', strokeWidth: 1.4 }),
        h('circle', { cx: 50, cy: 50, r: ir, fill: 'none', stroke: stats.over ? '#e5533d' : '#ff8a1f', strokeWidth: 1.4, strokeDasharray: (ic * pct).toFixed(2) + ' ' + ic.toFixed(2), transform: 'rotate(-90 50 50)' }),
        h('text', { x: 50, y: 47, textAnchor: 'middle', fill: '#e7e9ec', fontSize: 13, fontWeight: 600 }, String(stats.count)),
        h('text', { x: 50, y: 55, textAnchor: 'middle', fill: '#8a949b', fontSize: 4.6 }, props.countLabel),
        h('text', { x: 50, y: 63, textAnchor: 'middle', fill: stats.over ? '#e5533d' : '#ff8a1f', fontSize: 4.6 }, props.budgetLabel),
      )
    }

    /** 装配窗口里哪些库展开着：这一页里记住，下次打开还是那样。 */
    var loOpenLibsSeen = {}
    function LoadoutWindow(props) {
      var t = props.t
      var closingPair = useMenuClose(props.onClose)
      var requestClose = closingPair[1]
      var openPair = React.useState(function () { return Object.assign({}, loOpenLibsSeen) })
      var openLibs = openPair[0]
      var setOpenLibs = openPair[1]
      var dataPair = React.useState(null)
      var data = dataPair[0]
      var setData = dataPair[1]
      var equippedPair = React.useState(null)
      var equipped = equippedPair[0]
      var setEquipped = equippedPair[1]
      var tabPair = React.useState('current')
      var tab = tabPair[0]
      var setTab = tabPair[1]
      var focusPair = React.useState('')
      var focus = focusPair[0]
      var setFocus = focusPair[1]
      var previewPair = React.useState(null)
      var preview = previewPair[0]
      var setPreview = previewPair[1]
      var resultPair = React.useState(null)
      var result = resultPair[0]
      var setResult = resultPair[1]
      var busyPair = React.useState('')
      var busy = busyPair[0]
      var setBusy = busyPair[1]
      var errPair = React.useState('')
      var error = errPair[0]
      var setError = errPair[1]
      var noticePair = React.useState('')
      var notice = noticePair[0]
      var setNotice = noticePair[1]
      var namingPair = React.useState(false)
      var naming = namingPair[0]
      var setNaming = namingPair[1]
      var managePair = React.useState(false)
      var managing = managePair[0]
      var setManaging = managePair[1]
      var dropPair = React.useState('')
      var dropZone = dropPair[0]
      var setDropZone = dropPair[1]
      var aliveRef = React.useRef(true)

      var load = function (keepDraft) {
        return loadoutFetch('?session=' + encodeURIComponent(props.sessionId || sessionStore.id || '')).then(function (value) {
          if (!aliveRef.current) return
          setData(value)
          if (!keepDraft) {
            var live = {}
            ;(value.skills || []).forEach(function (s) { if (s.live) live[s.name] = true })
            setEquipped(live)
          }
        })
      }
      React.useEffect(function () {
        load(false).catch(function (failure) {
          if (aliveRef.current) setError(String((failure && failure.message) || failure))
        })
        sfxPlay('open')
        return function () {
          aliveRef.current = false
        }
      }, [])

      var skills = (data && data.skills) || []
      var byName = {}
      skills.forEach(function (s) { byName[s.name] = s })
      var draft = equipped || {}
      var builtinTokens = (data && data.builtin && data.builtin.tokens) || 0
      var contextWindow = (data && data.contextWindow) || budgetWindow().tokens
      // 窗口自己拿到了上下文大小：自动模式直接按它算（快照还没到也不会退回固定值）。
      var limit = prefs.budgetMode !== 'fixed' && autoBudgetTokens(contextWindow) ? autoBudgetTokens(contextWindow) : budgetLimitTokens()
      var stats = loadoutStats(skills, draft, builtinTokens, limit)
      var profiles = (data && data.profiles && data.profiles.profiles) || []

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
            setError(typeof profileErrorText === 'function' ? profileErrorText(t, code) : code)
          })
      }
      var setOn = function (name, on) {
        var skill = byName[name]
        if (!skill) return
        if (!on && skill.inUse && skill.inUse.length) {
          setNotice(fill(t('loLockedNotice'), 'sessions', skill.inUse.map(function (s) { return s.title }).join('、')))
          return
        }
        setNotice('')
        setPreview(null)
        setResult(null)
        setEquipped(function (previous) {
          var next = Object.assign({}, previous)
          if (on) next[name] = true
          else delete next[name]
          return next
        })
        sfxPlay(on ? 'expand' : 'collapse')
      }
      var pickTab = function (id) {
        setTab(id)
        setPreview(null)
        setResult(null)
        if (id === 'current') {
          var live = {}
          skills.forEach(function (s) { if (s.live) live[s.name] = true })
          setEquipped(live)
          return
        }
        var profile = profiles.find(function (p) { return p.id === id })
        if (!profile) return
        var next = {}
        profile.skills.forEach(function (name) { if (byName[name]) next[name] = true })
        // 别的对话正在用的技能不能卸：切到配置时也保持装着。
        skills.forEach(function (s) { if (s.live && s.inUse && s.inUse.length) next[s.name] = true })
        setEquipped(next)
      }
      var fill_ = function () {
        setEquipped(fillByUsage(skills, draft, builtinTokens, limit))
        sfxPlay('expand')
      }
      var clear = function () {
        var next = {}
        skills.forEach(function (s) { if (s.live && s.inUse && s.inUse.length) next[s.name] = true })
        setEquipped(next)
        sfxPlay('collapse')
      }
      var applyPreview = function () {
        var names = Object.keys(draft).filter(function (name) { return draft[name] })
        act('preview', profileFetch('POST', { previewSkills: names, sessionId: props.sessionId || sessionStore.id || '', label: tab === 'current' ? '' : ((profiles.find(function (p) { return p.id === tab }) || {}).name || '') }), setPreview)
      }
      var confirmApply = function () {
        act('apply', profileFetch('POST', { apply: preview.switchId }), function (value) {
          sfxPlay('done')
          setResult(value)
          setPreview(null)
          load(true).catch(function () {})
        })
      }
      var undo = function () {
        act('undo', profileFetch('POST', { undo: true }), function () {
          setResult(null)
          load(false).catch(function () {})
        })
      }

      var onKeyDown = function (event) {
        var typing = event.target && /^(INPUT|TEXTAREA)$/.test(event.target.tagName)
        if (event.key === 'Escape') {
          event.preventDefault()
          if (!busy) requestClose()
          return
        }
        if (typing) return
        if ((event.ctrlKey || event.metaKey) && (event.key === 's' || event.key === 'S')) {
          event.preventDefault()
          setNaming(true)
        } else if (event.key === 'f' || event.key === 'F') {
          event.preventDefault()
          fill_()
        } else if (event.key === 'Enter' && !preview && !result && event.target === event.currentTarget) {
          event.preventDefault()
          applyPreview()
        }
      }
      var dropProps = function (zone, onDrop) {
        return {
          'data-drop': dropZone === zone ? '1' : undefined,
          onDragOver: function (event) {
            event.preventDefault()
            if (dropZone !== zone) setDropZone(zone)
          },
          onDragLeave: function () {
            if (dropZone === zone) setDropZone('')
          },
          onDrop: function (event) {
            event.preventDefault()
            setDropZone('')
            var name = event.dataTransfer && event.dataTransfer.getData(LO_DRAG)
            if (name) onDrop(name)
          },
        }
      }
      var dragProps = function (name, from) {
        return {
          draggable: true,
          onDragStart: function (event) {
            if (event.dataTransfer) {
              event.dataTransfer.setData(LO_DRAG, name)
              event.dataTransfer.setData('text/plain', name)
              event.dataTransfer.effectAllowed = 'move'
            }
            setFocus(name)
          },
          'data-from': from,
        }
      }

      /* ── 左：倾斜大圆盘 + 四类图例 ── */
      var stage = h(
        'div',
        { className: '__rp_loStage' },
        h(
          'div',
          Object.assign({ className: '__rp_loRing', title: t('loRingTip') }, dropProps('ring', function (name) { setOn(name, true) })),
          h(LoadoutRing, { stats: stats, size: 320, label: t('loRingTip'), countLabel: t('loCountLabel'), budgetLabel: fill(t('loBudgetPct'), 'n', Math.round((stats.used / Math.max(1, stats.limit)) * 100)) }),
        ),
        h(
          'div',
          { className: '__rp_loLegend' },
          LO_GROUPS.map(function (group) {
            return h(
              'div',
              { key: group, className: '__rp_loLegendRow', 'data-bias': stats.bias === group ? '1' : undefined },
              h('i', { style: { background: LO_COLORS[group] } }),
              h('span', null, t('cat.' + group)),
              h('b', null, Math.round(stats.share[group] * 100) + '%' + (stats.bias === group ? ' · ' + t('loBias') : '')),
            )
          }),
          h('div', { className: '__rp_loNote', style: { marginTop: '4px' } }, stats.over ? fill(t('loOver'), 'n', formatTokens(stats.used - stats.limit)) : fill(t('loLeft'), 'n', formatTokens(stats.limit - stats.used))),
        ),
      )

      /* ── 右：装配窗口 ── */
      var head = h(
        'div',
        { key: 'head', className: '__rp_loHead', role: 'tablist' },
        h('span', { className: '__rp_loKicker' }, 'LOADOUT //'),
        h('span', { className: '__rp_loTitle' }, t('loTitle')),
        [{ id: 'current', name: t('loTabCurrent') }].concat(profiles).map(function (p) {
          return h('button', { key: p.id, type: 'button', role: 'tab', className: '__rp_loTab', 'aria-selected': tab === p.id ? 'true' : 'false', onClick: function () { pickTab(p.id) } }, p.name)
        }),
        h('button', { type: 'button', className: '__rp_loTab', onClick: function () { setNaming(true) } }, t('loTabNew')),
        h('button', { type: 'button', className: '__rp_loTab', onClick: function () { setManaging(true) } }, t('loManage')),
        h('button', { type: 'button', className: '__rp_loBtn', style: { marginLeft: 'auto' }, 'aria-label': t('profileClose'), disabled: Boolean(busy), onClick: requestClose }, '✕'),
      )
      var statCards = h(
        'div',
        { key: 'stats', className: '__rp_loStats' },
        h('div', { className: '__rp_loStat', 'data-over': stats.over ? '1' : undefined }, h('span', null, t('loStatBudget')), h('strong', null, formatTokens(stats.used)), h('small', null, '/ ' + formatTokens(stats.limit) + ' tok')),
        h('div', { className: '__rp_loStat' }, h('span', null, t('loStatCount')), h('strong', null, String(stats.count)), h('small', null, t('loCountLabel'))),
        h('div', { className: '__rp_loStat' }, h('span', null, t('loStatContext')), h('strong', null, contextWindow ? (Math.round((stats.used / contextWindow) * 1000) / 10) + '%' : '—')),
        h('div', { className: '__rp_loStat' }, h('span', null, t('loStatRecent')), h('strong', null, String(stats.recent)), h('small', null, '/ ' + stats.count)),
      )
      var scale = Math.max(stats.limit, stats.used, 1)
      var segs = skills
        .filter(function (s) { return draft[s.name] })
        .sort(function (a, b) { return LO_GROUPS.indexOf(a.group) - LO_GROUPS.indexOf(b.group) || b.tokens - a.tokens })
      var bar = h(
        'div',
        Object.assign({ key: 'bar', className: '__rp_loBar', role: 'list', 'aria-label': t('loBarLabel') }, dropProps('bar', function (name) { setOn(name, true) })),
        builtinTokens ? h('div', { className: '__rp_loSeg', 'data-builtin': '1', role: 'listitem', title: fill(fill(t('loBuiltin'), 'n', data.builtin.count), 'tok', formatTokens(builtinTokens)), style: { width: ((builtinTokens / scale) * 100) + '%' } }) : null,
        segs.map(function (s) {
          return h('div', Object.assign({
            key: s.name,
            className: '__rp_loSeg',
            role: 'listitem',
            'data-focus': focus === s.name ? '1' : undefined,
            title: (nameOf('skill', s.name) || s.name) + ' · ' + s.tokens + ' tok',
            style: { width: ((s.tokens / scale) * 100) + '%', background: LO_COLORS[s.group] || LO_COLORS.ops },
            onMouseEnter: function () { setFocus(s.name) },
            onClick: function () { setFocus(s.name) },
          }, dragProps(s.name, 'bar')))
        }),
        h('div', { className: '__rp_loLimit', style: { left: 'calc(' + ((stats.limit / scale) * 100) + '% - 1px)' } }),
      )
      var barHint = h(
        'div',
        { key: 'barhint', className: '__rp_loBarHint' },
        h('span', null, notice || t('loBarHint')),
        h('span', null, prefs.budgetMode === 'fixed' ? t('loLimitFixed') : contextWindow ? t('loLimitAuto') : t('loLimitFixed')),
      )

      // 技能区：按库分组、默认收起，点开才是具体技能（几十个技能也不会把窗口拉得很长）；
      // 也是「拖回来卸下」的放置区。库头显示装了几个、占多少、四类颜色条，可一键全装 / 全卸。
      var libOrder = []
      var byLib = {}
      skills.forEach(function (s) {
        var lib = s.lib || 'user'
        if (!byLib[lib]) {
          byLib[lib] = []
          libOrder.push(lib)
        }
        byLib[lib].push(s)
      })
      libOrder.sort(function (a, b) {
        return (a === 'user' ? 1 : 0) - (b === 'user' ? 1 : 0) || byLib[b].length - byLib[a].length || a.localeCompare(b)
      })
      var isOpen = function (lib) {
        if (typeof openLibs[lib] === 'boolean') return openLibs[lib]
        return libOrder.length <= 1
      }
      var toggleLib = function (lib) {
        var next = !isOpen(lib)
        loOpenLibsSeen[lib] = next
        setOpenLibs(Object.assign({}, openLibs, (function () { var o = {}; o[lib] = next; return o })()))
        sfxPlay(next ? 'expand' : 'collapse')
      }
      var setMany = function (list, on) {
        var skipped = []
        setPreview(null)
        setResult(null)
        setEquipped(function (previous) {
          var next = Object.assign({}, previous)
          list.forEach(function (s) {
            if (on) next[s.name] = true
            else if (s.inUse && s.inUse.length && next[s.name]) skipped.push(s)
            else delete next[s.name]
          })
          return next
        })
        setNotice(skipped.length ? fill(t('loLibKept'), 'n', skipped.length) : '')
        sfxPlay(on ? 'expand' : 'collapse')
      }
      var tileOf = function (s) {
        var on = Boolean(draft[s.name])
        var locked = on && s.inUse && s.inUse.length > 0
        var color = LO_COLORS[s.group] || LO_COLORS.ops
        return h(
          'button',
          Object.assign({
            key: s.name,
            type: 'button',
            className: '__rp_loTile',
            'data-on': on ? '1' : undefined,
            'data-locked': locked ? '1' : undefined,
            'data-focus': focus === s.name ? '1' : undefined,
            'aria-pressed': on ? 'true' : 'false',
            title: s.name,
            // 装上：整块填类别色；没装：左边一道类别色，分类信息不丢。
            style: on ? { background: color } : { boxShadow: 'inset 3px 0 0 ' + color },
            onMouseEnter: function () { setFocus(s.name) },
            onFocus: function () { setFocus(s.name) },
            onClick: function (event) {
              if (event && event.nativeEvent) event.nativeEvent.__rpSfx = true
              setOn(s.name, !on)
            },
          }, dragProps(s.name, 'library')),
          h('span', { className: '__rp_loTileName' }, (locked ? '🔒 ' : '') + (nameOf('skill', s.name) || s.name)),
          h('span', { className: '__rp_loTileTok' }, String(s.tokens)),
        )
      }
      var cols = h(
        'div',
        Object.assign({ className: '__rp_loLibs' }, dropProps('library', function (name) { setOn(name, false) })),
        libOrder.map(function (lib) {
          var list = byLib[lib].slice().sort(function (a, b) {
            return LO_GROUPS.indexOf(a.group) - LO_GROUPS.indexOf(b.group) || b.uses - a.uses || a.name.localeCompare(b.name)
          })
          var onList = list.filter(function (s) { return draft[s.name] })
          var onTokens = onList.reduce(function (sum, s) { return sum + s.tokens }, 0)
          var allOn = onList.length === list.length
          var open = isOpen(lib)
          var shares = LO_GROUPS.map(function (group) {
            return { group: group, n: onList.filter(function (s) { return s.group === group }).length }
          })
          return h(
            'div',
            { key: lib, className: '__rp_loLib', 'data-open': open ? '1' : undefined },
            h(
              'div',
              { className: '__rp_loLibHead' },
              h(
                'button',
                { type: 'button', className: '__rp_loLibToggle', 'aria-expanded': open ? 'true' : 'false', title: typeof libTip === 'function' ? libTip(t, lib, list.length) : lib, onClick: function () { toggleLib(lib) } },
                h('span', { className: '__rp_loLibCaret', 'aria-hidden': 'true' }, open ? '▾' : '▸'),
                h('span', { className: '__rp_loLibName' }, libLabel(lib)),
                h('span', { className: '__rp_loLibCount' }, onList.length + ' / ' + list.length),
                // 这个库装上的部分按四类上色；空的就是一条暗线。
                h(
                  'span',
                  { className: '__rp_loLibStripe', 'aria-hidden': 'true' },
                  shares.map(function (share) {
                    return share.n ? h('i', { key: share.group, style: { flexGrow: share.n, background: LO_COLORS[share.group] } }) : null
                  }),
                  h('i', { key: 'off', style: { flexGrow: list.length - onList.length, background: '#2b3338' } }),
                ),
                h('span', { className: '__rp_loLibTok' }, formatTokens(onTokens) + ' tok'),
              ),
              h('button', { type: 'button', className: '__rp_loBtn __rp_loLibAll', onClick: function () { setMany(list, !allOn) } }, allOn ? t('loLibAllOff') : t('loLibAllOn')),
            ),
            open ? h('div', { className: '__rp_loCols' }, list.map(tileOf)) : null,
          )
        }),
      )

      // 详情栏
      var focused = byName[focus] || segs[0] || skills[0]
      var detail = null
      if (focused) {
        var isOn = Boolean(draft[focused.name])
        var withIt = stats.used + (isOn ? 0 : focused.tokens)
        var withoutIt = stats.used - (isOn ? focused.tokens : 0)
        // 现在 → 装上后 / 卸下后
        var before = stats.used
        var afterUsed = isOn ? withoutIt : withIt
        var groupShareAfter = (function () {
          var total = LO_GROUPS.reduce(function (sum, g) { return sum + stats.byGroup[g] }, 0) + (isOn ? 0 : focused.tokens)
          var mine = stats.byGroup[focused.group] + (isOn ? 0 : focused.tokens)
          return total ? Math.round((mine / total) * 100) : 0
        })()
        detail = h(
          'div',
          { className: '__rp_loDetail' },
          h('div', { className: '__rp_loDetailKicker' }, t('loDetail')),
          h('div', { className: '__rp_loDetailName' }, nameOf('skill', focused.name) || focused.name),
          h('div', { className: '__rp_loNote' }, focused.name + ' · ' + (libLabel(focused.lib) || focused.lib) + ' · ' + t('cat.' + focused.group)),
          focused.description ? h('div', { style: { color: '#b9c0c5', fontSize: '12px' } }, tipOf('skill', focused.name, focused.description)) : null,
          h('div', { className: '__rp_loKV' }, h('span', null, t('loTokens')), h('span', null, focused.tokens + ' tok')),
          h('div', { className: '__rp_loKV' }, h('span', null, t('loUses')), h('span', null, '×' + focused.uses + (focused.lastAt ? ' · ' + dateOnly(focused.lastAt) : ''))),
          h('div', { className: '__rp_loKV' }, h('span', null, isOn ? t('loBudgetWithout') : t('loBudgetWith')), h('span', null, Math.round((before / Math.max(1, stats.limit)) * 100) + '% → ' + Math.round((afterUsed / Math.max(1, stats.limit)) * 100) + '%')),
          h('div', { className: '__rp_loCmp' }, h('i', { style: { width: Math.min(100, (before / scale) * 100) + '%', background: '#ff8a1f' } })),
          h('div', { className: '__rp_loCmp' }, h('i', { style: { width: Math.min(100, (afterUsed / scale) * 100) + '%', background: afterUsed > stats.limit ? '#e5533d' : '#e8b93c' } })),
          isOn ? null : h('div', { className: '__rp_loKV' }, h('span', null, t('loBiasAfter')), h('span', null, t('cat.' + focused.group) + ' ' + Math.round(stats.share[focused.group] * 100) + '% → ' + groupShareAfter + '%')),
          focused.inUse && focused.inUse.length ? h('div', { className: '__rp_loErr' }, fill(t('loInUse'), 'sessions', focused.inUse.map(function (s) { return s.title }).join('、'))) : null,
          focused.recent && focused.recent.length
            ? [h('div', { key: 'rt', className: '__rp_loSub' }, t('loRecent')), h('div', { key: 'rv', style: { fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '1px' } }, focused.recent.map(function (r, index) { return h('span', { key: index }, (r.title || r.sessionId) + ' · ' + dateOnly(r.at)) }))]
            : null,
          focused.together && focused.together.length
            ? [h('div', { key: 'tt', className: '__rp_loSub' }, t('loTogether')), h('div', { key: 'tv', style: { fontSize: '12px' } }, focused.together.map(function (name) { return nameOf('skill', name) || name }).join(' · '))]
            : null,
        )
      }
      var body = h('div', { key: 'body', className: '__rp_loBody' }, cols, detail)

      var lower = null
      if (naming) {
        lower = h(GoalInput, { key: 'naming', t: t, placeholder: t('profileNamePlaceholder'), busy: busy === 'save', onCancel: function () { setNaming(false) }, onSubmit: function (name) {
          act('save', profileFetch('POST', { name: name, skills: Object.keys(draft).filter(function (k) { return draft[k] }), libs: (prefs.pins && prefs.pins.libs) || [] }), function () {
            setNaming(false)
            load(true).catch(function () {})
          })
        } })
      } else if (preview) {
        var nothing = !preview.park.length && !preview.restore.length
        lower = h(
          'div',
          { key: 'preview', className: '__rp_loPreview' },
          h('div', { className: '__rp_switchGroup', 'data-kind': 'park' }, h('div', { className: '__rp_switchTitle' }, fill(t('profileWillPark'), 'n', preview.park.length)), h('div', { className: '__rp_switchNames' }, skillList(preview.park))),
          h('div', { className: '__rp_switchGroup', 'data-kind': 'restore' }, h('div', { className: '__rp_switchTitle' }, fill(t('profileWillRestore'), 'n', preview.restore.length)), h('div', { className: '__rp_switchNames' }, skillList(preview.restore.map(function (r) { return r.name })))),
          preview.keepInUse.length ? h('div', { className: '__rp_switchGroup' }, h('div', { className: '__rp_switchTitle' }, fill(t('profileKeepInUse'), 'n', preview.keepInUse.length)), h('div', { className: '__rp_switchNames' }, skillList(preview.keepInUse.map(function (r) { return r.name })))) : null,
          preview.missing.length ? h('div', { className: '__rp_switchGroup' }, h('div', { className: '__rp_switchTitle' }, fill(t('profileMissing'), 'n', preview.missing.length)), h('div', { className: '__rp_switchNames' }, skillList(preview.missing))) : null,
          nothing ? h('div', { className: '__rp_loNote' }, t('profileNothing')) : null,
          h(
            'div',
            { className: '__rp_loFoot', style: { borderTop: 0, paddingTop: 0 } },
            nothing ? null : h('button', { type: 'button', className: '__rp_loBtn', 'data-primary': '1', disabled: Boolean(busy), onClick: confirmApply }, busy === 'apply' ? t('profileApplying') : t('profileConfirm')),
            h('button', { type: 'button', className: '__rp_loBtn', disabled: Boolean(busy), onClick: function () { setPreview(null) } }, t('profileBack')),
          ),
        )
      } else if (result) {
        lower = h(
          'div',
          { key: 'result', className: '__rp_loPreview' },
          h('div', null, fill(fill(t('profileDone'), 'parked', result.parked.length), 'restored', result.restored.length)),
          result.failed && result.failed.length ? h('div', { className: '__rp_loErr' }, fill(t('profilePartFailed'), 'names', result.failed.map(function (row) { return row.name + '（' + row.error + '）' }).join('、'))) : null,
          h('div', { className: '__rp_loFoot', style: { borderTop: 0, paddingTop: 0 } }, h('button', { type: 'button', className: '__rp_loBtn', disabled: Boolean(busy), onClick: undo }, t('profileUndo')), h('button', { type: 'button', className: '__rp_loBtn', 'data-primary': '1', onClick: requestClose }, t('profileClose'))),
        )
      }
      var foot = h(
        'div',
        { key: 'foot', className: '__rp_loFoot' },
        h(
          'div',
          { className: '__rp_loKeys' },
          h('span', null, h('kbd', null, t('loKeyClick')), ' ', t('loKeyToggle')),
          h('span', null, h('kbd', null, '[F]'), ' ', t('loKeyFill')),
          h('span', null, h('kbd', null, '[Ctrl+S]'), ' ', t('loKeySave')),
          h('span', null, h('kbd', null, '[Enter]'), ' ', t('loKeyApply')),
          h('span', null, h('kbd', null, '[Esc]'), ' ', t('loKeyClose')),
        ),
        h('button', { type: 'button', className: '__rp_loBtn', disabled: !data || Boolean(busy), onClick: fill_ }, t('loFill')),
        h('button', { type: 'button', className: '__rp_loBtn', disabled: !data || Boolean(busy), onClick: clear }, t('loClear')),
        h('button', { type: 'button', className: '__rp_loBtn', disabled: !data || Boolean(busy), onClick: function () { pickTab('current') } }, t('loReset')),
        h('button', { type: 'button', className: '__rp_loBtn', disabled: !data || Boolean(busy), onClick: function () { setNaming(true) } }, t('loSave')),
        h('button', { type: 'button', className: '__rp_loBtn', 'data-primary': '1', disabled: !data || Boolean(busy), onClick: applyPreview }, busy === 'preview' ? t('loPreviewing') : t('loApply')),
      )

      var panelChildren = [head, statCards, bar, barHint, body]
      if (lower) panelChildren.push(lower)
      panelChildren.push(foot)
      if (error) panelChildren.push(h('div', { key: 'err', className: '__rp_loErr', role: 'alert' }, error))
      if (!data && !error) panelChildren.splice(1, 0, h('div', { key: 'loading', className: '__rp_loNote' }, t('loading')))

      var blur = prefs.mode !== 'performance' && activeEffects().blur !== false
      return portalToBody(
        h(
          'div',
          {
            className: '__rp_lo',
            'data-blur': blur ? '1' : undefined,
            'data-closing': closingPair[0] ? '1' : undefined,
            style: menuMotionStyle(),
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': t('loTitle'),
            tabIndex: -1,
            ref: function (node) {
              if (node && !node.__rpFocused) {
                node.__rpFocused = true
                try { node.focus() } catch (failure) { /* ignore */ }
              }
            },
            onKeyDown: onKeyDown,
            onMouseDown: function (event) {
              if (event.target === event.currentTarget && !busy) props.onClose()
            },
          },
          stage,
          h('div', { className: '__rp_loPanel' }, panelChildren),
          managing ? h(ProfilesDialog, { t: t, sessionId: props.sessionId, onClose: function () { setManaging(false); load(true).catch(function () {}) } }) : null,
        ),
      )
    }

    function LoadoutButton(props) {
      var t = props.t
      var openPair = React.useState(false)
      var open = openPair[0]
      var setOpen = openPair[1]
      return h(
        React.Fragment,
        null,
        h('button', { type: 'button', className: '__rp_optimize', title: t('loButtonTip'), onClick: function () { setOpen(true) } }, t('loButton')),
        open ? h(LoadoutWindow, { t: t, sessionId: props.sessionId, onClose: function () { setOpen(false) } }) : null,
      )
    }
