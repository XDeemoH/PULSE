    /* ── 活动栏图标 ──────────────────────────────────────────────────── */

    function PanelIcon(props) {
      var size = (props && props.size) || 18
      return h(
        'svg',
        {
          className: '__rp_icon',
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          'aria-hidden': 'true',
          style: { color: props && props.active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-secondary)' },
        },
        h('path', {
          d: 'M3 12h3.2l2.1-5.4 3.3 11 2.3-7 1.7 3.4H21',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )
    }

