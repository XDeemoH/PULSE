    /* ── 搜索框与结果行（当前会话） ──────────────────────────────────── */

    function SearchBar(props) {
      var t = props.t
      var inputRef = React.useRef(null)
      return h(
        'div',
        {
          className: '__rp_search',
          onClick: function () {
            // 3D skins can offset an input's hit area; clicking anywhere in the
            // bar still puts the caret back in the field.
            if (inputRef.current) inputRef.current.focus()
          },
        },
        h(
          'svg',
          { className: '__rp_searchIcon', width: 14, height: 14, viewBox: '0 0 24 24', 'aria-hidden': 'true' },
          h('circle', { cx: 10, cy: 10, r: 6.5, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 }),
          h('path', { d: 'M15 15l5 5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' }),
        ),
        h('input', {
          ref: inputRef,
          type: 'text',
          className: '__rp_searchInput',
          name: 'rp-search',
          value: props.value,
          placeholder: t('searchPlaceholder'),
          'aria-label': t('searchPlaceholder'),
          spellCheck: false,
          onChange: function (event) {
            props.onChange(event.target.value)
          },
          onKeyDown: function (event) {
            if (event.key === 'Escape') props.onChange('')
          },
        }),
        props.value
          ? h(
              'button',
              {
                type: 'button',
                className: '__rp_searchClear',
                title: t('clear'),
                'aria-label': t('clear'),
                onClick: function () {
                  props.onChange('')
                },
              },
              '×',
            )
          : null,
      )
    }

    /** 一条搜索结果：拖拽写 @名称，点击「插入」走同一段文本。冷层那条的按钮是「启用」。 */
    function SearchResultRow(props) {
      var t = props.t
      var entry = props.entry
      var cold = entry.availability === 'cold'
      var catalogOnly = entry.availability === 'catalog'
      var busyPair = React.useState(false)
      var busy = busyPair[0]
      var setBusy = busyPair[1]
      var failPair = React.useState(false)
      var failed = failPair[0]
      var setFailed = failPair[1]

      var restore = function () {
        setBusy(true)
        setFailed(false)
        fetch('/dsh-running-panel/park', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: entry.name, directoryName: entry.directoryName, action: 'restore' }),
        })
          .then(function (response) {
            if (!response.ok) setFailed(true)
          })
          .catch(function () {
            setFailed(true)
          })
          .then(function () {
            setBusy(false)
          })
      }

      return h(
        'div',
        {
          className: '__rp_result',
          'data-kind': entry.kind,
          'data-warn': failed ? '1' : undefined,
          draggable: !catalogOnly,
          title: entry.desc || entry.label,
          onDragStart: function (event) {
            if (catalogOnly) {
              event.preventDefault()
              return
            }
            var payload = dragPayload(entry)
            Object.keys(payload).forEach(function (type) {
              event.dataTransfer.setData(type, payload[type])
            })
            event.dataTransfer.effectAllowed = 'copy'
          },
        },
        h(
          'div',
          { className: '__rp_resultMain' },
          h(
            'div',
            { className: '__rp_resultTop' },
            h('span', { className: '__rp_resultName' }, entry.label),
            entry.alt ? h('span', { className: '__rp_resultAlt' }, entry.alt) : null,
            h('span', { className: '__rp_resultKind' }, entry.kind === 'skill' ? t('skills') : t('tools')),
            cold ? h('span', { className: '__rp_badge', 'data-tone': 'cold' }, t('searchCold')) : null,
            entry.availability === 'installed'
              ? h('span', { className: '__rp_badge', 'data-tone': 'installed' }, t('searchInstalled'))
              : null,
            catalogOnly
              ? h('span', { className: '__rp_badge', 'data-tone': 'installed' }, t('searchCatalog'))
              : null,
          ),
          entry.desc
            ? h('div', { className: '__rp_resultDesc' }, entry.desc)
            : h(
                'div',
                { className: '__rp_resultDesc' },
                [entry.lib, entry.tag].filter(Boolean).join(' · '),
              ),
        ),
        cold
          ? h(
              'button',
              {
                type: 'button',
                className: '__rp_linkBtn',
                disabled: busy,
                title: failed ? t('restoreFailed') : entry.name,
                onClick: restore,
              },
              busy ? '…' : t('restore'),
            )
          : h(
              'button',
              {
                type: 'button',
                className: '__rp_linkBtn',
                disabled: catalogOnly,
                title: t(catalogOnly ? 'catalogUnavailable' : 'insertTip'),
                onClick: function () {
                  if (!catalogOnly) props.onInsert(entry)
                },
              },
              t('insert'),
            ),
      )
    }

    function groupResultsByLib(results) {
      var groups = []
      var byLib = {}
      results.forEach(function (row) {
        var label = (row.entry && row.entry.lib) || ''
        if (!byLib[label]) {
          byLib[label] = { lib: label, libId: row.entry && row.entry.libId, rows: [] }
          groups.push(byLib[label])
        }
        byLib[label].rows.push(row)
      })
      return groups
    }

    function SearchResults(props) {
      var t = props.t
      return h(
        'section',
        { className: '__rp_group __rp_searchResults' },
        h(
          'div',
          { className: '__rp_groupHead' },
          h('h3', { className: '__rp_groupTitle' }, t('searchResults')),
          h('span', { className: '__rp_groupCount' }, String(props.results.length)),
          h('span', { className: '__rp_groupTags' }, t('searchHint')),
        ),
        props.notice ? h('div', { className: '__rp_searchNotice' }, props.notice) : null,
        h(
          'div',
          { className: '__rp_section' },
          props.results.length
            ? groupResultsByLib(props.results).map(function (group) {
                // 按安装批次分组；组的顺序跟着组内最佳命中走，排名信息不丢。
                return h(
                  'div',
                  { key: 'lib:' + group.lib, className: '__rp_searchLib' },
                  h('div', { className: '__rp_searchLibHead', title: group.libId ? libTip(t, group.libId, 0) || undefined : undefined }, group.lib + ' · ' + group.rows.length),
                  group.rows.map(function (row) {
                    return h(SearchResultRow, {
                      key: row.entry.key,
                      t: t,
                      entry: row.entry,
                      hits: row.hits,
                      onInsert: props.onInsert,
                    })
                  }),
                )
              })
            : h('span', { className: '__rp_empty' }, t('searchEmpty')),
        ),
      )
    }

