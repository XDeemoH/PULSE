    function useEchoes() {
      var pair = React.useState({ items: [], loading: true, error: '', capacity: null })
      var state = pair[0]
      var setState = pair[1]
      var reload = React.useCallback(function () {
        fetch('/dsh-running-panel/echo?all=1', { cache: 'no-store' })
          .then(function (response) {
            if (!response.ok) throw new Error('echo list failed')
            return response.json()
          })
          .then(function (body) {
            setState({ items: Array.isArray(body.echoes) ? body.echoes : [], loading: false, error: '', capacity: body.capacity || null })
          })
          .catch(function () {
            setState({ items: [], loading: false, error: 'load', capacity: null })
          })
      }, [])
      React.useEffect(
        function () {
          reload()
          var changed = function () {
            reload()
          }
          window.addEventListener('dsh-running-panel:echo-changed', changed)
          var timer = window.setInterval(function () {
            if (!document.hidden) reload()
          }, 10000)
          return function () {
            window.removeEventListener('dsh-running-panel:echo-changed', changed)
            window.clearInterval(timer)
          }
        },
        [reload],
      )
      return [state, reload]
    }

    function EchoContextModal(props) {
      var t = props.t
      var item = props.item
      var detail = props.detail
      var full = Boolean(props.full)
      var fullLoading = Boolean(props.fullLoading)
      var fullError = Boolean(props.fullError)
      var detailError = Boolean(props.detailError)
      var sessionAlive = props.sessionAlive !== false
      var messages = detail && Array.isArray(detail.messages) ? detail.messages : []
      var anchorId = item.anchorMessageId
      var anchorQuestionId = ''
      var anchorIndex = messages.findIndex(function (message) {
        return message && message.id === anchorId
      })
      for (var i = anchorIndex >= 0 ? anchorIndex : messages.length - 1; i >= 0; i -= 1) {
        if (messages[i] && messages[i].role === 'user') {
          anchorQuestionId = messages[i].id
          break
        }
      }
      var questionRef = React.useRef(null)
      var contextRef = React.useRef(null)
      // 框选整条气泡：picked 记选中的消息 id；marquee 是正在画的框（相对滚动内容的坐标）。
      var pickedPair = React.useState({})
      var picked = pickedPair[0]
      var setPicked = pickedPair[1]
      var marqueePair = React.useState(null)
      var marquee = marqueePair[0]
      var setMarquee = marqueePair[1]
      var copiedPair = React.useState(0)
      var copied = copiedPair[0]
      var setCopied = copiedPair[1]
      var pickedCount = Object.keys(picked).length
      var copyOpts = { messages: messages, picked: picked, labels: { user: t('echoUser'), assistant: t('echoAssistant') } }
      var copyRef = React.useRef(copyOpts)
      copyRef.current = copyOpts
      var afterCopy = function (payload) {
        if (payload && payload.count) setCopied(payload.count)
      }
      var afterCopyRef = React.useRef(afterCopy)
      afterCopyRef.current = afterCopy
      var pickAll = function () {
        var all = {}
        messages.forEach(function (message) { if (message && message.id) all[message.id] = true })
        setPicked(all)
      }
      var pickAllRef = React.useRef(pickAll)
      pickAllRef.current = pickAll
      var copyPicked = function () {
        if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return
        var selection = window.getSelection()
        if (selection) selection.removeAllRanges()
        // execCommand 会派发一次 copy 事件，由下面的监听按原格式写剪贴板。
        document.execCommand('copy')
      }
      React.useEffect(function () {
        if (typeof document === 'undefined') return undefined
        // 选区为空时 Ctrl+C 的 copy 事件不会落到对话区里，在 document 上兜住。
        var onCopy = function (event) {
          if (event.defaultPrevented) return
          var root = contextRef.current
          if (!root) return
          var target = event.target
          if (target && target.closest && target.closest('input,textarea,[contenteditable="true"]')) return
          var selection = window.getSelection()
          var inside = selection && !selection.isCollapsed && root.contains(selection.anchorNode)
          if (!inside && !Object.keys(copyRef.current.picked).length) return
          afterCopyRef.current(copyEchoSelection(event, root, copyRef.current))
        }
        document.addEventListener('copy', onCopy)
        return function () {
          document.removeEventListener('copy', onCopy)
        }
      }, [])
      React.useEffect(
        function () {
          if (!copied) return undefined
          var timer = setTimeout(function () { setCopied(0) }, 1800)
          return function () { clearTimeout(timer) }
        },
        [copied],
      )
      var onContextMouseDown = function (event) {
        var root = contextRef.current
        if (event.button !== 0 || !detail || !root) return
        var target = event.target
        var additive = event.ctrlKey || event.metaKey || event.shiftKey
        var bubble = target && target.closest ? target.closest('[data-msg-id]') : null
        if (bubble) {
          // 在气泡里：普通拖动是选文字；Ctrl / Shift 点一下是加选 / 取消这一条。
          if (!additive) return
          event.preventDefault()
          var id = bubble.getAttribute('data-msg-id')
          setPicked(function (previous) {
            var next = Object.assign({}, previous)
            if (next[id]) delete next[id]
            else next[id] = true
            return next
          })
          return
        }
        if (target && target.closest && target.closest('button,a,input,textarea')) return
        var rect = root.getBoundingClientRect()
        if (event.clientX > rect.left + root.clientWidth) return // 点在滚动条上
        event.preventDefault()
        if (typeof root.focus === 'function') root.focus({ preventScroll: true })
        var selection = window.getSelection()
        if (selection) selection.removeAllRanges()
        var start = { x: event.clientX - rect.left + root.scrollLeft, y: event.clientY - rect.top + root.scrollTop }
        var base = additive ? Object.assign({}, picked) : {}
        var last = { x: event.clientX, y: event.clientY }
        var moved = false
        var update = function () {
          var r = root.getBoundingClientRect()
          var cur = { x: last.x - r.left + root.scrollLeft, y: last.y - r.top + root.scrollTop }
          if (!moved && Math.abs(cur.x - start.x) < 4 && Math.abs(cur.y - start.y) < 4) return
          moved = true
          var box = { left: Math.min(start.x, cur.x), top: Math.min(start.y, cur.y), right: Math.max(start.x, cur.x), bottom: Math.max(start.y, cur.y) }
          setMarquee(box)
          var next = Object.assign({}, base)
          Array.prototype.forEach.call(root.querySelectorAll('[data-msg-id]'), function (node) {
            var b = node.getBoundingClientRect()
            var top = b.top - r.top + root.scrollTop
            var left = b.left - r.left + root.scrollLeft
            if (left < box.right && left + b.width > box.left && top < box.bottom && top + b.height > box.top) next[node.getAttribute('data-msg-id')] = true
          })
          setPicked(next)
        }
        var onMove = function (moveEvent) {
          // 松手事件可能被宿主吞掉：移动时发现已经没按键，就当松手。
          if (moveEvent.buttons === 0) return onUp()
          last = { x: moveEvent.clientX, y: moveEvent.clientY }
          var r = root.getBoundingClientRect()
          // 拖到上下边缘时自动滚动，长对话也能一口气框下去。
          if (moveEvent.clientY < r.top + 28) root.scrollTop -= 16
          else if (moveEvent.clientY > r.bottom - 28) root.scrollTop += 16
          update()
        }
        var done = false
        var onUp = function () {
          if (done) return
          done = true
          window.removeEventListener('mousemove', onMove, true)
          window.removeEventListener('mouseup', onUp, true)
          window.removeEventListener('pointerup', onUp, true)
          window.removeEventListener('blur', onUp)
          root.removeEventListener('scroll', update)
          setMarquee(null)
          if (!moved && !additive) setPicked({})
        }
        // 捕获阶段监听：宿主里有处理器会拦住冒泡的 mouseup。
        window.addEventListener('mousemove', onMove, true)
        window.addEventListener('mouseup', onUp, true)
        window.addEventListener('pointerup', onUp, true)
        window.addEventListener('blur', onUp)
        root.addEventListener('scroll', update)
      }
      var pickedRef = React.useRef(picked)
      pickedRef.current = picked
      var copyPickedRef = React.useRef(copyPicked)
      copyPickedRef.current = copyPicked
      React.useEffect(
        function () {
          var onKey = function (event) {
            var typing = event.target && event.target.closest && event.target.closest('input,textarea,[contenteditable="true"]')
            if ((event.ctrlKey || event.metaKey) && (event.key === 'a' || event.key === 'A') && !typing) {
              event.preventDefault()
              var selection = window.getSelection()
              if (selection) selection.removeAllRanges()
              pickAllRef.current()
              return
            }
            // 没有选中文字时浏览器不派发 copy 事件：有框选的气泡就自己触发复制。
            if ((event.ctrlKey || event.metaKey) && (event.key === 'c' || event.key === 'C') && !typing && Object.keys(pickedRef.current).length) {
              var current = window.getSelection()
              var root = contextRef.current
              if (!current || current.isCollapsed || !root || !root.contains(current.anchorNode)) {
                event.preventDefault()
                copyPickedRef.current()
              }
              return
            }
            if (event.key !== 'Escape') return
            // 先清掉选中，再按一次才关窗。
            if (Object.keys(pickedRef.current).length) {
              setPicked({})
              return
            }
            props.onClose()
          }
          // 捕获阶段：宿主会在冒泡阶段拦下 Ctrl+A / Ctrl+C。
          window.addEventListener('keydown', onKey, true)
          return function () {
            window.removeEventListener('keydown', onKey, true)
          }
        },
        [props.onClose],
      )
      React.useEffect(
        function () {
          var context = contextRef.current
          var anchor = questionRef.current
          if (!detail || !context || !anchor) return
          var contextRect = context.getBoundingClientRect()
          var anchorRect = anchor.getBoundingClientRect()
          // 让收藏条目的“起点”落在可视区中央，上方留出上下文；不要把整段长消息的中部居中。
          var target = context.scrollTop + (anchorRect.top - contextRect.top) - context.clientHeight / 2
          context.scrollTo({ top: Math.max(0, target), behavior: 'auto' })
        },
        [detail],
      )
      var dialog = h(
        'div',
        {
          className: '__rp_echoModalWrap',
          onMouseDown: function (event) {
            if (event.target === event.currentTarget) props.onClose()
          },
        },
        h(
          'div',
          {
            className: '__rp_echoModal',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': t('echoContext'),
            onMouseDown: function (event) {
              event.stopPropagation()
            },
          },
          h(
            'div',
            { className: '__rp_echoModalHead' },
            h(
              'div',
              { className: '__rp_echoModalHeading' },
              h(BookmarkIcon, { size: 16 }),
              h('span', { className: '__rp_echoModalTitle' }, item.sessionTitle || t('echoTitle')),
            ),
            h(
              'button',
              { type: 'button', className: '__rp_echoModalClose', autoFocus: true, 'aria-label': t('echoClose'), onClick: props.onClose },
              '✕',
            ),
          ),
          h(
            'div',
            { className: '__rp_echoModalMeta' },
            formatEchoWhen(item.anchorAt || item.updatedAt),
            ' · ',
            fill(t('echoFloor'), 'n', item.anchorFloor || 1),
            ' · ',
            full ? t('echoContextFull') : t('echoContextWindow'),
            item.pending ? ' · ' + fill(t('echoPendingTag'), 'n', item.pendingAfter) : null,
            sessionAlive
              ? full
                ? null
                : h(
                    'button',
                    {
                      type: 'button',
                      className: '__rp_linkBtn',
                      disabled: fullLoading,
                      onClick: props.onLoadFull,
                    },
                    fullLoading ? t('echoLoading') : t('echoLoadFull'),
                  )
              : h('span', { className: '__rp_echoGone' }, t('echoSessionGone')),
            sessionAlive && echoWorkspace
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: '__rp_linkBtn',
                    onClick: function () {
                      props.onClose()
                      openEchoAnchor(item)
                    },
                  },
                  t('echoOpenSession'),
                )
              : null,
            fullError ? h('span', { className: '__rp_echoGone' }, t('echoFullFailed')) : null,
            pickedCount
              ? h(
                  'span',
                  { className: '__rp_echoPickBar' },
                  copied ? fill(t('echoCopied'), 'n', copied) : fill(t('echoPicked'), 'n', pickedCount),
                  h('button', { type: 'button', className: '__rp_linkBtn', onClick: copyPicked }, t('echoCopyPicked')),
                  h('button', { type: 'button', className: '__rp_linkBtn', onClick: function () { setPicked({}) } }, t('echoClearPicked')),
                )
              : null,
          ),
          h(EchoScene, { key: 'scene:' + item.id, t: t, echoId: item.id }),
          h(
            'div',
            {
              className: '__rp_echoContext',
              ref: contextRef,
              tabIndex: -1,
              'data-marquee': marquee ? '1' : undefined,
              onMouseDown: onContextMouseDown,
              onCopy: function (event) {
                afterCopy(copyEchoSelection(event, contextRef.current, copyOpts))
              },
            },
            marquee
              ? h('div', {
                  className: '__rp_echoMarquee',
                  'aria-hidden': 'true',
                  style: { left: marquee.left + 'px', top: marquee.top + 'px', width: marquee.right - marquee.left + 'px', height: marquee.bottom - marquee.top + 'px' },
                })
              : null,
            !detail
              ? h(
                  'div',
                  { className: '__rp_echoModalHint', role: detailError ? 'alert' : 'status' },
                  detailError ? t('echoDetailFailed') : t('echoLoading'),
                )
              : h(
                  React.Fragment,
                  null,
                  h('div', { className: '__rp_echoContextLabel' }, t('echoContextStart') + ' · ' + t('echoPickHint')),
                  messages.map(function (message) {
                    var isAnchor = anchorQuestionId ? message.id === anchorQuestionId : message.id === anchorId
                    return h(
                      'div',
                      {
                        key: message.id,
                        className: '__rp_echoCtxMsg',
                        'data-role': message.role,
                        'data-anchor': isAnchor ? '1' : undefined,
                        'data-picked': picked[message.id] ? '1' : undefined,
                        ref: isAnchor ? questionRef : undefined,
                      },
                      h(
                        'div',
                        { className: '__rp_echoCtxRole' },
                        message.role === 'user' ? t('echoUser') : t('echoAssistant'),
                      ),
                      h('div', { className: '__rp_echoCtxText', 'data-msg-id': message.id }, echoReadable(message.text)),
                    )
                  }),
                ),
          ),
        ),
      )
      return portalToBody(dialog)
    }

    function EchoGroup(props) {
      var t = props.t
      var statePair = useEchoes()
      var state = statePair[0]
      var reload = statePair[1]
      var modalPair = React.useState(null)
      var modal = modalPair[0]
      var setModal = modalPair[1]
      var detailPair = React.useState(null)
      var detail = detailPair[0]
      var setDetail = detailPair[1]
      var queryPair = React.useState('')
      var query = queryPair[0]
      var setQuery = queryPair[1]
      var pendingOnlyPair = React.useState(false)
      var pendingOnly = pendingOnlyPair[0]
      var setPendingOnly = pendingOnlyPair[1]
      var fullPair = React.useState(false)
      var full = fullPair[0]
      var setFull = fullPair[1]
      var fullLoadingPair = React.useState(false)
      var fullLoading = fullLoadingPair[0]
      var setFullLoading = fullLoadingPair[1]
      var fullErrorPair = React.useState(false)
      var fullError = fullErrorPair[0]
      var setFullError = fullErrorPair[1]
      var detailErrorPair = React.useState(false)
      var detailError = detailErrorPair[0]
      var setDetailError = detailErrorPair[1]
      var openConvsPair = React.useState({})
      var openConvs = openConvsPair[0]
      var setOpenConvs = openConvsPair[1]
      var contextRequest = React.useRef(0)
      React.useEffect(function () {
        return function () {
          contextRequest.current += 1
        }
      }, [])

      function closeContext() {
        contextRequest.current += 1
        setModal(null)
        setDetail(null)
        setDetailError(false)
        setFull(false)
        setFullLoading(false)
        setFullError(false)
      }

      function toggleConv(sessionId) {
        setOpenConvs(function (previous) {
          var next = Object.assign({}, previous)
          next[sessionId] = !next[sessionId]
          return next
        })
      }

      var searchQuery = query.trim().toLowerCase()
      var visibleItems = state.items.filter(function (item) {
        if (pendingOnly && !item.pending) return false
        if (!searchQuery) return true
        return [item.sessionTitle, item.title, item.questionText, item.answerText, item.note, (item.tags || []).join(' ')]
          .join(' ')
          .toLowerCase()
          .indexOf(searchQuery) !== -1
      })

      function titleFor(item) {
        if (item.sessionId === props.sessionId && props.sessionTitle) return props.sessionTitle
        return item.sessionTitle || item.title || t('echoUntitled')
      }

      function openContext(item) {
        var request = ++contextRequest.current
        setModal(item)
        setDetail(null)
        setDetailError(false)
        setFull(false)
        setFullLoading(false)
        setFullError(false)
        fetch('/dsh-running-panel/echo?id=' + encodeURIComponent(item.id), { cache: 'no-store' })
          .then(function (response) {
            if (!response.ok) throw new Error('echo detail failed')
            return response.json()
          })
          .then(function (body) {
            if (request !== contextRequest.current) return
            setDetail(body && body.echo ? body.echo : null)
          })
          .catch(function () {
            if (request !== contextRequest.current) return
            // 以前这里只 setDetail(null)，弹窗会永远停在「加载中」。
            setDetail(null)
            setDetailError(true)
          })
      }

      function loadFullContext() {
        if (!modal || !modal.sessionAlive || fullLoading) return
        var request = ++contextRequest.current
        var itemId = modal.id
        setFullLoading(true)
        setFullError(false)
        fetch('/dsh-running-panel/echo?context=' + encodeURIComponent(modal.id), { cache: 'no-store' })
          .then(function (response) {
            if (!response.ok) throw new Error('echo context failed')
            return response.json()
          })
          .then(function (body) {
            if (request !== contextRequest.current) return
            setDetail({
                id: itemId,
                messages: Array.isArray(body.messages) ? body.messages : [],
                anchorMessageId: body.anchorMessageId,
            })
            setFull(true)
            setFullLoading(false)
          })
          .catch(function () {
            if (request !== contextRequest.current) return
            setFullError(true)
            setFullLoading(false)
          })
      }

      var confirmPair = React.useState(null)
      var confirmItem = confirmPair[0]
      var setConfirmItem = confirmPair[1]

      // 删除确认用面板内对话框：Electron 里系统 confirm 不可靠，也和面板风格割裂。
      function removeItem(item, event) {
        if (event) event.stopPropagation()
        setConfirmItem(item)
      }

      function confirmRemove(item) {
        setConfirmItem(null)
        fetch('/dsh-running-panel/echo?id=' + encodeURIComponent(item.id), { method: 'DELETE' })
          .then(function (response) {
            if (!response.ok) throw new Error('echo delete failed')
            if (modal && modal.id === item.id) setModal(null)
            reload()
          })
          .catch(function () {
            /* 下一轮刷新再说 */
          })
      }

      var groups = []
      visibleItems.forEach(function (item) {
        var group = groups.find(function (entry) {
          return entry.sessionId === item.sessionId
        })
        if (!group) {
          group = { sessionId: item.sessionId, title: titleFor(item), updatedAt: 0, sessionAlive: true, items: [] }
          groups.push(group)
        }
        group.items.push(item)
        group.updatedAt = Math.max(group.updatedAt, item.updatedAt || 0)
        group.sessionAlive = group.sessionAlive && item.sessionAlive !== false
        if (item.sessionId === props.sessionId && props.sessionTitle) group.title = props.sessionTitle
      })
      groups.sort(function (a, b) {
        return b.updatedAt - a.updatedAt
      })
      groups.forEach(function (group) {
        group.items.sort(function (a, b) {
          return (b.updatedAt || 0) - (a.updatedAt || 0)
        })
      })

      return h(
        React.Fragment,
        null,
        h(
          GroupSection,
          {
            id: 'echo',
            className: '__rp_group __rp_echoGroup',
            title: h(
              'span',
              { className: '__rp_echoGroupTitle' },
              h(BookmarkIcon, { size: 17 }),
              h('span', null, t('echoLibrary')),
            ),
            count: visibleItems.length,
            meta: h(
              'button',
              {
                type: 'button',
                className: '__rp_echoRefresh',
                title: t('echoRefresh'),
                'aria-label': t('echoRefresh'),
                onClick: reload,
              },
              '↻',
            ),
            body: h(
              'div',
              { className: '__rp_section' },
              state.capacity
                ? h('div', { className: '__rp_sheetHint' }, fill(fill(t('echoCapacity'), 'n', state.capacity.count), 'limit', state.capacity.limit))
                : null,
              h(
                'div',
                { className: '__rp_echoSearch' },
                h('input', {
                  type: 'search',
                  className: '__rp_echoSearchInput',
                  value: query,
                  placeholder: t('echoSearchPlaceholder'),
                  'aria-label': t('echoSearchPlaceholder'),
                  onChange: function (event) {
                    setQuery(event.target.value)
                  },
                }),
                h(
                  'button',
                  {
                    type: 'button',
                    className: '__rp_echoFilter',
                    'data-on': pendingOnly ? '1' : undefined,
                    'aria-pressed': pendingOnly ? 'true' : 'false',
                    title: t('echoPendingFilter'),
                    onClick: function () {
                      setPendingOnly(!pendingOnly)
                    },
                  },
                  t('echoPendingFilter'),
                ),
              ),
              state.loading
                ? h('div', { className: '__rp_sheetHint' }, t('echoLoading'))
                : groups.length
                  ? groups.map(function (group) {
                      var isOpen = Boolean(searchQuery || pendingOnly || openConvs[group.sessionId])
                      return h(
                        'div',
                        { key: group.sessionId, className: '__rp_echoConv' },
                        h(
                          'div',
                          { className: '__rp_echoConvHead' },
                          h(
                            'button',
                            {
                              type: 'button',
                              className: '__rp_echoConvToggle',
                              'aria-expanded': isOpen ? 'true' : 'false',
                              title: t(isOpen ? 'collapse' : 'expand'),
                              onClick: function () {
                                toggleConv(group.sessionId)
                              },
                            },
                            h('span', { className: '__rp_caret', 'aria-hidden': 'true' }, isOpen ? '▾' : '▸'),
                            h('span', { className: '__rp_echoConvTitle' }, group.title),
                            h('span', { className: '__rp_echoConvCount' }, String(group.items.length)),
                          ),
                          !group.sessionAlive
                            ? h('span', { className: '__rp_echoGone' }, t('echoSessionGone'))
                            : null,
                          group.sessionAlive && echoWorkspace
                            ? h(
                                'button',
                                {
                                  type: 'button',
                                  className: '__rp_echoConvOpen',
                                  title: t('echoOpenSession'),
                                  'aria-label': t('echoOpenSession'),
                                  onClick: function (event) {
                                    event.stopPropagation()
                                    openEchoAnchor(group.items[0])
                                  },
                                },
                                '↗',
                              )
                            : null,
                        ),
                        isOpen
                          ? group.items.map(function (item) {
                          return h(
                            'div',
                            {
                              key: item.id,
                              className: '__rp_echoCard',
                              role: 'button',
                              tabIndex: 0,
                              draggable: true,
                              title: t('echoDragTip'),
                              onDragStart: function (event) {
                                try {
                                  event.dataTransfer.effectAllowed = 'copy'
                                  event.dataTransfer.setData('text/plain', echoDragText(item))
                                  event.dataTransfer.setData('application/x-pulse-echo', item.id)
                                } catch (error) {
                                  /* 拖拽载荷不可用时仍可点开详情复制 */
                                }
                              },
                              'aria-label': t('echoOpenContext'),
                              onClick: function () {
                                openContext(item)
                              },
                              onKeyDown: function (event) {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault()
                                  openContext(item)
                                }
                              },
                            },
                            h(
                              'div',
                              { className: '__rp_echoCardHead' },
                              h('span', { className: '__rp_echoTime' }, formatEchoWhen(item.anchorAt || item.updatedAt)),
                              h(
                                'span',
                                { className: '__rp_echoMeta' },
                                fill(t('echoFloor'), 'n', item.anchorFloor || 1) +
                                  (item.pending ? ' · ' + fill(t('echoPendingTag'), 'n', item.pendingAfter) : ''),
                              ),
                              h(
                                'button',
                                {
                                  type: 'button',
                                  className: '__rp_echoDelete',
                                  onClick: function (event) {
                                    removeItem(item, event)
                                  },
                                },
                                t('echoDelete'),
                              ),
                            ),
                            h(
                              'div',
                              { className: '__rp_echoQA' },
                              h(
                                'div',
                                { className: '__rp_echoQ' },
                                h('span', { className: '__rp_echoRole' }, t('echoUser')),
                                h(
                                  'span',
                                  { className: '__rp_echoPreviewWrap' },
                                  h(
                                    'span',
                                    { className: '__rp_echoPreview' },
                                    echoReadable(item.questionText || t('echoNoQuestion')).slice(0, 1200),
                                  ),
                                ),
                              ),
                              h(
                                'div',
                                { className: '__rp_echoA' },
                                h('span', { className: '__rp_echoRole' }, t('echoAssistant')),
                                h(
                                  'span',
                                  { className: '__rp_echoPreviewWrap' },
                                  h(
                                    'span',
                                    { className: '__rp_echoPreview' },
                                    echoReadable(item.answerText || t('echoEmpty')).slice(0, 1200),
                                  ),
                                ),
                              ),
                            ),
                          )
                        }) : null,
                      )
                    })
                  : h(
                      'div',
                      { className: '__rp_sheetHint' },
                      searchQuery || pendingOnly ? t('echoNoMatch') : t('echoEmpty'),
                    ),
            ),
          },
        ),
        confirmItem
          ? h(ConfirmDialog, {
              t: t,
              title: t('echoDelete'),
              message: t('echoDeleteConfirm'),
              confirmLabel: t('echoDelete'),
              danger: true,
              onCancel: function () {
                setConfirmItem(null)
              },
              onConfirm: function () {
                confirmRemove(confirmItem)
              },
            })
          : null,
        modal
          ? h(EchoContextModal, {
              t: t,
              item: modal,
              detail: detail && detail.id === modal.id ? detail : null,
              full: full,
              fullLoading: fullLoading,
              fullError: fullError,
              detailError: detailError,
              sessionAlive: modal.sessionAlive !== false,
              onLoadFull: loadFullContext,
              onClose: closeContext,
            })
          : null,
      )
    }

