    /* ── 新技能自动翻译：触发与状态 ─────────────────────────────────────── */

    /**
     * Host 只在被请求时翻译（POST /translate）。这里决定什么时候请求：
     * 设置开着、快照说有待翻译、没在跑、上次没失败，并且待翻译数比上次触发时多了——
     * 这样同一批不会因为每帧快照反复触发；失败后只能在设置里手动重试。
     */
    var translateStore = { value: null, listeners: new Set() }
    var autoTranslateBaseline = 0

    function noteTranslate(value) {
      if (!value || typeof value !== 'object') return
      var previous = translateStore.value
      translateStore.value = value
      if (JSON.stringify(previous) === JSON.stringify(value)) return
      translateStore.listeners.forEach(function (listener) {
        try {
          listener()
        } catch (error) {
          /* 渲染层自己的错误不扩散 */
        }
      })
    }

    function useTranslateStatus() {
      var pair = React.useState(0)
      var bump = pair[1]
      React.useEffect(function () {
        var sync = function () {
          bump(function (n) {
            return n + 1
          })
        }
        translateStore.listeners.add(sync)
        return function () {
          translateStore.listeners.delete(sync)
        }
      }, [])
      return translateStore.value
    }

    function requestTranslation() {
      return fetch('/dsh-running-panel/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
        .then(function (response) {
          return response.json().catch(function () {
            return null
          })
        })
        .then(function (value) {
          if (value && typeof value === 'object' && 'pending' in value) noteTranslate(value)
          return value
        })
    }

    /** 每帧快照调用一次：决定要不要替用户点「翻译」。返回是否发起了请求。 */
    function maybeAutoTranslate(status) {
      if (!status || typeof status !== 'object') return false
      var pending = Number(status.pending) || 0
      if (status.running) return false
      if (pending < autoTranslateBaseline) autoTranslateBaseline = pending
      if (!modelAllowed('autoTranslate') || status.lastError || pending <= autoTranslateBaseline) return false
      autoTranslateBaseline = pending
      requestTranslation().catch(function () {})
      return true
    }

    function translateErrorText(t, code) {
      var key = {
        llm_unavailable: 'translateNoLlm',
        no_default_model: 'translateNoModel',
        translate_unparseable: 'translateUnparseable',
        translate_timeout: 'translateTimeout',
      }[code]
      return key ? t(key) : fill(t('translateFailedRaw'), 'code', code)
    }

    function translateStatusText(t, status) {
      if (!status) return hostOutdated() ? t('hostOutdatedShort') : t('translateUnknown')
      if (status.running) return t('translateRunning') + (status.model ? ' · ' + status.model : '')
      if (status.lastError) return translateErrorText(t, status.lastError)
      if (status.pending > 0) return fill(t('translatePending'), 'n', status.pending)
      if (status.lastAt) return fill(t('translateDone'), 'n', status.lastCount || 0)
      return t('translateNone')
    }

    /** 设置窗口里的一块：开关 + 状态 + 手动按钮（自动关掉或失败时用）。 */
    function TranslateSettings(props) {
      var t = props.t
      var status = useTranslateStatus()
      var pending = status ? Number(status.pending) || 0 : 0
      var running = Boolean(status && status.running)
      return h(
        'div',
        { className: '__rp_sheetRow', style: { flexDirection: 'column', alignItems: 'stretch', gap: '6px' } },
        h(
          'label',
          { className: '__rp_checkRow', style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          h('input', {
            type: 'checkbox',
            name: 'rp-translate',
            'aria-label': t('translateToggle'),
            checked: prefs.autoTranslate !== false,
            onChange: function (event) {
              setPref('autoTranslate', event.target.checked)
            },
          }),
          h('span', { className: '__rp_sheetLabel' }, t('translateToggle')),
        ),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 } },
          h(
            'span',
            {
              className: '__rp_sheetHint',
              role: 'status',
              style: { flex: '1 1 auto', minWidth: 0, color: status && status.lastError ? 'var(--dsw-alias-state-error-primary)' : undefined },
            },
            translateStatusText(t, status),
          ),
          h(
            'button',
            {
              type: 'button',
              className: '__rp_goalBtn',
              disabled: running || (pending === 0 && !(status && status.lastError)),
              onClick: function () {
                requestTranslation().catch(function () {})
              },
            },
            running ? t('translateRunningShort') : t('translateNow'),
          ),
        ),
      )
    }
