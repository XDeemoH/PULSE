    /* ── 子代理节点 ──────────────────────────────────────────────────── */

    function ChildNode(props) {
      var t = props.t
      var child = props.child
      var calls = child.calls || child.tools || []
      var pair = React.useState(Boolean(child.phase === 'active' && calls.length > 0))
      var open = pair[0]
      var setOpen = pair[1]
      var detail = []
      if (child.startedAt) detail.push(fill(t('startedAt'), 't', formatTime(child.startedAt)))
      if (child.endedAt) detail.push(fill(t('endedAt'), 't', formatTime(child.endedAt)))
      if (child.stopReason) detail.push(fill(t('stopReason'), 'r', child.stopReason))
      return h(
        'div',
        { className: '__rp_child', 'data-state': child.phase },
        h(
          'div',
          { className: '__rp_childHead' },
          h('span', { className: '__rp_dot', 'aria-hidden': 'true' }),
          h('span', { className: '__rp_childLabel', title: child.label }, child.label),
          h('span', { className: '__rp_rowMeta' }, detail.join(' · ')),
          calls.length
            ? h(
                'button',
                {
                  type: 'button',
                  className: '__rp_caret',
                  'aria-expanded': open ? 'true' : 'false',
                  title: open ? t('collapse') : t('expand'),
                  onClick: function () {
                    setOpen(!open)
                  },
                },
                open ? '▾' : '▸',
              )
            : null,
        open
          ? h(
              'div',
              { className: '__rp_childTools' },
              calls.length
                ? calls.map(function (call) {
                    return h(
                      'div',
                      {
                        key: call.name,
                        className: '__rp_row',
                        'data-state': child.phase === 'spent' ? 'spent' : 'active',
                        'data-warn': call.error ? '1' : undefined,
                      },
                      h('span', { className: '__rp_dot', 'aria-hidden': 'true' }),
                      h('span', { className: '__rp_name', title: call.name }, nameOf('tool', call.name)),
                      h('span', { className: '__rp_rowMeta' }, '×' + String(call.count || call.total || 0)),
                    )
                  })
                : h('span', { className: '__rp_empty' }, t('childNoTools')),
            )
          : null,
        )
      )
    }

