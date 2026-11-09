/**
 * 「运行中」面板的显示名词典。
 *
 * 为什么需要它：DSH 的技能只有 `name` / `description`，工具只有 `name`，
 * 都没有 display-name 字段，而且技能名是 `skill` 工具的调用键、不能改。
 * 所以本地化只能做在插件这一层：把稳定 id 映射成各语言的显示名。
 *
 * 数据形状刻意做成“一行一个 id + 每语言一列”，因此：
 *   - 新增一种语言 = 每个数组里加一列（外加 TAG_LABELS 加一列），代码不用动；
 *   - 新增一个技能/工具 = 加一行；没登记的 id 由客户端 humanize 兜底，不会显示成空白。
 *
 * 数组顺序：[id, 中文, English, tag]
 */

/** tag 是内部归类键，界面上以本地化标签显示；没有它就用 other。 */
export const TAG_LABELS = [
  ['code', '代码', 'Code'],
  ['design', '设计', 'Design'],
  ['image', '作图', 'Image'],
  ['vision', '识图', 'Vision'],
  ['video', '视频', 'Video'],
  ['docs', '文档', 'Documents'],
  ['text', '文字', 'Writing'],
  ['research', '检索', 'Research'],
  ['web', '网络', 'Web'],
  ['ops', '命令', 'Ops'],
  ['memory', '记忆', 'Memory'],
  ['agent', '代理', 'Agents'],
  ['meta', '工具链', 'Tooling'],
  ['files', '文件', 'Files'],
  ['other', '其他', 'Other'],
]

export const SKILLS = [
  ['better-accessibility', '无障碍检查', 'Accessibility review', 'design'],
  ['better-colors', '配色系统', 'Color system', 'design'],
  ['better-interface', '界面总检', 'Interface review', 'design'],
  ['better-layout', '布局结构', 'Layout structure', 'design'],
  ['better-typography', '字体排版', 'Typography', 'design'],
  ['better-ui', '表面打磨', 'Surface polish', 'design'],
  ['better-writing', '界面文案', 'Interface copy', 'text'],
  ['build-design', '照稿还原', 'Build from design', 'design'],
  ['break', '场景压测', 'Scenario stress test', 'design'],
  ['variant', '多方案对比', 'Variants', 'design'],
  ['state-machine', '状态穷举', 'State coverage', 'design'],
  ['interface-review', '界面评审', 'Interface review', 'design'],
  ['explain-interface', '效果溯源', 'Explains how it is built', 'design'],
  ['teardown', '原理插图', 'Technical illustration', 'design'],
  ['agent-experience', '技能与工具编写', 'Skill & tool authoring', 'meta'],
  ['api-and-interface-design', '接口设计', 'API & interface design', 'code'],
  ['archify', '架构图绘制', 'Architecture diagrams', 'design'],
  ['browser-testing-with-devtools', '浏览器实测', 'Browser testing', 'web'],
  ['ci-cd-and-automation', '流水线自动化', 'CI/CD automation', 'ops'],
  ['code-review-and-quality', '代码审查', 'Code review', 'code'],
  ['code-simplification', '代码简化', 'Code simplification', 'code'],
  ['constraint-driven-development', '质量约束', 'Constraint-driven dev', 'code'],
  ['context-engineering', '上下文工程', 'Context engineering', 'meta'],
  ['cordis-composition-reference', 'Cordis 组合参考', 'Cordis composition reference', 'meta'],
  ['cordis-plugin-development', '插件开发', 'Plugin development', 'meta'],
  ['craft-anything', '逆向调研', 'Reverse engineering', 'research'],
  ['dahuang-human-tone', '中文去 AI 味', 'Chinese de-AI tone', 'text'],
  ['debugging-and-error-recovery', '排错恢复', 'Debugging & recovery', 'code'],
  ['deprecation-and-migration', '废弃与迁移', 'Deprecation & migration', 'code'],
  ['diagnose-windows-sandbox-acl', '沙箱权限诊断', 'Sandbox ACL diagnosis', 'ops'],
  ['documentation-and-adrs', '文档与决策记录', 'Docs & ADRs', 'docs'],
  ['doubt-driven-development', '对抗式复核', 'Doubt-driven dev', 'code'],
  ['editing-cordis-compositions', '编辑组合', 'Edit compositions', 'meta'],
  ['frontend-ui-engineering', '前端界面工程', 'Frontend UI engineering', 'design'],
  ['git-workflow-and-versioning', 'Git 与版本', 'Git & versioning', 'ops'],
  ['idea-refine', '想法打磨', 'Idea refinement', 'research'],
  ['impeccable', '界面打磨', 'UI craftsmanship', 'design'],
  ['incremental-implementation', '增量交付', 'Incremental delivery', 'code'],
  ['interview-me', '需求访谈', 'Requirements interview', 'research'],
  ['novel-script-writer', '小说与剧本', 'Fiction & scripts', 'text'],
  ['observability-and-instrumentation', '可观测性', 'Observability', 'ops'],
  ['office', 'Office 路由', 'Office routing', 'docs'],
  ['office-docx', 'Word 文档', 'Word documents', 'docs'],
  ['office-export-pdf', '导出 PDF', 'Export PDF', 'docs'],
  ['office-pptx', 'PowerPoint', 'PowerPoint', 'docs'],
  ['office-recalculate', '重算表格', 'Recalculate sheets', 'docs'],
  ['office-render', '文档渲染', 'Render documents', 'docs'],
  ['office-xlsx', 'Excel 表格', 'Excel workbooks', 'docs'],
  ['performance-optimization', '性能优化', 'Performance tuning', 'code'],
  ['planning-and-task-breakdown', '任务拆解', 'Task breakdown', 'meta'],
  ['security-and-hardening', '安全加固', 'Security hardening', 'code'],
  ['shipping-and-launch', '发布上线', 'Shipping & launch', 'ops'],
  ['skyrim-mod-debug', '上古卷轴 Mod 排错', 'Skyrim mod debugging', 'ops'],
  ['source-driven-development', '按官方文档实现', 'Source-driven dev', 'research'],
  ['spec-driven-development', '规格先行', 'Spec-driven dev', 'docs'],
  ['startup-pressure-test', '创业压力测试', 'Startup pressure test', 'research'],
  ['test-driven-development', '测试驱动开发', 'Test-driven development', 'code'],
  ['using-agent-skills', '技能选用', 'Using agent skills', 'meta'],
]

