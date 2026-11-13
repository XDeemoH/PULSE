    /* ── 技能推荐栏：输入框左侧的三个槽位 + 向上展开的四栏面板 ───── */

    /**
     * 挂载方式与宿主自己的 message-feedback 相同：在 `conversation.input.overlay`（输入框卡片内、按会话）
     * 放一个不可见探针，用 closest('[data-composer-card]') 找到卡片，再把可见部分 portal 到 body
     * （槽位约定写明：固定定位的浮层必须 portal 到 document.body，因为停靠的输入框会裁剪它们）。
     * 位置跟随卡片矩形：ResizeObserver 盯卡片和对话列，拖动对话框宽度时立即重排；再加 resize 与 1s 兜底。
     * 留白 ≥ 176px 显示三个槽位，≥ 56px 收成一个按钮，再窄就隐藏。
     * 推荐来自 /dsh-running-panel/skill-suggest（本地打分，不调模型）；启用停用技能走 /park，先确认、可撤销。
     */
    var SD_FULL = 176
    var SD_MINI = 56
    var SD_GROUPS = [
      ['visual', '视觉'],
      ['code', '代码'],
      ['thought', '思考'],
      ['ops', '行动'],
    ]
    var SD_CSS = [
      '.__rp_sd{position:fixed;z-index:35;display:flex;align-items:flex-end;gap:6px;padding:7px 9px 5px 7px;border-radius:4px;box-sizing:border-box;color:#d9dee2;font-size:12px;--rp-amber:#ff7f00;background:linear-gradient(90deg,rgba(12,14,17,.70),rgba(12,14,17,.30));-webkit-backdrop-filter:blur(16px) saturate(140%);backdrop-filter:blur(16px) saturate(140%);transform:perspective(900px) rotateY(9deg);transform-origin:left center;animation:__rp_sdIn .22s cubic-bezier(.2,.8,.2,1) both;overflow:hidden}',
      '.__rp_sd::after{content:"";position:absolute;top:0;bottom:0;left:-40%;width:40%;background:linear-gradient(90deg,transparent,rgba(255,127,0,.18),transparent);pointer-events:none;opacity:0}',
      '.__rp_sd[data-scan="1"]::after{animation:__rp_sdScan .7s ease-out}',
      '.__rp_sdSlot{all:unset;box-sizing:border-box;width:36px;cursor:pointer;text-align:center;animation:__rp_sdPop .28s cubic-bezier(.2,.9,.3,1.2) both}',
      '.__rp_sdIc{width:34px;height:34px;border-radius:3px;border:1px solid transparent;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;letter-spacing:.02em;background:rgba(255,255,255,.04);transition:border-color .15s,background .15s,transform .15s}',
      '.__rp_sdSlot:hover .__rp_sdIc,.__rp_sdSlot:focus-visible .__rp_sdIc{background:var(--rp-amber);color:#1a0f00}',
      '.__rp_sdSlot[data-off="1"] .__rp_sdIc{border-color:rgba(255,255,255,.14);border-style:dashed;background:transparent;color:#7d868c}',
      '.__rp_sdBar{height:3px;border-radius:2px;background:rgba(255,255,255,.10);margin-top:4px;overflow:hidden}',
      '.__rp_sdBar>i{display:block;height:100%;background:var(--rp-amber)}',
      '.__rp_sdKey{font:10px/1.6 ui-monospace,Consolas,monospace;color:#7d868c}',
      '.__rp_sdMini .__rp_sdIc{border-radius:50%;border:1px solid var(--rp-amber);color:var(--rp-amber);position:relative}',
      '.__rp_sdBadge{position:absolute;top:-6px;right:-8px;min-width:14px;padding:0 4px;border-radius:8px;background:var(--rp-amber);color:#1a0f00;font-size:10px;line-height:15px}',
      '.__rp_sdPanel{position:fixed;z-index:36;width:420px;box-sizing:border-box;padding:14px;border-radius:14px;color:#d9dee2;font-size:12.5px;--rp-amber:#ff7f00;background:rgba(18,21,24,.58);border:1px solid rgba(255,255,255,.12);box-shadow:0 18px 44px rgba(0,0,0,.42);-webkit-backdrop-filter:blur(22px) saturate(150%);backdrop-filter:blur(22px) saturate(150%);transform-origin:left bottom;animation:__rp_sdOpen .24s cubic-bezier(.2,.8,.2,1) both}',
      '.__rp_sdPanel[data-closing="1"]{animation:__rp_sdClose .14s ease-in both}',
      '.__rp_sdHead{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px}',
      '.__rp_sdHead b{font-weight:600;font-size:13.5px;color:#eef1f3}',
      '.__rp_sdHead span{color:#7d868c}',
      '.__rp_sdCols{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}',
      '.__rp_sdCol h5{margin:0 0 6px;padding-top:6px;border-top:2px solid rgba(255,255,255,.16);font-size:11px;font-weight:500;color:#7d868c}',
      '.__rp_sdItem{all:unset;box-sizing:border-box;display:block;width:100%;padding:5px 6px;border-radius:6px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border:1px solid transparent}',
      '.__rp_sdItem:hover{background:rgba(255,255,255,.06)}',
      '.__rp_sdItem[data-sel="1"]{border-color:var(--rp-amber);background:rgba(255,127,0,.12);color:#ffd3a6}',
      '.__rp_sdItem[data-off="1"]{color:#7d868c}',
      '.__rp_sdDetail{margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.10);display:flex;justify-content:space-between;gap:12px}',
      '.__rp_sdWhy{display:inline-block;margin-top:5px;padding:1px 8px;border-radius:6px;background:rgba(255,127,0,.14);color:#ffbf80;font-size:11.5px}',
      '.__rp_sdKeys{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;color:#7d868c;font-size:11.5px}',
      '.__rp_sdMsg{margin-top:10px;padding:8px 10px;border-radius:8px;background:rgba(255,127,0,.10);border:1px solid rgba(255,127,0,.28);color:#ffd3a6;line-height:1.5}',
      '.__rp_sdBtns{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}',
      '.__rp_sdBtn{all:unset;cursor:pointer;padding:3px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.22);color:#eef1f3;font-size:12px}',
      '.__rp_sdBtn:hover{border-color:var(--rp-amber)}',
      '.__rp_sdBtn[data-primary="1"]{border-color:var(--rp-amber);background:rgba(255,127,0,.16)}',
      '.__rp_sdToast{position:fixed;z-index:37;padding:6px 12px;border-radius:8px;font-size:12px;color:#eef1f3;background:rgba(18,21,24,.72);border:1px solid rgba(255,255,255,.12);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);animation:__rp_sdIn .2s ease-out both;display:flex;gap:10px;align-items:center}',
      '.__rp_sdEmpty{color:#7d868c;padding:4px 2px}',
      '.__rp_sdKeys kbd{font:10.5px ui-monospace,Consolas,monospace;border:1px solid rgba(255,255,255,.2);border-radius:4px;padding:0 5px;margin-right:4px;color:#d9dee2}',
      'html[data-rp-scheme="light"] :is(.__rp_sd,.__rp_sdPanel){--rp-amber:#a04c00;color:#1b1f24;background:rgba(255,253,247,.62);border-color:rgba(20,24,28,.14)}',
      '@keyframes __rp_sdIn{from{opacity:0;transform:perspective(900px) rotateY(24deg) translateX(-8px);filter:blur(4px)}}',
      '@keyframes __rp_sdPop{from{opacity:0;transform:scale(.86)}}',
      '@keyframes __rp_sdScan{0%{left:-40%;opacity:1}100%{left:100%;opacity:1}}',
      '@keyframes __rp_sdOpen{0%{opacity:0;transform:translateY(10px) scale(.98);filter:blur(6px)}45%{opacity:.75}60%{opacity:.45}100%{opacity:1;transform:none;filter:none}}',
      '@keyframes __rp_sdClose{to{opacity:0;transform:translateY(6px) scale(.985)}}',
      '@media (prefers-reduced-motion:reduce){.__rp_sd,.__rp_sdSlot,.__rp_sdPanel,.__rp_sdPanel[data-closing="1"]{animation:none}.__rp_sd[data-scan="1"]::after{animation:none}}',
    ].join('\n')

    function ensureSkillDockCss() {
      if (typeof document === 'undefined' || document.getElementById('__rp_sd_css')) return
      var style = document.createElement('style')
      style.id = '__rp_sd_css'
      style.textContent = SD_CSS + String.fromCharCode(10) + SD_PANEL_CSS // 面板样式一起注入：第一帧就是倾斜的无边框样式
      document.head.appendChild(style)
    }

    function sdPortal(node) {
      if (ReactDOM && typeof ReactDOM.createPortal === 'function' && typeof document !== 'undefined' && document.body) {
        return ReactDOM.createPortal(node, document.body)
      }
      return node
    }

    function sdLabel(item) {
      return (item && (item.zh || item.name)) || ''
    }
    /** 槽位里的两个字：中文名取前两字，英文名取前两段的首字母。 */
    function sdGlyph(item) {
      var label = sdLabel(item)
      if (/[一-鿿]/.test(label)) return Array.from(label.replace(/\s+/g, '')).slice(0, 2).join('')
      var parts = String(item.name || '').split(/[-_\s]+/).filter(Boolean)
      return (parts.length > 1 ? parts[0][0] + parts[1][0] : String(item.name || '').slice(0, 2)).toUpperCase()
    }
    function sdReason(reason) {
      if (!reason) return ''
      if (reason.kind === 'draft') return '提到「' + reason.text + '」'
      if (reason.kind === 'recent') return '最近说过「' + reason.text + '」'
      if (reason.kind === 'pair') return reason.text ? '常和「' + reason.text + '」一起用' : '常和本会话的技能一起用'
      if (reason.kind === 'habit') return '你常用'
      if (reason.kind === 'picked') return '你常从这里选'
      return ''
    }
    function sdTok(value) {
      var n = Number(value) || 0
      return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n))
    }
    function sdLock() {
      return h(
        'svg',
        { width: 12, height: 12, viewBox: '0 0 16 16', 'aria-hidden': 'true' },
        h('rect', { x: 3, y: 7, width: 10, height: 7, rx: 1.5, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4 }),
        h('path', { d: 'M5.5 7V5a2.5 2.5 0 0 1 5 0v2', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4 }),
      )
    }
    /**
     * 把输入框内容拆成正文和引用块：引用（斜杠菜单插入的技能、@ 文件等）是不可编辑的节点，
     * 文字单独交给 Host 识别是哪个技能，正文里去掉，免得技能名被当成内容去匹配别的技能。
     */
    function sdDraftParts(input) {
      if (!input) return { text: '', chips: [] }
      var chips = []
      var clone = input.cloneNode(true)
      Array.prototype.slice.call(clone.querySelectorAll('[contenteditable="false"]')).forEach(function (node) {
        var label = String(node.textContent || '').trim()
        if (label) chips.push(label)
        node.parentNode.removeChild(node)
      })
      return { text: String(clone.textContent || '').trim(), chips: chips.slice(0, 50) }
    }
    function sdPicked() {
      return prefs.skillDockPicks && typeof prefs.skillDockPicks === 'object' ? prefs.skillDockPicks : {}
    }
    /** 从推荐栏用过一次就记一笔，推荐会慢慢贴近你的习惯（只存在本机偏好里）。 */
    function sdNotePick(name) {
      var next = Object.assign({}, sdPicked())
      next[name] = (Number(next[name]) || 0) + 1
      var keys = Object.keys(next)
      if (keys.length > 300) delete next[keys[0]]
      setPref('skillDockPicks', next)
    }
    function sdDismissed() {
      return Array.isArray(prefs.skillDockDismissed) ? prefs.skillDockDismissed : []
    }
    function sdPark(directoryName, action, sessionId) {
      return fetch('/dsh-running-panel/park', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ directoryName: directoryName, action: action, sessionId: sessionId || '' }),
      }).then(function (response) {
        return response
          .json()
          .catch(function () {
            return {}
          })
          .then(function (value) {
            return { ok: response.ok && value && value.ok !== false, status: response.status, value: value || {} }
          })
      })
    }

    /** 跟随输入框卡片的几何信息；card 变了或尺寸变了都会重测。 */
    function useComposerGeometry(card) {
      var pair = React.useState(null)
      var geo = pair[0]
      var setGeo = pair[1]
      React.useEffect(
        function () {
          if (!card) return undefined
          var column = card.closest('[data-conversation-scroll]') || card.parentElement
          var measure = function () {
            var rect = card.getBoundingClientRect()
            var colRect = column ? column.getBoundingClientRect() : { left: 0 }
            if (rect.width === 0 && rect.height === 0) {
              setGeo(null)
              return
            }
            var next = {
              left: Math.round(rect.left),
              top: Math.round(rect.top),
              bottom: Math.round(window.innerHeight - rect.bottom),
              gutter: Math.round(rect.left - Math.max(0, colRect.left)),
              floor: Math.round(Math.max(0, colRect.left)),
            }
            setGeo(function (previous) {
              if (previous && previous.left === next.left && previous.top === next.top && previous.bottom === next.bottom && previous.gutter === next.gutter) return previous
              return next
            })
          }
          measure()
          var observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
          if (observer) {
            observer.observe(card)
            if (column) observer.observe(column)
          }
          window.addEventListener('resize', measure)
          var timer = window.setInterval(measure, 1000)
          return function () {
            if (observer) observer.disconnect()
            window.removeEventListener('resize', measure)
            window.clearInterval(timer)
          }
        },
        [card],
      )
      return geo
    }

    /** 推荐数据：草稿停顿 600ms、换会话、每 20s（页面可见时）各请求一次；前三名变了才扫一次光。 */
    function useSkillSuggestions(card, sessionId, nonce) {
      var pair = React.useState({ items: [], liveTokens: 0, failed: false })
      var data = pair[0]
      var setData = pair[1]
      var scanPair = React.useState(0)
      var scanSeq = scanPair[0]
      var setScanSeq = scanPair[1]
      React.useEffect(
        function () {
          if (!card) return undefined
          var alive = true
          var timer = null
          var lastKey = ''
          var fail = function () {
            if (!alive) return
            setData(function (previous) {
              return Object.assign({}, previous, { failed: true })
            })
          }
          var load = function () {
            var parts = sdDraftParts(card.querySelector('[data-composer-input]'))
            var draft = parts.text
            fetch('/dsh-running-panel/skill-suggest', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ session: sessionId || '', draft: draft, referenced: parts.chips, dismissed: sdDismissed(), picked: sdPicked() }),
            })
              .then(function (response) {
                return response.ok ? response.json() : null
              })
              .then(function (value) {
                if (!alive) return
                if (!value || !Array.isArray(value.suggestions)) return fail()
                var key = value.suggestions
                  .slice(0, 3)
                  .map(function (item) {
                    return item.name
                  })
                  .join('|')
                if (key && key !== lastKey) {
                  setScanSeq(function (n) {
                    return n + 1
                  })
                }
                lastKey = key
                setData({ items: value.suggestions, liveTokens: (value.budget && value.budget.liveTokens) || 0, failed: false })
              })
              .catch(fail)
          }
          var onInput = function () {
            if (timer !== null) window.clearTimeout(timer)
            timer = window.setTimeout(function () {
              timer = null
              load()
            }, 600)
          }
          load()
          // Lexical 不一定把 input 事件冒泡出来：盯输入框 DOM 的变化最可靠，input / keyup 作补充。
          var input = card.querySelector('[data-composer-input]')
          var watcher = typeof MutationObserver === 'function' && input ? new MutationObserver(onInput) : null
          if (watcher) watcher.observe(input, { childList: true, subtree: true, characterData: true })
          card.addEventListener('input', onInput, true)
          card.addEventListener('keyup', onInput, true)
          var poll = window.setInterval(function () {
            if (!document.hidden) load()
          }, 20000)
          return function () {
            alive = false
            if (timer !== null) window.clearTimeout(timer)
            window.clearInterval(poll)
            if (watcher) watcher.disconnect()
            card.removeEventListener('input', onInput, true)
            card.removeEventListener('keyup', onInput, true)
          }
        },
        [card, sessionId, nonce],
      )
      return [data, scanSeq]
    }

    var SD_PANEL_CSS = [
      '.__rp_sdPanel{border:0;border-radius:4px;box-shadow:none;background:linear-gradient(90deg,rgba(12,14,17,.78) 0,rgba(12,14,17,.52) 70%,rgba(12,14,17,.30));-webkit-backdrop-filter:blur(20px) saturate(140%);backdrop-filter:blur(20px) saturate(140%);transform:perspective(1000px) rotateY(9deg);transform-origin:left center;animation:__rp_sdTiltIn .26s cubic-bezier(.2,.8,.2,1) both}',
      '.__rp_sdPanel[data-closing="1"]{animation:__rp_sdTiltOut .14s ease-in both}',
      '.__rp_sdPanel .__rp_sdHead b{display:flex;align-items:center;gap:8px;font-size:12.5px;letter-spacing:.14em}',
      '.__rp_sdPanel .__rp_sdHead b::before{content:"";width:3px;height:12px;background:var(--rp-amber)}',
      '.__rp_sdPanel .__rp_sdGrp{padding-top:7px;border-top:1px solid rgba(255,255,255,.07)}',
      '@keyframes __rp_sdTiltIn{0%{opacity:0;transform:perspective(1000px) rotateY(26deg) translateX(-14px);filter:blur(6px)}45%{opacity:.8}58%{opacity:.4}72%{opacity:.9}100%{opacity:1;transform:perspective(1000px) rotateY(9deg);filter:none}}',
      '@keyframes __rp_sdTiltOut{to{opacity:0;transform:perspective(1000px) rotateY(20deg) translateX(-10px)}}',
      '@media (prefers-reduced-motion:reduce){.__rp_sdPanel,.__rp_sdPanel[data-closing="1"]{animation:none}}',
      '.__rp_sdPanel{max-height:min(62vh,540px);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;padding:10px 8px 8px}',
      '.__rp_sdPanel .__rp_sdHead{padding:0 4px;margin-bottom:6px;align-items:center}',
      '.__rp_sdX{all:unset;cursor:pointer;width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#7d868c;font-size:14px;line-height:1}',
      '.__rp_sdX:hover{color:#eef1f3;background:rgba(255,255,255,.08)}',
      '.__rp_sdGrp{margin:8px 4px 3px;font-size:10.5px;letter-spacing:.12em;color:#69737a}',
      '.__rp_sdRow{all:unset;box-sizing:border-box;width:100%;display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:2px;cursor:pointer;transition:background .12s,color .12s}',
      '.__rp_sdRow:hover{background:rgba(255,255,255,.05)}',
      '.__rp_sdRow[data-sel="1"]{background:var(--rp-amber)}',
      '.__rp_sdRow[data-sel="1"] :is(.__rp_sdName,.__rp_sdPct,.__rp_sdChip){color:#1a0f00}',
      '.__rp_sdRow[data-sel="1"] .__rp_sdChip{border-color:rgba(26,15,0,.35);background:rgba(26,15,0,.08)}',
      '.__rp_sdChip{flex:none;width:24px;height:24px;border-radius:3px;border:1px solid rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:600;color:#e6e9eb;background:rgba(255,255,255,.03)}',
      '.__rp_sdRow[data-off="1"] .__rp_sdChip{border-style:dashed;color:#7d868c}',
      '.__rp_sdRow[data-off="1"] .__rp_sdName{color:#8b949a}',
      '.__rp_sdName{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12.5px;color:#dfe3e6}',
      '.__rp_sdPct{flex:none;font:10.5px ui-monospace,Consolas,monospace;color:#69737a}',
      
      '.__rp_sdOpen{margin:2px 6px 6px 38px;font-size:11.5px;color:#8b949a;line-height:1.55;animation:__rp_sdIn .16s ease-out both}',
      '.__rp_sdOpen .__rp_sdWhy{margin:0 4px 4px 0}',
      '.__rp_sdOpen .__rp_sdBtn{margin-top:4px}',
      '.__rp_sdFoot{margin:8px 4px 0;font-size:10.5px;color:#5f686e}',
      '.__rp_sdPanel[data-compact="1"] .__rp_sdName,.__rp_sdPanel[data-compact="1"] .__rp_sdGrp,.__rp_sdPanel[data-compact="1"] .__rp_sdFoot{display:none}',
      '.__rp_sdPanel[data-compact="1"] .__rp_sdRow{justify-content:space-between}',
      'html[data-rp-scheme="light"] .__rp_sdPanel :is(.__rp_sdName,.__rp_sdChip){color:#1b1f24}',
      'html[data-rp-scheme="light"] :is(.__rp_sd,.__rp_sdPanel){background:linear-gradient(90deg,rgba(255,253,247,.82),rgba(255,253,247,.40))}',
    ].join('\n')

    function SkillDockPanel(props) {
      var items = props.items
      var compact = props.width < 168
      var selPair = React.useState(null)
      var sel = selPair[0]
      var setSel = selPair[1]
      var limit = props.limitTokens
      React.useEffect(function () {
        if (typeof document === 'undefined' || document.getElementById('__rp_sd_css2')) return
        var style = document.createElement('style')
        style.id = '__rp_sd_css2'
        style.textContent = SD_PANEL_CSS
        document.head.appendChild(style)
      }, [])
      var row = function (item) {
        var selected = !compact && item.name === sel
        var after = item.live ? props.liveTokens : props.liveTokens + (item.tokens || 0)
        return h(
          React.Fragment,
          { key: item.name },
          h(
            'button',
            {
              type: 'button',
              className: '__rp_sdRow',
              'data-sel': selected ? '1' : undefined,
              'data-off': item.live ? undefined : '1',
              title: sdLabel(item) + ' · /' + item.name + ' · ' + sdReason((item.reasons || [])[0]) + (item.live ? '' : ' · 已停用') + ' · 右键不再推荐',
              onClick: function () {
                if (compact) props.onUse(item)
                else setSel(selected ? null : item.name)
              },
              onDoubleClick: function () {
                props.onUse(item)
              },
              onContextMenu: function (event) {
                event.preventDefault()
                props.onDismiss(item)
              },
            },
            h('span', { className: '__rp_sdChip' }, item.live ? sdGlyph(item) : sdLock()),
            h('span', { className: '__rp_sdName' }, sdLabel(item)),
            h('span', { className: '__rp_sdPct' }, Math.round(item.match * 100)),
          ),
          selected
            ? h(
                'div',
                { className: '__rp_sdOpen' },
                (item.reasons || []).map(function (reason, index) {
                  return h('span', { key: index, className: '__rp_sdWhy' }, sdReason(reason))
                }),
                h(
                  'div',
                  null,
                  sdTok(item.tokens) + ' tok · 用过 ' + (item.uses || 0) + ' 次' + (item.loaded ? ' · 本会话已加载' : ''),
                ),
                item.live
                  ? null
                  : h('div', { style: { color: limit && after > limit ? '#ff8a6a' : '#8b949a' } }, '已停用 · 启用后预算 ' + sdTok(after) + (limit ? ' / ' + sdTok(limit) : '')),
                h(
                  'button',
                  {
                    type: 'button',
                    className: '__rp_sdBtn',
                    'data-primary': '1',
                    onClick: function () {
                      props.onUse(item)
                    },
                  },
                  item.live ? '插入' : '启用并插入',
                ),
              )
            : null,
        )
      }
      return h(
        'div',
        {
          className: '__rp_sdPanel',
          'data-closing': props.closing ? '1' : undefined,
          'data-compact': compact ? '1' : undefined,
          style: { left: props.left + 'px', bottom: props.bottom + 'px', width: props.width + 'px' },
          role: 'dialog',
          'aria-label': '技能推荐',
        },
        h(
          'div',
          { className: '__rp_sdHead' },
          h('b', null, compact ? '推荐' : '技能推荐'),
          h('button', { type: 'button', className: '__rp_sdX', title: '收起（Esc）', 'aria-label': '收起', onClick: props.onClose }, '×'),
        ),
        items.length
          ? SD_GROUPS.map(function (group) {
              var list = items.filter(function (item) {
                return (item.group || 'ops') === group[0]
              })
              if (!list.length) return null
              return h(React.Fragment, { key: group[0] }, h('div', { className: '__rp_sdGrp' }, group[1]), list.map(row))
            })
          : h('div', { className: '__rp_sdEmpty', style: { padding: '4px' } }, props.failed ? '读取推荐失败，稍后自动重试。' : '写几句你要做的事，停顿一下就会推荐。'),
        props.notice
          ? h(
              'div',
              { className: '__rp_sdMsg' },
              props.notice.text,
              props.notice.actions && props.notice.actions.length
                ? h(
                    'div',
                    { className: '__rp_sdBtns' },
                    props.notice.actions.map(function (action, index) {
                      return h('button', { type: 'button', key: index, className: '__rp_sdBtn', 'data-primary': index === 0 ? '1' : undefined, onClick: action.run }, action.label)
                    }),
                  )
                : null,
            )
          : null,
        h('div', { className: '__rp_sdFoot' }, '双击使用 · 右键不再推荐 · Esc 收起'),
      )
    }

    function SkillDock(props) {
      var geo = useComposerGeometry(props.card)
      var sessionId = props.sessionId
      var noncePair = React.useState(0)
      var nonce = noncePair[0]
      var setNonce = noncePair[1]
      var result = useSkillSuggestions(props.card, sessionId, nonce)
      var data = result[0]
      var scanSeq = result[1]
      var items = data.items
      var openPair = React.useState(false)
      var open = openPair[0]
      var setOpen = openPair[1]
      var closingPair = React.useState(false)
      var closing = closingPair[0]
      var setClosing = closingPair[1]
      var scanPair = React.useState(false)
      var scan = scanPair[0]
      var setScan = scanPair[1]
      var noticePair = React.useState(null)
      var notice = noticePair[0]
      var setNotice = noticePair[1]
      var toastPair = React.useState(null)
      var toast = toastPair[0]
      var setToast = toastPair[1]
      var busy = React.useRef(false)
      var limitTokens = Math.round(budgetLimitChars() / 4)
      var close = React.useCallback(function () {
        setClosing(true)
        window.setTimeout(function () {
          setOpen(false)
          setClosing(false)
          setNotice(null)
        }, 140)
      }, [])
      React.useEffect(ensureSkillDockCss, [])
      React.useEffect(
        function () {
          if (!scanSeq) return undefined
          setScan(true)
          var timer = window.setTimeout(function () {
            setScan(false)
          }, 720)
          return function () {
            window.clearTimeout(timer)
          }
        },
        [scanSeq],
      )
      React.useEffect(
        function () {
          if (!toast) return undefined
          var timer = window.setTimeout(
            function () {
              setToast(null)
            },
            toast.undo ? 8000 : 3200,
          )
          return function () {
            window.clearTimeout(timer)
          }
        },
        [toast],
      )
      var refresh = function () {
        setNonce(function (n) {
          return n + 1
        })
      }
      var restore = function (item, swap) {
        if (busy.current) return
        busy.current = true
        setNotice({ text: '正在启用「' + sdLabel(item) + '」……' })
        var first = swap ? sdPark(swap.directoryName, 'park', sessionId) : Promise.resolve({ ok: true })
        first
          .then(function (parked) {
            if (!parked.ok) {
              var used = parked.value && parked.value.error === 'in-use'
              throw new Error(used ? '「' + swap.name + '」正被别的对话使用，没有替换。' : '停用「' + swap.name + '」失败。')
            }
            return sdPark(item.directoryName || item.name, 'restore', sessionId).then(function (restored) {
              if (restored.ok) return
              if (swap) sdPark(swap.directoryName, 'restore', sessionId) // 回滚刚才的停用
              throw new Error('启用「' + sdLabel(item) + '」失败。')
            })
          })
          .then(function () {
            sdNotePick(item.name)
            // 刚搬回 live：等宿主的技能目录刷新、斜杠菜单能筛出它再插入。
            window.setTimeout(function () {
              insertSkillReference(item.name)
            }, 900)
            setNotice(null)
            setToast({
              text: swap ? '已用「' + sdLabel(item) + '」替换「' + swap.name + '」并插入' : '已启用「' + sdLabel(item) + '」并插入',
              undo: function () {
                sdPark(item.directoryName || item.name, 'park', sessionId)
                  .then(function () {
                    if (swap) return sdPark(swap.directoryName, 'restore', sessionId)
                    return null
                  })
                  .then(refresh)
                setToast({ text: '已撤销' })
              },
            })
            close()
            refresh()
          })
          .catch(function (error) {
            setNotice({ text: String((error && error.message) || error) })
          })
          .then(function () {
            busy.current = false
          })
      }
      var use = function (item) {
        if (!item) return
        if (item.live) {
          sdNotePick(item.name)
          insertSkillReference(item.name)
          if (open) close()
          return
        }
        if (!open) setOpen(true)
        if (!item.movable) {
          setNotice({ text: '「' + sdLabel(item) + '」不在可启用的技能目录里，请在 PULSE 面板里处理。' })
          return
        }
        var after = data.liveTokens + (item.tokens || 0)
        if (limitTokens && after > limitTokens) {
          setNotice({ text: '启用后会超出预算线，正在找一个可以替换的技能……' })
          fetch('/dsh-running-panel/loadout?session=' + encodeURIComponent(sessionId), { cache: 'no-store' })
            .then(function (response) {
              return response.ok ? response.json() : null
            })
            .then(function (value) {
              var pool = value && Array.isArray(value.skills) ? value.skills : []
              var candidate = pool
                .filter(function (skill) {
                  return skill.live && skill.movable && !(skill.inUse && skill.inUse.length) && skill.name !== item.name && !isPinnedSkill(skill.name)
                })
                .sort(function (a, b) {
                  return (a.uses || 0) - (b.uses || 0) || (a.lastAt || 0) - (b.lastAt || 0) || (b.tokens || 0) - (a.tokens || 0)
                })[0]
              var text = '启用「' + sdLabel(item) + '」后目录预算 ' + sdTok(after) + '，超过预算线 ' + sdTok(limitTokens) + '。'
              var actions = []
              if (candidate) {
                text += '可以停用很少用的「' + candidate.name + '」（用过 ' + (candidate.uses || 0) + ' 次，' + sdTok(candidate.tokens) + ' tok）来换。'
                actions.push({
                  label: '替换并插入',
                  run: function () {
                    restore(item, candidate)
                  },
                })
              }
              actions.push({
                label: '直接启用（超线只变色）',
                run: function () {
                  restore(item, null)
                },
              })
              actions.push({
                label: '取消',
                run: function () {
                  setNotice(null)
                },
              })
              setNotice({ text: text, actions: actions })
            })
            .catch(function () {
              setNotice({
                text: '读取技能列表失败。',
                actions: [
                  {
                    label: '直接启用',
                    run: function () {
                      restore(item, null)
                    },
                  },
                ],
              })
            })
          return
        }
        setNotice({
          text: '启用「' + sdLabel(item) + '」会占用 +' + sdTok(item.tokens) + ' tok（目录预算 ' + sdTok(after) + (limitTokens ? ' / ' + sdTok(limitTokens) : '') + '）。',
          actions: [
            {
              label: '启用并插入',
              run: function () {
                restore(item, null)
              },
            },
            {
              label: '取消',
              run: function () {
                setNotice(null)
              },
            },
          ],
        })
      }
      var dismiss = function (item) {
        var list = sdDismissed().filter(function (name) {
          return name !== item.name
        })
        list.push(item.name)
        setPref('skillDockDismissed', list.slice(-200))
        setToast({
          text: '不再推荐「' + sdLabel(item) + '」',
          undo: function () {
            setPref(
              'skillDockDismissed',
              sdDismissed().filter(function (name) {
                return name !== item.name
              }),
            )
            setToast({ text: '已恢复推荐' })
            refresh()
          },
        })
        refresh()
      }
      // 点面板和推荐栏以外的任何地方（包括输入框）就收起。
      React.useEffect(
        function () {
          if (!open) return undefined
          var onDown = function (event) {
            var target = event.target
            if (target instanceof Element && target.closest('.__rp_sd,.__rp_sdPanel,.__rp_sdToast')) return
            close()
          }
          document.addEventListener('pointerdown', onDown, true)
          return function () {
            document.removeEventListener('pointerdown', onDown, true)
          }
        },
        [open, close],
      )
      var useRef = React.useRef(use)
      useRef.current = use
      React.useEffect(
        function () {
          var onKey = function (event) {
            if (event.key === 'Escape' && open) {
              close()
              return
            }
            if (event.altKey && !event.ctrlKey && !event.metaKey && /^[123]$/.test(event.key)) {
              var target = event.target
              if (!(target instanceof Element) || !target.closest('[data-composer-card]')) return
              var item = items[Number(event.key) - 1]
              if (item) {
                event.preventDefault()
                useRef.current(item)
              }
            }
          }
          window.addEventListener('keydown', onKey, true)
          return function () {
            window.removeEventListener('keydown', onKey, true)
          }
        },
        [open, close, items],
      )
      if (!geo || geo.gutter < SD_MINI) return null
      var full = geo.gutter >= SD_FULL
      var top = items.slice(0, 3)
      var slotCount = full ? Math.max(1, top.length) : 0
      var dockWidth = full ? (slotCount + 1) * 36 + slotCount * 6 + 14 : 36 + 14
      var dockLeft = geo.left - 12 - dockWidth
      // 面板只占输入框左边这一列：左边贴对话列，右边留 12px 不碰输入框。
      var panelLeft = geo.floor + 10
      var panelWidth = Math.max(56, Math.min(300, geo.left - 12 - panelLeft))
      var toggle = function () {
        if (open) close()
        else setOpen(true)
      }
      var slots = !full
        ? []
        : top.length
          ? top.map(function (item, index) {
              return h(
                'button',
                {
                  type: 'button',
                  key: item.name,
                  className: '__rp_sdSlot',
                  'data-off': item.live ? undefined : '1',
                  title: sdLabel(item) + ' · ' + sdReason((item.reasons || [])[0]) + (item.live ? '' : ' · 已停用，点击启用') + ' · 右键不再推荐',
                  style: { animationDelay: index * 50 + 'ms' },
                  onClick: function () {
                    use(item)
                  },
                  onContextMenu: function (event) {
                    event.preventDefault()
                    dismiss(item)
                  },
                },
                h('div', { className: '__rp_sdIc' }, item.live ? sdGlyph(item) : sdLock()),
                h('div', { className: '__rp_sdBar' }, h('i', { style: { width: Math.round(item.match * 100) + '%' } })),
                h('div', { className: '__rp_sdKey' }, String(index + 1)),
              )
            })
          : [
              h(
                'div',
                { key: 'idle', className: '__rp_sdSlot', style: { cursor: 'default' }, title: '暂时没有推荐' },
                h('div', { className: '__rp_sdIc', style: { color: '#7d868c', borderStyle: 'dashed' } }, '··'),
                h('div', { className: '__rp_sdBar' }),
                h('div', { className: '__rp_sdKey' }, ' '),
              ),
            ]
      var more = h(
        'button',
        { type: 'button', key: 'more', className: '__rp_sdSlot' + (full ? '' : ' __rp_sdMini'), title: open ? '收起' : '展开全部推荐', onClick: toggle },
        h('div', { className: '__rp_sdIc' }, full ? (open ? '收起' : '+' + Math.max(0, items.length - 3)) : h('span', null, '◉', items.length ? h('span', { className: '__rp_sdBadge' }, String(items.length)) : null)),
        h('div', { className: '__rp_sdBar' }),
        h('div', { className: '__rp_sdKey' }, full ? '展开' : '推荐'),
      )
      return sdPortal(
        h(
          React.Fragment,
          null,
          h('div', { className: '__rp_sd', 'data-scan': scan ? '1' : undefined, style: { left: dockLeft + 'px', bottom: geo.bottom + 'px' } }, slots, more),
          open
            ? h(SkillDockPanel, {
                items: items,
                failed: data.failed,
                closing: closing,
                left: panelLeft,
                width: panelWidth,
                bottom: geo.bottom + 74,
                onClose: close,
                liveTokens: data.liveTokens,
                limitTokens: limitTokens,
                notice: notice,
                onUse: use,
                onDismiss: dismiss,
              })
            : null,
          toast
            ? h(
                'div',
                { className: '__rp_sdToast', role: 'status', style: { left: panelLeft + 'px', maxWidth: panelWidth + 'px', bottom: geo.bottom + 78 + 'px' } },
                toast.text,
                toast.undo ? h('button', { type: 'button', className: '__rp_sdBtn', onClick: toast.undo }, '撤销') : null,
              )
            : null,
        ),
      )
    }

    /** 输入框卡片内的不可见探针：只负责找到 [data-composer-card]，可见部分由 SkillDock portal 到 body。 */
    function SkillDockProbe() {
      usePrefs()
      var sessionId = useActiveSession()
      var ref = React.useRef(null)
      var cardPair = React.useState(null)
      var card = cardPair[0]
      var setCard = cardPair[1]
      React.useLayoutEffect(function () {
        setCard(ref.current ? ref.current.closest('[data-composer-card]') : null)
      }, [])
      return h(
        React.Fragment,
        null,
        h('span', { ref: ref, hidden: true, 'data-rp-skill-dock-probe': '' }),
        card && prefs.skillDock !== false ? h(SkillDock, { card: card, sessionId: sessionId }) : null,
      )
    }
