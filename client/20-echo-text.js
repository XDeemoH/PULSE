    /**
     * 回声正文只做“去格式”，不做概括：不调用模型、不增加 token。
     * 目的是让人读到对话，而不是命令/表格/标题符号。
     */
    function echoReadable(text) {
      var value = String(text || '')
      value = value.replace(/```[\s\S]*?```/g, ' ')
      value = value.replace(/`([^`]+)`/g, '$1')
      value = value.replace(/^#{1,6}\s+/gm, '')
      value = value.replace(/^\s*\|?[-: ]+\|?[-: |]*$/gm, '')
      value = value.replace(/\*\*([^*]+)\*\*/g, '$1')
      value = value.replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
      value = value.replace(/\|/g, ' ')
      value = value.replace(/<\/?[a-z][^>]*>/gi, '')
      value = value.replace(/\n{3,}/g, '\n\n')
      return value.trim()
    }

    /**
     * 拖拽载荷：一条回声变成能直接落进输入框的引用块。
     * 只带标题、楼号和 Q/A 前若干字，不整段搬运——拖一次不该吃满预算。
     */
    function echoDragText(item, limits) {
      var maxQ = (limits && limits.maxQuestion) || 240
      var maxA = (limits && limits.maxAnswer) || 600
      var clip = function (text, max) {
        // 按码点截断：按 UTF-16 单元切会把 emoji / 生僻字劈成半个代理对。
        var chars = Array.from(echoReadable(text).replace(/\s+/g, ' ').trim())
        return chars.length > max ? chars.slice(0, max - 1).join('') + '…' : chars.join('')
      }
      var title = String((item && (item.title || item.sessionTitle)) || '').trim() || 'Echo'
      var floor = item && item.anchorFloor ? item.anchorFloor : 1
      var zhLabel = typeof isChineseLocale !== 'function' || isChineseLocale()
      var lines = [zhLabel ? '【Echo · ' + title + '】第 ' + floor + ' 楼' : '[Echo · ' + title + '] #' + floor]
      var question = clip(item && item.questionText, maxQ)
      var answer = clip(item && item.answerText, maxA)
      if (question) lines.push('Q: ' + question)
      if (answer) lines.push('A: ' + answer)
      return lines.join('\n')
    }

    function escapeHtml(text) {
      return String(text).replace(/[&<>]/g, function (ch) {
        return ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : '&gt;'
      })
    }

    /**
     * 选区复制：
     * - 在气泡里框选文字：只选了一条里的一段 → 抄选中的那段；跨了两条以上 → 这些消息整条按原格式复制。
     * - 框选了整条气泡（在气泡外拖动画框、Ctrl / Shift 加选）→ 选中的消息整条按原格式复制。
     * 纯文本是原始 Markdown（带「用户 / 助手」标头），同时写一份 HTML，粘到 Word / Notion 里保留格式。
     */
    function copyEchoSelection(event, root, opts) {
      if (!event || !event.clipboardData || typeof window === 'undefined') return null
      var selection = window.getSelection()
      var hasSelection = Boolean(selection && !selection.isCollapsed && selection.rangeCount && (!root || root.contains(selection.anchorNode)))
      var payload = null
      if (hasSelection) {
        var touched = echoMessagesInSelection(selection, root, opts)
        if (touched.length >= 2) payload = echoCopyPayload(touched, opts && opts.labels)
        else {
          var selected = String(selection).replace(/ /g, ' ')
          if (!selected.trim()) return null
          payload = {
            text: selected,
            html: selected
              .split(/\n{2,}/)
              .map(function (block) {
                return '<p>' + escapeHtml(block).replace(/\n/g, '<br>') + '</p>'
              })
              .join(''),
            count: 0,
          }
        }
      } else if (opts && opts.picked && Array.isArray(opts.messages)) {
        var list = opts.messages.filter(function (message) { return message && opts.picked[message.id] })
        if (list.length) payload = echoCopyPayload(list, opts.labels)
      }
      if (!payload) return null
      var text = payload.text
      var html = payload.html
      try {
        event.clipboardData.setData('text/plain', text)
        event.clipboardData.setData('text/html', html)
        event.preventDefault()
      } catch (error) {
        /* 写剪贴板失败就让浏览器自己处理 */
        return null
      }
      return payload
    }

    /** 选区碰到了哪些气泡（按页面顺序）。 */
    function echoMessagesInSelection(selection, root, opts) {
      if (!root || !opts || !Array.isArray(opts.messages) || typeof root.querySelectorAll !== 'function') return []
      var ids = {}
      Array.prototype.forEach.call(root.querySelectorAll('[data-msg-id]'), function (node) {
        if (selection.containsNode(node, true)) ids[node.getAttribute('data-msg-id')] = true
      })
      return opts.messages.filter(function (message) { return message && ids[message.id] })
    }

    /** 整条消息的复制内容：原始 Markdown + 渲染好的 HTML。 */
    function echoCopyPayload(list, labels) {
      var labelOf = function (message) {
        return message.role === 'user' ? (labels && labels.user) || 'User' : (labels && labels.assistant) || 'Assistant'
      }
      return {
        text: list
          .map(function (message) {
            return '**' + labelOf(message) + '**\n\n' + String(message.text || '').replace(/\r\n/g, '\n').trim()
          })
          .join('\n\n'),
        html: list
          .map(function (message) {
            return '<p><strong>' + escapeHtml(labelOf(message)) + '</strong></p>' + echoMarkdownHtml(message.text)
          })
          .join(''),
        count: list.length,
      }
    }

    function escapeAttr(text) {
      return escapeHtml(text).replace(/"/g, '&quot;')
    }

    /** 行内 Markdown → HTML：先转义，代码段不再处理粗体等，链接只认 http(s)。 */
    function echoInlineHtml(text) {
      return String(text)
        .split(/(`[^`\n]+`)/)
        .map(function (part) {
          if (/^`[^`\n]+`$/.test(part)) return '<code>' + escapeHtml(part.slice(1, -1)) + '</code>'
          return escapeHtml(part)
            .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (all, label, url) {
              return '<a href="' + escapeAttr(url) + '">' + label + '</a>'
            })
            .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
            .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
            .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
            .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
        })
        .join('')
    }

    /** 够用的 Markdown 渲染（标题、段落、列表、引用、代码块、表格、分隔线），只用于复制出去的 HTML。 */
    function echoMarkdownHtml(markdown) {
      var lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n')
      var out = []
      var i = 0
      var isTableSep = function (line) {
        return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line || '')
      }
      var cells = function (line) {
        return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (cell) { return cell.trim() })
      }
      var blockStart = function (line) {
        return /^\s*(```|#{1,6}\s|>|[-*+]\s|\d+[.)]\s)/.test(line) || /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)
      }
      while (i < lines.length) {
        var line = lines[i]
        var fence = /^\s*```/.exec(line)
        if (fence) {
          var code = []
          i += 1
          while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++])
          i += 1
          out.push('<pre><code>' + escapeHtml(code.join('\n')) + '</code></pre>')
          continue
        }
        var heading = /^\s*(#{1,6})\s+(.*)$/.exec(line)
        if (heading) {
          out.push('<h' + heading[1].length + '>' + echoInlineHtml(heading[2]) + '</h' + heading[1].length + '>')
          i += 1
          continue
        }
        if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
          out.push('<hr>')
          i += 1
          continue
        }
        if (line.indexOf('|') >= 0 && isTableSep(lines[i + 1])) {
          var head = cells(line)
          i += 2
          var rows = []
          while (i < lines.length && lines[i].indexOf('|') >= 0 && lines[i].trim()) rows.push(cells(lines[i++]))
          out.push(
            '<table><thead><tr>' + head.map(function (c) { return '<th>' + echoInlineHtml(c) + '</th>' }).join('') + '</tr></thead><tbody>' +
              rows.map(function (row) { return '<tr>' + row.map(function (c) { return '<td>' + echoInlineHtml(c) + '</td>' }).join('') + '</tr>' }).join('') +
              '</tbody></table>',
          )
          continue
        }
        var listMatch = /^\s*([-*+]|\d+[.)])\s+/.exec(line)
        if (listMatch) {
          var ordered = /\d/.test(listMatch[1])
          var items = []
          while (i < lines.length) {
            var m = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i])
            if (!m || /\d/.test(m[1]) !== ordered) break
            items.push('<li>' + echoInlineHtml(m[2]) + '</li>')
            i += 1
          }
          out.push((ordered ? '<ol>' : '<ul>') + items.join('') + (ordered ? '</ol>' : '</ul>'))
          continue
        }
        if (/^\s*>/.test(line)) {
          var quote = []
          while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(echoInlineHtml(lines[i++].replace(/^\s*>\s?/, '')))
          out.push('<blockquote>' + quote.join('<br>') + '</blockquote>')
          continue
        }
        if (!line.trim()) {
          i += 1
          continue
        }
        var para = []
        while (i < lines.length && lines[i].trim() && !(para.length && blockStart(lines[i])) && !(lines[i].indexOf('|') >= 0 && isTableSep(lines[i + 1]))) para.push(echoInlineHtml(lines[i++]))
        out.push('<p>' + para.join('<br>') + '</p>')
      }
      return out.join('')
    }

    function BookmarkIcon(props) {
      var size = props && props.size ? props.size : 16
      // 战术风格回声标记：六边形外壳 + 三条脉冲，明显区别于普通书签/星标。
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: 'none',
          className: '__rp_echoMark',
          'aria-hidden': 'true',
        },
        h('path', {
          d: 'M12 2.4 20.6 7.2v9.6L12 21.6 3.4 16.8V7.2Z',
          fill: props && props.filled ? 'currentColor' : 'none',
          fillOpacity: props && props.filled ? 0.14 : 0,
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinejoin: 'round',
        }),
        h('path', {
          d: 'M7.4 9.2h9.2M7.4 12h5.8M7.4 14.8h9.2',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
        }),
        h('circle', { cx: 12, cy: 12, r: 1.35, fill: 'currentColor' }),
      )
    }

    // #region echo-navigation-core
    /** Exact identity and visible geometry only; never search message text. */
    function echoAnchorNode(snapshot, messageId) {
      if (!snapshot || !snapshot.nodes || typeof snapshot.nodes.get !== 'function') return null
      var order = snapshot.order || []
      for (var i = 0; i < order.length; i += 1) {
        var node = snapshot.nodes.get(order[i])
        var data = node && node.data
        if (!data) continue
        if ((node.kind === 'user' || node.kind === 'steering') && String(data.messageId || '') === messageId) return node
        if (node.kind === 'assistant-step' && data.finalNode && String(data.finalNode.messageId || '') === messageId) return node
      }
      return null
    }

    function echoAnchorVisible(node, root, env) {
      if (!node || node.isConnected === false || !root.contains(node) || !node.getClientRects().length) return false
      var rect = node.getBoundingClientRect()
      var view = env.document.documentElement
      var bounds = { top: 0, left: 0, bottom: view.clientHeight, right: view.clientWidth }
      for (var element = node; element; element = element.parentElement) {
        if (element.hasAttribute && element.hasAttribute('hidden')) return false
        var style = env.style(element)
        if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') return false
        if (element !== node && element.getBoundingClientRect && /auto|scroll|hidden|clip/.test(style.overflowY + ' ' + style.overflowX)) {
          var clip = element.getBoundingClientRect()
          bounds.top = Math.max(bounds.top, clip.top)
          bounds.bottom = Math.min(bounds.bottom, clip.bottom)
          bounds.left = Math.max(bounds.left, clip.left)
          bounds.right = Math.min(bounds.right, clip.right)
        }
      }
      return Math.min(rect.bottom, bounds.bottom) - Math.max(rect.top, bounds.top) >= Math.min(20, rect.bottom - rect.top) &&
        Math.min(rect.right, bounds.right) - Math.max(rect.left, bounds.left) >= Math.min(20, rect.right - rect.left) &&
        rect.bottom > rect.top && rect.right > rect.left
    }

    async function locateEchoAnchor(item, env) {
      var sessionId = String((item && item.sessionId) || '')
      var messageId = String((item && (item.anchorMessageId || item.messageId)) || '')
      if (!sessionId || !messageId) return { ok: false, reason: 'missing-identity' }
      var deadline = env.now() + 20000
      var check = function () {
        var selection = env.workspace.selection && env.workspace.selection.getSnapshot()
        if (!env.isCurrent() || (selection && selection.sessionId !== sessionId)) throw new Error('cancelled')
        if (env.now() >= deadline) throw new Error('timeout')
      }
      var perform = async function (promise) {
        var settled = false, failure
        Promise.resolve(promise).then(function () { settled = true }, function (error) { failure = error || new Error('history-failed'); settled = true })
        while (!settled) { check(); await env.delay(80) }
        check()
        if (failure) throw failure
      }
      try {
        if (!env.workspace || !env.sessions || !env.conversation || !env.isCurrent()) throw new Error(env.isCurrent() ? 'unavailable' : 'cancelled')
        env.workspace.openSession(sessionId)
        var binding
        for (var wait = 0; wait < 40 && !binding; wait += 1) {
          check()
          binding = env.sessions.binding(sessionId)
          if (!binding) await env.delay(100)
        }
        if (!binding || !binding.session) throw new Error('unavailable')
        var session = binding.session
        if (typeof session.open === 'function') await perform(session.open())
        var conversation = env.conversation.binding(sessionId)
        if (typeof conversation.activate === 'function') conversation.activate('chat')
        var target = conversation.target('chat')
        var modelNode = null
        for (var page = 0; page <= 12; page += 1) {
          check()
          modelNode = echoAnchorNode(target.getSnapshot(), messageId)
          if (modelNode) break
          var state = session.getSnapshot()
          if (!state.hasMore || page === 12 || typeof session.loadOlder !== 'function') break
          if (state.loadingOlder) { await env.delay(100); page -= 1; continue }
          await perform(session.loadOlder())
          await env.delay(100)
        }
        if (!modelNode) throw new Error('history-limit')
        var previous = null
        for (var attempt = 0; attempt < 30; attempt += 1) {
          check()
          var roots = Array.prototype.slice.call(env.document.querySelectorAll('[data-conversation-session]'))
          for (var r = 0; r < roots.length; r += 1) {
            var root = roots[r]
            if (root.getAttribute('data-conversation-session') !== sessionId) continue
            var rows = Array.prototype.slice.call(root.querySelectorAll('[data-chat-node-key]'))
            for (var n = 0; n < rows.length; n += 1) {
              var node = rows[n]
              if (node.getAttribute('data-chat-node-key') !== String(modelNode.key) || node.getAttribute('data-chat-group-part') === 'reasoning') continue
              if (echoAnchorVisible(node, root, env) && previous === node) return { ok: true, node: node }
              previous = echoAnchorVisible(node, root, env) ? node : null
              // This is the shipped searchable-hidden reveal contract. Do not remove React-owned hidden attributes.
              node.dispatchEvent(new env.Event('beforematch', { bubbles: true }))
              node.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' })
            }
          }
          await env.delay(100)
        }
        throw new Error('not-visible')
      } catch (error) {
        return { ok: false, reason: String((error && error.message) || error) }
      }
    }
    // #endregion echo-navigation-core

    var echoNoticeStore = { value: null, listeners: new Set(), sequence: 0, timer: 0 }
    var echoNavigationSequence = 0
    var echoAnchorHighlight = null
    function showEchoNotice(value) {
      if (echoNoticeStore.timer) window.clearTimeout(echoNoticeStore.timer)
      echoNoticeStore.timer = 0
      echoNoticeStore.value = value
      echoNoticeStore.listeners.forEach(function (listener) { listener(value) })
    }
    function EchoFeedback(props) {
      var pair = React.useState(echoNoticeStore.value)
      React.useEffect(function () {
        var sync = function (value) { pair[1](value) }
        echoNoticeStore.listeners.add(sync)
        sync(echoNoticeStore.value)
        return function () { echoNoticeStore.listeners.delete(sync) }
      }, [])
      var notice = pair[0]
      if (!notice) return null
      var label = props.t(notice.key)
      Object.keys(notice.values || {}).forEach(function (key) { label = fill(label, key, notice.values[key]) })
      return h('div', {
        className: '__rp_warnBox', role: notice.error ? 'alert' : 'status', title: notice.details || undefined,
        style: { position: 'fixed', right: '18px', bottom: '18px', maxWidth: '420px', padding: '12px', zIndex: 10000,
          background: 'var(--dsw-alias-bg-layer-1)', border: '1px solid var(--dsw-alias-border-l1)', borderRadius: '8px' },
      }, label, h('button', { type: 'button', className: '__rp_linkBtn', 'aria-label': props.t('echoClose'), onClick: function () {
        echoNavigationSequence += 1
        showEchoNotice(null)
      } }, '✕'))
    }
    function openEchoAnchor(item) {
      var request = ++echoNavigationSequence
      if (echoAnchorHighlight) { echoAnchorHighlight(); echoAnchorHighlight = null }
      showEchoNotice({ key: 'echoLocating' })
      return locateEchoAnchor(item, {
        workspace: echoWorkspace, sessions: clientSessions, conversation: echoConversation, document: document,
        Event: window.Event, now: Date.now, style: function (node) { return window.getComputedStyle(node) },
        delay: function (ms) { return new Promise(function (resolve) { window.setTimeout(resolve, ms) }) },
        isCurrent: function () { return request === echoNavigationSequence },
      }).then(function (result) {
        if (request !== echoNavigationSequence) return result
        if (!result.ok && result.reason === 'cancelled') { showEchoNotice(null); return result }
        showEchoNotice({ key: result.ok ? 'echoLocated' : result.reason === 'missing-identity' ? 'echoAnchorMissing' : 'echoLocateFailed', error: !result.ok, details: result.ok ? '' : result.reason })
        if (result.ok) {
          result.node.classList.add('__rp_searchHit')
          var timer = window.setTimeout(function () { result.node.classList.remove('__rp_searchHit') }, 2200)
          echoAnchorHighlight = function () { window.clearTimeout(timer); result.node.classList.remove('__rp_searchHit') }
          echoNoticeStore.timer = window.setTimeout(function () { if (request === echoNavigationSequence) showEchoNotice(null) }, 3000)
        }
        return result
      })
    }

    function EchoActionButton(props) {
      var t = echoT || function (key) { return key }
      var sessionId = props.sessionId || sessionStore.id
      var pair = React.useState('idle')
      var status = pair[0]
      var setStatus = pair[1]
      var capacityPair = React.useState(null)
      var capacity = capacityPair[0]
      if (!sessionId || !props.messageId) return null
      var labels = {
        idle: t('echoFavorite'),
        saving: t('echoSaving'),
        saved: t('echoSaved'),
        merged: t('echoMerged'),
        pending: t('echoPending'),
        error: t('echoError'),
      }
      var label = status === 'full' && capacity
        ? fill(fill(t('echoCapacityFull'), 'n', capacity.count), 'limit', capacity.limit)
        : labels[status] || labels.idle
      var pressed = status === 'saved' || status === 'merged' || status === 'pending'
      function save() {
        if (status === 'saving' || pressed) return
        setStatus('saving')
        fetch('/dsh-running-panel/echo', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionId, messageId: props.messageId }),
        })
          .then(function (response) {
            return response.json().then(function (body) {
              if (!response.ok) {
                var error = new Error(body && body.error ? body.error : 'echo failed')
                error.body = body
                throw error
              }
              return body
            })
          })
          .then(function (body) {
            setStatus(body.merged ? 'merged' : body.pending ? 'pending' : 'saved')
            if (typeof sfxPlay === 'function') sfxPlay('done')
            try {
              window.dispatchEvent(
                new CustomEvent('dsh-running-panel:echo-changed', { detail: { sessionId: sessionId } }),
              )
            } catch (error) {
              /* ignore */
            }
          })
          .catch(function (error) {
            if (error && error.body && error.body.error === 'echo_capacity_reached') {
              var limit = error.body.capacity || error.body
              capacityPair[1]({ count: limit.count, limit: limit.limit })
              setStatus('full')
              showEchoNotice({ key: 'echoCapacityFull', values: { n: limit.count, limit: limit.limit }, error: true })
            } else {
              setStatus('error')
              showEchoNotice({ key: 'echoError', error: true })
            }
          })
      }
      return h(
        'button',
        {
          type: 'button',
          className: '__rp_echoAction',
          'data-state': status,
          'data-pressed': pressed ? '1' : undefined,
          title: label,
          'aria-label': label,
          'aria-pressed': pressed ? 'true' : 'false',
          disabled: status === 'saving' || pressed,
          onClick: save,
        },
        h(BookmarkIcon, { filled: pressed, size: 24 }),
        status === 'saving' ? h('span', { className: '__rp_echoSpin', 'aria-hidden': 'true' }) : null,
      )
    }