export const TOOLS = [
  ['edit', '编辑文件', 'Edit file', 'files'],
  ['load_workspace_dependencies', '加载依赖路径', 'Load dependency paths', 'files'],
  ['present', '交付文件', 'Present file', 'files'],
  ['read', '读取文件', 'Read file', 'files'],
  ['read_image', '看图', 'View image', 'vision'],
  ['write', '写入文件', 'Write file', 'files'],

  ['job_kill', '终止后台任务', 'Kill job', 'ops'],
  ['job_list', '后台任务列表', 'List jobs', 'ops'],
  ['job_output', '后台任务输出', 'Read job output', 'ops'],
  ['pwsh', '执行 PowerShell', 'Run PowerShell', 'ops'],

  ['glob', '按路径找文件', 'Find files by path', 'research'],
  ['grep', '搜索文件内容', 'Search file contents', 'research'],

  ['web_search', '网页搜索', 'Web search', 'web'],
  ['web_fetch', '抓取网页', 'Fetch web page', 'web'],

  ['whale_comfyui_character', '角色三视图工作流', 'Character sheet workflow', 'image'],
  ['whale_comfyui_workflow', 'ComfyUI 工作流', 'ComfyUI workflow', 'image'],
  ['whale_generate_video', '生成视频', 'Generate video', 'video'],
  ['whale_optimize_prompt', '优化提示词', 'Optimize prompt', 'image'],
  ['whale_quality_review', '视频质检', 'Review video', 'video'],
  ['whale_self_audit', '插件自检', 'Plugin self-audit', 'meta'],
  ['whale_story_presets', '漫剧内容包', 'Story presets', 'text'],
  ['whale_storyboard', '拆分镜脚本', 'Storyboard', 'text'],
  ['whale_studio', '节点式工坊', 'Node studio', 'video'],

  ['interrupt_agent', '打断子代理', 'Interrupt subagent', 'agent'],
  ['list_agents', '列出子代理', 'List subagents', 'agent'],
  ['send_message', '给子代理发消息', 'Message subagent', 'agent'],
  ['subagent', '派出子代理', 'Spawn subagent', 'agent'],
  ['subagent_fork', '派生分支子代理', 'Fork subagent', 'agent'],
  ['workflow', '多代理工作流', 'Multi-agent workflow', 'agent'],

  ['memory_append', '追加记忆', 'Append memory', 'memory'],
  ['memory_read', '读取记忆', 'Read memory', 'memory'],
  ['memory_rewrite', '重写记忆', 'Rewrite memory', 'memory'],
  ['memory_search', '搜索记忆', 'Search memory', 'memory'],
  ['soul_read', '读取人格卡', 'Read persona card', 'memory'],
  ['soul_update', '更新人格卡', 'Update persona card', 'memory'],

  ['ask_user_question', '向你提问', 'Ask the user', 'meta'],
  ['cordis_inspect_list', '列出可查能力', 'List inspect providers', 'meta'],
  ['cordis_inspect_query', '查询运行时', 'Query runtime', 'meta'],
  ['create_goal', '建立目标', 'Create goal', 'meta'],
  ['exit_plan_mode', '退出计划模式', 'Exit plan mode', 'meta'],
  ['get_goal', '读取目标', 'Read goal', 'meta'],
  ['list_mcp_resource_templates', '列出 MCP 资源模板', 'List MCP resource templates', 'meta'],
  ['list_mcp_resources', '列出 MCP 资源', 'List MCP resources', 'meta'],
  ['plugin_manager', '插件管理', 'Plugin manager', 'meta'],
  ['read_mcp_resource', '读取 MCP 资源', 'Read MCP resource', 'meta'],
  ['schedule_create', '新建提醒', 'Create reminder', 'meta'],
  ['schedule_delete', '删除提醒', 'Delete reminder', 'meta'],
  ['schedule_list', '列出提醒', 'List reminders', 'meta'],
  ['schedule_update', '修改提醒', 'Update reminder', 'meta'],
  ['skill', '加载技能', 'Load skill', 'meta'],
  ['todo_write', '更新待办', 'Update todos', 'meta'],
  ['update_goal', '更新目标', 'Update goal', 'meta'],
  ['working_directory', '切换工作目录', 'Change directory', 'files'],

  ['mcp__chrome-devtools__click', '点击元素', 'Click element', 'web'],
  ['mcp__chrome-devtools__close_page', '关闭页面', 'Close page', 'web'],
  ['mcp__chrome-devtools__drag', '拖拽元素', 'Drag element', 'web'],
  ['mcp__chrome-devtools__emulate', '模拟设备与网络', 'Emulate device', 'web'],
  ['mcp__chrome-devtools__evaluate_script', '执行页面脚本', 'Evaluate script', 'web'],
  ['mcp__chrome-devtools__fill', '填写输入框', 'Fill input', 'web'],
  ['mcp__chrome-devtools__fill_form', '批量填表', 'Fill form', 'web'],
  ['mcp__chrome-devtools__get_console_message', '读取控制台消息', 'Get console message', 'web'],
  ['mcp__chrome-devtools__get_css_styles', '读取元素样式', 'Get CSS styles', 'design'],
  ['mcp__chrome-devtools__get_network_request', '读取网络请求', 'Get network request', 'web'],
  ['mcp__chrome-devtools__handle_dialog', '处理页面弹窗', 'Handle dialog', 'web'],
  ['mcp__chrome-devtools__hover', '悬停元素', 'Hover element', 'web'],
  ['mcp__chrome-devtools__lighthouse_audit', 'Lighthouse 审计', 'Lighthouse audit', 'web'],
  ['mcp__chrome-devtools__list_console_messages', '列出控制台消息', 'List console messages', 'web'],
  ['mcp__chrome-devtools__list_network_requests', '列出网络请求', 'List network requests', 'web'],
  ['mcp__chrome-devtools__list_pages', '列出打开的页面', 'List pages', 'web'],
  ['mcp__chrome-devtools__navigate_page', '页面跳转', 'Navigate page', 'web'],
  ['mcp__chrome-devtools__new_page', '打开新页面', 'Open new page', 'web'],
  ['mcp__chrome-devtools__performance_analyze_insight', '性能洞察分析', 'Analyze perf insight', 'web'],
  ['mcp__chrome-devtools__performance_start_trace', '开始性能录制', 'Start perf trace', 'web'],
  ['mcp__chrome-devtools__performance_stop_trace', '停止性能录制', 'Stop perf trace', 'web'],
  ['mcp__chrome-devtools__press_key', '按键', 'Press key', 'web'],
  ['mcp__chrome-devtools__resize_page', '调整窗口尺寸', 'Resize page', 'web'],
  ['mcp__chrome-devtools__screencast_start', '开始录屏', 'Start screencast', 'video'],
  ['mcp__chrome-devtools__screencast_stop', '停止录屏', 'Stop screencast', 'video'],
  ['mcp__chrome-devtools__select_page', '切换页面', 'Select page', 'web'],
  ['mcp__chrome-devtools__take_heapsnapshot', '抓取堆快照', 'Take heap snapshot', 'web'],
  ['mcp__chrome-devtools__take_screenshot', '截图', 'Take screenshot', 'vision'],
  ['mcp__chrome-devtools__take_snapshot', '读取页面结构', 'Take page snapshot', 'web'],
  ['mcp__chrome-devtools__type_text', '输入文本', 'Type text', 'web'],
  ['mcp__chrome-devtools__upload_file', '上传文件', 'Upload file', 'web'],
  ['mcp__chrome-devtools__wait_for', '等待页面文本', 'Wait for text', 'web'],
]

