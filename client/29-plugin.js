    /* ── 插件 ────────────────────────────────────────────────────────── */

    function apply(ctx) {
      loadPrefs()
      ctx.effect(function () {
        var uninstall = installRowTips()
        return function () {
          if (uninstall) uninstall()
        }
      }, 'dsh-running-panel: row tips')

      ctx.effect(function () {
        var uninstall = installSchemeWatch()
        return function () {
          if (uninstall) uninstall()
        }
      }, 'dsh-running-panel: dsh scheme')
      var t = ctx.locale.bind(NS)
      ctxLocale = ctx.locale
      try {
        clientLayout = ctx.layout || null
      } catch (error) {
        clientLayout = null
      }
      echoT = t
      try {
        clientSessions = ctx.get('sessions') || null
      } catch (error) {
        clientSessions = null
      }
      ctx.inject(['sessions'], function (sessionsCtx) {
        try {
          clientSessions = sessionsCtx.sessions || sessionsCtx.get('sessions') || null
        } catch (error) {
          clientSessions = null
        }
        sessionsCtx.effect(function () {
          return function () {
            clientSessions = null
          }
        }, 'dsh-running-panel: client sessions')
      })
      ctx.inject(['uiWorkspace'], function (workspaceCtx) {
        try {
          echoWorkspace = workspaceCtx.uiWorkspace || null
        } catch (error) {
          echoWorkspace = null
        }
        workspaceCtx.effect(function () {
          return function () {
            echoWorkspace = null
          }
        }, 'dsh-running-panel: echo workspace')
      })
      ctx.inject(['uiConversation'], function (conversationCtx) {
        echoConversation = conversationCtx.uiConversation || null
        conversationCtx.effect(function () {
          return function () { echoConversation = null; echoNavigationSequence += 1 }
        }, 'dsh-running-panel: echo conversation navigation')
      })
      ctx.effect(function () {
        return function () {
          echoNavigationSequence += 1
          if (echoAnchorHighlight) { echoAnchorHighlight(); echoAnchorHighlight = null }
          showEchoNotice(null)
        }
      }, 'dsh-running-panel: echo feedback cleanup')
      // Soul 是可选依赖：有 configForms + soul-md 命名空间才显示人格联动。
      ctx.inject(['configForms'], function (soulCtx) {
        try {
          soulScope = soulCtx.configForms.get('soul-md') || null
        } catch (error) {
          soulScope = null
        }
        prefsStore.version += 1
        prefsStore.listeners.forEach(function (listener) {
          try {
            listener()
          } catch (error) {
            /* ignore */
          }
        })
        soulCtx.effect(function () {
          return function () {
            soulScope = null
          }
        }, 'dsh-running-panel: soul scope')
      })

      // 显示名 / tag 词典：取一次，注册进 locale 服务；取不到就靠 humanize 兜底。
      ctx.effect(function () {
        var alive = true
        catalogCtx = ctx
        try {
          fetch('/dsh-running-panel/catalog', { cache: 'no-store' })
            .then(function (response) {
              return response && response.ok ? response.json() : null
            })
            .then(function (data) {
              if (alive && data) applyCatalog(ctx, data)
            })
            .catch(function () {
              /* 没有词典也能工作 */
            })
        } catch (error) {
          /* fetch 不可用（极旧环境）：保持 humanize */
        }
        return function () {
          alive = false
        }
      }, 'dsh-running-panel: display names')

      ctx.effect(function () {
        return ctx.locale.register(NS, { zh: zh, en: en })
      }, 'dsh-running-panel: dictionaries')

      ctx.effect(function () {
        var tag = document.createElement('style')
        tag.dataset.plugin = 'dsh-running-panel'
        tag.textContent = CSS
        document.head.appendChild(tag)
        return function () {
          tag.remove()
        }
      }, 'dsh-running-panel: styles')

      ctx.slots.inject('sidebar.panellist', function () {
        return ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: 'dsh-running-panel',
            order: 12,
            label: function () {
              return t('nav')
            },
          },
          PanelIcon,
        )
      })

      // 左侧主要栏位：全局看板。
      ctx.slots.inject('main', function () {
        return ctx.slots.register({ name: 'main', key: 'dsh-running-panel' }, function () {
          return h(Panel, { t: t, mode: 'global' })
        })
      })

      // 仅用于登记“当前会话 id”，渲染 null，不占位、不改动会话 UI。
      ctx.slots.inject('conversation.input.dock', function () {
        return ctx.slots.register(
          { name: 'conversation.input.dock', id: 'running-panel-session-probe', order: 0 },
          SessionReporter,
        )
      })

      // 对话标题栏的可见入口（右侧栏之外的兜底路径）。
      ctx.slots.inject('conversation.session.header.utilities', function () {
        return ctx.slots.register(
          { name: 'conversation.session.header.utilities', id: 'running-panel-open', order: 30, locale: NS },
          function (props) {
            return h(HeaderButton, { t: t, sessionId: props && props.sessionId })
          },
        )
      })

      // 对话右上角常驻圆盘：不开侧边栏也能看本轮调用构成。
      ctx.slots.inject('shell.overlay', function () {
        return ctx.slots.register({ name: 'shell.overlay', id: 'running-panel-corner', order: 40 }, function () {
          return h(PulseCorner, { t: t })
        })
      })

      // 每条 finalized assistant 消息上的收藏按钮。
      ctx.slots.inject('shell.overlay', function () {
        return ctx.slots.register({ name: 'shell.overlay', id: 'running-panel-echo-feedback', order: 41 }, function () {
          return h(EchoFeedback, { t: t })
        })
      })

      // 每条 finalized assistant 消息上的收藏按钮。
      ctx.slots.inject('conversation.chat.assistant-actions', function () {
        return ctx.slots.register(
          {
            name: 'conversation.chat.assistant-actions',
            id: 'dsh-running-panel-echo',
            order: 1000,
            label: function () {
              return t('echoFavorite')
            },
          },
          EchoActionButton,
        )
      })

      // 右侧栏：一种页签类型 + 正文 + 标题，内容只看当前会话。
      ctx.inject(['sidebarRightTabs', 'sidebarRight'], function (panelCtx) {
        rightDock = panelCtx.sidebarRight || null
        panelCtx.effect(function () {
          return panelCtx.sidebarRightTabs.register({
            id: RIGHT_TAB_ID,
            kind: RIGHT_KIND,
            priority: 'builtin',
            title: function () {
              return t('nav')
            },
          })
        }, 'dsh-running-panel: right sidebar tab type')

        panelCtx.slots.inject('sidebar.right.pane.tab', function () {
          return panelCtx.slots.register(
            { name: 'sidebar.right.pane.tab', key: RIGHT_TAB_ID, locale: NS },
            function (props) {
              return h(Panel, { t: t, mode: 'session', sessionId: props && props.sessionId })
            },
          )
        })

        panelCtx.slots.inject('sidebar.right.pane.tab.title', function () {
          return panelCtx.slots.register(
            { name: 'sidebar.right.pane.tab.title', key: RIGHT_TAB_ID },
            function () {
              return h('span', { className: '__rp_tabTitle' }, t('nav'))
            },
          )
        })
      })
    }

    return { inject: ['slots', 'locale'], apply: apply }
  },
})
