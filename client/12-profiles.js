    /* ── 技能配置：按工作类型保存 / 切换启用的技能组合 ───────────────────── */

    /**
     * 预算方案旁的「技能配置」按钮 → 一个窗口：
     * - 保存当前配置（此刻启用着的自装技能 + 钉住的库），改名、用当前覆盖、删除；
     * - 切换：先预演（将停用 / 将恢复 / 保留·新装 / 保留·别的对话在用 / 找不到），确认才动文件；
     * - 撤销上次切换。
     * 搬目录全部走 Host 的可撤销停用 / 恢复，和预算方案同一套安全检查。
     */

    CSS += '\n' + [
      '.__rp_profiles{width:min(560px,100%);max-height:84vh;overflow:auto;display:flex;flex-direction:column;gap:10px}',
      '.__rp_profilesHead{display:flex;align-items:center;gap:8px}',
      '.__rp_profilesHead h3{margin:0;flex:1 1 auto}',
      '.__rp_profilesNote{font-size:12.5px;color:var(--dsw-alias-label-secondary);line-height:1.55}',
      '.__rp_profileRow{display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid var(--dsw-alias-border-l1);flex-wrap:wrap}',
      '.__rp_profileName{flex:1 1 auto;min-width:0;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.__rp_profileRow[data-active="1"] .__rp_profileName{color:var(--rp-amber)}',
      '.__rp_profileMeta{font-size:11.5px;color:var(--dsw-alias-label-tertiary)}',
      '.__rp_switchGroup{display:flex;flex-direction:column;gap:3px}',
      '.__rp_switchTitle{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.__rp_switchGroup[data-kind=park] .__rp_switchTitle{color:var(--rp-rust)}',
      '.__rp_switchGroup[data-kind=restore] .__rp_switchTitle{color:var(--rp-teal)}',
      '.__rp_switchNames{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.6;word-break:break-word}',
      '.__rp_profilesErr{font-size:12.5px;color:var(--dsw-alias-state-error-primary)}',
    ].join('\n')

    function profileFetch(method, body, query) {
      return fetch('/dsh-running-panel/profiles' + (query || ''), {
        method: method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
      }).then(function (response) {
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
    }

    function profileErrorText(t, code) {
      if (hostOutdated()) return t('hostOutdatedShort')
      var key = { profile_name_empty: 'profileNameEmpty', profile_name_taken: 'profileNameTaken', profile_limit: 'profileLimit', 'plan-expired': 'profilePlanExpired', 'nothing-to-undo': 'profileNothingToUndo' }[code]
      return key ? t(key) : fill(t('profileFailed'), 'reason', code)
    }

    function skillList(names) {
      return names
        .map(function (name) {
          return nameOf('skill', name) || name
        })
        .join('、')
    }

    function ProfilesButton(props) {
      var t = props.t
      var openPair = React.useState(false)
      var open = openPair[0]
      var setOpen = openPair[1]
      return h(
        React.Fragment,
        null,
        h('button', { type: 'button', className: '__rp_optimize', title: t('profilesTip'), onClick: function () { setOpen(true) } }, t('profiles')),
        open ? h(ProfilesDialog, { t: t, sessionId: props.sessionId, onClose: function () { setOpen(false) } }) : null,
      )
    }

    function ProfilesDialog(props) {
      var t = props.t
      var viewPair = React.useState(null)
      var view = viewPair[0]
      var setView = viewPair[1]
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
      var namingPair = React.useState('')
      var naming = namingPair[0] // '' | 'new' | <profile id>（改名）
      var setNaming = namingPair[1]
      var deletingPair = React.useState('')
      var deleting = deletingPair[0]
      var setDeleting = deletingPair[1]
      var aliveRef = React.useRef(true)
      React.useEffect(function () {
        profileFetch('GET')
          .then(function (value) {
            if (aliveRef.current) setView(value)
          })
          .catch(function (failure) {
            if (aliveRef.current) setError(profileErrorText(t, String((failure && failure.message) || failure)))
          })
        return function () {
          aliveRef.current = false
        }
      }, [])

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
            setError(profileErrorText(t, String((failure && failure.message) || failure)))
          })
      }
      var libs = function () {
        return (prefs.pins && Array.isArray(prefs.pins.libs) ? prefs.pins.libs : []).slice()
      }

      var body = []
      if (!view && !error) body.push(h('div', { key: 'loading', className: '__rp_profilesNote' }, t('loading')))
      if (view && !preview && !result) {
        var active = (view.profiles || []).find(function (p) { return p.id === view.active })
        body.push(
          h('div', { key: 'note', className: '__rp_profilesNote' }, fill(t('profilesNow'), 'n', view.liveCount) + (active ? ' · ' + fill(t('profilesActive'), 'name', active.name) : '')),
        )
        ;(view.profiles || []).forEach(function (profile) {
          var isActive = profile.id === view.active
          body.push(
            naming === profile.id
              ? h(GoalInput, { key: profile.id, t: t, initial: profile.name, placeholder: t('profileNamePlaceholder'), busy: busy === 'rename', onCancel: function () { setNaming('') }, onSubmit: function (name) { act('rename', profileFetch('PATCH', { id: profile.id, name: name }), function (value) { setView(value); setNaming('') }) } })
              : h(
                  'div',
                  { key: profile.id, className: '__rp_profileRow', 'data-active': isActive ? '1' : undefined },
                  h('span', { className: '__rp_profileName', title: skillList(profile.skills) }, (isActive ? '★ ' : '') + profile.name),
                  h('span', { className: '__rp_profileMeta' }, fill(t('profileCount'), 'n', profile.count)),
                  h('button', { type: 'button', className: '__rp_goalBtn', 'data-primary': '1', disabled: Boolean(busy) || isActive, onClick: function () { act('preview', profileFetch('POST', { preview: profile.id, sessionId: props.sessionId || sessionStore.id || '' }), setPreview) } }, t('profileSwitch')),
                  h('button', { type: 'button', className: '__rp_goalBtn', disabled: Boolean(busy), onClick: function () { setNaming(profile.id) } }, t('profileRename')),
                  h('button', { type: 'button', className: '__rp_goalBtn', disabled: Boolean(busy), title: t('profileOverwriteTip'), onClick: function () { act('overwrite', profileFetch('PATCH', { id: profile.id, overwrite: true, libs: libs() }), setView) } }, t('profileOverwrite')),
                  deleting === profile.id
                    ? h('button', { type: 'button', className: '__rp_goalBtn', 'data-danger': '1', disabled: Boolean(busy), onClick: function () { act('delete', profileFetch('DELETE', null, '?id=' + encodeURIComponent(profile.id)), function (value) { setView(value); setDeleting('') }) } }, t('profileDeleteConfirm'))
                    : h('button', { type: 'button', className: '__rp_goalBtn', 'aria-label': t('profileDelete'), title: t('profileDelete'), disabled: Boolean(busy), onClick: function () { setDeleting(profile.id) } }, '✕'),
                ),
          )
        })
        if (!(view.profiles || []).length) body.push(h('div', { key: 'empty', className: '__rp_profilesNote' }, t('profilesEmpty')))
        body.push(
          naming === 'new'
            ? h(GoalInput, { key: 'new', t: t, placeholder: t('profileNamePlaceholder'), busy: busy === 'save', onCancel: function () { setNaming('') }, onSubmit: function (name) { act('save', profileFetch('POST', { name: name, libs: libs() }), function (value) { setView(value); setNaming('') }) } })
            : h('div', { key: 'save', className: '__rp_goalActions' }, h('button', { type: 'button', className: '__rp_goalBtn', 'data-primary': '1', disabled: Boolean(busy), onClick: function () { setNaming('new') } }, t('profileSave'))),
        )
        if (view.lastSwitch) {
          body.push(
            h(
              'div',
              { key: 'undo', className: '__rp_goalActions' },
              h('span', { className: '__rp_profilesNote' }, fill(t('profileLast'), 'name', view.lastSwitch.profileName)),
              h('button', { type: 'button', className: '__rp_goalBtn', disabled: Boolean(busy), onClick: function () { act('undo', profileFetch('POST', { undo: true }), function (value) { setView(value.view); setResult(null) }) } }, t('profileUndo')),
            ),
          )
        }
      }
      if (preview && !result) {
        var nothing = !preview.park.length && !preview.restore.length
        var group = function (kind, title, names, key) {
          if (!names.length) return null
          return h('div', { key: key || kind, className: '__rp_switchGroup', 'data-kind': kind }, h('div', { className: '__rp_switchTitle' }, fill(title, 'n', names.length)), h('div', { className: '__rp_switchNames' }, skillList(names)))
        }
        body.push(h('div', { key: 'ptitle', className: '__rp_profilesNote' }, fill(t('profilePreviewTitle'), 'name', preview.profileName)))
        body.push(group('park', t('profileWillPark'), preview.park))
        body.push(group('restore', t('profileWillRestore'), preview.restore.map(function (row) { return row.name })))
        body.push(group('new', t('profileKeepNew'), preview.keepNew))
        if (preview.keepInUse.length) {
          body.push(
            h(
              'div',
              { key: 'inuse', className: '__rp_switchGroup', 'data-kind': 'inuse' },
              h('div', { className: '__rp_switchTitle' }, fill(t('profileKeepInUse'), 'n', preview.keepInUse.length)),
              h('div', { className: '__rp_switchNames' }, preview.keepInUse.map(function (row) { return (nameOf('skill', row.name) || row.name) + '（' + row.sessions.map(function (s) { return s.title }).join('、') + '）' }).join('、')),
            ),
          )
        }
        body.push(group('missing', t('profileMissing'), preview.missing))
        if (nothing) body.push(h('div', { key: 'nothing', className: '__rp_profilesNote' }, t('profileNothing')))
        body.push(
          h(
            'div',
            { key: 'acts', className: '__rp_goalActions' },
            nothing
              ? null
              : h('button', { type: 'button', className: '__rp_goalBtn', 'data-primary': '1', disabled: Boolean(busy), onClick: function (event) {
                  sfxFor(event, 'click')
                  act('apply', profileFetch('POST', { apply: preview.switchId }), function (value) {
                    // 配置里钉住的库跟着切换。
                    if (value && Array.isArray(value.libs)) setPref('pins', Object.assign({}, prefs.pins, { libs: value.libs }))
                    sfxPlay('done')
                    setResult(value)
                    setView(value.view)
                  })
                } }, busy === 'apply' ? t('profileApplying') : t('profileConfirm')),
            h('button', { type: 'button', className: '__rp_goalBtn', disabled: Boolean(busy), onClick: function () { setPreview(null) } }, t('profileBack')),
          ),
        )
      }
      if (result) {
        body.push(h('div', { key: 'done', className: '__rp_profilesNote' }, fill(fill(t('profileDone'), 'parked', result.parked.length), 'restored', result.restored.length)))
        if (result.failed && result.failed.length) body.push(h('div', { key: 'failed', className: '__rp_profilesErr' }, fill(t('profilePartFailed'), 'names', result.failed.map(function (row) { return row.name + '（' + row.error + '）' }).join('、'))))
        body.push(
          h(
            'div',
            { key: 'racts', className: '__rp_goalActions' },
            h('button', { type: 'button', className: '__rp_goalBtn', disabled: Boolean(busy), onClick: function () { act('undo', profileFetch('POST', { undo: true }), function (value) { setView(value.view); setResult(null); setPreview(null) }) } }, t('profileUndo')),
            h('button', { type: 'button', className: '__rp_goalBtn', 'data-primary': '1', onClick: props.onClose }, t('profileClose')),
          ),
        )
      }
      if (error) body.push(h('div', { key: 'err', className: '__rp_profilesErr', role: 'alert' }, error))

      return portalToBody(
        h(
          'div',
          {
            className: '__rp_confirmWrap',
            onMouseDown: function (event) {
              if (event.target === event.currentTarget && !busy) props.onClose()
            },
            onKeyDown: function (event) {
              if (event.key === 'Escape' && !busy) props.onClose()
            },
          },
          h(
            'div',
            { className: '__rp_confirm __rp_profiles', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('profiles') },
            h('div', { className: '__rp_profilesHead' }, h('h3', null, t('profiles')), h('button', { type: 'button', className: '__rp_goalBtn', 'aria-label': t('profileClose'), disabled: Boolean(busy), onClick: props.onClose }, '✕')),
            h('div', { className: '__rp_profilesNote' }, t('profilesIntro')),
            body,
          ),
        ),
      )
    }
