    /* ── 搜索核心（纯函数，tests/search.test.mjs 直接抽这段跑） ───────── */

    // #region search-core

    /**
     * v0 关键词别名：补中文意图与英文名之间的缝。
     * 例如「工作台」不在 whale_studio 的名字里，但用户就是这么叫它。
     * 以后扩成 catalog.js 的 produces 维，这里只留过渡用的别名。
     */
    var SEARCH_HINTS = {
      'skill:novel-script-writer': '小说 剧本 短剧 分镜 对白 故事 网文',
      'skill:dahuang-human-tone': '去AI味 文案 改写 自然 人味',
      'skill:teardown': '插图 图解 原理 剖面 结构 技术插图',
      'skill:build-design': '设计稿 还原 界面 前端',
      'skill:better-accessibility': '无障碍 键盘 焦点 读屏',
      'skill:better-colors': '配色 色板 对比度',
      'skill:better-interface': '界面 审查 总检',
      'skill:better-layout': '布局 响应式 排版 结构',
      'skill:better-typography': '字体 排版 字号 行高',
      'skill:better-ui': '界面 表面 图标 动效',
      'skill:better-writing': '文案 提示 错误 空状态',
      'skill:office': '文档 表格 幻灯片 PDF Office',
      'skill:office-docx': 'Word 文档 合同 报告',
      'skill:office-xlsx': 'Excel 表格 数据 公式',
      'skill:office-pptx': 'PPT 幻灯片 演示 汇报',
      'skill:office-export-pdf': 'PDF 导出 转换',
      'skill:office-render': '渲染 预览 截图 文档',
      'skill:office-recalculate': '重算 公式 Excel',
      'skill:documentation-and-adrs': '文档 决策记录 架构',
      'skill:api-and-interface-design': '接口 API 设计',
      'skill:source-driven-development': '官方文档 代码 实现',
      'skill:code-review-and-quality': '代码审查 质量',
      'skill:debugging-and-error-recovery': '排错 调试 报错',
      'skill:test-driven-development': '测试 TDD 红绿',
      'skill:context-engineering': '上下文 提示词 规则',
      'skill:agent-experience': '工具定义 技能 上下文',
      'skill:browser-testing-with-devtools': '浏览器 调试 截图 网络 性能',
      'skill:craft-anything': '拆解 原理 软件 调查',
      'skill:agent-skills': '技能 发现 索引',
      'tool:whale_studio': '工作台 节点 画布 分镜 视频 流水线 工坊',
      'tool:whale_comfyui_character': '角色 三视图 插图 设定图',
      'tool:whale_comfyui_workflow': '工作流 ComfyUI 节点',
      'tool:whale_generate_video': '视频 生成 短片 镜头',
      'tool:whale_story_presets': '剧本 故事 题材 分镜',
      'tool:whale_storyboard': '分镜 剧本 镜头 脚本',
      'tool:whale_optimize_prompt': '提示词 优化 画图',
      'tool:whale_quality_review': '视频 质检 审查',
      'tool:comfyui_character': '角色 三视图 插图',
      'tool:comfyui_workflow': '工作流 ComfyUI',
    }

    /** 空格、中英文逗号、顿号、分号都算分隔；大小写不敏感。 */
    function splitSearchTerms(query) {
      return String(query || '')
        .toLowerCase()
        .split(/[\s,，、;；]+/)
        .filter(Boolean)
    }

    function searchHaystack(entry) {
      return [entry.label, entry.alt, entry.name, entry.desc, entry.tag, entry.lib, entry.hints]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
    }

    function scoreSearchEntry(entry, terms) {
      var label = String(entry.label || '').toLowerCase()
      var name = String(entry.name || '').toLowerCase()
      var haystack = searchHaystack(entry)
      var hits = 0
      var score = 0
      terms.forEach(function (term) {
        if (label === term || name === term) {
          score += 100
        } else if (label.indexOf(term) === 0) {
          score += 60
        } else if (name.indexOf(term) === 0) {
          // mcp__chrome-devtools__* 这类前缀是工具命名空间，不是用户输入的意图，权重低于显示名。
          score += 40
        } else if (label.indexOf(term) >= 0) {
          score += 30
        } else if (name.indexOf(term) >= 0) {
          score += 20
        } else if (haystack.indexOf(term) >= 0) {
          score += 10
        } else {
          return
        }
        hits += 1
      })
      return { score: score + hits * 10, hits: hits }
    }

    var AVAILABILITY_RANK = { session: 0, cold: 1, installed: 2, catalog: 3 }

    /**
     * 多关键词是并集：任一词命中就出现，命中越多排越前。
     * 同分时按「本会话 → 冷层 → 已装未挂载」，再按显示名。
     */
    function searchEntries(entries, query) {
      var terms = splitSearchTerms(query)
      if (!terms.length) return []
      var rows = []
      ;(entries || []).forEach(function (entry) {
        if (!entry) return
        var scored = scoreSearchEntry(entry, terms)
        if (!scored.hits) return
        rows.push({ entry: entry, score: scored.score, hits: scored.hits })
      })
      rows.sort(function (a, b) {
        var byScore = b.score - a.score
        if (byScore) return byScore
        var byAvailability =
          (AVAILABILITY_RANK[a.entry.availability] || 0) - (AVAILABILITY_RANK[b.entry.availability] || 0)
        if (byAvailability) return byAvailability
        return String(a.entry.label || a.entry.name).localeCompare(String(b.entry.label || b.entry.name), 'zh')
      })
      return rows
    }

    /**
     * 插入/拖拽到对话框的文本。
     * 技能走 DSH 的 `/` 引用：只认英文本名（kebab-case），中文名只是显示名。
     * 工具没有 `/` 引用，退化为反引号包住的工具 id，给模型和人都能认。
     */
    function composerToken(entry) {
      if (!entry) return ''
      if (entry.kind === 'skill') return '/' + String(entry.name || '').trim() + ' '
      return '`' + String(entry.name || '').trim() + '` '
    }

    function dragPayload(entry) {
      return { 'text/plain': composerToken(entry) }
    }

    /** 悬停 0.5 秒才出现的短说明：优先用中文一行；没有就取英文第一句，最多 72 字。 */
    var SHORT_DESCS = {
      'agent-experience': '写技能、写工具、写工作流',
      'api-and-interface-design': '定接口：边界、契约、错误',
      archify: '画架构图',
      'better-accessibility': '无障碍排查：焦点、键盘、对比度',
      'better-colors': '定配色：语义色、深浅阶、对比校验',
      'better-interface': '界面总检：结构、层级、一致性',
      'better-layout': '布局：网格、间距、对齐、断点',
      'better-typography': '字体：字号阶梯、行高、字重',
      'better-ui': '表面打磨：圆角、阴影、细节统一',
      'better-writing': '界面文案：按钮、空态、报错措辞',
      'browser-testing-with-devtools': '真浏览器里测：DOM、网络、截图',
      'build-design': '照设计稿还原成页面',
      break: '场景压测：极端输入、边界状态',
      'ci-cd-and-automation': '流水线：构建、测试、发布',
      'code-review-and-quality': '代码审查：正确性、可维护性',
      'code-simplification': '化简代码，不改行为',
      'constraint-driven-development': '先定质量约束再动手',
      'context-engineering': '调上下文：规则、记忆、技能装载',
      'cordis-composition-reference': '查 Cordis 组合与包清单',
      'cordis-plugin-development': '开发与调试本机插件',
      'craft-anything': '逆向摸清一个软件怎么跑',
      'dahuang-human-tone': '中文去 AI 味',
      'debugging-and-error-recovery': '先复现、找根因、再修',
      'deprecation-and-migration': '废弃旧接口、平滑迁移',
      'diagnose-windows-sandbox-acl': '查 Windows 沙箱权限拒绝',
      'documentation-and-adrs': '写文档与决策记录',
      'doubt-driven-development': '对抗式复核：找反例',
      'editing-cordis-compositions': '改与校验 Cordis 组合',
      'explain-interface': '讲清一个界面怎么实现',
      'frontend-ui-engineering': '生产级前端界面实现',
      'git-workflow-and-versioning': 'Git 分支、提交、版本',
      'idea-refine': '把模糊想法打磨成方案',
      impeccable: '界面打磨与评审总入口',
      'incremental-implementation': '切成小步，逐步验证',
      'interface-review': '界面评审：逐屏挑问题',
      'interview-me': '一次一问，问清真实需求',
      'observability-and-instrumentation': '日志、指标、告警',
      office: 'Office 文档总入口',
      'office-docx': 'Word 文档：读、写、改、校验',
      'office-export-pdf': '转 PDF 并校验',
      'office-pptx': 'PowerPoint：读、写、改、校验',
      'office-recalculate': '重算表格公式并核对',
      'office-render': '渲染文档检查版式',
      'office-xlsx': 'Excel 表格：读、写、改、校验',
      'performance-optimization': '找瓶颈、量指标、再优化',
      'planning-and-task-breakdown': '拆任务、排顺序',
      'shipping-and-launch': '发布前检查与回滚',
      'source-driven-development': '按官方文档实现',
      'spec-driven-development': '先写规格再实现',
      'startup-pressure-test': '创业点子压力测试',
      'state-machine': '穷举状态：加载、空、错、满',
      teardown: '画原理插图，拆解结构',
      'test-driven-development': '先写测试，再写实现',
      'using-agent-skills': '判断该用哪个技能',
      variant: '出多个方案再对比取舍',
    }

    /**
     * 工具的中文一句话说明。键与 catalog.js 的 TOOL 表一致；没登记的工具
     * 用宿主给的 description 兜底（英文界面下直接显示它）。
     */
    var TOOL_TIPS = {
      'edit': '按旧文本替换文件片段（需先读）',
      'load_workspace_dependencies': '取工作区 Python / Node 依赖的绝对路径',
      'present': '把已完成的文件作为交付物展示',
      'read': '读取文本文件，可分段续读',
      'read_image': '直接查看图片内容',
      'write': '整体写入或新建文本文件',
      'job_kill': '终止后台任务',
      'job_list': '列出后台任务及其状态',
      'job_output': '读取后台任务的输出',
      'pwsh': '执行 PowerShell 命令',
      'glob': '按路径通配符找文件',
      'grep': '用正则搜索文件内容',
      'web_search': '搜索网页并返回来源链接',
      'web_fetch': '抓取单个网页并转成文本',
      'whale_comfyui_character': '生成角色三视图的 ComfyUI 工作流',
      'whale_comfyui_workflow': '把提示词拼成 ComfyUI workflow',
      'whale_generate_video': '把视频任务提交到账号池',
      'whale_optimize_prompt': '把草稿提示词扩成专业模板',
      'whale_quality_review': '检查成片是否存在、时长够不够',
      'whale_self_audit': '扫描鲸影插件源码做差距审计',
      'whale_story_presets': '列出或展开题材故事卡',
      'whale_storyboard': '把大纲拆成分镜与逐镜提示词',
      'whale_studio': '在聊天里打开节点式工坊画布',
      'interrupt_agent': '让运行中的子代理停下来',
      'list_agents': '列出已派出的子代理',
      'send_message': '给子代理追加消息或继续对话',
      'subagent': '派出一个独立子代理去做任务',
      'subagent_fork': '派一个继承当前上下文的子代理',
      'workflow': '用脚本批量编排多个子代理',
      'memory_append': '往长期记忆追加一条',
      'memory_read': '读回当前作用域的长期记忆',
      'memory_rewrite': '整份替换一份记忆文件',
      'memory_search': '按关键词搜索记忆条目',
      'soul_read': '读取当前生效的人格卡',
      'soul_update': '替换当前人格卡内容',
      'ask_user_question': '暂停并向你提问或确认',
      'cordis_inspect_list': '列出可查询的运行时能力',
      'cordis_inspect_query': '查运行时状态与依赖',
      'create_goal': '建立一个跨轮次的目标',
      'exit_plan_mode': '退出计划模式',
      'get_goal': '读取当前目标与进度',
      'list_mcp_resource_templates': '列出 MCP 资源模板',
      'list_mcp_resources': '列出 MCP 服务器的资源',
      'plugin_manager': '列插件、启停、安装与卸载',
      'read_mcp_resource': '读取一个 MCP 资源',
      'schedule_create': '按规则创建定时任务',
      'schedule_delete': '删除一个定时任务',
      'schedule_list': '列出定时任务与下次触发',
      'schedule_update': '改提醒内容或频率',
      'skill': '按名字加载技能说明',
      'todo_write': '更新本轮任务清单',
      'update_goal': '暂停 / 恢复 / 完成目标',
      'working_directory': '查看或切换工作目录',
      'mcp__chrome-devtools__click': '在页面上点击元素',
      'mcp__chrome-devtools__close_page': '关闭一个标签页',
      'mcp__chrome-devtools__drag': '把一个元素拖到另一个元素上',
      'mcp__chrome-devtools__emulate': '模拟设备、网络与配色',
      'mcp__chrome-devtools__evaluate_script': '在页面里执行一段 JS',
      'mcp__chrome-devtools__fill': '往输入框里填文本',
      'mcp__chrome-devtools__fill_form': '一次填多个表单控件',
      'mcp__chrome-devtools__get_console_message': '按 id 读一条控制台消息',
      'mcp__chrome-devtools__get_css_styles': '读元素命中的 CSS 规则',
      'mcp__chrome-devtools__get_network_request': '读一条网络请求的详情',
      'mcp__chrome-devtools__handle_dialog': '接受或关闭浏览器弹窗',
      'mcp__chrome-devtools__hover': '把鼠标悬停在元素上',
      'mcp__chrome-devtools__lighthouse_audit': '跑 Lighthouse 可访问性等审计',
      'mcp__chrome-devtools__list_console_messages': '列出控制台消息',
      'mcp__chrome-devtools__list_network_requests': '列出网络请求',
      'mcp__chrome-devtools__list_pages': '列出打开的页面',
      'mcp__chrome-devtools__navigate_page': '打开、后退或刷新页面',
      'mcp__chrome-devtools__new_page': '新开一个标签页',
      'mcp__chrome-devtools__performance_analyze_insight': '展开某条性能洞察',
      'mcp__chrome-devtools__performance_start_trace': '开始录制性能轨迹',
      'mcp__chrome-devtools__performance_stop_trace': '停止录制并保存轨迹',
      'mcp__chrome-devtools__press_key': '模拟按键或组合键',
      'mcp__chrome-devtools__resize_page': '调整页面视口尺寸',
      'mcp__chrome-devtools__screencast_start': '开始录屏',
      'mcp__chrome-devtools__screencast_stop': '停止录屏',
      'mcp__chrome-devtools__select_page': '切换当前操作的页面',
      'mcp__chrome-devtools__take_heapsnapshot': '抓堆快照查内存',
      'mcp__chrome-devtools__take_screenshot': '截取页面或元素',
      'mcp__chrome-devtools__take_snapshot': '读取页面可访问性结构',
      'mcp__chrome-devtools__type_text': '往焦点处输入文本',
      'mcp__chrome-devtools__upload_file': '通过文件输入框上传文件',
      'mcp__chrome-devtools__wait_for': '等页面出现指定文字',
    }

    /** 当前界面语言是不是中文（拿不到 locale 服务时按中文处理）。 */
    function isChineseLocale() {
      var locale = String(currentLocale() || '').toLowerCase()
      return !locale || locale.indexOf('zh') === 0
    }

    /** 取第一句；超长截断，避免说明占满整行。 */
    function firstSentence(text, limit) {
      var value = String(text || '')
        .replace(/\s+/g, ' ')
        .trim()
      if (!value) return ''
      var first = value.split(/[。.!?；;]/)[0] || value
      if (first.length > limit) first = first.slice(0, limit - 1) + '…'
      return first
    }

    /** 覆盖层里的说明（Host 把 catalog-overlay.json 合并进 /catalog 的 descs）。 */
    function pickLocalized(entry) {
      if (!entry) return ''
      var locale = String(currentLocale() || '').toLowerCase()
      if (locale && entry[locale]) return entry[locale]
      if (locale.indexOf('zh') === 0) return entry.zh || entry.en || ''
      return entry.en || entry.zh || ''
    }

    /**
     * 能力行的悬停说明：覆盖层 > 本地词典（技能 / 工具各一份）> 宿主给的描述。
     * 覆盖层让新装的技能不改代码就能有中文名和一句话说明。
     */
    function tipOf(kind, name, text) {
      var id = String(name || '')
      var key = kind + ':' + id
      if (typeof entryOverrides !== 'undefined' && entryOverrides.descs[key]) return entryOverrides.descs[key]
      var overlay = pickLocalized(lookup('descs', key))
      if (overlay) return overlay
      if (isChineseLocale()) {
        var known = kind === 'skill' ? SHORT_DESCS[id] : TOOL_TIPS[id]
        if (known) return known
      }
      return firstSentence(text, 72)
    }

    /** 旧名字保留：外部若还按技能取短说明，走同一套规则。 */
    function shortDescription(name, text) {
      return tipOf('skill', name, text)
    }

    // #endregion search-core


