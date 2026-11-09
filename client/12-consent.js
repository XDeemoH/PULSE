    /* ── 后台模型调用的同意 ─────────────────────────────────────────────── */

    /**
     * 三项后台功能会把内容发给你的默认模型（DSH 的模型服务 → 你配置的服务商），并消耗 token：
     * - 自动翻译：技能 / 工具的名字和说明
     * - 推断目标：当前会话最近几轮对话（约 3000 字以内）
     * - 灵感收集：命中「下一步 / 以后再做」的回合
     * 在用户明确同意之前（prefs.modelConsent === 'granted'），它们都不会自动调用模型。
     * 用户自己点的按钮（现在翻译 / 检查完成情况 / 从历史会话整理）是明确操作，不受这里限制。
     */

    CSS += '\n' + [
      '.__rp_consent{margin:6px 0 8px;padding:8px 10px;border:1px solid color-mix(in srgb,var(--rp-amber) 45%,transparent);border-left:3px solid var(--rp-amber);border-radius:3px;background:color-mix(in srgb,var(--rp-amber) 6%,transparent);font-size:12.5px;line-height:1.55;display:flex;flex-direction:column;gap:6px}',
      '.__rp_consentTitle{font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.__rp_consent ul{margin:0;padding-left:18px;color:var(--dsw-alias-label-secondary)}',
      '.__rp_consentActs{display:flex;gap:6px;flex-wrap:wrap}',
    ].join('\n')

    /** 某项后台模型功能现在能不能自动跑：总同意 + 单项开关。 */
    function modelAllowed(feature) {
      return prefs.modelConsent === 'granted' && prefs[feature] !== false
    }

    function ModelConsent(props) {
      var t = props.t
      usePrefs()
      if (prefs.modelConsent === 'granted' || prefs.modelConsent === 'declined') return null
      return h(
        'div',
        { className: '__rp_consent', role: 'region', 'aria-label': t('consentTitle') },
        h('div', { className: '__rp_consentTitle' }, t('consentTitle')),
        h('div', null, t('consentBody')),
        h(
          'ul',
          null,
          h('li', null, t('consentTranslate')),
          h('li', null, t('consentGoal')),
          h('li', null, t('consentIdeas')),
        ),
        h('div', { style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: '12px' } }, t('consentCost')),
        h(
          'div',
          { className: '__rp_consentActs' },
          h('button', { type: 'button', className: '__rp_goalBtn', 'data-primary': '1', onClick: function () { setPref('modelConsent', 'granted') } }, t('consentAllow')),
          h('button', { type: 'button', className: '__rp_goalBtn', onClick: function () { setPref('modelConsent', 'declined') } }, t('consentDecline')),
        ),
      )
    }

    /** 设置窗口里的总开关；关着时下面三项显示为不可用。 */
    function ModelConsentSetting(props) {
      var t = props.t
      return h(
        'label',
        { className: '__rp_sheetRow __rp_checkRow' },
        h('input', {
          type: 'checkbox',
          name: 'rp-model-consent',
          'aria-label': t('consentToggle'),
          checked: prefs.modelConsent === 'granted',
          onChange: function (event) {
            setPref('modelConsent', event.target.checked ? 'granted' : 'declined')
          },
        }),
        h('span', { className: '__rp_sheetLabel' }, t('consentToggle')),
      )
    }
