    /* ── 显示名 / tag 词典（Host 的 /catalog 路由） ───────────────────── */
    var NAME_NS = 'runningPanelNames'
    /** 与服务端 PIN_LIMIT 保持一致：连续 4 轮没调用就回落。 */
    var PIN_LIMIT = 4
    var catalogStore = { data: null, version: 0, listeners: new Set() }
    var nameT = null
    var ctxLocale = null
    var catalogCtx = null
    /** 改完名字/描述先本地生效，再和 Host 对齐；否则要等下一次整页加载才看得到。 */
    var entryOverrides = { names: {}, descs: {} }

    function useCatalogVersion() {
      var pair = React.useState(catalogStore.version)
      var version = pair[0]
      var setVersion = pair[1]
      React.useEffect(function () {
        var sync = function () {
          setVersion(catalogStore.version)
        }
        catalogStore.listeners.add(sync)
        sync()
        return function () {
          catalogStore.listeners.delete(sync)
        }
      }, [])
      return version
    }

    function bumpCatalog() {
      catalogStore.version += 1
      catalogStore.listeners.forEach(function (listener) {
        try {
          listener()
        } catch (error) {
          /* 单个订阅者失败不影响其他 */
        }
      })
    }

    /** 重命名后重新拉词典，让面板上的名字立刻换成新的。 */
    function refreshCatalog() {
      if (!catalogCtx) return Promise.resolve(false)
      return fetch('/dsh-running-panel/catalog', { cache: 'no-store' })
        .then(function (response) {
          return response && response.ok ? response.json() : null
        })
        .then(function (data) {
          if (!data) return false
          applyCatalog(catalogCtx, data)
          bumpCatalog()
          return true
        })
        .catch(function () {
          return false
        })
    }

    function currentLocale() {
      try {
        var snapshot = ctxLocale && typeof ctxLocale.getLocale === 'function' ? ctxLocale.getLocale() : null
        return (snapshot && (snapshot.id || snapshot.locale)) || ''
      } catch (error) {
        return ''
      }
    }

    /** 没登记过的 id 的兜底：去掉 mcp 前缀、下划线转空格、首字母大写。 */
    function humanize(id) {
      var raw = String(id || '')
      if (raw.indexOf('mcp__') === 0) {
        var parts = raw.split('__')
        if (parts.length >= 3) raw = parts.slice(2).join('__')
      }
      var text = raw.replace(/[_.]+/g, ' ').trim()
      return text ? text.charAt(0).toUpperCase() + text.slice(1) : ''
    }

    function lookup(map, key) {
      var data = catalogStore.data
      if (!data || !data[map]) return null
      return data[map][key] || null
    }

    /** 先问 locale 服务（跟随语言切换），再退回词典里的当前语言 / 英文 / 中文。 */
    function localized(key, entry) {
      if (typeof entryOverrides !== 'undefined' && entryOverrides.names[key]) return entryOverrides.names[key]
      if (nameT) {
        try {
          var translated = nameT(key)
          if (translated && translated !== key) return translated
        } catch (error) {
          /* locale 服务还没就绪 */
        }
      }
      if (!entry) return ''
      var locale = String(currentLocale() || '')
      if (locale && entry[locale]) return entry[locale]
      // zh-CN / zh-Hans 这类带地区的 id 先回落到 zh，和 pickLocalized 一致；否则中文界面会显示英文名。
      if (locale.toLowerCase().indexOf('zh') === 0 && entry.zh) return entry.zh
      if (entry.en) return entry.en
      if (entry.zh) return entry.zh
      return ''
    }

    /** 覆盖层只存 zh / en 两列：改名写进当前界面语言那一列。 */
    function overlayLocale() {
      return String(currentLocale() || '').toLowerCase().indexOf('en') === 0 ? 'en' : 'zh'
    }

    /** 库对应的仓库地址；没登记就返回空串，界面上不显示链接。 */
    function sourceOf(lib) {
      var url = lookup('sources', lib)
      return typeof url === 'string' ? url : ''
    }

    function nameOf(kind, id) {
      var key = kind + ':' + id
      return localized(key, lookup('names', key)) || humanize(id)
    }

    /** 名字后面跟的英文名：当前语言已经是英文、或没有登记英文名时不重复显示。 */
    function altNameOf(kind, id) {
      var entry = lookup('names', kind + ':' + id)
      if (!entry || !entry.en) return ''
      if (currentLocale().indexOf('en') === 0) return ''
      var primary = nameOf(kind, id)
      return primary && primary !== entry.en ? entry.en : ''
    }

    function tagOfItem(kind, id) {
      var tag = lookup('tagOf', kind + ':' + id)
      return typeof tag === 'string' ? tag : 'other'
    }

    function tagLabel(tag) {
      return localized('tag:' + tag, lookup('tags', tag)) || tag
    }

    /** 一个能力属于哪个来源库；没登记就按种类兜底（技能 → 自装，工具 → 核心）。 */
    function libOfItem(kind, id) {
      var lib = lookup('libOf', kind + ':' + id)
      return typeof lib === 'string' ? lib : kind === 'skill' ? 'user' : 'core'
    }

    function libLabel(lib) {
      return localized('lib:' + lib, lookup('libs', lib)) || lib
    }

    function libMetaOf(lib) {
      var meta = lookup('libMeta', lib)
      return meta && typeof meta === 'object' ? meta : null
    }

    /** 组标题的悬停说明：安装日期、这一批的说明、仓库地址。 */
    function libTip(t, lib, count) {
      var meta = libMetaOf(lib)
      var lines = []
      if (meta && meta.installedAt) lines.push(fill(t('libInstalledAt'), 'd', dateOnly(meta.installedAt)))
      var desc = meta ? (isChineseLocale() ? meta.description : meta.descriptionEn || meta.description) : ''
      if (desc) lines.push(desc)
      if (meta && meta.topic) lines.push('# ' + meta.topic)
      if (count) lines.push(fill(t('libSkillsFrom'), 'n', count))
      var url = sourceOf(lib)
      if (url) lines.push(url)
      return lines.join('\n')
    }

    /** 把一组条目按来源库分桶，桶大的排前面：32 个 MCP 工具折成一行就是靠它。 */
    function bucketByLib(kind, items) {
      var map = {}
      items.forEach(function (item) {
        var lib = libOfItem(kind, item.name)
        if (!map[lib]) map[lib] = []
        map[lib].push(item)
      })
      return Object.keys(map)
        .map(function (lib) {
          return { lib: lib, items: map[lib] }
        })
        .sort(function (a, b) {
          return b.items.length - a.items.length || a.lib.localeCompare(b.lib)
        })
    }

    /**
     * 搜索索引：本会话技能 / 本会话工具 / 冷层 / 名称目录。
     * 同一个 key 只出现一次；名称词典本身不能证明安装状态。
     */
    function buildSearchEntries(snapshot) {
      var out = []
      var seen = {}

      function push(entry) {
        if (!entry || !entry.key || seen[entry.key]) return
        seen[entry.key] = true
        out.push(entry)
      }

      function skillEntry(kind, name, availability, description) {
        var key = kind + ':' + name
        var availabilityHints =
          availability === 'cold'
            ? ' 冷层 已停用 parked cold'
            : availability === 'catalog'
              ? ' 名称目录 未确认 catalog unverified'
              : availability === 'installed'
              ? ' 已装 未挂载 installed unmounted'
              : ' 本会话 session'
        return {
          key: key,
          kind: kind,
          name: name,
          label: nameOf(kind, name),
          alt: altNameOf(kind, name),
          desc: description || '',
          tag: tagLabel(tagOfItem(kind, name)),
          lib: libLabel(libOfItem(kind, name)),
          libId: libOfItem(kind, name),
          hints: (SEARCH_HINTS[key] || '') + availabilityHints,
          availability: availability,
        }
      }

      ;((snapshot && snapshot.skills && snapshot.skills.items) || []).forEach(function (item) {
        push(skillEntry('skill', item.name, 'session', item.description))
      })

      ;((snapshot && snapshot.tools && snapshot.tools.groups) || []).forEach(function (group) {
        ;(group.items || []).forEach(function (item) {
          push(skillEntry('tool', item.name, 'session', item.description))
        })
      })

      ;((snapshot && snapshot.cold && snapshot.cold.items) || []).forEach(function (item) {
        var cue = item.cue && item.cue !== nameOf('skill', item.name) ? item.cue : ''
        var entry = skillEntry('skill', item.name, 'cold', cue)
        if (item.directoryName) {
          entry.directoryName = item.directoryName
          entry.key += ':cold:' + item.directoryName
        }
        push(entry)
        seen['skill:' + item.name] = true
      })

      var names = catalogStore.data && catalogStore.data.names
      if (names) {
        Object.keys(names).forEach(function (key) {
          if (seen[key]) return
          var split = key.indexOf(':')
          if (split < 0) return
          var kind = key.slice(0, split)
          if (kind !== 'skill' && kind !== 'tool') return
          push(skillEntry(kind, key.slice(split + 1), 'catalog', ''))
        })
      }

      return out
    }

    /**
     * 把 @名称 插进当前对话输入框。
     * 输入框是 Lexical 的 contenteditable；execCommand 会触发它的 beforeinput/input 链路。
     * 找不到输入框就返回 false，由调用方提示「拖进去」。
     */
    function insertIntoComposer(text) {
      if (typeof document === 'undefined') return false
      var el = document.querySelector('[data-composer-input]')
      if (!el) return false
      try {
        el.focus({ preventScroll: true })
      } catch (error) {
        try {
          el.focus()
        } catch (ignored) {
          /* 聚焦失败也不影响后面的尝试 */
        }
      }
      try {
        return document.execCommand('insertText', false, text)
      } catch (error) {
        return false
      }
    }

    /**
     * 插入技能引用，走应用自己的斜杠菜单：
     * 先写 `/名字`，等菜单筛出这一项后补一个 Enter —— 这样拿到的是真正的 reference 节点，
     * 不是白色纯文本。菜单里没有这个技能（本会话未挂载）就退回纯文本插入。
     */
    function insertSkillReference(name) {
      if (typeof document === 'undefined') return false
      var el = document.querySelector('[data-composer-input]')
      if (!el || !name) return false
      try {
        el.focus({ preventScroll: true })
      } catch (error) {
        /* 聚焦失败也继续 */
      }
      var typed = false
      try {
        typed = document.execCommand('insertText', false, '/' + name)
      } catch (error) {
        typed = false
      }
      if (!typed) return false
      return new Promise(function (resolve) {
        window.setTimeout(function () {
          var options = Array.prototype.slice.call(document.querySelectorAll('[role="listbox"] [role="option"]'))
          var hit = null
          for (var i = 0; i < options.length; i += 1) {
            var text = (options[i].textContent || '').trim()
            if (text.indexOf(name) === 0) {
              hit = options[i]
              break
            }
          }
          if (!hit) {
            try {
              document.execCommand('insertText', false, ' ')
            } catch (error) {
              /* 保持原样 */
            }
            resolve(false)
            return
          }
          el.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }),
          )
          window.setTimeout(function () {
            resolve(true)
          }, 140)
        }, 220)
      })
    }

    /** 把词典按语言注册进 locale 服务：以后加一门语言只是词典里多一列。 */
    function applyCatalog(ctx, data) {
      catalogStore.data = data
      var byLocale = {}
      var put = function (locale, key, value) {
        if (!locale || typeof value !== 'string') return
        if (!byLocale[locale]) byLocale[locale] = {}
        byLocale[locale][key] = value
      }
      Object.keys(data.names || {}).forEach(function (key) {
        var entry = data.names[key] || {}
        Object.keys(entry).forEach(function (locale) {
          put(locale, key, entry[locale])
        })
      })
      Object.keys(data.tags || {}).forEach(function (tag) {
        var entry = data.tags[tag] || {}
        Object.keys(entry).forEach(function (locale) {
          put(locale, 'tag:' + tag, entry[locale])
        })
      })
      Object.keys(data.libs || {}).forEach(function (lib) {
        var entry = data.libs[lib] || {}
        Object.keys(entry).forEach(function (locale) {
          put(locale, 'lib:' + lib, entry[locale])
        })
      })
      Object.keys(byLocale).forEach(function (locale) {
        try {
          ctx.locale.register(NAME_NS, locale, byLocale[locale])
        } catch (error) {
          /* 注册失败就退回直接查表 */
        }
      })
      try {
        nameT = ctx.locale.bind(NAME_NS)
      } catch (error) {
        nameT = null
      }
      bumpCatalog()
    }