/**
 * 最笼统的四个大类：战术风格的圆环统计按它分四段。
 * 每个 tag 恰好属于一个大类，所以全部已安装能力都能被覆盖。
 */
export const GROUPS = ['visual', 'code', 'thought', 'ops']

export const TAG_GROUP = {
  design: 'visual',
  image: 'visual',
  vision: 'visual',
  video: 'visual',

  code: 'code',
  files: 'code',

  research: 'thought',
  docs: 'thought',
  text: 'thought',
  memory: 'thought',

  web: 'ops',
  ops: 'ops',
  agent: 'ops',
  meta: 'ops',
}

/**
 * 来源库：面板里把同一个库的小功能折叠成一行，避免 32 个 MCP 工具占 32 行。
 *
 * 运行时没有 provenance 字段（ToolDefinition 只有 name/description/parameters），
 * 所以归属只有两条可靠来源：
 *   1. MCP 工具名 `mcp__<server>__<tool>` —— 名字里就编码了服务器；
 *   2. 下面这张手工登记表。
 * 没登记的 id 落到 defaultLib（工具 → core，技能 → user），不会显示成空白。
 */
/** 每个库的仓库地址：用于行内「↗」链接，点了在系统浏览器打开。没有就显示「本地」。 */
export const SOURCES = {
  better: 'https://github.com/jakubkrehel/skills',
  addyosmani: 'https://github.com/addyosmani/agent-skills',
  impeccable: 'https://github.com/impeccable-ui/impeccable',
  'chrome-devtools': 'https://github.com/ChromeDevTools/chrome-devtools-mcp',
  cordis: 'https://github.com/cordiverse/cordis',
  'plugin-manager': 'https://www.npmjs.com/package/@deepseek-ai/dsh-plugin-manager',
}

