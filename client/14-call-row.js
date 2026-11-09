    /* ── 调用行（全局卡片里用，紧凑） ─────────────────────────────────── */

    function CallRow(props) {
      var t = props.t
      var call = props.call
      var extra = []
      extra.push(fill(t('roundCount'), 'n', call.count || 0))
      if (call.total > (call.count || 0)) extra.push(fill(t('totalCount'), 'n', call.total))
      if (call.ms) extra.push(formatMs(call.ms))
      return h(
        'div',
        {
          className: '__rp_call',
          'data-warn': call.error ? '1' : undefined,
          title: (call.at ? formatTime(call.at) : '') + (extra.length ? ' · ' + extra.join(' · ') : ''),
        },
        h('span', { className: '__rp_callName' }, nameOf('tool', call.name)),
        altNameOf('tool', call.name) ? h('span', { className: '__rp_nameAlt' }, altNameOf('tool', call.name)) : null,
        h('span', { className: '__rp_callCount' }, '×' + String(call.count || 0)),
        call.error ? h('span', { className: '__rp_warnTag' }, t('hasError')) : null,
      )
    }