/**
 * 安装器标记文件（技能目录里的 `.<名字>`）→ 仓库地址。
 * 标记本身只说明「谁装的」，登记了地址才能显示成「作者/仓库」并给出仓库链接。
 */
export const MARKER_SOURCES = {
  mattpocock: 'https://github.com/mattpocock/skills',
}

export const LIBRARIES = [
  ['better', '界面自查合集', 'UI review kit'],
  ['core', 'DSH 核心', 'DSH core'],
  ['chrome-devtools', 'Chrome DevTools', 'Chrome DevTools'],
  ['whale', '鲸影', 'Whale studio'],
  ['soul-md', '记忆与人格库', 'Persona & memory'],
  ['subagent', '子代理工具', 'Subagent tools'],
  ['goal', '目标与待办', 'Goals & todos'],
  ['schedule', '日程提醒', 'Schedules'],
  ['cordis', 'Cordis 工具链', 'Cordis tooling'],
  ['mcp', 'MCP 资源', 'MCP resources'],
  ['plugin-manager', '插件管理', 'Plugin manager'],
  ['addyosmani', 'agent-skills 合集', 'agent-skills'],
  ['dsh-skills', 'DSH 内置技能', 'DSH built-in skills'],
  ['user', '自装技能', 'Installed skills'],
  ['impeccable', 'impeccable', 'impeccable'],
  ['startup-test', '创业压力测试', 'Startup pressure test'],
]

/** 按名字前缀判定的库（MCP 服务器名与插件前缀都在名字里）。 */
export const LIB_PREFIXES = [
  ['better-', 'better'],
  ['mcp__chrome-devtools__', 'chrome-devtools'],
  ['whale_', 'whale'],
  ['memory_', 'soul-md'],
  ['soul_', 'soul-md'],
  ['schedule_', 'schedule'],
  ['cordis_', 'cordis'],
  ['job_', 'core'],
]

/** 显式登记的归属。键形如 `tool:read` / `skill:archify`。 */
export const LIB_IDS = {
  core: [
    'tool:read',
    'tool:write',
    'tool:edit',
    'tool:read_image',
    'tool:present',
    'tool:glob',
    'tool:grep',
    'tool:pwsh',
    'tool:working_directory',
    'tool:load_workspace_dependencies',
    'tool:skill',
    'tool:web_search',
    'tool:web_fetch',
  ],
  subagent: [
    'tool:subagent',
    'tool:subagent_fork',
    'tool:send_message',
    'tool:list_agents',
    'tool:interrupt_agent',
    'tool:workflow',
  ],
  goal: [
    'tool:create_goal',
    'tool:get_goal',
    'tool:update_goal',
    'tool:todo_write',
    'tool:ask_user_question',
    'tool:exit_plan_mode',
  ],
  'plugin-manager': ['tool:plugin_manager'],
  mcp: ['tool:list_mcp_resources', 'tool:list_mcp_resource_templates', 'tool:read_mcp_resource'],
  impeccable: ['skill:impeccable'],
  'startup-test': ['skill:startup-pressure-test'],
  'dsh-skills': [
    'skill:agent-experience',
    'skill:cordis-composition-reference',
    'skill:cordis-plugin-development',
    'skill:diagnose-windows-sandbox-acl',
    'skill:editing-cordis-compositions',
    'skill:office',
    'skill:office-docx',
    'skill:office-export-pdf',
    'skill:office-pptx',
    'skill:office-recalculate',
    'skill:office-render',
    'skill:office-xlsx',
  ],
  user: [
    'skill:archify',
    'skill:craft-anything',
    'skill:dahuang-human-tone',
    'skill:novel-script-writer',
    'skill:skyrim-mod-debug',
  ],
  addyosmani: [
    'skill:api-and-interface-design',
    'skill:browser-testing-with-devtools',
    'skill:ci-cd-and-automation',
    'skill:code-review-and-quality',
    'skill:code-simplification',
    'skill:constraint-driven-development',
    'skill:context-engineering',
    'skill:debugging-and-error-recovery',
    'skill:deprecation-and-migration',
    'skill:documentation-and-adrs',
    'skill:doubt-driven-development',
    'skill:frontend-ui-engineering',
    'skill:git-workflow-and-versioning',
    'skill:idea-refine',
    'skill:incremental-implementation',
    'skill:interview-me',
    'skill:observability-and-instrumentation',
    'skill:performance-optimization',
    'skill:planning-and-task-breakdown',
    'skill:security-and-hardening',
    'skill:shipping-and-launch',
    'skill:source-driven-development',
    'skill:spec-driven-development',
    'skill:test-driven-development',
    'skill:using-agent-skills',
  ],
}
