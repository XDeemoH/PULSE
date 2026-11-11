/**
 * 「运行中」面板 · Client 半侧
 * ============================================================================
 * 两块视图，数据都来自 Host 的推送（EventSource，无轮询）：
 *   左侧主要栏位（`main` key `dsh-running-panel`）—— 全局：整个 DSH 里正在运行的任务
 *       GET /dsh-running-panel/stream?scope=global
 *   右侧边栏（页签 type `running-panel`）—— 当前会话：这个会话正在调用的能力
 *       GET /dsh-running-panel/stream?session=<SessionId>
 *
 * 右侧栏页签的契约（在 @deepseek-ai/dsh-client-ui-sidebar-files /
 * dsh-client-ui-subagent 里核对）：
 *   ctx.sidebarRightTabs.register({ id, kind, priority, title })   声明一种页签类型
 *   sidebar.right.pane.tab        keyed by <id>   页签正文
 *   sidebar.right.pane.tab.title  keyed by <id>   页签标题
 *   打开：ctx.sidebarRight.openTab(<kind>, { preferNewPane: true })
 *   注意：`openTabFromTarget` / `commandTarget(element)` 是给快捷键用的
 *        （靠 DOM 焦点定位面板），在插件自己的按钮里用它会拿不到目标，不要用。
 * ============================================================================
 */
window.__ModuleLoader__.load({
  id: '@xdeemoh/dsh-pulse',
  factory: (require) => {
    var React = require('react')
    var h = React.createElement
    var ReactDOM = null
    try {
      ReactDOM = require('react-dom')
    } catch (error) {
      ReactDOM = null
    }

    var NS = 'runningPanel'
    var RIGHT_KIND = 'running-panel'
    var RIGHT_TAB_ID = '@xdeemoh/dsh-pulse/panel'

    var zh = {
      nav: '脉冲',
      schemeLabel: '面板配色',
      schemeAuto: '跟随 DSH',
      studioNav: '工坊',
      title: '脉冲',
      subtitle: '正在运行的能力',
      globalTitle: '脉冲',
      globalSubtitle: '整个 Harness 里正在跑的任务，以及它们在调什么',
      runningLabel: '正在运行',
      recentLabel: '最近结束',
      observedLabel: '观测到的会话',
      noRunning: '现在没有正在运行的任务。',
      noRecent: '还没有结束过的任务。',
      noCalls: '本轮还没有工具调用',
      storageUsageError: '用量记录未能读取或保存，请检查存储后重试。',
      storageEchoError: '收藏未能读取或保存，请检查存储后重试。',
      storageCatalogError: '自定义名称目录读取失败，已保留上次有效名称。请检查文件后重试。',
      undoStoreError: '撤销记录或恢复操作遇到错误，请检查提示后重试。',
      round: '第 {n} 轮',
      phaseIdle: '未使用',
      phaseActive: '进行中',
      phaseSpent: '已结束',
      phaseRunning: '运行中',
      skills: '技能',
      tools: '工具',
      agents: '代理',
      persona: '当前人格卡',
      soulTitle: 'Soul 人格卡',
      soulAuto: '自动（工作区 / 默认）',
      soulNone: '关闭人设',
      soulHint: '直接写 Soul 的会话人设映射；切换后标题栏也会同步。',
      soulEmpty: 'Soul 已安装，但还没有人格卡。',
      soulError: '人设写入失败',
      noPersona: '（没有读到人格卡）',
      subagents: '子代理',
      noSubagents: '本轮没有子代理活动',
      noSession: '未选择会话：清单照常列出，状态全部为空闲。打开一个会话后会自动跟随它。',
      loading: '正在读取…',
      offline: '无法连接 Host 推送通道（/dsh-running-panel/stream）。',
      retry: '浏览器会自动重连；持续失败说明 Host 半侧没有加载。',
      emptyGroup: '本 profile 没有这一类工具',
      roundCount: '本轮 {n} 次',
      totalCount: '累计 {n} 次',
      lastAt: '最近 {t}',
      hasError: '有报错',
      unobservable: '不可观测',
      notes: '说明',
      expand: '展开',
      collapse: '收起',
      stopReason: '结束 {r}',
      startedAt: '开始 {t}',
      endedAt: '结束 {t}',
      session: '会话',
      cwd: '目录',
      childTools: '它调用的工具',
      childNoTools: '还没有工具调用',
      openRight: '停靠到右侧栏',
      openFailed: '打开右侧栏失败，请用右侧栏的「新标签页」入口。',
      runningSection: '正在运行',
      runningHint: '被调用过的能力会浮到这里，回合结束变淡，连续 4 轮不再调用就回落原分组。',
      agentPresetLine: 'Agent 预设 · {x}',
      subagentOf: '子代理 · {x}',
      fadingTip: '再 {n} 轮无调用就回落',
      'group.skill': '技能',
      'group.files': '文件读写',
      'group.exec': '命令执行',
      'group.search': '检索',
      'group.web': '网络',
      'group.media': '媒体生成',
      'group.office': 'Office',
      'group.agents': '代理协作',
      'group.memory': '记忆与人格',
      'group.other': '其他（未归类）',
      'cat.visual': '视效',
      'cat.code': '代码',
      'cat.thought': '思考',
      'cat.ops': '行动',
      ringCalls: '次调用',
      budgetPct: '预算',
      contextLabel: '上下文',
      contextTip: 'Host tokenMeter 的最新生效请求压力与窗口容量；没有记录时显示未测得，不做估算。',
      contextUnknown: '未测得',
      tokenRound: '本轮输入/输出',
      tokenTotal: '累计输入/输出',
      tokenTip: '供应商 usage 的实测 token；没有 usage 时不显示，不估算。',
      costTitle: '成本估算',
      costTotal: '预计 {n} tok',
      costHint: '按技能名/描述与工具 schema 估算的提示词成本；不是供应商账单。',
      costRowTip: '估算值：启用后每轮提示词的近似增量，不是精确账单。',
      costKindSkill: '技能',
      costKindTool: '工具',
      costRmbTip: '按输入单价',
      costRmbUnset: '填单价显示 ¥',
      ringTitle: '本轮构成',
      settingsTitle: '显示设置',
      contourLabel: '等高线背景',
      contourGl: 'WebGL（会动）',
      contourSvg: '等高线 · 流光',
      contourStudio: '工坊（连续）',
      studioSection: '等高线设置',
      studioMore: '完整版等高线工坊：照片转等高线、PNG / SVG 导出',
      studioMoreLink: '打开 ↗',
      frostSection: '毛玻璃',
      pricingSection: '成本单价',
      pricingHint: '本地估算用；单位：人民币元 / 百万 token。DSH 不提供统一价格，填你当前模型/渠道的单价。',
      pricingInput: '输入单价',
      pricingOutput: '输出单价',
      pricingUnit: '元 / 1M tokens',
      frostEnabled: '启用毛玻璃',
      frostBlur: '模糊半径',
      frostOpacity: '玻璃透明度',
      frostSaturation: '饱和度',
      frostHint: '默认接近无色，只保留模糊和卡片边缘；数值越大越像磨砂玻璃。',
      modeVisual: '视效模式',
      modePerformance: '性能模式',
      modeVisualHint: '完整动效；当前模式的设置会单独保存。',
      modePerformanceHint: '默认关闭等高线形变、3D 倾斜、扫描线、毛玻璃、入场/流光/窗口动画、状态脉冲；可逐项放开。',
      cornerToggle: '对话右上角圆盘',
      effectContour: '等高线形变',
      effectTilt: '3D 倾斜',
      effectScan: '扫描线',
      effectBlur: '毛玻璃模糊',
      effectReveal: '入场动画',
      effectFlow: '流光',
      effectWindow: '窗口动画',
      effectPulse: '状态脉冲',
      effectGrid: '战术网格',
      resetAll: '恢复默认设置',
      resetTitle: '恢复默认设置？',
      resetBody: '会重置视效/性能模式、等高线、毛玻璃、折叠状态和模式设置；不会删除 Echo、历史或会话。',
      resetCancel: '取消',
      resetConfirm: '确认重置',
      studioPalette: '底色',
      studioDark: '墨黑',
      studioLight: '纸白',
      studioSeed: '地形种子',
      studioReroll: '换一幅',
      studioSurface: '面板背景透明度',
      studioScale: '地形尺度',
      studioBands: '等高线密度',
      studioWarp: '弯曲程度',
      studioOctaves: '地形细节',
      studioLineWidth: '线宽',
      studioAlpha: '线条显隐',
      studioEdge: '边缘渐隐',
      studioSpeed: '形变速度',
      studioAccent: '琥珀掠光',
      studioLineColor: '线色',
      studioDashed: '穿插虚线',
      studioOn: '工坊背景：开',
      studioOff: '工坊背景：关',
      themeLight: '切到纸白',
      themeDark: '切到墨黑',
      echoTitle: 'Echo',
      echoLibrary: 'Echo 库',
      echoDragTip: '拖到输入框，作为引用插入',
      echoFavorite: '收藏为 Echo',
      echoSaving: '正在收藏…',
      echoSaved: '已收藏为回声',
      echoMerged: '已更新这条回声',
      echoPending: '已收藏，等待后续 5 楼',
      echoError: '回声读取/写入失败',
      echoCapacity: '已收藏 {n} / {limit} 条',
      echoCapacityFull: '回声库已满（{n}/{limit}）。请先删除不需要的收藏，再重试。',
      echoLocating: '正在打开原会话并定位收藏消息…',
      echoLocated: '已定位到原消息',
      echoLocateFailed: '原消息尚未显示，未能完成定位。请切到对话视图，加载更早历史后重试。',
      echoAnchorMissing: '这条旧收藏没有消息标识，无法精确定位；收藏副本仍可阅读。',
      echoLoading: '正在读取回声…',
      echoEmpty: '还没有回声。在任意助手消息上点标记收藏。',
      echoUntitled: '未命名对话',
      echoMessageCount: '{n} 楼',
      echoFloor: '第 {n} 楼',
      echoPendingTag: '待补 {n} 楼',
      echoOpenSession: '打开原会话',
      echoOpenContext: '查看上下文',
      echoContext: '对话上下文',
      echoContextStart: '收藏的问答已居中显示；上方和下方还有上下文。',
      echoContextWindow: '收藏窗口',
      echoContextFull: '完整会话',
      echoLoadFull: '加载完整会话',
      echoFullFailed: '完整会话加载失败',
      echoSessionGone: '原会话已删除',
      echoNoQuestion: '没有记录到提问',
      echoClose: '关闭',
      echoRefresh: '刷新回声库',
      echoSearchPlaceholder: '搜索回声…',
      echoPendingFilter: '只看待补',
      echoNoMatch: '没有匹配的回声',
      echoDelete: '删除这条收藏',
      echoDeleteConfirm: '只删除这一条收藏？同对话的其他收藏会保留。',
      echoUser: '你',
      echoAssistant: '助手',
      echoNoNote: '没有备注',
      sessionSearchTitle: '全库搜索',
      sessionSearchPlaceholder: '搜索所有对话内容…',
      sessionSearchTip: '按原消息标识打开并定位；历史未加载或旧记录缺少标识时会提示，不按相似文本猜测。',
      sessionSearchLoading: '搜索中…',
      sessionSearchError: '搜索失败',
      sessionSearchNoResult: '没有匹配结果',
      contourOff: '关闭',
      ringRoundBasis: '本轮构成',
      ringTotalBasis: '按本会话累计',
      ringIdle: '还没有调用',
      reconnecting: '连接中断，正在重连',
      heroCaption: 'PULSE',
      untitled: '未命名会话',
      budgetLabel: '目录预算',
      coldLine: '冷层 {n} 个 / {c} 字符',
      coldTitle: '冷层（已停用）',
      restore: '启用',
      optimize: '自动配装',
      optimizeTip: '先算一份预算方案：保留核心集，其余可停；确认后才动文件。',
      planTitle: '预算方案',
      planMeta: '{a} → {b} tok',
      planSaved: '省 {c} 字符',
      planKeep: '保留 {n} 项',
      planPark: '停用 {n} 项',
      planApply: '应用 · 停 {n} 项',
      planBusy: '处理中…',
      planUndo: '撤销',
      planRecoverUndo: '撤销上次停用',
      planRecoverUndoTip: '查看保存的停用记录，再确认撤销；关闭或重启后仍可找回。',
      planCancel: '取消',
      planEmpty: '已在预算内，没有需要停用的技能。',
      planApplied: '已停用 {n} 项',
      planFailed: '操作未完成，请重试',
      planPartial: '{n} 项未移动，请排除同名冲突或文件占用后重试',
      planUndoFailed: '撤销未完成，请重试撤销剩余项',
      planBarTitle: '保留 {a} / 共 {b}',
      planColKeep: '保留',
      planColPark: '停用',
      planCount: '{n} 项',
      planLocked: '内置',
      planEmptyPark: '点左边的技能移到这里',
      planEmptyKeep: '没有保留项',
      whyPinned: '你钉住的',
      whyLibrary: '库已钉住',
      whyRecent: '近 7 天用过',
      whyDays: '{n} 天未用',
      whyNever: '从未用过',
      openRepo: '打开仓库',
      repoShort: '仓库',
      noRepo: '本地技能，无来源',
      glOn: 'WebGL 等高线：开（点击关闭）',
      glOff: 'WebGL 等高线：关（点击开启）',
      overBudget: '超出预算',
      budgetTip: '按模型真实目录算：全局层 + 会话层的每条 name + description（描述最多 500 字符）＋冷层索引。DSH 不会因为超量而截断目录；这里只是软目标，超了是提示，不是故障。',
      budgetSkills: '目录 {n} 项',
      budgetTokens: '≈{t} tok',
      budgetSection: '预算',
      budgetTarget: '预算线（token）',
      budgetHint: '软目标：技能目录（模型每轮都会读到的技能名和说明）超过预算线只会变色提示，不会停用任何技能。会移动技能目录的是「自动配装」和「技能装配」，都要先预演、确认，可以撤销。',
      historyTitle: '历史常用',
      historySince: '自 {d}',
      timeShare: '工时 {p}%',
      historyShare: '占 {p}%',
      historyTimeTip: '技能加载后发生的工具耗时占比（启发式，不是墙钟；并行调用会重复计时）',
      historyUnmeasured: '工时未测得',
      timeShareUnder: '工时 <1%',
      alertsTitle: '可能卡住了',
      alertErrors: '{tool} 连续失败 {n} 次',
      alertRepeat: '{tool} 本轮已调用 {n} 次',
      roundCost: '本轮工具耗时 {x}',
      slowest: '最慢：{a}',
      durationTip: '这是工具的墙钟耗时，不含模型思考时间',
      libCount: '{n} 项',
      libInstalledAt: '安装于 {d}',
      libSkillsFrom: '{n} 个技能来自这一批',
      libMenu: '分组菜单',
      libRename: '重命名这一组…',
      libRenameTitle: '给这一组起个记得住的名字',
      libCopyName: '复制组名',
      libOpenRepo: '打开仓库',
      historyGroupMeta: '×{n}',
      historyRowMeta: '×{n}',
      historyTimeShort: '工时 {p}%',
      historyTimeUnder: '工时 <1%',
      showAllRows: '显示全部 {n} 项',
      collapseRows: '收起',
      parkLib: '停用整库',
      parkingLib: '停用中…',
      parkLibTip: '把这个库里的用户技能移进冷层；官方内置技能会跳过',
      parkLibFailed: '整库停用失败',
      parkSkill: '停用',
      parkingSkill: '…',
      parkSkillTip: '把这个用户技能移进冷层',
      parkSkillFailed: '停用失败',
      pinSkill: '钉住',
      rowMenu: '条目菜单',
      menuInsert: '插入到对话',
      menuRename: '重命名…',
      menuRenamePrompt: '给这个条目起个中文名',
      menuReveal: '跳到技能目录',
      menuOpenFile: '打开 SKILL.md',
      menuCopyName: '复制名字',
      menuCopyId: '复制 ID',
      menuPin: '钉住',
      menuUnpin: '取消钉住',
      menuPark: '停用这个技能',
      menuEditDesc: '改描述…',
      menuCalls: '调用记录',
      menuSave: '保存',
      menuCancel: '取消',
      menuSaving: '保存中…',
      goalEmpty: '设定当前目标',
      goalAccept: '设为目标',
      goalDismiss: '不用',
      goalInferredTip: '按会话标题推断的提议，确认后才算数',
      goalConfirm: '确认',
      goalDone: '完成',
      goalEdit: '改写',
      goalNew: '换个目标',
      goalRemove: '移除',
      goalReopen: '重开',
      goalNewPlaceholder: '这个工作区现在要做成什么？',
      goalReplaceHint: '回车保存。会替换当前目标，旧目标记为「已顶替」，不算完成。',
      goalDshParallel: 'DSH 的 /goal 正在跑，目标条先显示它；这里设的目标在它结束后接上。',
      goalHistory: '历史',
      goalDoneCount: '已完成 {n}',
      goalStale: '已顶替',
      goalDshBadge: 'DSH',
      goalDshManaged: '这是 DSH 的 /goal，在输入框上方的目标栏里管理，这里只读。完成后自动记进历史。',
      goalPhaseActive: '进行中',
      goalPhasePaused: '已暂停',
      goalPhaseBlocked: '受阻',
      goalPhaseComplete: '已完成',
      goalRounds: '{n}/{max} 轮',
      goalFocusToggle: '专注模式：目标开始后没用过的技能和工具变淡',
      goalFocusOn: '专注',
      goalFailed: '没保存上：{reason}',
      goalTooLong: '最多 {n} 个字',
      goalNoWorkspace: '这个会话没有工作目录，挂不了目标',
      goalFull: '回声库已满，目标和收藏共用 200 条上限。先删掉一些再试。',
      translateToggle: '新技能自动翻译（后台用默认模型补中文名和说明）',
      translateNow: '现在翻译',
      translateRunningShort: '翻译中…',
      translateRunning: '翻译中…',
      translatePending: '{n} 个技能还没有中文名或说明',
      translateDone: '都翻译好了（上次补了 {n} 个）',
      translateNone: '没有待翻译的技能',
      translateUnknown: '等待面板数据…',
      translateNoLlm: '这个 DSH 没给插件开放模型服务，只能手动改名',
      translateNoModel: '没有默认模型：先在输入框右下角选一个模型',
      translateUnparseable: '模型的回答没法解析，没写入任何东西。可以再试一次',
      translateTimeout: '翻译超时，没写入任何东西',
      translateFailedRaw: '翻译失败：{code}',
      sceneIdle: '还原收藏那一轮：触发指令、工具链、技能、耗时、模型',
      sceneLoad: '重建现场',
      sceneRetry: '重试',
      sceneLoading: '正在从会话日志重建…',
      sceneReady: '收藏那一轮的现场',
      sceneGone: '原会话的日志已经不在了，没法重建',
      sceneFailed: '重建失败：{reason}',
      sceneAsk: '触发这一轮的指令',
      sceneTurn: '第',
      sceneDuration: '用时',
      sceneOpen: '未结束',
      sceneSteps: '步数',
      sceneTools: '工具',
      sceneModel: '模型',
      sceneTokens: '输入 / 输出',
      sceneSkills: '这一轮加载的技能',
      sceneTrackLabel: '工具时间轨道，共 {n} 次调用',
      sceneError: '失败',
      sceneErrors: '{n} 次失败',
      sceneNoTools: '这一轮没有调用工具',
      sceneTruncated: '只画了前 {n} 次调用',
      suggestTitle: '可能值得收藏',
      suggestHint: '按你的反馈和这一轮做了什么推断的，点了才收藏',
      suggestTurn: '第 {n} 轮',
      suggestPraised: '你说「{q}」',
      suggestPraisedPlain: '你给了肯定',
      suggestApproved: '你认可了',
      suggestDelivered: '交付了文件',
      suggestRecovered: '出错后修好了',
      suggestBig: '大回合 · {n} 次工具',
      suggestSave: '收藏',
      suggestDismiss: '忽略这条',
      suggestFailed: '没收藏上：{reason}',
      goalInferredModelTip: '模型根据最近几轮对话推断的提议，确认后才算数',
      goalInferring: '推断中…',
      goalTagTracked: '追踪中',
      goalTagUnconfirmed: '待确认',
      goalTagIdea: '灵感',
      budgetModeLabel: '预算线',
      budgetModeAuto: '自动',
      budgetModeFixed: '固定',
      budgetAutoHint: '当前模型上下文 {window} tok，预算线取 1% = {n} tok（最少 3k、最多 20k）。换了更大的模型会自动放宽。',
      budgetAutoUnknown: '还没见过模型的上下文大小（没有会话上报过），暂用下面的后备值 {n} tok。打开任意会话后会自动改按窗口算，并记住。',
      budgetFixedHint: '用下面填的固定值，不随模型变化。',
      setTitle: '设置',
      setTabOptions: '选项',
      setTabAbout: '关于',
      setCatGeneral: '常规',
      setCatVisual: '视效',
      setCatModel: '模型',
      setCatSound: '音效',
      setCatBackground: '背景',
      setCatBudget: '预算',
      setCatPricing: '计价',
      setTitleSuffix: '设置',
      setKeyTabs: '切换页签',
      setKeyCats: '切换分类',
      setKeyBack: '返回',
      setKeyReset: '恢复默认值',
      setAboutClient: '界面版本',
      setAboutHost: 'Host 版本',
      setAboutHostUnknown: '还没收到',
      setAboutBody: 'PULSE 是 DSH 的运行面板：实时显示技能和工具的调用、技能目录占用的预算、上下文压力，提供技能装配、目标与灵感、ECHO 现场重建。所有数据存在本机。',
      loLibAllOn: '全装',
      loLibAllOff: '全卸',
      loLibKept: '{n} 个技能别的对话正在用，没卸',
      echoPickHint: '在气泡外拖动可框选整条消息（Ctrl / Shift 加选，Ctrl+A 全选），Ctrl+C 按原格式复制',
      echoPicked: '已选 {n} 条',
      echoCopied: '已复制 {n} 条',
      echoCopyPicked: '复制',
      echoClearPicked: '清除',
      budgetAutoLive: '当前会话上下文 {window} × {pct} = {raw}，夹在 {range} 之间 → 预算线 {n} tok。',
      budgetAutoRemembered: '这会儿没有会话上报上下文，按上次见到的 {window} 算：× {pct} = {raw}，夹在 {range} 之间 → 预算线 {n} tok。',
      budgetRatio: '占上下文的比例',
      budgetMin: '下限（小窗口模型的余地）',
      budgetMax: '上限（技能太多模型会挑错）',
      budgetExamples: '按现在的规则：{list}',
      budgetFallback: '后备值（拿不到窗口大小时）',
      menuMotionSection: '菜单开关',
      menuFade: '淡入淡出时长',
      menuFadeInstant: '即时',
      menuBlur: '背景模糊',
      menuBlurOff: '关',
      menuMotionHint: '设置窗口和技能装配窗口打开、关闭时的过渡。模糊越大越吃显卡；性能模式下装配窗口不模糊。',
      loButton: '技能装配',
      loButtonTip: '打开装配窗口：自己拼技能组合，按预算装满，可存为配置、先预演再应用',
      loTitle: '技能装配',
      loTabCurrent: '当前',
      loTabNew: '+ 新配置',
      loManage: '管理配置',
      loStatBudget: '预算',
      loStatCount: '已装',
      loStatContext: '占上下文',
      loStatRecent: '近 7 天用过',
      loCountLabel: '个技能',
      loBarLabel: '预算条：已装技能按占用分段',
      loBarHint: '拖到条上或左边圆盘上装上 · 把条上的段拖回技能区卸下 · 点一下也能装卸',
      loLimitAuto: '预算线 = 上下文 1%（3k–20k）',
      loLimitFixed: '预算线 = 固定值（设置里可改）',
      loBuiltin: '内置技能 {n} 个 · {tok} tok（搬不动）',
      loRingTip: '拖技能到这里装上',
      loBudgetPct: '预算 {n}%',
      loBias: '偏向',
      loOver: '超出预算 {n} tok',
      loLeft: '余量 {n} tok',
      loLockedNotice: '这个技能正在别的对话里用（{sessions}），先不能卸下',
      loInUse: '正在用：{sessions}（不能卸下）',
      loDetail: '详情',
      loTokens: '占用',
      loUses: '累计使用',
      loBudgetWith: '装上后预算',
      loBudgetWithout: '卸下后预算',
      loBiasAfter: '装上后类别占比',
      loRecent: '最近用在',
      loTogether: '常一起用',
      loKeyClick: '[点击 / 拖动]',
      loKeyToggle: '装 / 卸',
      loKeyFill: '按常用补满',
      loKeySave: '存为配置',
      loKeyApply: '应用（先预演）',
      loKeyClose: '关闭',
      loFill: '按常用补满',
      loClear: '清空',
      loReset: '恢复当前',
      loSave: '存为配置',
      loApply: '应用',
      loPreviewing: '预演中…',
      profiles: '技能配置',
      profilesTip: '按工作类型保存启用的技能组合，一键切换（先预演、可撤销）',
      profilesIntro: '保存「此刻启用着哪些自装技能」为一份配置；切换时先列出要停用和要恢复的技能，你确认后才移动文件，可以撤销。',
      profilesNow: '现在启用 {n} 个自装技能',
      profilesActive: '与「{name}」一致',
      profilesEmpty: '还没有配置。先把技能调成某类工作需要的样子，再点「保存当前配置」。',
      profileCount: '{n} 个技能',
      profileSwitch: '切换',
      profileRename: '改名',
      profileOverwrite: '用当前覆盖',
      profileOverwriteTip: '把这份配置更新成此刻启用着的技能',
      profileDelete: '删除这份配置（不动任何技能）',
      profileDeleteConfirm: '确认删除',
      profileSave: '保存当前配置',
      profileNamePlaceholder: '配置名称，比如：写代码 / 剪视频 / 写短剧',
      profileLast: '上次切换到「{name}」',
      profileUndo: '撤销这次切换',
      profilePreviewTitle: '切换到「{name}」会：',
      profileWillPark: '停用 {n} 个',
      profileWillRestore: '恢复 {n} 个',
      profileKeepNew: '保留 {n} 个新装的（不在任何配置里）',
      profileKeepInUse: '保留 {n} 个别的对话正在用的',
      profileMissing: '找不到 {n} 个（已卸载）',
      profileNothing: '已经是这个配置了，不用移动任何技能。',
      profileConfirm: '确认切换',
      profileApplying: '切换中…',
      profileBack: '返回',
      profileDone: '已切换：停用 {parked} 个，恢复 {restored} 个。',
      profilePartFailed: '有几个没搬成：{names}',
      profileClose: '关闭',
      profileNameEmpty: '名称不能为空',
      profileNameTaken: '已经有同名的配置了',
      profileLimit: '配置太多了（最多 30 份），先删掉一些',
      profilePlanExpired: '这份预演已过期，请重新点「切换」',
      profileNothingToUndo: '没有可以撤销的切换',
      profileFailed: '没成功：{reason}',
      inUseTitle: '这个技能正在别的对话里用',
      inUseMessage: '{sessions} 正在使用它。停用会把技能目录挪走：那边下一轮就调不到它，已经读进去的说明还在，但它自带的脚本、模板、文档会找不到，可能中途出错。仍要停用吗？',
      inUseConfirm: '仍要停用',
      parkSkippedInUse: '这几个正在别的对话里用，已跳过：{names}',
      whyInUse: '正在用：{sessions}',
      consentTitle: '要让 PULSE 用你的模型做后台任务吗？',
      consentBody: '开启后，下面三件事会自动把内容发给你在 DSH 里选的默认模型（经 DSH 的模型服务，发往你配置的服务商）：',
      consentTranslate: '自动翻译：新技能 / 工具的名字和说明',
      consentGoal: '推断目标：当前会话最近几轮对话（约 3000 字以内），只在没有目标时',
      consentIdeas: '灵感收集：出现「下一步 / 以后再做」的回合',
      consentCost: '每次是一次短请求，会消耗你账户的 token。随时可以在设置里关掉；你自己点的按钮（现在翻译、检查完成情况、从历史会话整理）不受这里限制。',
      consentAllow: '开启',
      consentDecline: '不用',
      consentToggle: '允许 PULSE 用默认模型做后台任务（翻译、推断目标、收集灵感；会发送相关内容并消耗 token）',
      goalIdeaTip: '最近一条还没做的灵感；设为目标后，目标完成时它也会标为完成',
      collectIdeasToggle: '每轮结束后自动收集灵感与分支（助手给的方向、你说的以后再做）',
      ideaTitle: '灵感与分支',
      ideaCounts: '待做 {open} · 已完成 {done}',
      ideaBarCount: '灵感 {n}',
      ideaAdd: '+ 记一条',
      ideaAddPlaceholder: '想到但现在不做的事…',
      ideaCheck: '检查完成情况',
      ideaBackfill: '从历史会话整理',
      ideaBackfillStart: '开始整理',
      ideaEstimate: '这个项目有 {sessions} 个会话，{turns} 个回合里出现了方向清单，约需调用模型 {calls} 次。',
      ideaEstimateNone: '这个项目的 {sessions} 个会话里没找到方向清单，不用整理。',
      ideaBackfilling: '正在整理历史：{done}/{total} 批，新增 {added} 条',
      ideaBackfilled: '历史整理完成，新增 {added} 条',
      ideaCapturing: '正在收集这一轮的灵感…',
      ideaChecking: '正在对照最近的对话检查哪些已经做了…',
      ideaFailed: '没成功：{reason}',
      ideaEmpty: '还没有灵感。助手列出「下一步可以…」或者你说「以后再做」时，会自动收进来。',
      ideaDoneList: '已完成 {n}',
      ideaDoing: '进行中',
      ideaMaybeDone: '可能已完成',
      ideaConfirmDone: '确认完成',
      ideaNotDone: '不是',
      ideaToGoal: '设为目标',
      ideaDrop: '忽略这条',
      ideaJump: '跳回原对话',
      ideaFromAssistant: '助手',
      ideaFromUser: '你说的',
      ideaFromHistory: '历史',
      ideaFromManual: '手记',
      sfxToggle: '音效（现场合成，不用游戏原声）',
      sfxVolume: '音量',
      'sfx.click': '点击',
      'sfx.expand': '展开',
      'sfx.collapse': '收起',
      'sfx.open': '打开侧栏',
      'sfx.done': '完成',
      'sfx.ignite': '开始工作',
      versionMismatch: '界面已经是 {client}，但 DSH 里跑的插件 Host 还是 {host}，新功能会报错。请完全退出 DSH（托盘图标右键退出，不只是关窗口）再打开。',
      hostOutdatedShort: 'Host 还是旧版本：完全退出 DSH 再打开就能用',
      goalTagProposal: '提议',
      inferGoalToggle: '没有目标时，用默认模型从最近对话推断一个提议（点了才算数）',
      editorSaveFailed: '没保存上：{reason}',
      editorTooLong: '最多 {n} 个字',
      echoDetailFailed: '读取这条 Echo 失败，请稍后重试。',
      editorNameTitle: '重命名这个条目',
      editorDescTitle: '改这个条目的说明',
      callsRound: '本会话',
      callsTotal: '会话内累计',
      callsLast: '最近一次',
      callsMs: '上次耗时',
      callsLifetime: '跨会话累计',
      callsNone: '没有跨会话记录',
      callsHint: '只统计面板见过的调用',
      menuCopied: '已复制',
      menuFail: '没成功',
      pinSkillTip: '钉住后，预算方案默认不会停用这个技能',
      unpinSkill: '取消钉住',
      unpinSkillTip: '取消钉住，预算方案可以停用它',
      pinLib: '钉住整库',
      pinLibTip: '钉住这个库，预算方案默认不碰它',
      unpinLib: '取消钉住整库',
      unpinLibTip: '取消钉住，预算方案可以动这个库',
      callSkill: '调用',
      callSkillTip: '把这个技能插到对话框（/名字）',
      openSkillsDir: '目录',
      openSkillsDirTip: '在资源管理器打开本地技能目录',
      restoreLib: '启用整库',
      restoringLib: '启用中…',
      restoreLibTip: '把这个库里停用的技能全部移回技能目录',
      restoreLibFailed: '整库启用失败',
      searchPlaceholder: '搜能力：剧本 工作台…',
      searchHint: '空格分词，任一命中',
      searchResults: '搜索结果',
      searchEmpty: '没有命中。换个词，或把词拆开。',
      searchCold: '冷层',
      searchInstalled: '未挂载',
      searchCatalog: '仅名称目录',
      catalogUnavailable: '尚未确认安装或挂载，不能从这里调用',
      insert: '插入',
      insertTip: '插入技能 /英文本名，或工具 id',
      insertFailed: '没找到对话输入框。先打开一个会话，或把结果拖进去。',
      restoreFailed: '启用失败',
      clear: '清空',
      rightHint: '想边聊边看：打开右侧栏，在「新标签页」里选「运行中」，面板就会停靠到对话右侧。',
    }

    var en = {
      nav: 'Pulse',
      schemeLabel: 'Panel theme',
      schemeAuto: 'Follow DSH',
      studioNav: 'Studio',
      title: 'Pulse',
      subtitle: 'What is running right now',
      globalTitle: 'Pulse',
      globalSubtitle: 'Every task running in this Harness and what it is calling',
      runningLabel: 'Running now',
      recentLabel: 'Recently finished',
      observedLabel: 'Sessions observed',
      noRunning: 'Nothing is running right now.',
      noRecent: 'Nothing has finished yet.',
      noCalls: 'No tool calls this round',
      storageUsageError: 'Usage records could not be read or saved. Check storage and retry.',
      storageEchoError: 'Echoes could not be read or saved. Check storage and retry.',
      storageCatalogError: 'The custom name catalog could not be read. The last valid names were retained; check the file and retry.',
      undoStoreError: 'The undo record or restore operation needs attention. Check the details and retry.',
      round: 'Round {n}',
      phaseIdle: 'Unused',
      phaseActive: 'In progress',
      phaseSpent: 'Finished',
      phaseRunning: 'Running',
      skills: 'Skills',
      tools: 'Tools',
      agents: 'Agents',
      persona: 'Active persona card',
      soulTitle: 'Soul persona',
      soulAuto: 'Auto (workspace / default)',
      soulNone: 'Disable persona',
      soulHint: 'Writes the Soul session-persona mapping; the header selector follows.',
      soulEmpty: 'Soul is installed, but no persona cards exist yet.',
      soulError: 'Persona write failed',
      noPersona: '(no persona card observed)',
      subagents: 'Subagents',
      noSubagents: 'No subagent activity this round',
      noSession: 'No session selected: the catalogues are listed and everything is idle.',
      loading: 'Reading…',
      offline: 'Cannot reach the Host push channel (/dsh-running-panel/stream).',
      retry: 'The browser reconnects automatically; a persistent failure means the Host half is not loaded.',
      emptyGroup: 'No tool of this kind in this profile',
      roundCount: '{n} this round',
      totalCount: '{n} total',
      lastAt: 'last {t}',
      hasError: 'error',
      unobservable: 'Not observable',
      notes: 'Notes',
      expand: 'Expand',
      collapse: 'Collapse',
      stopReason: 'stopped {r}',
      startedAt: 'started {t}',
      endedAt: 'ended {t}',
      session: 'Session',
      cwd: 'Directory',
      childTools: 'Tools it called',
      childNoTools: 'No tool calls yet',
      openRight: 'Dock to the right sidebar',
      openFailed: 'Could not open the right sidebar; use its "New tab" entry instead.',
      runningSection: 'Running now',
      runningHint: 'Capabilities you invoke float up here; they fade when the round ends and drop back after 4 rounds without a call.',
      agentPresetLine: 'Agent preset · {x}',
      subagentOf: 'Subagent · {x}',
      fadingTip: 'Falls back after {n} more idle rounds',
      'group.skill': 'Skills',
      'group.files': 'Files',
      'group.exec': 'Commands',
      'group.search': 'Search',
      'group.web': 'Web',
      'group.media': 'Media',
      'group.office': 'Office',
      'group.agents': 'Agents',
      'group.memory': 'Memory & persona',
      'group.other': 'Other',
      'cat.visual': 'Visual',
      'cat.code': 'Code',
      'cat.thought': 'Thought',
      'cat.ops': 'Action',
      ringCalls: 'calls',
      budgetPct: 'budget',
      contextLabel: 'context',
      contextTip: 'Latest effective request pressure and window capacity from Host tokenMeter; unknown means not measured, never estimated.',
      contextUnknown: 'n/a',
      tokenRound: 'round I/O',
      tokenTotal: 'total I/O',
      tokenTip: 'Provider usage tokens; hidden when usage is absent, never estimated.',
      costTitle: 'Cost estimate',
      costTotal: '~{n} tok',
      costHint: 'Estimated prompt cost from skill name/description and tool schema; not a provider bill.',
      costRowTip: 'Estimate: approximate per-turn prompt delta if enabled, not an exact bill.',
      costKindSkill: 'skill',
      costKindTool: 'tool',
      costRmbTip: 'input-rate est.',
      costRmbUnset: 'set rate for ¥',
      ringTitle: 'This round',
      settingsTitle: 'Display',
      contourLabel: 'Contour background',
      contourGl: 'WebGL (animated)',
      contourSvg: 'Contours · sweep',
      contourStudio: 'Studio (continuous)',
      studioSection: 'Contour settings',
      studioMore: 'Full Contour Workshop: photo to contours, PNG / SVG export',
      studioMoreLink: 'Open ↗',
      frostSection: 'Frosted glass',
      pricingSection: 'Token price',
      pricingHint: 'For local estimates only; CNY per 1M tokens. DSH exposes no universal price—enter your model/channel rate.',
      pricingInput: 'Input price',
      pricingOutput: 'Output price',
      pricingUnit: 'CNY / 1M tokens',
      frostEnabled: 'Enable frosted glass',
      frostBlur: 'Blur radius',
      frostOpacity: 'Glass opacity',
      frostSaturation: 'Saturation',
      frostHint: 'Nearly colorless by default; only blur and the card edge remain.',
      modeVisual: 'Visual',
      modePerformance: 'Performance',
      modeVisualHint: 'Full effects; each mode keeps its own settings.',
      modePerformanceHint: 'Turns off contour morph, 3D tilt, scanline, frost, reveal/flow/window animations and status pulses by default. Re-enable any item.',
      cornerToggle: 'Corner ring in conversation',
      effectContour: 'Contour morph',
      effectTilt: '3D tilt',
      effectScan: 'Scanline',
      effectBlur: 'Frost blur',
      effectReveal: 'Reveal animation',
      effectFlow: 'Flow',
      effectWindow: 'Window animations',
      effectPulse: 'Status pulses',
      effectGrid: 'Tactical grid',
      resetAll: 'Reset to defaults',
      resetTitle: 'Reset to defaults?',
      resetBody: 'Resets visual/performance mode, contour, frost, folds and per-mode settings. Echo, history and sessions are kept.',
      resetCancel: 'Cancel',
      resetConfirm: 'Reset',
      studioPalette: 'Palette',
      studioDark: 'Ink',
      studioLight: 'Paper',
      studioSeed: 'Terrain seed',
      studioReroll: 'Reroll',
      studioSurface: 'Panel surface opacity',
      studioScale: 'Terrain scale',
      studioBands: 'Contour density',
      studioWarp: 'Warp',
      studioOctaves: 'Detail',
      studioLineWidth: 'Line width',
      studioAlpha: 'Line opacity',
      studioEdge: 'Edge fade',
      studioSpeed: 'Morph speed',
      studioAccent: 'Amber sweep',
      studioLineColor: 'Line color',
      studioDashed: 'Dashed minor lines',
      studioOn: 'Studio background: on',
      studioOff: 'Studio background: off',
      themeLight: 'Switch to paper',
      themeDark: 'Switch to ink',
      echoTitle: 'Echo',
      echoLibrary: 'Echo library',
      echoDragTip: 'Drag into the composer to quote it',
      echoFavorite: 'Save as echo',
      echoSaving: 'Saving…',
      echoSaved: 'Saved as echo',
      echoMerged: 'Updated this echo',
      echoPending: 'Saved; waiting for the next 5 floors',
      echoError: 'Echo read/write failed',
      echoCapacity: '{n} / {limit} echoes saved',
      echoCapacityFull: 'Echo library full ({n}/{limit}). Delete an unwanted echo, then retry.',
      echoLocating: 'Opening the original session and locating the saved message…',
      echoLocated: 'Located the original message',
      echoLocateFailed: 'The original message is not visible yet. Switch to Chat, load earlier history, and retry.',
      echoAnchorMissing: 'This older echo has no message identity for an exact jump. Its saved copy is still readable.',
      echoLoading: 'Reading echoes…',
      echoEmpty: 'No echoes yet. Tap the mark on any assistant message.',
      echoUntitled: 'Untitled conversation',
      echoMessageCount: '{n} floors',
      echoFloor: 'floor {n}',
      echoPendingTag: 'waiting {n}',
      echoOpenSession: 'Open session',
      echoOpenContext: 'View context',
      echoContext: 'Conversation context',
      echoContextStart: 'The saved Q&A is centered; more context sits above and below.',
      echoContextWindow: 'Saved window',
      echoContextFull: 'Full session',
      echoLoadFull: 'Load full session',
      echoFullFailed: 'Full session failed to load',
      echoSessionGone: 'Original session deleted',
      echoNoQuestion: 'No question captured',
      echoClose: 'Close',
      echoRefresh: 'Refresh echo library',
      echoSearchPlaceholder: 'Search echoes…',
      echoPendingFilter: 'Waiting only',
      echoNoMatch: 'No matching echoes',
      echoDelete: 'Delete this echo',
      echoDeleteConfirm: 'Delete only this echo? Other echoes in the same conversation stay.',
      echoUser: 'You',
      echoAssistant: 'Assistant',
      echoNoNote: 'No note',
      sessionSearchTitle: 'Search all sessions',
      sessionSearchPlaceholder: 'Search visible messages…',
      sessionSearchTip: 'Opens and locates the exact message identity. Missing identities or unloaded history produce a notice; similar text is never used as a substitute.',
      sessionSearchLoading: 'Searching…',
      sessionSearchError: 'Search failed',
      sessionSearchNoResult: 'No matches',
      contourOff: 'Off',
      ringRoundBasis: 'this round',
      ringTotalBasis: 'session total',
      ringIdle: 'No calls yet',
      reconnecting: 'Disconnected, reconnecting',
      heroCaption: 'PULSE',
      untitled: 'Untitled session',
      budgetLabel: 'Catalog budget',
      coldLine: 'cold tier: {n} / {c} chars',
      coldTitle: 'Cold tier (disabled)',
      restore: 'Enable',
      optimize: 'Auto loadout',
      optimizeTip: 'Compute a budget plan first: keep the core set, park the rest only after you confirm.',
      planTitle: 'Budget plan',
      planMeta: '{a} → {b} tok',
      planSaved: 'saves {c} chars',
      planKeep: 'Keep {n}',
      planPark: 'Park {n}',
      planApply: 'Apply · park {n}',
      planBusy: 'Working…',
      planUndo: 'Undo',
      planRecoverUndo: 'Undo last parking',
      planRecoverUndoTip: 'Review the saved parking record before undoing. It remains available after a restart.',
      planCancel: 'Cancel',
      planEmpty: 'Within budget. Nothing to park.',
      planApplied: 'Parked {n}',
      planFailed: 'Operation incomplete; please retry',
      planPartial: '{n} items were not moved; resolve name conflicts or file locks and retry',
      planUndoFailed: 'Undo incomplete; retry the remaining items',
      planBarTitle: 'Keeping {a} of {b}',
      planColKeep: 'Keep',
      planColPark: 'Park',
      planCount: '{n}',
      planLocked: 'built-in',
      planEmptyPark: 'Click a skill on the left to park it',
      planEmptyKeep: 'Nothing kept',
      whyPinned: 'pinned',
      whyLibrary: 'library pinned',
      whyRecent: 'used in 7d',
      whyDays: 'idle {n}d',
      whyNever: 'never used',
      openRepo: 'Open repo',
      repoShort: 'Repo',
      noRepo: 'Local skill, no source',
      glOn: 'WebGL contours: on',
      glOff: 'WebGL contours: off',
      overBudget: 'Over budget',
      budgetTip: 'Counts what the model actually sees: global + session skill entries (name + description, 500 chars max) plus the cold index. DSH never truncates the catalog; this cap is a soft target, not a failure.',
      budgetSkills: '{n} in catalog',
      budgetTokens: '≈{t} tok',
      budgetSection: 'Budget',
      budgetTarget: 'Budget line (tokens)',
      budgetHint: 'Soft target: when the skill catalog (the names and descriptions the model reads every turn) goes over the line, the panel only changes colour. Nothing is parked. Only \"Auto loadout\" and \"Loadout\" move skill folders, and both show a dry run, need confirmation and can be undone.',
      historyTitle: 'All-time usage',
      historySince: 'since {d}',
      timeShare: 'work {p}%',
      historyShare: '{p}% of calls',
      historyTimeTip: 'Share of measured tool time after the skill loaded (heuristic, not wall-clock)',
      historyUnmeasured: 'time not measured',
      timeShareUnder: 'work <1%',
      alertsTitle: 'Possibly stuck',
      alertErrors: '{tool} failed {n} times in a row',
      alertRepeat: '{tool} called {n} times this round',
      roundCost: 'Tool time this round {x}',
      slowest: 'Slowest: {a}',
      durationTip: 'Wall-clock tool time; model thinking is not included',
      libCount: '{n} items',
      libInstalledAt: 'Installed {d}',
      libSkillsFrom: '{n} skills from this install',
      libMenu: 'Group menu',
      libRename: 'Rename this group…',
      libRenameTitle: 'Give this group a name you will remember',
      libCopyName: 'Copy group name',
      libOpenRepo: 'Open repository',
      historyGroupMeta: '×{n}',
      historyRowMeta: '×{n}',
      historyTimeShort: 'work {p}%',
      historyTimeUnder: 'work <1%',
      showAllRows: 'Show all {n}',
      collapseRows: 'Collapse',
      parkLib: 'Park library',
      parkingLib: 'Parking…',
      parkLibTip: 'Move this library’s user skills to the cold tier; bundled skills are skipped',
      parkLibFailed: 'Park failed',
      parkSkill: 'Park',
      parkingSkill: '…',
      parkSkillTip: 'Move this user skill to the cold tier',
      parkSkillFailed: 'Park failed',
      pinSkill: 'Pin',
      rowMenu: 'Item menu',
      menuInsert: 'Insert into composer',
      menuRename: 'Rename…',
      menuRenamePrompt: 'Chinese display name for this item',
      menuReveal: 'Reveal skill folder',
      menuOpenFile: 'Open SKILL.md',
      menuCopyName: 'Copy name',
      menuCopyId: 'Copy ID',
      menuPin: 'Pin',
      menuUnpin: 'Unpin',
      menuPark: 'Park this skill',
      menuEditDesc: 'Edit description…',
      menuCalls: 'Call history',
      menuSave: 'Save',
      menuCancel: 'Cancel',
      menuSaving: 'Saving…',
      goalEmpty: 'Set the current goal',
      goalAccept: 'Use as goal',
      goalDismiss: 'Dismiss',
      goalInferredTip: 'Suggested from the session title; it only counts once you confirm it',
      goalConfirm: 'Confirm',
      goalDone: 'Done',
      goalEdit: 'Edit',
      goalNew: 'New goal',
      goalRemove: 'Remove',
      goalReopen: 'Reopen',
      goalNewPlaceholder: 'What should this workspace get done now?',
      goalReplaceHint: 'Enter saves. Replaces the current goal; the old one is marked superseded, not done.',
      goalDshParallel: 'A DSH /goal is running, so the bar shows it first; this goal takes over when it ends.',
      goalHistory: 'History',
      goalDoneCount: '{n} done',
      goalStale: 'Superseded',
      goalDshBadge: 'DSH',
      goalDshManaged: 'This is a DSH /goal. Manage it from the goal bar above the composer; it is read-only here and goes into history when it completes.',
      goalPhaseActive: 'Active',
      goalPhasePaused: 'Paused',
      goalPhaseBlocked: 'Blocked',
      goalPhaseComplete: 'Complete',
      goalRounds: 'round {n}/{max}',
      goalFocusToggle: 'Focus mode: dim skills and tools not used since the goal started',
      goalFocusOn: 'Focus',
      goalFailed: 'Not saved: {reason}',
      goalTooLong: 'At most {n} characters',
      goalNoWorkspace: 'This session has no working directory, so it cannot hold a goal',
      goalFull: 'The Echo library is full; goals and saved excerpts share the 200 limit. Delete some and retry.',
      translateToggle: 'Auto-translate new skills (Chinese names and descriptions, default model, in the background)',
      translateNow: 'Translate now',
      translateRunningShort: 'Translating…',
      translateRunning: 'Translating…',
      translatePending: '{n} skills have no Chinese name or description yet',
      translateDone: 'All translated (last run filled {n})',
      translateNone: 'Nothing to translate',
      translateUnknown: 'Waiting for panel data…',
      translateNoLlm: 'This DSH does not expose its model service to plugins; rename by hand',
      translateNoModel: 'No default model: pick one in the composer first',
      translateUnparseable: 'Could not parse the model reply; nothing was written. Try again',
      translateTimeout: 'Translation timed out; nothing was written',
      translateFailedRaw: 'Translation failed: {code}',
      sceneIdle: 'Replay the saved turn: prompt, tool chain, skills, timing, model',
      sceneLoad: 'Reconstruct',
      sceneRetry: 'Retry',
      sceneLoading: 'Rebuilding from the session log…',
      sceneReady: 'The saved turn, reconstructed',
      sceneGone: 'The original session log is gone; nothing to reconstruct',
      sceneFailed: 'Reconstruction failed: {reason}',
      sceneAsk: 'The prompt that started this turn',
      sceneTurn: 'Turn',
      sceneDuration: 'Took',
      sceneOpen: 'unfinished',
      sceneSteps: 'Steps',
      sceneTools: 'Tools',
      sceneModel: 'Model',
      sceneTokens: 'In / out',
      sceneSkills: 'Skills loaded in this turn',
      sceneTrackLabel: 'Tool timeline, {n} calls',
      sceneError: 'failed',
      sceneErrors: '{n} failed',
      sceneNoTools: 'No tools were called in this turn',
      sceneTruncated: 'Only the first {n} calls are drawn',
      suggestTitle: 'Worth saving?',
      suggestHint: 'Guessed from your feedback and what the turn did; nothing is saved until you click',
      suggestTurn: 'Turn {n}',
      suggestPraised: 'You said "{q}"',
      suggestPraisedPlain: 'You approved it',
      suggestApproved: 'You accepted it',
      suggestDelivered: 'Delivered files',
      suggestRecovered: 'Recovered from errors',
      suggestBig: 'Big turn · {n} tools',
      suggestSave: 'Save',
      suggestDismiss: 'Dismiss',
      suggestFailed: 'Not saved: {reason}',
      goalInferredModelTip: 'Suggested by the model from the last few turns; it only counts once you confirm it',
      goalInferring: 'Inferring…',
      goalTagTracked: 'Tracked',
      goalTagUnconfirmed: 'Unconfirmed',
      goalTagIdea: 'Idea',
      budgetModeLabel: 'Budget line',
      budgetModeAuto: 'Auto',
      budgetModeFixed: 'Fixed',
      budgetAutoHint: 'Current model context {window} tok; the budget line is 1% = {n} tok (3k–20k). A larger model widens it automatically.',
      budgetAutoUnknown: 'No conversation has reported a context size yet, so the fallback {n} tok below is used. Once any conversation reports one, the line follows it and remembers it.',
      budgetFixedHint: 'Uses the fixed value below, regardless of the model.',
      setTitle: 'Settings',
      setTabOptions: 'Options',
      setTabAbout: 'About',
      setCatGeneral: 'General',
      setCatVisual: 'Visuals',
      setCatModel: 'Model',
      setCatSound: 'Sound',
      setCatBackground: 'Background',
      setCatBudget: 'Budget',
      setCatPricing: 'Pricing',
      setTitleSuffix: ' settings',
      setKeyTabs: 'Switch tab',
      setKeyCats: 'Category',
      setKeyBack: 'Back',
      setKeyReset: 'Restore defaults',
      setAboutClient: 'Client version',
      setAboutHost: 'Host version',
      setAboutHostUnknown: 'not reported yet',
      setAboutBody: 'PULSE is a running panel for DSH: live skill and tool calls, the budget the skill catalog takes, context pressure, plus skill loadouts, goals and ideas, and ECHO scene rebuilds. All data stays on this machine.',
      loLibAllOn: 'Equip all',
      loLibAllOff: 'Remove all',
      loLibKept: '{n} skills are in use by another conversation and stay equipped',
      echoPickHint: 'Drag outside the bubbles to select whole messages (Ctrl / Shift adds, Ctrl+A all); Ctrl+C copies them with formatting',
      echoPicked: '{n} selected',
      echoCopied: 'Copied {n}',
      echoCopyPicked: 'Copy',
      echoClearPicked: 'Clear',
      budgetAutoLive: 'Current context {window} × {pct} = {raw}, clamped to {range} → budget line {n} tok.',
      budgetAutoRemembered: 'No conversation is reporting a context size right now; using the last one seen, {window}: × {pct} = {raw}, clamped to {range} → budget line {n} tok.',
      budgetRatio: 'Share of the context',
      budgetMin: 'Floor (room for small-window models)',
      budgetMax: 'Cap (too many skills makes the model pick wrong)',
      budgetExamples: 'With the current rule: {list}',
      budgetFallback: 'Fallback (when the context size is unknown)',
      menuMotionSection: 'Menus',
      menuFade: 'Fade duration',
      menuFadeInstant: 'instant',
      menuBlur: 'Backdrop blur',
      menuBlurOff: 'off',
      menuMotionHint: 'Transition when the settings and loadout windows open and close. More blur costs more GPU; the loadout window does not blur in performance mode.',
      loButton: 'Loadout',
      loButtonTip: 'Open the loadout window: compose a skill set, fill to budget, save as a profile, dry run then apply',
      loTitle: 'Skill loadout',
      loTabCurrent: 'Current',
      loTabNew: '+ New profile',
      loManage: 'Manage',
      loStatBudget: 'Budget',
      loStatCount: 'Equipped',
      loStatContext: 'Of context',
      loStatRecent: 'Used in 7 days',
      loCountLabel: 'skills',
      loBarLabel: 'Budget bar: equipped skills by size',
      loBarHint: 'Drag onto the bar or the ring to equip · drag a segment back to unequip · or just click',
      loLimitAuto: 'Budget line = 1% of context (3k–20k)',
      loLimitFixed: 'Budget line = fixed value (see settings)',
      loBuiltin: '{n} built-in skills · {tok} tok (cannot be moved)',
      loRingTip: 'Drop skills here to equip',
      loBudgetPct: 'Budget {n}%',
      loBias: 'leaning',
      loOver: '{n} tok over budget',
      loLeft: '{n} tok left',
      loLockedNotice: 'Another conversation is using this skill ({sessions}); it cannot be unequipped now',
      loInUse: 'In use: {sessions} (cannot unequip)',
      loDetail: 'Details',
      loTokens: 'Size',
      loUses: 'Used',
      loBudgetWith: 'Budget if equipped',
      loBudgetWithout: 'Budget if removed',
      loBiasAfter: 'Category share if equipped',
      loRecent: 'Recently used in',
      loTogether: 'Often used with',
      loKeyClick: '[Click / drag]',
      loKeyToggle: 'equip / remove',
      loKeyFill: 'fill by usage',
      loKeySave: 'save as profile',
      loKeyApply: 'apply (dry run first)',
      loKeyClose: 'close',
      loFill: 'Fill by usage',
      loClear: 'Clear',
      loReset: 'Back to current',
      loSave: 'Save as profile',
      loApply: 'Apply',
      loPreviewing: 'Previewing…',
      profiles: 'Skill profiles',
      profilesTip: 'Save the set of enabled skills per kind of work and switch in one go (dry run first, undoable)',
      profilesIntro: 'Save “which installed skills are enabled right now” as a profile. Switching lists what would be parked and restored first; files move only after you confirm, and it can be undone.',
      profilesNow: '{n} installed skills enabled',
      profilesActive: 'matches “{name}”',
      profilesEmpty: 'No profiles yet. Set the skills up for one kind of work, then press “Save current”.',
      profileCount: '{n} skills',
      profileSwitch: 'Switch',
      profileRename: 'Rename',
      profileOverwrite: 'Overwrite',
      profileOverwriteTip: 'Update this profile to the skills enabled right now',
      profileDelete: 'Delete this profile (no skill is moved)',
      profileDeleteConfirm: 'Confirm delete',
      profileSave: 'Save current',
      profileNamePlaceholder: 'Profile name, e.g. coding / video / writing',
      profileLast: 'Last switched to “{name}”',
      profileUndo: 'Undo this switch',
      profilePreviewTitle: 'Switching to “{name}” will:',
      profileWillPark: 'park {n}',
      profileWillRestore: 'restore {n}',
      profileKeepNew: 'keep {n} newly installed (in no profile)',
      profileKeepInUse: 'keep {n} another conversation is using',
      profileMissing: 'not find {n} (uninstalled)',
      profileNothing: 'Already on this profile; nothing to move.',
      profileConfirm: 'Confirm switch',
      profileApplying: 'Switching…',
      profileBack: 'Back',
      profileDone: 'Switched: parked {parked}, restored {restored}.',
      profilePartFailed: 'Some could not be moved: {names}',
      profileClose: 'Close',
      profileNameEmpty: 'Name cannot be empty',
      profileNameTaken: 'A profile with this name already exists',
      profileLimit: 'Too many profiles (30 max); delete some first',
      profilePlanExpired: 'This preview expired; press “Switch” again',
      profileNothingToUndo: 'Nothing to undo',
      profileFailed: 'Failed: {reason}',
      inUseTitle: 'This skill is in use in another conversation',
      inUseMessage: '{sessions} is using it. Parking moves the skill folder away: that conversation cannot call it next turn, and while the instructions it already read stay, the scripts, templates and docs it ships will be missing and may break mid-task. Park anyway?',
      inUseConfirm: 'Park anyway',
      parkSkippedInUse: 'Skipped because another conversation is using them: {names}',
      whyInUse: 'In use: {sessions}',
      consentTitle: 'Let PULSE use your model for background tasks?',
      consentBody: 'When enabled, these send content to the default model you picked in DSH (through DSH’s model service, to your configured provider):',
      consentTranslate: 'Auto-translate: names and descriptions of new skills / tools',
      consentGoal: 'Goal suggestion: the last few turns of the session (up to ~3000 characters), only when there is no goal',
      consentIdeas: 'Idea collection: turns that list next steps or say “later”',
      consentCost: 'Each is one short request and uses your account’s tokens. You can turn it off in settings at any time; buttons you press yourself (translate now, check what got done, collect from past sessions) are not affected.',
      consentAllow: 'Enable',
      consentDecline: 'No thanks',
      consentToggle: 'Allow PULSE to use the default model for background tasks (translation, goal suggestion, idea collection; sends the related content and uses tokens)',
      goalIdeaTip: 'The latest idea not done yet; make it the goal and it is marked done when the goal is',
      collectIdeasToggle: 'Collect ideas and branches after each turn (directions the assistant suggested, things you said to do later)',
      ideaTitle: 'Ideas & branches',
      ideaCounts: '{open} to do · {done} done',
      ideaBarCount: 'Ideas {n}',
      ideaAdd: '+ Note',
      ideaAddPlaceholder: 'Something to do later…',
      ideaCheck: 'Check what got done',
      ideaBackfill: 'Collect from past sessions',
      ideaBackfillStart: 'Start',
      ideaEstimate: 'This project has {sessions} sessions; {turns} turns list directions, about {calls} model calls.',
      ideaEstimateNone: 'No direction lists found in this project’s {sessions} sessions.',
      ideaBackfilling: 'Collecting from history: {done}/{total} batches, {added} new',
      ideaBackfilled: 'History collected, {added} new',
      ideaCapturing: 'Collecting ideas from this turn…',
      ideaChecking: 'Checking recent turns for ideas already done…',
      ideaFailed: 'Failed: {reason}',
      ideaEmpty: 'No ideas yet. When the assistant lists next steps or you say “later”, they are collected here.',
      ideaDoneList: '{n} done',
      ideaDoing: 'In progress',
      ideaMaybeDone: 'Maybe done',
      ideaConfirmDone: 'Confirm done',
      ideaNotDone: 'No',
      ideaToGoal: 'Make goal',
      ideaDrop: 'Dismiss',
      ideaJump: 'Jump to the conversation',
      ideaFromAssistant: 'Assistant',
      ideaFromUser: 'You',
      ideaFromHistory: 'History',
      ideaFromManual: 'Note',
      sfxToggle: 'Sound effects (synthesized live, no game audio)',
      sfxVolume: 'Volume',
      'sfx.click': 'Click',
      'sfx.expand': 'Expand',
      'sfx.collapse': 'Collapse',
      'sfx.open': 'Open panel',
      'sfx.done': 'Done',
      'sfx.ignite': 'Start working',
      versionMismatch: 'The panel is {client} but the plugin host running inside DSH is still {host}, so new features will fail. Quit DSH completely (tray icon → Quit, not just closing the window) and open it again.',
      hostOutdatedShort: 'The host is still the old version: quit DSH completely and reopen it',
      goalTagProposal: 'Proposed',
      inferGoalToggle: 'With no goal, let the default model suggest one from recent turns (it only counts once confirmed)',
      editorSaveFailed: 'Not saved: {reason}',
      editorTooLong: 'At most {n} characters',
      echoDetailFailed: 'Could not load this Echo. Try again shortly.',
      editorNameTitle: 'Rename this item',
      editorDescTitle: 'Edit this item description',
      callsRound: 'This session',
      callsTotal: 'Session total',
      callsLast: 'Last call',
      callsMs: 'Last duration',
      callsLifetime: 'Across sessions',
      callsNone: 'No cross-session record',
      callsHint: 'Counts only calls this panel has seen',
      menuCopied: 'Copied',
      menuFail: 'Failed',
      pinSkillTip: 'Pinned skills stay enabled; the budget plan will not park them by default',
      unpinSkill: 'Unpin',
      unpinSkillTip: 'Unpin: the budget plan may park this skill',
      pinLib: 'Pin library',
      pinLibTip: 'Pin this library; the budget plan leaves it alone by default',
      unpinLib: 'Unpin library',
      unpinLibTip: 'Unpin: the budget plan may touch this library',
      callSkill: 'Call',
      callSkillTip: 'Insert this skill into the composer (/name)',
      openSkillsDir: 'Folder',
      openSkillsDirTip: 'Open the local skills folder in Explorer',
      restoreLib: 'Restore library',
      restoringLib: 'Restoring…',
      restoreLibTip: 'Move every parked skill in this library back to the skills directory',
      restoreLibFailed: 'Library restore failed',
      searchPlaceholder: 'Search skills: script studio…',
      searchHint: 'Space-separated, any term matches',
      searchResults: 'Results',
      searchEmpty: 'No match. Try different or fewer words.',
      searchCold: 'cold',
      searchInstalled: 'not mounted',
      searchCatalog: 'catalog only',
      catalogUnavailable: 'Installation or availability is unverified; cannot invoke from here',
      insert: 'Insert',
      insertTip: 'Insert /skill-name, or a tool id',
      insertFailed: 'No composer found. Open a session, or drag the result in.',
      restoreFailed: 'Enable failed',
      clear: 'Clear',
      rightHint: 'To watch it beside the chat: open the right sidebar and pick "Running" under "New tab".',
    }

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

    /* 只使用 --dsw-alias-* 主题令牌。
     * 动效分档：MOTION 常量将来可以改成插件 Config（full / subtle / off）。
     * 当前档位 = subtle：一段极轻的扫描带 + 阶梯进场 + 活跃点脉冲，
     * 全部只动 transform / opacity（合成器线程），不动 width/height/filter/box-shadow。 */
    var MOTION = 'subtle'

    var CSS = [
      '.__rp_root{position:relative;height:100%;overflow:hidden;box-sizing:border-box;color:var(--dsw-alias-label-primary);font-size:18px;line-height:1.55;background:linear-gradient(180deg,color-mix(in srgb,var(--dsw-alias-bg-base) 84%,#000) 0,var(--dsw-alias-bg-base) 72%);container-type:inline-size;--rp-frost-rgb:255,255,255;--rp-frost-alpha:.06;--rp-frost-blur:20px;--rp-frost-saturate:140%;--rp-frost-border:rgba(255,255,255,.10)}',
      '.__rp_root[data-studio="1"]{background:#111416}',
      /* 纸白：整层重映射。琥珀/沙/锈都要压到 ≥4.5:1（文字）或 ≥3:1（图形），
       * 背景层、遮罩、警告/错误色跟着换，否则沿用暗色主题的令牌会白底白字。 */
      '.__rp_root[data-studio="1"][data-studio-light="1"]{background:#f4f2ed;--rp-frost-rgb:120,112,100;--rp-frost-border:rgba(20,24,28,.18);--rp-amber:#a04c00;--rp-teal:#22736e;--rp-rust:#a63c22;--rp-slate:#45688f;--rp-sand:#8a6414;--dsw-alias-label-primary:#1b1f24;--dsw-alias-label-secondary:#4a545c;--dsw-alias-label-tertiary:#5b646c;--dsw-alias-border-l1:rgba(20,24,28,.16);--dsw-alias-border-l2:rgba(20,24,28,.34);--dsw-alias-bg-layer-1:rgba(20,24,28,.06);--dsw-alias-bg-layer-2:rgba(20,24,28,.10);--dsw-alias-bg-base:#f4f2ed;--dsw-alias-bg-overlay:#fffdf7;--dsw-alias-brand-primary:#a04c00;--dsw-alias-state-warn-primary:#8a5a00;--dsw-alias-state-error-primary:#b3261a;--dsw-alias-state-idle-primary:#6f767e}',
      /* 纸白下不再用透明度做次级层次：0.45–0.8 的淡出会把正文压到 3:1 以下。层次交给字号/字重/灰度。 */
      '.__rp_root[data-studio="1"][data-studio-light="1"] :is(.__rp_nameAlt,.__rp_desc,.__rp_row[data-state=idle] .__rp_desc,.__rp_empty,.__rp_groupTags,.__rp_legendLabel,.__rp_legendNote,.__rp_telemetryFoot,.__rp_heroCap,.__rp_echoTime,.__rp_echoMeta,.__rp_echoNote,.__rp_echoGone,.__rp_echoMore,.__rp_resultAlt,.__rp_resultDesc,.__rp_libCount,.__rp_sheetHint){opacity:1}',
      '.__rp_root[data-studio="1"][data-studio-light="1"] .__rp_chip[data-phase="spent"],.__rp_root[data-studio="1"][data-studio-light="1"] .__rp_libPark,.__rp_root[data-studio="1"][data-studio-light="1"] .__rp_rowPark{opacity:.9}',
      '.__rp_root[data-studio="1"][data-studio-light="1"] .__rp_searchInput::placeholder,.__rp_root[data-studio="1"][data-studio-light="1"] .__rp_echoSearchInput::placeholder{opacity:.9}',
      /* DSH 亮色主题：整层换成纸白令牌。判定在 JS 里做（data-rp-scheme），
       * 这里只负责把颜色压到可读区间：正文 ≥4.5:1，图形 ≥3:1。 */
      'html[data-rp-scheme="light"] :is(.__rp_root,.__rp_plan,.__rp_confirm,.__rp_sheet,.__rp_corner){--rp-amber:#a04c00;--rp-teal:#22736e;--rp-rust:#a63c22;--rp-slate:#45688f;--rp-sand:#8a6414;--rp-frost-rgb:255,255,255;--rp-frost-alpha:.55;--rp-frost-border:rgba(20,24,28,.14);--dsw-alias-label-primary:#1b1f24;--dsw-alias-label-secondary:#4a545c;--dsw-alias-label-tertiary:#5b646c;--dsw-alias-border-l1:rgba(20,24,28,.16);--dsw-alias-border-l2:rgba(20,24,28,.34);--dsw-alias-bg-layer-1:rgba(20,24,28,.05);--dsw-alias-bg-layer-2:rgba(20,24,28,.09);--dsw-alias-bg-base:#f4f2ed;--dsw-alias-bg-overlay:#fffdf7;--dsw-alias-brand-primary:#a04c00;--dsw-alias-state-warn-primary:#8a5a00;--dsw-alias-state-error-primary:#b3261a;--dsw-alias-state-idle-primary:#6f767e;color:#1b1f24}',
      'html[data-rp-scheme="light"] .__rp_root,html[data-rp-scheme="light"] .__rp_root[data-studio="1"]{background:linear-gradient(180deg,#faf8f3 0,#f2efe7 55%,#ece7dd 100%);color:#1b1f24}',
      'html[data-rp-scheme="light"] :is(.__rp_confirm,.__rp_sheet){background:#fbf9f4;color:#1b1f24;border-color:rgba(20,24,28,.24)}',
      'html[data-rp-scheme="light"] .__rp_root :is(.__rp_nameAlt,.__rp_desc,.__rp_empty,.__rp_groupTags,.__rp_legendLabel,.__rp_legendNote,.__rp_telemetryFoot,.__rp_heroCap,.__rp_echoMeta,.__rp_echoNote,.__rp_resultAlt,.__rp_resultDesc,.__rp_libCount,.__rp_sheetHint){opacity:1}',
      'html[data-rp-scheme="light"] .__rp_root .__rp_chip[data-phase="spent"],html[data-rp-scheme="light"] .__rp_root .__rp_libPark,html[data-rp-scheme="light"] .__rp_root .__rp_rowPark{opacity:.92}',
      '.__rp_studioCanvas{position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;display:block}',
      '.__rp_surface{position:absolute;inset:0;z-index:1;pointer-events:none}',
      '.__rp_scroll{height:100%;overflow:auto;box-sizing:border-box;padding:20px 22px 40px}',
      '.__rp_scanWrap{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:3;contain:strict}',
      '.__rp_root[data-effect-scan="off"] .__rp_scanWrap{display:none!important}',
      '.__rp_root[data-effect-reveal="off"] .__rp_inner > *{animation:none!important}',
      '.__rp_root[data-effect-flow="off"] .__rp_flowBand,.__rp_root[data-effect-flow="off"] .__rp_contourAlt{animation:none!important}',
      '.__rp_root[data-effect-window="off"] .__rp_fx,.__rp_root[data-effect-window="off"] .__rp_fx::before,.__rp_root[data-effect-window="off"] .__rp_fx::after{animation:none!important;transition:none!important}',
      '.__rp_root[data-effect-status="off"] .__rp_dot,.__rp_root[data-effect-status="off"] .__rp_pendingDot,.__rp_root[data-effect-status="off"] .__rp_budgetArc[data-over="1"]{animation:none!important}',
      '.__rp_scanBar{height:100%;transform:translateY(-100%);will-change:transform;opacity:.28;animation:rp-scan 12s linear infinite;background:linear-gradient(to bottom,transparent 0%,transparent 48.5%,color-mix(in srgb,var(--rp-amber) 6%,transparent) 50%,transparent 51.5%,transparent 100%)}',
      '@keyframes rp-scan{0%{transform:translateY(-100%)}100%{transform:translateY(100%)}}',
      '@keyframes rp-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
      '@keyframes rp-pulse{0%,100%{opacity:1;transform:translateY(-1px) scale(1)}50%{opacity:.42;transform:translateY(-1px) scale(1.45)}}',
      '.__rp_inner{max-width:920px;margin:0 auto;display:flex;flex-direction:column;gap:16px}',
      '.__rp_inner > *{animation:rp-in .24s cubic-bezier(.2,.7,.3,1) both}',
      '.__rp_inner > *:nth-child(1){animation-delay:0ms}',
      '.__rp_inner > *:nth-child(2){animation-delay:40ms}',
      '.__rp_inner > *:nth-child(3){animation-delay:80ms}',
      '.__rp_inner > *:nth-child(4){animation-delay:120ms}',
      '.__rp_inner > *:nth-child(5){animation-delay:160ms}',
      '.__rp_inner > *:nth-child(6){animation-delay:200ms}',
      '.__rp_inner > *:nth-child(7){animation-delay:240ms}',
      '.__rp_inner > *:nth-child(8){animation-delay:280ms}',
      '.__rp_inner > *:nth-child(n+9){animation-delay:300ms}',
      '.__rp_root[data-motion=off] .__rp_scanWrap{display:none}',
      '.__rp_root[data-motion=off] .__rp_inner > *{animation:none}',
      '.__rp_root[data-motion=off] .__rp_dot{animation:none}',
      '@media (prefers-reduced-motion:reduce){.__rp_scanWrap{display:none}.__rp_inner > *{animation:none!important}.__rp_dot{animation:none!important}}',
      '.__rp_head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}',
      '.__rp_title{margin:0;font-size:16px;font-weight:600}',
      '.__rp_sub{color:var(--dsw-alias-label-secondary);font-size:18px}',
      '.__rp_chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:2px;padding:2px 10px;font-size:13px;letter-spacing:.12em;color:var(--dsw-alias-label-secondary);white-space:nowrap;clip-path:polygon(0 0,calc(100% - 7px) 0,100% 7px,100% 100%,0 100%)}',
      '.__rp_chip[data-phase=active]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}',
      '.__rp_chip[data-phase=spent]{opacity:.65}',
      '.__rp_meta{display:flex;gap:14px;flex-wrap:wrap;color:var(--dsw-alias-label-secondary);font-size:15.5px}',
      '.__rp_stats{display:flex;gap:12px;flex-wrap:wrap}',
      '.__rp_stat{display:flex;flex-direction:column;gap:2px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:6px 12px;min-width:96px;background:var(--dsw-alias-bg-layer-1)}',
      '.__rp_statValue{font-size:18px;font-weight:600;line-height:1.2}',
      '.__rp_statLabel{font-size:15.5px;color:var(--dsw-alias-label-secondary)}',
      '.__rp_group{background:rgba(var(--rp-frost-rgb),var(--rp-frost-alpha));-webkit-backdrop-filter:blur(var(--rp-frost-blur)) saturate(var(--rp-frost-saturate));backdrop-filter:blur(var(--rp-frost-blur)) saturate(var(--rp-frost-saturate));border:1px solid var(--rp-frost-border);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;content-visibility:auto;contain-intrinsic-size:auto 240px}',
      '.__rp_groupHead{display:flex;align-items:baseline;gap:8px}',
      '.__rp_groupTitle{margin:0;font-size:18px;font-weight:600}',
      '.__rp_groupCount{font-size:15.5px;color:var(--dsw-alias-label-secondary)}',
      '.__rp_unobservable{font-size:15.5px;border:1px solid var(--dsw-alias-state-warn-primary);color:var(--dsw-alias-state-warn-primary);border-radius:999px;padding:0 8px}',
      '.__rp_section{margin-left:2px;display:flex;flex-direction:column;gap:2px}',
      '.__rp_sectionTitle{font-size:15.5px;letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-secondary);margin:6px 0 2px}',
      '.__rp_row{display:flex;align-items:baseline;gap:8px;font-variant-numeric:tabular-nums;padding:5px 8px;border-radius:6px;min-height:28px;line-height:1.35;transition:transform .16s cubic-bezier(.22,1,.36,1),background .16s ease-out}',
      '.__rp_row:hover{transform:translateY(-1px);z-index:5}',
      '.__rp_row:focus-within{z-index:5}',
      '.__rp_row:active{transform:translateY(0) scale(.997)}',
      '.__rp_row[data-state=active]{background:var(--dsw-alias-bg-layer-2)}',
      '.__rp_dot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-idle-primary);opacity:.5;transform:translateY(-1px)}',
      '.__rp_row[data-state=active] .__rp_dot,.__rp_card[data-running="1"] .__rp_dot{background:var(--dsw-alias-brand-primary);opacity:1;box-shadow:0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, transparent);animation:rp-pulse 2.4s ease-in-out infinite}',
      '.__rp_row[data-state=spent] .__rp_dot{opacity:.28}',
      '.__rp_row[data-warn="1"] .__rp_dot,.__rp_card[data-warn="1"] .__rp_dot{background:var(--dsw-alias-state-warn-primary);opacity:1}',
      '.__rp_name{flex:none;font-weight:500;font-size:18px;color:var(--dsw-alias-label-secondary)}',
      '.__rp_row[data-state=active] .__rp_name{color:var(--dsw-alias-label-primary)}',
      '.__rp_desc{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15.5px;color:var(--dsw-alias-label-secondary);opacity:.8}',
      '.__rp_row[data-state=idle] .__rp_desc{opacity:.55}',
      '.__rp_rowMeta{flex:none;font-size:15.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap}',
      '.__rp_costTag{flex:none;margin-left:auto;font-size:11px;color:color-mix(in srgb,var(--rp-amber) 82%,var(--dsw-alias-label-secondary));border:1px solid color-mix(in srgb,var(--rp-amber) 28%,transparent);border-radius:3px;padding:0 4px;white-space:nowrap}',
      '.__rp_row[data-state=active] .__rp_rowMeta{color:var(--dsw-alias-brand-primary)}',
      '.__rp_warnTag{font-size:13px;color:var(--dsw-alias-state-warn-primary);white-space:nowrap}',
      '.__rp_card{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:10px 12px;display:flex;flex-direction:column;gap:6px}',
      '.__rp_card[data-running="1"]{border-color:color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, var(--dsw-alias-border-l1))}',
      '.__rp_cardHead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.__rp_cardTitle{font-size:18px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:52%}',
      '.__rp_cardId{font-size:15.5px;color:var(--dsw-alias-label-secondary);font-family:ui-monospace,Consolas,monospace}',
      '.__rp_calls{display:flex;flex-direction:column;gap:1px;margin-left:15px}',
      '.__rp_call{display:flex;align-items:baseline;gap:8px;padding:2px 6px;border-radius:5px;font-size:18px}',
      '.__rp_callName{font-weight:500}',
      '.__rp_callCount{font-size:15.5px;color:var(--dsw-alias-brand-primary)}',
      '.__rp_callAt{margin-left:auto;font-size:15.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap}',
      '.__rp_child{border-left:2px solid var(--dsw-alias-border-l2);padding-left:10px;margin:2px 0 2px 2px;display:flex;flex-direction:column;gap:3px}',
      '.__rp_childHead{display:flex;align-items:center;gap:8px}',
      '.__rp_caret{border:none;background:none;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:15.5px;padding:0 2px;line-height:1}',
      '.__rp_caret:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
      '.__rp_childLabel{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:18px}',
      '.__rp_childTools{margin:2px 0 4px 18px;display:flex;flex-direction:column;gap:1px}',
      '.__rp_empty{font-size:15.5px;color:var(--dsw-alias-label-secondary);opacity:.75;padding:2px 6px}',
      '.__rp_note{font-size:15.5px;color:var(--dsw-alias-label-secondary);padding:2px 0}',
      '.__rp_notes{border-top:1px solid var(--dsw-alias-border-l1);padding-top:10px;display:flex;flex-direction:column;gap:2px}',
      '.__rp_alert{border:1px solid var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);border-radius:8px;padding:8px 10px;font-size:18px}',
      '.__rp_warnBox{font-size:15.5px;color:var(--dsw-alias-state-warn-primary)}',
      '.__rp_versionWarn{display:block;margin:6px 0 4px;padding:6px 10px;font-size:13px;line-height:1.5;border:1px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary) 55%,transparent);border-left-width:3px;border-radius:3px;background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 9%,transparent)}',
      '.__rp_icon{display:block}',
      '.__rp_tabTitle{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.__rp_rightHint{font-size:15.5px;color:var(--dsw-alias-label-secondary);opacity:.85;display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.__rp_linkBtn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:6px;padding:2px 9px;font:inherit;font-size:15.5px;cursor:pointer}',
      '.__rp_linkBtn:hover{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}',
      '.__rp_linkBtn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
      '.__rp_headerBtn{display:inline-flex;align-items:center;gap:5px;border:1px solid transparent;background:none;color:var(--dsw-alias-label-secondary);border-radius:6px;padding:2px 7px;font:inherit;font-size:18px;cursor:pointer;line-height:1.4}',
      '.__rp_headerBtn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}',
      '.__rp_headerBtn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
      '.__rp_headerBtn[data-failed="1"]{color:var(--dsw-alias-state-warn-primary)}',
      '.__rp_groupTags{font-size:13px;color:var(--dsw-alias-label-secondary);opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.__rp_pinned{border-top-color:var(--dsw-alias-brand-primary)}',
      '.__rp_pinned .__rp_groupTitle{color:var(--dsw-alias-brand-primary)}',
      '.__rp_pinned .__rp_row{background:var(--dsw-alias-bg-layer-1)}',

      /* ── 战术调色：图形用饱和色，文字用「往主题前景色混」的版本，明暗主题都能读 ── */
      '.__rp_root{--rp-amber:#ff7f00;--rp-teal:#2f8f8d;--rp-rust:#b8452a;--rp-slate:#5f7fa8;--rp-sand:#e8b93c}',
      '.__rp_pinned{border-top-color:color-mix(in srgb,var(--rp-amber) 60%,transparent)}',
      '.__rp_pinned .__rp_groupTitle{color:color-mix(in srgb,var(--rp-amber) 85%,var(--dsw-alias-label-primary))}',
      '.__rp_pinned .__rp_row[data-state=active]{background:color-mix(in srgb,var(--rp-amber) 9%,transparent)}',
      '.__rp_pinned .__rp_groupTags{color:color-mix(in srgb,var(--rp-amber) 70%,var(--dsw-alias-label-secondary))}',
      '.__rp_row[data-state=active] .__rp_dot,.__rp_card[data-running="1"] .__rp_dot{background:var(--rp-amber);box-shadow:0 0 0 3px color-mix(in srgb,var(--rp-amber) 20%,transparent)}',
      '.__rp_row[data-warn="1"] .__rp_dot,.__rp_card[data-warn="1"] .__rp_dot{background:var(--rp-rust)}',
      '.__rp_chip[data-phase=active]{border-color:color-mix(in srgb,var(--rp-amber) 65%,transparent);color:color-mix(in srgb,var(--rp-amber) 80%,var(--dsw-alias-label-primary))}',
      '.__rp_row[data-state=active] .__rp_rowMeta{color:color-mix(in srgb,var(--rp-amber) 80%,var(--dsw-alias-label-primary))}',
      '.__rp_callCount{color:color-mix(in srgb,var(--rp-amber) 80%,var(--dsw-alias-label-primary))}',
      '.__rp_linkBtn:hover,.__rp_headerBtn:hover{color:color-mix(in srgb,var(--rp-amber) 80%,var(--dsw-alias-label-primary));border-color:color-mix(in srgb,var(--rp-amber) 55%,transparent)}',
      '.__rp_linkBtn:focus-visible,.__rp_headerBtn:focus-visible,.__rp_caret:focus-visible{outline:2px solid var(--rp-amber);outline-offset:2px}',

      /* 名称：中文名 + 英文名同排；描述只在悬停时贴着这一行下方出现 */
      '.__rp_nameAlt{font-size:13px;color:var(--dsw-alias-label-secondary);opacity:.62;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:24ch;flex:none}',
      '.__rp_row{position:relative}',
      '.__rp_row[data-desc]:hover{background:color-mix(in srgb,var(--rp-amber) 7%,transparent)}',
      '.__rp_tipLayer{position:fixed;left:0;top:0;z-index:2147483000;box-sizing:border-box;max-width:min(46ch,340px);padding:6px 9px;border-radius:5px;background-color:var(--dsw-alias-bg-overlay);background-image:linear-gradient(var(--dsw-alias-bg-overlay),var(--dsw-alias-bg-overlay));color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);box-shadow:0 10px 26px rgba(0,0,0,.45);-webkit-backdrop-filter:blur(8px) saturate(130%);backdrop-filter:blur(8px) saturate(130%);font-size:12.5px;line-height:1.45;white-space:normal;pointer-events:none;opacity:0;transition:opacity .12s ease}',
      '.__rp_tipLayer[data-open="1"]{opacity:1}',

      /* 英雄区：大圆盘居中，鼠标在面板里时轻微倾斜 */
      '.__rp_contour{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;color:var(--dsw-alias-label-primary);opacity:.035;-webkit-mask-image:radial-gradient(125% 108% at 50% 44%,#000 34%,rgba(0,0,0,.55) 58%,transparent 82%);mask-image:radial-gradient(125% 108% at 50% 44%,#000 34%,rgba(0,0,0,.55) 58%,transparent 82%);animation:rp-drift 45s ease-in-out infinite alternate}',
      '.__rp_contourSvg{width:100%;height:100%;display:block}',
      '.__rp_contourAlt{opacity:.02;animation:rp-drift2 120s ease-in-out infinite alternate}',
      /* 战术风格底：把等高线场压成几乎看不见的纹理，让圆盘成为唯一焦点 */
      '.__rp_studioCanvas{opacity:.22;transition:opacity .3s ease-out}',
      '.__rp_root[data-studio-light="1"] .__rp_studioCanvas{opacity:.3}',
      '.__rp_flow{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;opacity:.3;mask-repeat:no-repeat;mask-size:cover;mask-position:center;-webkit-mask-repeat:no-repeat;-webkit-mask-size:cover;-webkit-mask-position:center}',
      '.__rp_flowBand{position:absolute;top:-10%;bottom:-10%;left:-40%;width:40%;background:linear-gradient(90deg,rgba(255,127,0,0),rgba(255,127,0,.9) 50%,rgba(255,127,0,0));will-change:transform;animation:rp-flow-slide 11s linear infinite}',
      '@keyframes rp-flow-slide{from{transform:translateX(-100%)}to{transform:translateX(350%)}}',
      '@media (prefers-reduced-motion:reduce){.__rp_flowBand{animation:none;transform:translateX(70%)}}',
      '.__rp_root[data-motion=off] .__rp_flowBand{animation:none;transform:translateX(70%)}',
      '.__rp_gl{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;mask-image:radial-gradient(125% 108% at 50% 44%,#000 36%,transparent 84%);-webkit-mask-image:radial-gradient(125% 108% at 50% 44%,#000 36%,transparent 84%)}',
      '@keyframes rp-drift2{from{transform:translate3d(2%,1.4%,0) scale(1.05)}to{transform:translate3d(-2%,-1.6%,0) scale(1.12)}}',
      '@keyframes rp-drift{from{transform:translate3d(-2.5%,-1.5%,0)}to{transform:translate3d(2.5%,1.5%,0)}}',
      '.__rp_scroll{position:relative;z-index:2}',
      '.__rp_budgetArc{stroke:var(--rp-amber);opacity:.85}',
      '.__rp_budgetArc[data-warn="1"]{stroke:var(--rp-rust)}',
      '.__rp_budgetArc[data-over="1"]{stroke:var(--rp-rust);animation:rp-budget-pulse 2.6s ease-in-out infinite}',
      '@keyframes rp-budget-pulse{0%,100%{opacity:.85}50%{opacity:.35}}',
      '.__rp_budgetTrackInner{stroke:var(--dsw-alias-border-l2);opacity:.3}',
      '.__rp_budgetLine{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--dsw-alias-label-secondary);opacity:.85;font-variant-numeric:tabular-nums}',
      '.__rp_optimize{border:1px solid var(--rp-rust);background:color-mix(in srgb,var(--rp-rust) 18%,transparent);color:color-mix(in srgb,var(--rp-rust) 70%,var(--dsw-alias-label-primary));border-radius:4px;font-size:13px;letter-spacing:.08em;padding:2px 10px;cursor:pointer;line-height:1.4;font-weight:600}',
      '.__rp_optimize:hover{background:color-mix(in srgb,var(--rp-rust) 32%,transparent)}',
      '.__rp_caret,.__rp_optimize,.__rp_segBtn,.__rp_linkBtn,.__rp_headerBtn{transition:transform 150ms ease-out,background-color 150ms ease-out,border-color 150ms ease-out,color 150ms ease-out}',
      '.__rp_caret:active,.__rp_optimize:active,.__rp_segBtn:active,.__rp_linkBtn:active,.__rp_headerBtn:active{transform:scale(.96)}',
      '.__rp_heroRow{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:10px;width:100%}',
      '.__rp_side{display:flex;flex-direction:column;gap:3px;min-width:0}',
      '.__rp_sideLeft{align-items:flex-start;text-align:left}',
      '.__rp_sideRight{align-items:flex-end;text-align:right}',
      '.__rp_sideLabel{font-size:15px;font-weight:600;letter-spacing:.02em;color:var(--dsw-alias-label-primary);opacity:.92;margin-bottom:5px;line-height:1.2}',
      '.__rp_sideValue{font-size:18px;font-weight:600;line-height:1.1;color:var(--rp-amber);font-variant-numeric:tabular-nums}',
      '.__rp_sideSub{font-size:12px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
      '.__rp_sideRight .__rp_optimize{margin-top:4px}',
      /* 预算方案弹层：大窗 + 两栏（左保留 / 右停用），点条目在两栏之间移动 */
      '.__rp_planWrap{position:fixed;inset:0;z-index:430;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.55)}',
      '.__rp_plan{width:min(760px,96vw);height:min(80vh,680px);display:flex;flex-direction:column;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;box-shadow:0 18px 60px rgba(0,0,0,.6);overflow:hidden}',
      '.__rp_planHead{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 16px 8px}',
      '.__rp_planTitle{font-size:16px;font-weight:600;letter-spacing:.04em}',
      '.__rp_planClose{width:28px;height:28px;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:15px;cursor:pointer}',
      '.__rp_planClose:hover{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}',
      '.__rp_planMeta{display:flex;justify-content:space-between;gap:8px;padding:0 16px 10px;font-size:12.5px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
      '.__rp_planSaved{color:color-mix(in srgb,var(--rp-amber) 85%,var(--dsw-alias-label-primary))}',
      '.__rp_planBody{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;gap:8px;padding:0 16px 12px}',
      '.__rp_planDual{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:1fr 1fr;gap:12px}',
      '.__rp_planCol{display:flex;flex-direction:column;min-height:0;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:hidden}',
      '.__rp_planColHead{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);font-size:12px;letter-spacing:.04em;color:var(--dsw-alias-label-secondary)}',
      '.__rp_planColList{flex:1 1 auto;min-height:0;overflow:auto;padding:4px}',
      '.__rp_planItem{display:flex;align-items:baseline;gap:8px;width:100%;min-width:0;border:none;border-radius:6px;background:transparent;color:inherit;font:inherit;font-size:13px;text-align:left;padding:6px 8px;cursor:pointer}',
      '.__rp_planItem:hover{background:color-mix(in srgb,var(--rp-amber) 8%,transparent)}',
      '.__rp_planItem:focus-visible{outline:2px solid var(--rp-amber);outline-offset:-2px}',
      '.__rp_planItem[data-locked="1"]{opacity:.5;cursor:default}',
      '.__rp_planItem[data-locked="1"]:hover{background:transparent}',
      '.__rp_planItemName{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.__rp_planItemMeta{flex:none;font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap}',
      '.__rp_planItemChars{flex:none;font-size:11px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
      '.__rp_planItem[data-parked="1"] .__rp_planItemChars{color:color-mix(in srgb,var(--rp-rust) 85%,var(--dsw-alias-label-primary))}',
      '.__rp_planPin{flex:none;font-size:11px;color:var(--rp-amber)}',
      '.__rp_planLock{flex:none;font-size:10px}',
      '.__rp_planEmpty{font-size:12px;color:var(--dsw-alias-label-secondary);padding:10px 8px}',
      '.__rp_planBar{position:relative;flex:none;height:10px;border-radius:3px;background:color-mix(in srgb,var(--rp-rust) 32%,transparent);overflow:hidden}',
      '.__rp_planBarFill{position:absolute;left:0;top:0;bottom:0;background:color-mix(in srgb,var(--rp-amber) 78%,transparent)}',
      '.__rp_planBarRest{position:absolute;right:0;top:0;bottom:0;width:2px;background:var(--rp-rust)}',
      '.__rp_planBarLabel{display:flex;flex:none;justify-content:space-between;font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.__rp_planFoot{display:flex;justify-content:flex-end;gap:8px;padding:10px 16px 14px;border-top:1px solid var(--dsw-alias-border-l1)}',
      '.__rp_planApply{min-height:34px;border:1px solid color-mix(in srgb,var(--rp-amber) 60%,transparent);border-radius:6px;background:color-mix(in srgb,var(--rp-amber) 16%,transparent);color:color-mix(in srgb,var(--rp-amber) 88%,var(--dsw-alias-label-primary));font:inherit;font-size:13px;padding:4px 16px;cursor:pointer}',
      '.__rp_planApply:disabled{opacity:.5;cursor:default}',
      '.__rp_planDone{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 16px 14px;border-top:1px solid var(--dsw-alias-border-l1);font-size:12.5px;color:var(--dsw-alias-label-secondary)}',
      '.__rp_planError{font-size:12.5px;color:var(--rp-rust);padding:0 16px 8px}',
      '@media (max-width:640px){.__rp_plan{height:min(86vh,720px)}.__rp_planDual{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) minmax(0,1fr)}}',
      '.__rp_hero{display:flex;flex-direction:column;align-items:center;gap:8px;padding:6px 0 16px;margin-bottom:4px;position:relative}',
      '.__rp_hero::before{content:"";position:absolute;left:50%;top:24%;width:min(72%,420px);height:200px;transform:translate(-50%,-50%);background:radial-gradient(55% 55% at 50% 50%,rgba(255,127,0,.10),transparent 72%);pointer-events:none;z-index:0}',
      '.__rp_hero > *{position:relative;z-index:1}',
      '.__rp_telemetry{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;width:min(100%,560px);margin-top:2px}',
      '.__rp_telemetryCard{position:relative;min-width:0;padding:8px 10px 7px;border:1px solid color-mix(in srgb,var(--rp-amber) 22%,var(--dsw-alias-border-l1));background:linear-gradient(135deg,rgba(255,127,0,.07),rgba(255,127,0,.015));clip-path:polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,0 100%)}',
      '.__rp_telemetryCard::before{content:"";position:absolute;left:0;top:0;width:20px;height:1px;background:color-mix(in srgb,var(--rp-amber) 70%,transparent)}',
      '.__rp_telemetryHead{display:flex;align-items:baseline;gap:6px;min-width:0}',
      '.__rp_telemetryKicker{flex:none;font-size:9px;line-height:1;letter-spacing:.14em;color:var(--rp-amber);font-weight:700}',
      '.__rp_telemetryName{flex:1 1 auto;min-width:0;font-size:12px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.__rp_telemetryValue{flex:none;font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}',
      '.__rp_telemetryBar{height:3px;margin:7px 0 5px;background:color-mix(in srgb,var(--rp-amber) 14%,transparent);overflow:hidden}',
      '.__rp_telemetryBar i{display:block;height:100%;background:repeating-linear-gradient(90deg,var(--rp-amber) 0 6px,transparent 6px 8px)}',
      '.__rp_telemetryFoot{font-size:11px;line-height:1.3;color:var(--dsw-alias-label-secondary);opacity:.8;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.__rp_telemetryIO{display:flex;align-items:baseline;gap:5px;margin-top:7px;font-size:12px;font-variant-numeric:tabular-nums}',
      '.__rp_telemetryIOKey{font-size:9px;letter-spacing:.12em;color:var(--dsw-alias-label-secondary);opacity:.75}',
      '.__rp_telemetryIO b{font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.__rp_heroTop{display:flex;align-items:center;gap:10px}',
      '.__rp_heroCap{font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:var(--dsw-alias-label-secondary);opacity:.65}',
      '.__rp_heroRing{display:flex;justify-content:center;align-items:center;padding:2px 0;align-self:center}',
      '.__rp_heroTilt{--rp-rx:0deg;--rp-ry:0deg;transform:perspective(900px) rotateX(var(--rp-rx)) rotateY(var(--rp-ry));will-change:transform;transform-style:preserve-3d}',
      '.__rp_heroMeta{display:flex;align-items:baseline;gap:10px;font-size:15.5px;color:var(--dsw-alias-label-secondary);max-width:100%;overflow:hidden}',
      '.__rp_heroMeta span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.__rp_ringSvg{display:block;filter:drop-shadow(0 0 12px color-mix(in srgb,var(--rp-amber) 10%,transparent));animation:__rp_ringIn .75s cubic-bezier(.16,1,.3,1) both}',
      '@keyframes __rp_ringIn{from{opacity:0;transform:scale(.965)}to{opacity:1;transform:scale(1)}}',
      '.__rp_ringSpin{transform-origin:50px 50px;animation:__rp_ringSpin 60s linear infinite}',
      '@keyframes __rp_ringSpin{to{transform:rotate(360deg)}}',
      '.__rp_ringCore,.__rp_ringTickBand{transition:opacity .8s ease-out}',
      '.__rp_ringSvg[data-active="0"] .__rp_ringCore{opacity:.07}',
      '.__rp_ringSvg[data-active="0"] .__rp_ringTickBand{opacity:.24}',
      '.__rp_ringSvg[data-active="0"] .__rp_ringSpin{animation-play-state:paused}',
      '.__rp_ringHair{stroke:color-mix(in srgb,var(--rp-amber) 26%,transparent);stroke-width:.35}',
      '.__rp_ringTickBand{stroke:color-mix(in srgb,var(--rp-amber) 52%,transparent);stroke-width:2.4;stroke-dasharray:.45 1.35}',
      '.__rp_ringInnerHair{stroke:color-mix(in srgb,var(--rp-amber) 16%,transparent);stroke-width:.35}',
      '.__rp_root[data-motion=off] .__rp_ringSpin,.__rp_root[data-motion=off] .__rp_ringSvg{animation:none}',
      '@media (prefers-reduced-motion:reduce){.__rp_ringSpin{animation:none}.__rp_ringSvg{animation:none}}',
      /* 对话右上角圆盘：不在面板里，自己带一套 --rp-* 颜色 */
      '.__rp_corner{position:fixed;z-index:30;width:128px;height:128px;border-radius:50%;pointer-events:none;--rp-amber:#ff7f00;--rp-teal:#2f8f8d;--rp-rust:#b8452a;--rp-slate:#5f7fa8;--rp-sand:#e8b93c;background:color-mix(in srgb,var(--dsw-alias-bg-base) 78%,transparent);border:1px solid var(--dsw-alias-border-l1);box-shadow:0 10px 28px rgba(0,0,0,.35);-webkit-backdrop-filter:blur(12px) saturate(120%);backdrop-filter:blur(12px) saturate(120%)}',
      '.__rp_cornerBtn{pointer-events:auto;display:block;width:100%;height:100%;padding:0;border:none;border-radius:50%;background:transparent;cursor:pointer;transition:opacity .15s ease-out}',
      '.__rp_cornerBtn:hover{opacity:.86}',
      '.__rp_cornerBtn:focus-visible{outline:2px solid var(--rp-amber);outline-offset:4px}',
      '.__rp_ringTicks{stroke:var(--dsw-alias-border-l2);stroke-width:.22;stroke-dasharray:.32 6.2;opacity:.16}',
      '.__rp_ringTrack{stroke:var(--dsw-alias-border-l2);opacity:.4}',
      '.__rp_ringSeg[data-cat=visual]{stroke:var(--rp-amber)}',
      '.__rp_ringSeg[data-cat=code]{stroke:var(--rp-teal)}',
      '.__rp_ringSeg[data-cat=thought]{stroke:var(--rp-sand)}',
      '.__rp_ringSeg[data-cat=ops]{stroke:var(--rp-rust)}',
      '.__rp_ringNum{fill:var(--dsw-alias-label-primary);font-size:19px;font-weight:600;text-anchor:middle;font-variant-numeric:tabular-nums}',
      '.__rp_ringCap{fill:var(--dsw-alias-label-secondary);font-size:5.8px;text-anchor:middle;letter-spacing:.1em}',
      '.__rp_legend{display:flex;flex-direction:column;gap:6px;width:100%}',
      '.__rp_legendRow{display:flex;align-items:center;gap:6px;width:100%;justify-content:flex-start}',
      '.__rp_legendChip{width:9px;height:9px;border-radius:2px;flex:none}',
      '.__rp_legendChip[data-cat=visual]{background:var(--rp-amber)}',
      '.__rp_legendChip[data-cat=code]{background:var(--rp-teal)}',
      '.__rp_legendChip[data-cat=thought]{background:var(--rp-sand)}',
      '.__rp_legendChip[data-cat=ops]{background:var(--rp-rust)}',
      '.__rp_legendLabel{font-size:12px;letter-spacing:.06em;color:var(--dsw-alias-label-secondary);opacity:.85}',
      '.__rp_legendValue{margin-left:auto;font-size:13px;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;opacity:.85}',
      '.__rp_legendNote{grid-column:1 / -1;text-align:center;font-size:13px;color:var(--dsw-alias-label-secondary);opacity:.7}',

      /* 浏览器自己的表面也归这套配色 */
      '.__rp_scroll::-webkit-scrollbar{width:9px}',
      '.__rp_scroll::-webkit-scrollbar-track{background:transparent}',
      '.__rp_scroll::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--rp-amber) 28%,transparent);border-radius:5px}',
      '.__rp_scroll::-webkit-scrollbar-thumb:hover{background:color-mix(in srgb,var(--rp-amber) 55%,transparent)}',
      '.__rp_root ::selection{background:color-mix(in srgb,var(--rp-amber) 34%,transparent)}',

      /* 诊断：卡住提示用锈色，和“运行中”的琥珀区分开 */
      '.__rp_alerts{border-top-color:color-mix(in srgb,var(--rp-rust) 60%,transparent)}',
      '.__rp_alerts .__rp_groupTitle{color:color-mix(in srgb,var(--rp-rust) 85%,var(--dsw-alias-label-primary))}',
      '.__rp_alertRow{display:flex;align-items:baseline;gap:8px;font-size:18px;padding:4px 7px;border-radius:6px;background:color-mix(in srgb,var(--rp-rust) 8%,transparent)}',
      '.__rp_alertChip{font-size:13px;color:color-mix(in srgb,var(--rp-rust) 85%,var(--dsw-alias-label-primary));border:1px solid color-mix(in srgb,var(--rp-rust) 55%,transparent);border-radius:999px;padding:0 7px;white-space:nowrap}',

      /* 来源库折叠：一个库一行，展开才看单项 */
      '.__rp_lib{display:flex;flex-direction:column;gap:1px}',
      '.__rp_libRow{display:flex;align-items:center;gap:6px;width:100%;box-sizing:border-box;font:inherit;font-size:18px;line-height:1.5;min-width:0}',
      '.__rp_libToggle{display:flex;align-items:center;gap:8px;flex:1 1 auto;min-width:0;border:none;background:none;color:var(--dsw-alias-label-secondary);font:inherit;padding:3px 6px;border-radius:6px;cursor:pointer;text-align:left}',
      '.__rp_libToggle:hover{background:color-mix(in srgb,var(--rp-amber) 7%,transparent);color:var(--dsw-alias-label-primary)}',
      '.__rp_libToggle:focus-visible{outline:2px solid var(--rp-amber);outline-offset:1px}',
      '.__rp_libToggle[data-active="1"]{color:var(--dsw-alias-label-primary)}',
      '.__rp_libToggle[data-active="1"] .__rp_libName{color:color-mix(in srgb,var(--rp-amber) 80%,var(--dsw-alias-label-primary))}',
      '.__rp_libPark{flex:none;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:1.6;min-height:26px;padding:3px 8px;border-radius:4px;cursor:pointer;opacity:.55;transition:opacity .15s ease-out,border-color .15s ease-out,color .15s ease-out}',
      '.__rp_lib:hover .__rp_libPark,.__rp_lib:focus-within .__rp_libPark{opacity:1}',
      '.__rp_libPark:hover{border-color:color-mix(in srgb,var(--rp-rust) 60%,transparent);color:color-mix(in srgb,var(--rp-rust) 85%,var(--dsw-alias-label-primary))}',
      '.__rp_libPark[data-failed="1"]{border-color:var(--rp-rust);color:var(--rp-rust);opacity:1}',
      '.__rp_libPark:disabled{opacity:.5;cursor:default}',
      /* 冷层库头：整库启用，和「停用整库」同尺寸但走琥珀色，语义不撞车 */
      '.__rp_libRestore{flex:none;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:1.6;min-height:26px;padding:3px 8px;border-radius:4px;cursor:pointer;opacity:.55;transition:opacity .15s ease-out,border-color .15s ease-out,color .15s ease-out}',
      '.__rp_lib:hover .__rp_libRestore,.__rp_lib:focus-within .__rp_libRestore{opacity:1}',
      '.__rp_libRestore:hover{border-color:color-mix(in srgb,var(--rp-amber) 55%,transparent);color:color-mix(in srgb,var(--rp-amber) 85%,var(--dsw-alias-label-primary))}',
      '.__rp_libRestore:focus-visible{outline:2px solid var(--rp-amber);outline-offset:1px}',
      '.__rp_libRestore[data-failed="1"]{border-color:var(--rp-rust);color:var(--rp-rust);opacity:1}',
      '.__rp_libRestore:disabled{opacity:.5;cursor:default}',
      '@container (max-width: 380px){.__rp_libRestore{width:26px;min-width:26px;padding:0;font-size:0}.__rp_libRestore::before{content:"↺";font-size:14px;line-height:1}}',
      '.__rp_rowPark{flex:none;margin-left:auto;align-self:center;border:1px solid var(--dsw-alias-border-l2);border-radius:4px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:1.6;min-height:26px;padding:2px 8px;cursor:pointer;opacity:.45;white-space:nowrap;transition:opacity .15s ease-out,color .15s ease-out,border-color .15s ease-out}',
      '.__rp_row:hover .__rp_rowPark,.__rp_row:focus-within .__rp_rowPark{opacity:1}',
      '.__rp_rowPark:hover{border-color:color-mix(in srgb,var(--rp-rust) 55%,transparent);color:color-mix(in srgb,var(--rp-rust) 85%,var(--dsw-alias-label-primary))}',
      '.__rp_rowPark:focus-visible{outline:2px solid var(--rp-amber);outline-offset:1px}',
      '.__rp_rowPark:disabled{opacity:.3;cursor:default}',
      '.__rp_rowPark[data-failed="1"]{color:var(--rp-rust);opacity:1}',
      /* 图钉：技能行 / 库行；钉住的进核心集，预算方案默认不碰 */
      '.__rp_rowPin{flex:none;margin-left:auto;width:22px;height:22px;padding:0;border:1px solid transparent;border-radius:4px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:1;cursor:pointer;opacity:.5;transition:opacity .15s ease-out,color .15s ease-out,border-color .15s ease-out}',
      '.__rp_row:hover .__rp_rowPin,.__rp_row:focus-within .__rp_rowPin{opacity:1}',
      '.__rp_rowPin:hover{color:color-mix(in srgb,var(--rp-amber) 85%,var(--dsw-alias-label-primary));border-color:color-mix(in srgb,var(--rp-amber) 35%,transparent)}',
      '.__rp_rowPin[data-on="1"]{color:var(--rp-amber);opacity:1}',
      /* 技能行动作条：调用 / 仓库 / 停用；钉住时星标常显，其余悬停才出现 */
      '.__rp_rowActions{position:absolute;right:4px;top:50%;transform:translateY(-50%);z-index:2;display:flex;align-items:center;gap:2px;opacity:0;pointer-events:none;transition:opacity .12s ease-out;padding:2px 4px 2px 8px;border-radius:6px;background:var(--dsw-alias-bg-base)}',
      '.__rp_rowActions::before{content:"";position:absolute;right:100%;top:0;bottom:0;width:20px;background:linear-gradient(90deg,transparent,var(--dsw-alias-bg-base));pointer-events:none}',
      '.__rp_row:hover .__rp_rowActions,.__rp_row:focus-within .__rp_rowActions{opacity:1;pointer-events:auto;background:var(--dsw-alias-bg-base)}',
      '.__rp_rowActions[data-pinned="1"]{opacity:1;background:transparent}',
      '.__rp_rowActions[data-pinned="1"]::before{background:none}',
      '.__rp_rowActions .__rp_rowPin{pointer-events:auto}',
      '.__rp_rowSkill{padding-right:32px}',
      '.__rp_rowSkill .__rp_costTag{transition:opacity .12s ease-out}',
      '.__rp_rowSkill:hover .__rp_costTag,.__rp_rowSkill:focus-within .__rp_costTag{opacity:0}',
      '.__rp_rowActions .__rp_rowPin{margin-left:0}',
      '.__rp_menu{position:fixed;z-index:520;background:#0f1216;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;padding:4px;box-shadow:0 14px 38px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:1px}',
      '.__rp_menuItem{display:flex;align-items:center;width:100%;min-height:28px;padding:0 10px;border:none;border-radius:4px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;text-align:left;cursor:pointer;white-space:nowrap}',
      '.__rp_menuItem:hover{background:color-mix(in srgb,var(--rp-amber) 16%,transparent);color:#fff}',
      '.__rp_menuItem[data-danger="1"]{color:color-mix(in srgb,var(--rp-rust) 85%,var(--dsw-alias-label-primary))}',
      '.__rp_menuItem[data-danger="1"]:hover{background:color-mix(in srgb,var(--rp-rust) 16%,transparent)}',
      '.__rp_editorInput,.__rp_editorArea{width:100%;box-sizing:border-box;margin:2px 0 12px;background:#141a1e;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:8px 10px;resize:vertical}',
      '.__rp_editorInput:focus,.__rp_editorArea:focus{outline:2px solid var(--rp-amber);outline-offset:1px}',
      '.__rp_editorBtn{min-height:30px;padding:0 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer}',
      '.__rp_editorBtn:hover{border-color:color-mix(in srgb,var(--rp-amber) 55%,transparent)}',
      '.__rp_editorBtn[data-primary="1"]{background:var(--rp-amber,#d89140);border-color:var(--rp-amber,#d89140);color:#141719;font-weight:600}',
      '.__rp_editorBtn:disabled{opacity:.45;cursor:default}',
      '.__rp_editorBtn[data-primary="1"][data-danger="1"]{background:var(--rp-rust,#b6462a);border-color:var(--rp-rust,#b6462a);color:#fff}',
      '.__rp_editorError{margin:-6px 0 12px!important;font-size:12px!important;color:var(--rp-rust,#b6462a)!important}',
      /* 浮层 portal 到 body，脱离了 .__rp_root：令牌放在 portal 外壳上，所有浮层都继承得到。 */
      '.__rp_portal{display:contents;--rp-amber:#d89140;--rp-teal:#2f8f8d;--rp-rust:#b6462a;--rp-slate:#5f7fa8;--rp-sand:#e8b93c}',
      /* 深色浮层底色是写死的 #0f1216：文字令牌也要写死，不能跟随可能是浅色的 DSH 主题。 */
      'html:not([data-rp-scheme="light"]) .__rp_portal{--dsw-alias-label-primary:#e7e9ec;--dsw-alias-label-secondary:#a9b0b8;--dsw-alias-label-tertiary:#8a9198;--dsw-alias-border-l1:rgba(255,255,255,.10);--dsw-alias-border-l2:rgba(255,255,255,.18)}',
      '.__rp_menuItem:disabled{opacity:.42;cursor:default}',
      '.__rp_menuItem:disabled:hover{background:transparent;color:var(--dsw-alias-label-primary)}',
      '.__rp_menuItem:focus-visible{outline:none;background:color-mix(in srgb,var(--rp-amber) 16%,transparent)}',
      'html[data-rp-scheme="light"] .__rp_menu{background:#fbf9f4;border-color:rgba(20,24,28,.24);box-shadow:0 14px 38px rgba(20,24,28,.18);--rp-amber:#a04c00;--rp-rust:#a63c22;--dsw-alias-label-primary:#1b1f24}',
      'html[data-rp-scheme="light"] .__rp_menuItem:hover{color:#1b1f24}',
      'html[data-rp-scheme="light"] :is(.__rp_editorInput,.__rp_editorArea){background:#fff;color:#1b1f24;border-color:rgba(20,24,28,.24)}',
      '.__rp_calls{display:flex;flex-direction:column;gap:6px;margin:0 0 10px}',
      '.__rp_callsRow{display:flex;align-items:baseline;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(255,255,255,.06);padding-bottom:5px}',
      '.__rp_callsRow dt{font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.__rp_callsRow dd{margin:0;font-size:13px;font-family:ui-monospace,Consolas,monospace;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}',
      '.__rp_callsHint{font-size:11px;color:var(--dsw-alias-label-secondary);opacity:.75;margin:0 0 12px}',
      '.__rp_rowAct{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:1px solid transparent;border-radius:4px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:15px;line-height:1;text-decoration:none;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .12s ease-out,color .12s ease-out,border-color .12s ease-out,background .12s ease-out}',
      '.__rp_row:hover .__rp_rowAct,.__rp_row:focus-within .__rp_rowAct{opacity:1;pointer-events:auto}',
      '.__rp_rowAct:hover{color:color-mix(in srgb,var(--rp-amber) 85%,var(--dsw-alias-label-primary));border-color:color-mix(in srgb,var(--rp-amber) 35%,transparent);background:color-mix(in srgb,var(--rp-amber) 12%,transparent)}',
      '.__rp_rowAct[data-failed="1"]{color:var(--rp-rust);border-color:var(--rp-rust)}',
      '.__rp_rowAct:focus-visible{outline:2px solid var(--rp-amber);outline-offset:1px}',
      '.__rp_rowPin:focus-visible{outline:2px solid var(--rp-amber);outline-offset:1px}',
      '.__rp_rowPin + .__rp_rowPark{margin-left:0}',
      '.__rp_libPin{flex:none;width:24px;height:24px;padding:0;border:1px solid transparent;border-radius:4px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:1;cursor:pointer;opacity:.55;transition:opacity .15s ease-out,color .15s ease-out,border-color .15s ease-out}',
      '.__rp_lib:hover .__rp_libPin,.__rp_lib:focus-within .__rp_libPin{opacity:1}',
      '.__rp_libPin:hover{color:color-mix(in srgb,var(--rp-amber) 85%,var(--dsw-alias-label-primary));border-color:color-mix(in srgb,var(--rp-amber) 35%,transparent)}',
      '.__rp_libPin[data-on="1"]{color:var(--rp-amber);opacity:1}',
      '.__rp_libPin:focus-visible{outline:2px solid var(--rp-amber);outline-offset:1px}',
      /* 组名是「作者/仓库」，可能很长：名字可收缩省略，计数永远单行贴在后面。 */
      '.__rp_libName{flex:0 1 auto;min-width:0;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.__rp_libCount{flex:none;font-size:13px;opacity:.72;white-space:nowrap}',
      '.__rp_repoBtn{flex:none;display:inline-flex;align-items:center;justify-content:center;gap:4px;height:26px;padding:2px 6px;border:1px solid var(--dsw-alias-border-l2);border-radius:4px;color:var(--rp-amber);font-size:12px;line-height:1.2;text-decoration:none;white-space:nowrap}',
      '.__rp_repoBtn:hover{border-color:var(--rp-amber);background:color-mix(in srgb,var(--rp-amber) 10%,transparent)}',
      '.__rp_repoBtn:focus-visible{outline:2px solid var(--rp-amber);outline-offset:1px}',
      '.__rp_repoIcon{display:block;width:14px;height:14px;flex:none}',
      '.__rp_libBody{margin-left:14px;border-left:1px solid var(--dsw-alias-border-l1);padding-left:8px;display:flex;flex-direction:column;gap:1px}',
      '.__rp_libMore{align-self:flex-start;margin:3px 0 1px;border:1px solid var(--dsw-alias-border-l1);border-radius:4px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;padding:2px 7px;cursor:pointer}',
      '.__rp_libMore:hover{color:var(--rp-amber);border-color:color-mix(in srgb,var(--rp-amber) 45%,transparent)}',

      /* 公告预算条：细、克制，只在超 90% 时转锈色 */
      '.__rp_budget{display:flex;flex-direction:column;gap:4px;padding:2px 2px 6px}',
      '.__rp_budgetHead{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:15.5px}',
      '.__rp_budgetLabel{color:var(--dsw-alias-label-secondary)}',
      '.__rp_budgetValue{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
      '.__rp_budgetValue[data-over="1"]{color:color-mix(in srgb,var(--rp-rust) 85%,var(--dsw-alias-label-primary))}',
      '.__rp_budgetTrack{height:3px;background:var(--dsw-alias-bg-layer-2);border-radius:2px;overflow:hidden}',
      '.__rp_budgetFill{height:100%;background:linear-gradient(to right,color-mix(in srgb,var(--rp-amber) 55%,transparent),var(--rp-amber));transition:width .3s ease-out}',
      '.__rp_budgetFill[data-over="1"]{background:linear-gradient(to right,color-mix(in srgb,var(--rp-rust) 60%,transparent),var(--rp-rust))}',
      '.__rp_pending{display:flex;align-items:center;gap:8px;font-size:18px;color:var(--dsw-alias-label-secondary);padding:4px 2px}',
      '.__rp_pendingDot{width:6px;height:6px;border-radius:50%;background:var(--rp-amber);animation:rp-pulse 1.6s ease-in-out infinite}',
      /* 复刻稿对齐：分区左侧琥珀竖线（用 border，不用伪元素）、更大的展开箭头、行底纹 */
      '.__rp_groupTitle{border-left:3px solid var(--rp-amber);padding-left:8px;line-height:1.25;letter-spacing:.02em}',
      '.__rp_caret{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;min-width:14px;border:none;background:none;color:color-mix(in srgb,var(--rp-amber) 78%,var(--dsw-alias-label-primary));font-size:0;padding:0;line-height:1}',
      '.__rp_caret::before{content:"";display:block;width:6px;height:6px;border-right:1.7px solid currentColor;border-bottom:1.7px solid currentColor;transform:rotate(-45deg);transition:transform .18s cubic-bezier(.22,1,.36,1)}',
      '[aria-expanded="true"] > .__rp_caret::before{transform:rotate(45deg)}',
      '[aria-expanded="false"] > .__rp_caret::before{transform:rotate(-45deg)}',
      '.__rp_caret:hover{background:color-mix(in srgb,var(--rp-amber) 24%,transparent);border-color:var(--rp-amber)}',

      '.__rp_libBody .__rp_row{background:var(--dsw-alias-bg-layer-1)}',
      '.__rp_heroCap{border-bottom:2px solid var(--rp-amber);padding-bottom:4px;letter-spacing:.34em;font-size:15.5px;opacity:.92}',
      '.__rp_legendRow{display:flex;align-items:center;gap:6px;width:100%;justify-content:flex-start}',
      '.__rp_legendChip{width:9px;height:9px;border-radius:2px;flex:none}',
      '.__rp_legendLabel{font-size:12px;letter-spacing:.06em;color:var(--dsw-alias-label-secondary);opacity:.85}',
      '.__rp_legendValue{margin-left:auto;font-size:13px;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;opacity:.85}',
      /* 复刻稿对齐 2：方形标记、分区满宽细线、小节标题下的横线 */
      '.__rp_dot{border-radius:1px}',
      '.__rp_legendChip{width:9px;height:9px;border-radius:2px;flex:none}',
      '.__rp_group > .__rp_groupHead{border-bottom:1px solid var(--dsw-alias-border-l1);padding-bottom:6px}',
      '.__rp_sectionTitle{border-bottom:1px solid var(--dsw-alias-border-l1);padding-bottom:3px;margin-bottom:3px}',
      '.__rp_pinned .__rp_groupHead{border-bottom-color:color-mix(in srgb,var(--rp-amber) 35%,var(--dsw-alias-border-l1))}',
      /* 设置面板 */
      '.__rp_sheetWrap{position:fixed;inset:0;z-index:200;overscroll-behavior:contain;background:color-mix(in srgb,#000 42%,transparent);display:flex;align-items:flex-start;justify-content:center;padding:56px 18px 18px}',
      '.__rp_sheet{box-sizing:border-box;width:100%;max-width:360px;max-height:calc(100vh - 74px);overflow:auto;background:#0f1216;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:12px 14px 14px;box-shadow:0 12px 32px rgba(0,0,0,.55)}',
      '.__rp_sheetHead{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}',
      '.__rp_sheetTitle{font-size:15.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--dsw-alias-label-secondary)}',
      '.__rp_sheetRow{display:flex;flex-direction:column;gap:6px}',
      '.__rp_sheetLabel{font-size:15.5px;color:var(--dsw-alias-label-secondary)}',
      '.__rp_seg{display:flex;gap:6px;flex-wrap:wrap}',
      '.__rp_segBtn{flex:1 1 auto;min-width:72px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);border-radius:5px;padding:5px 8px;font-size:15.5px;cursor:pointer;line-height:1.3}',
      '.__rp_segBtn:hover{border-color:color-mix(in srgb,var(--rp-amber) 55%,transparent)}',
      '.__rp_segBtn[data-on="1"]{border-color:var(--rp-amber);background:color-mix(in srgb,var(--rp-amber) 16%,transparent);color:color-mix(in srgb,var(--rp-amber) 85%,var(--dsw-alias-label-primary))}',
      '.__rp_studioSettings{display:flex;flex-direction:column;gap:10px;margin-top:10px}',
      '.__rp_sheetDivider{height:1px;background:var(--dsw-alias-border-l1);margin:2px 0 0}',
      '.__rp_sheetSection{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--rp-amber)}',
      '.__rp_setFold{border-top:1px solid var(--dsw-alias-border-l1);padding-top:8px;margin-top:8px;display:flex;flex-direction:column;gap:6px}',
      '.__rp_setFoldHead{display:flex;align-items:center;gap:8px;width:100%;min-height:30px;border:none;background:none;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;letter-spacing:.12em;text-transform:uppercase;padding:4px 0;cursor:pointer;text-align:left}',
      '.__rp_setFoldHead:hover{color:var(--dsw-alias-label-primary)}',
      '.__rp_setFoldHead:focus-visible{outline:2px solid var(--rp-amber);outline-offset:2px}',
      '.__rp_setFoldBody{display:flex;flex-direction:column;gap:10px;padding-top:2px}',
      '.__rp_sheetRowStack{gap:4px}',
      '.__rp_sheetLabelRow{display:flex;align-items:baseline;justify-content:space-between;gap:8px}',
      '.__rp_sheetValue{font-size:13px;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}',
      '.__rp_sheetHint{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);opacity:.8}',
      '.__rp_modeBar{display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid var(--rp-frost-border);border-radius:8px;background:rgba(127,127,127,.06)}',
      '.__rp_modeSwitch{display:flex;gap:6px}',
      '.__rp_modeSwitch .__rp_segBtn{flex:1 1 0;min-height:30px}',
      '.__rp_modeHint{font-size:12px;line-height:1.45;color:var(--dsw-alias-label-secondary)}',
      '.__rp_effectGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:4px 8px}',
      '.__rp_effect{display:flex;align-items:center;gap:6px;min-width:0;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.__rp_effect span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.__rp_sheetActions{display:flex;justify-content:flex-end;margin-top:10px}',
      '.__rp_sheetVersion{margin-top:8px;text-align:right;font-size:11px;letter-spacing:.08em;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;user-select:text}',
      '.__rp_resetBtn{display:inline-flex;align-items:center;justify-content:center;min-height:30px;border:1px solid color-mix(in srgb,var(--rp-rust) 55%,var(--dsw-alias-border-l2));border-radius:5px;background:transparent;color:color-mix(in srgb,var(--rp-rust) 85%,var(--dsw-alias-label-primary));font:inherit;font-size:12px;padding:3px 10px;cursor:pointer}',
      '.__rp_resetBtn:hover{background:color-mix(in srgb,var(--rp-rust) 10%,transparent);border-color:var(--rp-rust)}',
      '.__rp_resetBtn:focus-visible{outline:2px solid var(--rp-rust);outline-offset:2px}',
      '.__rp_confirmWrap{position:fixed;inset:0;z-index:400;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.55);--rp-amber:#d89140;--rp-rust:#b6462a}',
      '.__rp_confirm{width:min(380px,100%);background:#0f1216;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:16px;box-shadow:0 18px 48px rgba(0,0,0,.6);color:var(--dsw-alias-label-primary)}',
      '.__rp_confirm h3{margin:0 0 8px;font-size:16px;font-weight:600}',
      '.__rp_confirm p{margin:0 0 14px;font-size:13px;line-height:1.55;color:var(--dsw-alias-label-secondary)}',
      '.__rp_confirmActions{display:flex;justify-content:flex-end;gap:8px}',
      '.__rp_range{width:100%;height:18px;accent-color:var(--rp-amber)}',
      '.__rp_seedRow{display:flex;align-items:center;gap:8px}',
      '.__rp_seedInput{width:96px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);border-radius:4px;padding:2px 6px;font:inherit;font-size:14px}',
      '.__rp_priceRow{display:flex;align-items:center;gap:6px}',
      '.__rp_priceInput{width:88px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);border-radius:4px;padding:2px 6px;font:inherit;font-size:14px;min-height:28px}',
      '.__rp_priceUnit{font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap}',
      '.__rp_color{width:34px;height:22px;border:1px solid var(--dsw-alias-border-l2);background:transparent;padding:0;border-radius:4px}',
      '.__rp_checkRow{flex-direction:row;align-items:center;gap:8px;cursor:pointer}',
      '.__rp_ringBudget{fill:color-mix(in srgb,var(--rp-amber) 72%,var(--dsw-alias-label-primary));font-size:5.8px;text-anchor:middle;letter-spacing:.03em;opacity:.92}',
      '.__rp_row{overflow:visible}',
      '.__rp_row > *{min-width:0}',
      '.__rp_name,.__rp_nameAlt,.__rp_rowMeta,.__rp_libName{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.__rp_name{flex:1 1 auto}',
      '.__rp_groupTitle,.__rp_sectionTitle{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 0 auto}',
      '.__rp_sideLabel,.__rp_legendLabel{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}',
      '@media (max-width:520px){.__rp_sideLabel{display:none}.__rp_legendLabel{display:none}.__rp_sideSub{display:none}}',
      '.__rp_row .__rp_name{flex:0 1 auto;min-width:0}',
      '.__rp_row .__rp_nameAlt{flex:1 1 auto;min-width:0}',
      '.__rp_row .__rp_rowMeta,.__rp_call .__rp_callAt{display:none}',
      '.__rp_pinned .__rp_row{transition:opacity .6s ease}',
      '.__rp_searchLib + .__rp_searchLib{margin-top:6px}',
      '.__rp_searchLibHead{font-size:11.5px;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary);padding:4px 2px 2px;border-bottom:1px solid var(--dsw-alias-border-l1);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      /* 历史常用：次数与工时占比是这一组的主信息，不能跟普通行一起藏起来。 */
      '.__rp_row.__rp_historyRow .__rp_rowMeta{display:inline-block;margin-left:auto;padding-left:8px;font-size:12.5px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}',
      '.__rp_historyRow .__rp_histShare{color:color-mix(in srgb,var(--rp-amber) 78%,var(--dsw-alias-label-primary))}',
      '.__rp_groupHead{display:flex;align-items:baseline;gap:8px;flex-wrap:nowrap;min-width:0}',
      '.__rp_groupHeadToggle{align-items:center}',
      '.__rp_groupHeadToggle .__rp_groupTitle{overflow:visible}',
      '.__rp_groupToggle{display:inline-flex;align-items:center;gap:7px;max-width:100%;min-width:0;min-height:28px;border:none;background:none;padding:0;margin:0;font:inherit;color:inherit;cursor:pointer;text-align:left;border-radius:4px}',
      '.__rp_groupToggleText{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.__rp_groupToggle:hover .__rp_groupToggleText{color:color-mix(in srgb,var(--rp-amber) 85%,var(--dsw-alias-label-primary))}',
      '.__rp_groupToggle:focus-visible{outline:2px solid var(--rp-amber);outline-offset:2px}',
      '.__rp_search{position:relative;z-index:2;display:flex;align-items:center;gap:8px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:4px 9px;background:rgba(var(--rp-frost-rgb),var(--rp-frost-alpha));-webkit-backdrop-filter:blur(var(--rp-frost-blur)) saturate(var(--rp-frost-saturate));backdrop-filter:blur(var(--rp-frost-blur)) saturate(var(--rp-frost-saturate));min-width:0}',
      '.__rp_search:focus-within{border-color:color-mix(in srgb,var(--rp-amber) 70%,transparent);box-shadow:0 0 0 2px color-mix(in srgb,var(--rp-amber) 14%,transparent)}',
      '.__rp_searchIcon{flex:none;color:var(--dsw-alias-label-secondary);display:block}',
      '.__rp_searchInput{flex:1 1 auto;min-width:0;border:none;background:none;outline:none;color:var(--dsw-alias-label-primary);font:inherit;font-size:16px;line-height:1.5;padding:3px 0}',
      '.__rp_searchInput::placeholder{color:var(--dsw-alias-label-secondary);opacity:.7}',
      '.__rp_searchInput::-webkit-search-cancel-button{display:none}',
      '.__rp_searchClear{flex:none;border:none;background:none;color:var(--dsw-alias-label-secondary);font:inherit;font-size:18px;line-height:1;padding:0 2px;cursor:pointer}',
      '.__rp_searchClear:hover{color:var(--dsw-alias-label-primary)}',
      '.__rp_searchResults .__rp_groupHead{border-bottom-color:color-mix(in srgb,var(--rp-amber) 35%,var(--dsw-alias-border-l1))}',
      '.__rp_searchNotice{font-size:13px;color:color-mix(in srgb,var(--rp-rust) 85%,var(--dsw-alias-label-primary));padding:2px 4px}',
      '.__rp_result{display:flex;align-items:center;gap:8px;min-width:0;padding:6px 7px;border-radius:6px;background:var(--dsw-alias-bg-layer-1);border:1px solid transparent}',
      '.__rp_result:hover{background:color-mix(in srgb,var(--rp-amber) 7%,transparent);border-color:color-mix(in srgb,var(--rp-amber) 24%,transparent)}',
      '.__rp_result:hover,.__rp_result:focus-within{border-color:color-mix(in srgb,var(--rp-amber) 62%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--rp-amber) 30%,transparent)}',
      '.__rp_coldRow{transition:background-color .15s ease-out,box-shadow .15s ease-out}',
      '.__rp_coldRow:hover,.__rp_coldRow:focus-within{background:color-mix(in srgb,var(--rp-amber) 8%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--rp-amber) 55%,transparent)}',
      '.__rp_result[data-warn="1"]{border-color:color-mix(in srgb,var(--rp-rust) 45%,transparent)}',
      '.__rp_resultMain{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:1px}',
      '.__rp_resultTop{display:flex;align-items:baseline;gap:6px;min-width:0;flex-wrap:nowrap}',
      '.__rp_resultName{font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto;min-width:0}',
      '.__rp_resultAlt{font-size:12px;color:var(--dsw-alias-label-secondary);opacity:.65;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1 1 auto;min-width:0}',
      '.__rp_resultKind{flex:none;font-size:12px;letter-spacing:.08em;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:3px;padding:0 4px;line-height:1.5}',
      '.__rp_badge{flex:none;font-size:12px;line-height:1.5;border-radius:3px;padding:0 4px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary)}',
      '.__rp_badge[data-tone=cold]{border-color:color-mix(in srgb,var(--rp-rust) 50%,transparent);color:color-mix(in srgb,var(--rp-rust) 85%,var(--dsw-alias-label-primary))}',
      '.__rp_badge[data-tone=installed]{border-color:color-mix(in srgb,var(--rp-slate) 55%,transparent);color:color-mix(in srgb,var(--rp-slate) 85%,var(--dsw-alias-label-primary))}',
      '.__rp_resultDesc{font-size:13px;color:var(--dsw-alias-label-secondary);opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}',
      '.__rp_echoAction{display:inline-flex;align-items:center;justify-content:center;gap:4px;width:40px;height:40px;padding:0;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--rp-amber,#ff7f00);cursor:pointer;position:relative}',
      '.__rp_echoMark{display:inline-block;flex:none;vertical-align:middle}',
      '.__rp_echoGroup{position:relative}',
      '.__rp_echoGroupTitle{display:inline-flex;align-items:center;gap:4px;color:var(--rp-amber)}',
      '.__rp_echoAction:hover{color:color-mix(in srgb,var(--rp-amber,#ff7f00) 78%,#fff);border-color:color-mix(in srgb,var(--rp-amber,#ff7f00) 50%,transparent);background:color-mix(in srgb,var(--rp-amber,#ff7f00) 8%,transparent)}',
      '.__rp_echoAction[data-pressed="1"]{color:var(--rp-amber,#ff7f00);border-color:color-mix(in srgb,var(--rp-amber,#ff7f00) 55%,transparent)}',
      '.__rp_echoAction[data-state="error"],.__rp_echoAction[data-state="full"]{color:var(--rp-rust,#e26645)}',
      '.__rp_echoAction:disabled{cursor:default;opacity:.75}',
      '.__rp_echoAction:focus-visible{outline:2px solid var(--rp-amber,#ff7f00);outline-offset:2px}',
      '.__rp_echoSpin{position:absolute;right:2px;bottom:2px;width:5px;height:5px;border-radius:50%;background:var(--rp-amber,#ff7f00);animation:rp-pulse 1.2s ease-in-out infinite}',
      '.__rp_echoCard{border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-1);overflow:hidden;cursor:grab}',
      '.__rp_echoCard:active{cursor:grabbing}',
      '.__rp_echoCard[draggable="true"]:hover{border-color:color-mix(in srgb,var(--rp-amber) 42%,var(--dsw-alias-border-l1))}',
      '.__rp_echoCard:hover{border-color:color-mix(in srgb,var(--rp-amber) 42%,var(--dsw-alias-border-l1))}',
      '.__rp_echoCard:focus-visible{outline:2px solid var(--rp-amber);outline-offset:1px}',
      '.__rp_echoConv{display:flex;flex-direction:column;gap:5px}',
      '.__rp_echoConv + .__rp_echoConv{margin-top:8px;padding-top:8px;border-top:1px solid var(--dsw-alias-border-l1)}',
      '.__rp_echoConvHead{display:flex;align-items:center;gap:6px;min-width:0;padding:0 2px}',
      '.__rp_echoConvToggle{display:flex;align-items:center;gap:5px;flex:1 1 auto;min-width:0;border:none;background:none;padding:0;color:inherit;font:inherit;text-align:left;cursor:pointer}',
      '.__rp_echoConvToggle:hover .__rp_echoConvTitle{color:var(--rp-amber)}',
      '.__rp_echoConvTitle{flex:1 1 auto;min-width:0;border:none;background:none;padding:0;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;font-weight:600;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}',
      '.__rp_echoConvCount{flex:none;font-size:12px;color:var(--dsw-alias-label-secondary);opacity:.7}',
      '.__rp_echoConvOpen{flex:none;width:24px;height:24px;padding:0;border:1px solid transparent;border-radius:4px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:14px;line-height:1;cursor:pointer}',
      '.__rp_echoConvOpen:hover{color:var(--rp-amber);border-color:color-mix(in srgb,var(--rp-amber) 40%,transparent)}',
      '.__rp_echoGone{flex:none;font-size:11px;color:var(--dsw-alias-label-secondary);opacity:.65;border:1px solid var(--dsw-alias-border-l1);border-radius:3px;padding:0 4px;white-space:nowrap}',
      '.__rp_echoRefresh{width:24px;height:24px;padding:0;border:1px solid transparent;border-radius:4px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:14px;line-height:1;cursor:pointer}',
      '.__rp_echoRefresh:hover{color:var(--rp-amber);border-color:color-mix(in srgb,var(--rp-amber) 40%,transparent)}',
      '.__rp_echoSearch{display:flex;align-items:center;gap:6px;margin-bottom:6px}',
      '.__rp_echoSearchInput{flex:1 1 auto;min-width:0;height:28px;border:1px solid var(--dsw-alias-border-l1);border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;padding:0 8px}',
      '.__rp_echoSearchInput::placeholder{color:var(--dsw-alias-label-secondary);opacity:.65}',
      '.__rp_echoSearchInput:focus-visible{outline:2px solid var(--rp-amber);outline-offset:1px}',
      '.__rp_echoFilter{flex:none;height:28px;border:1px solid var(--dsw-alias-border-l1);border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;padding:0 7px;cursor:pointer;white-space:nowrap}',
      '.__rp_echoFilter[data-on="1"]{border-color:color-mix(in srgb,var(--rp-amber) 55%,transparent);color:var(--rp-amber);background:color-mix(in srgb,var(--rp-amber) 7%,transparent)}',
      '.__rp_echoFilter:focus-visible{outline:2px solid var(--rp-amber);outline-offset:1px}',
      '.__rp_sessionHit{display:flex;flex-direction:column;gap:3px;width:100%;text-align:left;border:1px solid var(--dsw-alias-border-l1);border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:inherit;font:inherit;padding:6px 8px;cursor:pointer}',
      '.__rp_sessionHit:hover{border-color:color-mix(in srgb,var(--rp-amber) 45%,var(--dsw-alias-border-l1))}',
      '.__rp_sessionHit:focus-visible{outline:2px solid var(--rp-amber);outline-offset:1px}',
      '.__rp_sessionHitTitle{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.__rp_sessionHitMeta{font-size:11px;color:var(--rp-amber);opacity:.85}',
      '.__rp_sessionHitSnippet{font-size:12px;line-height:1.45;color:var(--dsw-alias-label-secondary);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}',
      '.__rp_searchHit{outline:2px solid var(--rp-amber,#ff7f00);outline-offset:2px;border-radius:4px}',
      '.__rp_echoCardHead{display:flex;align-items:center;gap:6px;min-width:0;padding:5px 7px 0}',
      '.__rp_echoQA{display:flex;flex-direction:column;gap:4px;padding:4px 8px 5px}',
      '.__rp_echoQ,.__rp_echoA{display:flex;align-items:flex-start;gap:6px;min-width:0}',
      '.__rp_echoQ .__rp_echoRole{color:var(--rp-amber)}',
      '.__rp_echoA .__rp_echoRole{color:var(--dsw-alias-label-secondary)}',
      '.__rp_echoPreviewWrap{position:relative;flex:1 1 auto;min-width:0;overflow:hidden}',
      '.__rp_echoPreview{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);word-break:break-word}',
      '.__rp_echoPreviewWrap::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1.4em;background:linear-gradient(to bottom,transparent,var(--dsw-alias-bg-layer-1) 92%);pointer-events:none}',
      '.__rp_echoMore{font-size:11px;color:var(--dsw-alias-label-secondary);opacity:.65;padding:0 8px 6px;text-align:right}',
      '.__rp_echoCard[data-open="1"]{border-color:color-mix(in srgb,var(--rp-amber) 35%,var(--dsw-alias-border-l1))}',
      '.__rp_echoHead{display:flex;align-items:center;gap:6px;width:100%;min-height:34px;padding:5px 7px;border:none;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}',
      '.__rp_echoHead:hover{background:color-mix(in srgb,var(--rp-amber) 6%,transparent)}',
      '.__rp_echoTitle{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;color:var(--dsw-alias-label-primary)}',
      '.__rp_echoMeta{flex:none;font-size:12px;color:var(--dsw-alias-label-secondary);opacity:.85;white-space:nowrap}',
      '.__rp_echoTime{flex:none;font-size:12px;color:var(--dsw-alias-label-secondary);opacity:.7;white-space:nowrap}',
      '.__rp_echoBody{display:flex;flex-direction:column;gap:4px;padding:4px 8px 8px;border-top:1px solid var(--dsw-alias-border-l1)}',
      '.__rp_echoActions{display:flex;gap:10px;justify-content:flex-end;align-items:center;min-height:26px}',
      '.__rp_echoDelete{border:1px solid color-mix(in srgb,var(--rp-rust) 45%,var(--dsw-alias-border-l2));border-radius:4px;background:transparent;color:var(--rp-rust);font:inherit;font-size:12px;padding:2px 7px;min-height:24px;cursor:pointer}',
      '.__rp_echoMsg{display:flex;gap:7px;min-width:0;padding:3px 0;border-top:1px dashed color-mix(in srgb,var(--dsw-alias-border-l1) 60%,transparent)}',
      '.__rp_echoMsg:first-of-type{border-top:none}',
      '.__rp_echoRole{flex:none;font-size:11px;letter-spacing:.06em;color:var(--rp-amber);padding-top:2px}',
      '.__rp_echoText{flex:1 1 auto;min-width:0;font-size:12px;line-height:1.45;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word}',
      '.__rp_echoNote{font-size:12px;color:var(--dsw-alias-label-secondary);opacity:.7;border-top:1px dashed var(--dsw-alias-border-l1);padding-top:4px}',
      '.__rp_echoModalWrap{position:fixed;inset:0;z-index:420;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.62)}',
      '.__rp_echoModal{width:min(720px,100%);max-height:84vh;display:flex;flex-direction:column;background:#0f1216;color:#e7e9ec;border:1px solid #343a42;border-radius:10px;box-shadow:0 18px 60px rgba(0,0,0,.65);overflow:hidden}',
      '.__rp_echoModalHead{display:flex;align-items:center;gap:7px;padding:11px 13px 0}',
      '.__rp_echoModalHeading{display:flex;align-items:center;gap:6px;min-width:0;flex:1 1 auto;color:#ff8a1f}',
      '.__rp_echoModalTitle{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;font-weight:600;color:#f1f2f4}',
      '.__rp_echoModalClose{width:28px;height:28px;border:1px solid #343a42;border-radius:5px;background:transparent;color:#abb1ba;font:inherit;cursor:pointer}',
      '.__rp_echoModalClose:hover{color:#fff;border-color:#59616c}',
      '.__rp_echoModalMeta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:4px 13px 10px;border-bottom:1px solid #242a31;font-size:12px;color:#9aa2ad}',
      '.__rp_echoModalMeta .__rp_linkBtn{font-size:12px;color:#ff9a3c}',
      '.__rp_echoModalMeta .__rp_linkBtn:disabled{opacity:.55;cursor:default}',
      '.__rp_echoContext{position:relative;outline:none;cursor:crosshair;overflow-y:auto;overscroll-behavior:contain;padding:10px 13px 14px;scrollbar-gutter:stable;display:flex;flex-direction:column;user-select:text;-webkit-user-select:text}',
      '.__rp_echoContext *{user-select:text;-webkit-user-select:text}',
      '.__rp_echoContextLabel{font-size:11px;line-height:1.5;color:#8b93a0;margin-bottom:8px}',
      '.__rp_echoCtxMsg{display:flex;flex-direction:column;align-items:flex-start;max-width:86%;margin:5px 0}',
      '.__rp_echoCtxMsg[data-role="user"]{align-self:flex-end;align-items:flex-end}',
      '.__rp_echoCtxRole{font-size:10.5px;letter-spacing:.06em;color:#8b93a0;padding:0 2px 3px}',
      '.__rp_echoCtxMsg[data-role="user"] .__rp_echoCtxRole{color:#ff9a3c}',
      '.__rp_echoCtxText{font-size:13px;line-height:1.62;white-space:pre-wrap;word-break:break-word;color:#d9dde3;padding:8px 11px;border-radius:10px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.07)}',
      '.__rp_echoCtxMsg[data-role="user"] .__rp_echoCtxText{background:rgba(255,127,0,.10);border-color:rgba(255,127,0,.26)}',
      '.__rp_echoCtxMsg[data-anchor="1"] .__rp_echoCtxText{outline:1px solid rgba(255,127,0,.55);outline-offset:2px}',
      '.__rp_echoCtxText{cursor:text}',
      '.__rp_echoContext[data-marquee="1"],.__rp_echoContext[data-marquee="1"] *{user-select:none;-webkit-user-select:none;cursor:crosshair}',
      '.__rp_echoMarquee{position:absolute;z-index:2;pointer-events:none;border:1px solid rgba(255,154,60,.9);background:rgba(255,127,0,.12)}',
      '.__rp_echoCtxMsg[data-picked="1"] .__rp_echoCtxText{box-shadow:0 0 0 2px #ff9a3c;background:rgba(255,154,60,.16)}',
      '.__rp_echoCtxMsg[data-picked="1"] .__rp_echoCtxRole{color:#ff9a3c}',
      '.__rp_echoPickBar{display:inline-flex;align-items:center;gap:8px;margin-left:auto;color:#ff9a3c}',
      '.__rp_echoModalHint{padding:14px 2px;color:#9aa2ad;font-size:13px}',
      '.__rp_soulRow{display:flex;align-items:center;gap:8px;min-width:0}',
      '.__rp_soulBadge{flex:none;font-size:10px;letter-spacing:.12em;color:var(--rp-amber);border:1px solid color-mix(in srgb,var(--rp-amber) 45%,transparent);border-radius:3px;padding:1px 4px;line-height:1.4}',
      '.__rp_soulSelect{flex:1 1 auto;min-width:0;height:28px;border:1px solid var(--dsw-alias-border-l2);border-radius:4px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:0 6px}',
      '.__rp_result .__rp_linkBtn{flex:none}',
      '.__rp_groupTitle{flex:0 0 auto}',
      '.__rp_groupCount{flex:0 0 auto}',
      '.__rp_groupHead .__rp_rowMeta{flex:1 1 auto;min-width:0;text-align:right}',
      '.__rp_row .__rp_linkBtn{margin-left:auto}',
      '.__rp_row .__rp_optimize{margin-left:auto}',
      '@container (max-width: 380px){.__rp_heroTop{gap:6px;flex-wrap:nowrap}.__rp_chipRound{display:none}.__rp_heroRow{display:flex;flex-direction:column;align-items:center;gap:4px}.__rp_heroRing{order:1}.__rp_sideLeft{order:2;flex-direction:row;flex-wrap:wrap;justify-content:center;align-items:center;gap:8px;text-align:center}.__rp_sideLeft .__rp_sideLabel{display:none}.__rp_sideRight{order:3;display:flex;flex-direction:row;align-items:center;justify-content:center;gap:6px;text-align:center}.__rp_sideRight .__rp_sideLabel,.__rp_sideRight .__rp_sideValue,.__rp_sideRight .__rp_sideSub{display:none}.__rp_sideRight .__rp_optimize{margin:0;white-space:nowrap}.__rp_legend{flex-direction:row;flex-wrap:wrap;justify-content:center;gap:8px}.__rp_legendRow{gap:4px;width:auto}.__rp_legendValue{margin-left:0;font-size:12px}.__rp_legendLabel{display:none}.__rp_meta{font-size:13px;gap:6px;flex-wrap:nowrap;overflow:hidden;white-space:nowrap}.__rp_meta span{overflow:hidden;text-overflow:ellipsis;min-width:0}.__rp_meta span + span{display:none}.__rp_groupTags{display:none}.__rp_nameAlt,.__rp_rowMeta,.__rp_desc{display:none}.__rp_libCount{display:none}.__rp_notes{display:none}.__rp_libPark{width:26px;min-width:26px;padding:0;font-size:0}.__rp_libPark::before{content:"⊘";font-size:14px;line-height:1}.__rp_rowPark{width:26px;min-width:26px;padding:0;font-size:0}.__rp_rowPark::before{content:"⊘";font-size:14px;line-height:1}.__rp_repoText{display:none}.__rp_repoBtn{width:26px;padding:0}.__rp_echoTime{display:inline;font-size:11px}}',
      '@container (max-width: 380px){.__rp_historyRow .__rp_rowMeta{display:inline-block;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:58%;margin-left:auto}}',
      /* 战术网格（地图模式）：24px 细格 + 每 4 格一条 琥珀橙粗线，中心实、四周淡出。
       * 在等高线（z 0）之上、内容（z 2）之下；静态背景，不重绘。 */
      '.__rp_root[data-effect-grid="on"]::before{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background-image:linear-gradient(rgba(255,127,0,.11) 1px,transparent 1px),linear-gradient(90deg,rgba(255,127,0,.11) 1px,transparent 1px),linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:96px 96px,96px 96px,24px 24px,24px 24px;background-position:-1px -1px;-webkit-mask-image:radial-gradient(130% 105% at 50% 30%,#000 25%,transparent 88%);mask-image:radial-gradient(130% 105% at 50% 30%,#000 25%,transparent 88%)}',
      '.__rp_root[data-studio-light="1"][data-effect-grid="on"]::before,html[data-rp-scheme="light"] .__rp_root[data-effect-grid="on"]::before{background-image:linear-gradient(rgba(160,76,0,.10) 1px,transparent 1px),linear-gradient(90deg,rgba(160,76,0,.10) 1px,transparent 1px),linear-gradient(rgba(20,24,28,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(20,24,28,.045) 1px,transparent 1px)}',
    ].join('\n')

    /* ── 当前会话登记（root 作用域的面板拿不到会话绑定） ────────────────── */
    var sessionStore = { id: '', listeners: new Set() }

    function setActiveSession(id) {
      if (!id || sessionStore.id === id) return
      sessionStore.id = id
      sessionStore.listeners.forEach(function (listener) {
        try {
          listener()
        } catch (error) {
          /* 渲染层自己的错误不扩散 */
        }
      })
    }

    function useActiveSession() {
      var pair = React.useState(sessionStore.id)
      var id = pair[0]
      var setId = pair[1]
      React.useEffect(function () {
        var sync = function () {
          setId(sessionStore.id)
        }
        sessionStore.listeners.add(sync)
        sync()
        return function () {
          sessionStore.listeners.delete(sync)
        }
      }, [])
      return id
    }

    function SessionReporter(props) {
      var sessionId = props && props.sessionId
      React.useEffect(
        function () {
          if (sessionId) setActiveSession(sessionId)
        },
        [sessionId],
      )
      return null
    }

    /* ── 右侧栏控制器（由 ctx.inject 可选拿到） ─────────────────────────── */
    var rightDock = null
    var clientLayout = null

    /**
     * 把「运行中」作为页签停靠到右侧栏。
     * 顺序：openTab(kind, {preferNewPane}) → openTab(kind, {}) → 展开右侧栏。
     * 每一步单独兜底，失败只记录，不抛给渲染层。
     */
    function openRightDock() {
      if (!rightDock) return false
      var opened = false
      var lastError = ''
      var variants = [{ preferNewPane: true }, {}]
      for (var i = 0; i < variants.length && !opened; i += 1) {
        try {
          rightDock.openTab(RIGHT_KIND, variants[i])
          opened = true
        } catch (error) {
          lastError = String((error && error.message) || error)
        }
      }
      if (!opened) {
        if (typeof console !== 'undefined') console.error('dsh-running-panel: openTab failed:', lastError)
        return false
      }
      try {
        if (clientLayout && typeof clientLayout.openRightbar === 'function') {
          clientLayout.openRightbar(true, false)
        }
      } catch (error) {
        if (typeof console !== 'undefined') console.error('dsh-running-panel: openRightbar failed:', error)
      }
      return true
    }

    /* ── 格式化 ──────────────────────────────────────────────────────── */

    function formatTime(at) {
      if (!at) return ''
      try {
        return new Date(at).toLocaleTimeString(undefined, {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      } catch (error) {
        return ''
      }
    }

    function fill(template, key, value) {
      return String(template).split('{' + key + '}').join(String(value))
    }

    /** 字符数缩写：3742 → 3.7k。预算条用它，避免两位以上数字撑破窄栏。 */
    function formatChars(value) {
      var n = Number(value) || 0
      if (n < 1000) return String(n)
      return (n / 1000).toFixed(1) + 'k'
    }

    function formatTokens(value) {
      var n = Number(value) || 0
      if (n < 1000) return String(n)
      return (n / 1000).toFixed(1) + 'k'
    }

    /**
     * 预算线按 token 记；比字符更接近真实成本（中英混排时 1 字符 ≠ 1 token）。
     * 自动模式（默认）：上下文窗口 × 比例（默认 1%），夹在下限～上限（默认 3000～20000）之间——
     * 模型窗口变大，预算跟着放宽；但技能多了模型会挑错，所以不无限放宽。三个数都能在设置里改。
     * 窗口大小来自会话上报；这会儿没有会话上报时用上次见过的（记在 prefs 里），都没有才退回固定值。
     * 这只是软目标：超了只变色提示，不会停用任何技能（会动文件的是「自动配装」，要确认、可撤销）。
     */
    var contextWindowSeen = 0
    var BUDGET_AUTO_RATIO = 0.01
    var BUDGET_AUTO_MIN = 3000
    var BUDGET_AUTO_MAX = 20000
    function clampNumber(value, min, max, fallback) {
      var n = Number(value)
      if (!Number.isFinite(n) || n <= 0) return fallback
      return Math.min(max, Math.max(min, n))
    }
    function budgetRule() {
      var ratio = clampNumber(prefs.budgetRatio, 0.001, 0.05, BUDGET_AUTO_RATIO)
      var min = Math.round(clampNumber(prefs.budgetMin, 500, 100000, BUDGET_AUTO_MIN))
      var max = Math.max(min, Math.round(clampNumber(prefs.budgetMax, 1000, 200000, BUDGET_AUTO_MAX)))
      return { ratio: ratio, min: min, max: max }
    }
    function autoBudgetTokens(contextWindow) {
      var window = Number(contextWindow) || 0
      if (window <= 0) return 0
      var rule = budgetRule()
      return Math.min(rule.max, Math.max(rule.min, Math.round(window * rule.ratio)))
    }
    /** 用来算预算线的窗口大小，以及它从哪来：live = 会话刚上报，remembered = 上次见过，none = 没有。 */
    function budgetWindow() {
      if (contextWindowSeen > 0) return { tokens: contextWindowSeen, source: 'live' }
      var last = Number(prefs.lastContextWindow) || 0
      if (last > 0) return { tokens: last, source: 'remembered' }
      return { tokens: 0, source: 'none' }
    }
    function budgetFixedTokens() {
      var n = Number(prefs.budgetTokens)
      return Math.min(200000, Math.max(500, Math.round(Number.isFinite(n) && n > 0 ? n : 3000)))
    }
    function budgetLimitTokens() {
      if (prefs.budgetMode !== 'fixed') {
        var auto = autoBudgetTokens(budgetWindow().tokens)
        if (auto) return auto
      }
      return budgetFixedTokens()
    }
    function budgetLimitChars() {
      return budgetLimitTokens() * 4
    }

    /** 图钉：钉住的技能/库进核心集，预算方案默认不碰。 */
    function pinnedSkills() {
      return prefs.pins && Array.isArray(prefs.pins.skills) ? prefs.pins.skills : []
    }
    function pinnedLibs() {
      return prefs.pins && Array.isArray(prefs.pins.libs) ? prefs.pins.libs : []
    }
    function isPinnedSkill(name) {
      return pinnedSkills().indexOf(name) >= 0
    }
    function isPinnedLib(lib) {
      return pinnedLibs().indexOf(lib) >= 0
    }
    function togglePin(kind, name) {
      var skills = pinnedSkills().slice()
      var libs = pinnedLibs().slice()
      var list = kind === 'lib' ? libs : skills
      var at = list.indexOf(name)
      if (at >= 0) list.splice(at, 1)
      else list.push(name)
      setPref('pins', { skills: skills, libs: libs })
    }

    function formatRmb(value) {
      var n = Number(value) || 0
      if (n < 0.01) return n.toFixed(4)
      if (n < 1) return n.toFixed(3)
      return n.toFixed(2)
    }

    /** 只显示日期，历史窗口的起点用。 */
    function dateOnly(ms) {
      if (!ms) return ''
      try {
        return new Date(ms).toLocaleDateString()
      } catch (error) {
        return ''
      }
    }

    /** 回声卡片时间：对话发生日期 + 分钟，不显示秒。 */
    function formatEchoWhen(ms) {
      if (!ms) return ''
      return dateOnly(ms) + ' ' + formatTime(ms).slice(0, 5)
    }

    /** 毫秒 → 320ms / 3.2s / 1m 05s。空值返回空串，调用方据此决定要不要显示。 */    function formatMs(ms) {
      if (!ms || ms < 0) return ''
      if (ms < 1000) return Math.round(ms) + 'ms'
      if (ms < 60000) return (ms / 1000).toFixed(1) + 's'
      var minutes = Math.floor(ms / 60000)
      var seconds = Math.round((ms % 60000) / 1000)
      return minutes + 'm ' + (seconds < 10 ? '0' + seconds : String(seconds)) + 's'
    }

    function shortId(id) {
      var body = String(id || '').replace(/^session-/, '')
      return body.length > 8 ? body.slice(0, 8) : body
    }

    /** 面板根节点：圆盘的指针视差挂在这里（整个面板算“运行中区域”）。 */
    var panelRootEl = null

    /**
     * 面板外壳：根容器 + 一条扫描带 + 滚动层。
     * 扫描带是**一个**覆盖层（不是每行一条），只做 translateY，pointer-events:none，contain:strict。
     */
    /**
     * 等高线艺术背景：预烘焙的同心等高线 + 极慢漂移 + 径向 mask 渐隐到边缘。
     * 只动 transform（合成器），不跑滤镜、不跑 rAF、不依赖主题色——currentColor。
     */
    /**
     * 等高线背景：不规则地形线（不是同心圆）平铺 + 极慢漂移，按到窗口边缘的距离渐隐。
     * 两层用同一套路径、不同的速度/方向/缩放叠出“在蠕动”的视差；只动 transform。
     */
    var CONTOUR_RINGS = [
      'M60 12C78 12 96 26 98 44C100 62 86 82 66 90C46 98 24 88 16 68C8 48 20 24 38 16C45 13 52 12 60 12Z',
      'M60 26C72 26 84 34 85 46C86 58 76 70 63 72C50 74 38 66 36 54C34 42 44 30 55 27C57 26 58 26 60 26Z',
      'M60 40C67 40 74 45 74 52C74 59 68 64 61 64C54 64 48 59 47 52C46 45 52 40 60 40Z',
      'M60 51C63 51 65 53 65 56C65 59 63 60 60 60C57 60 55 59 55 56C55 53 57 51 60 51Z',
    ]
    var CONTOUR_STRAYS = [
      'M18 92C22 90 26 92 26 96C26 100 21 102 18 100C15 98 15 94 18 92Z',
      'M92 22C96 20 100 23 99 27C98 31 93 32 90 29C88 26 89 23 92 22Z',
      'M104 74C108 72 112 75 111 79C110 83 104 84 102 80C100 77 101 75 104 74Z',
    ]

    /**
     * 把同一套等高线路径序列化成 CSS mask 用的 data URI。
     * 皮肤里的流光就是「等高线地图当 mask + 一条橙色亮带平移」；这里不搬它那份
     * 225KB 的底图，直接用面板自己的线稿，视觉语言一致、体积只有几 KB。
     */
    var contourMaskCache = ''
    function contourMaskUri() {
      if (contourMaskCache) return contourMaskCache
      var paths = CONTOUR_RINGS.concat(CONTOUR_STRAYS)
      var body = paths
        .map(function (d) {
          return '<path d="' + d + '"/>'
        })
        .join('')
      var svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480">' +
        '<defs><pattern id="p" width="148" height="148" patternUnits="userSpaceOnUse">' +
        '<g fill="none" stroke="white" stroke-width="1" stroke-linejoin="round">' +
        body +
        '</g></pattern></defs><rect width="480" height="480" fill="url(#p)"/></svg>'
      contourMaskCache = 'data:image/svg+xml,' + encodeURIComponent(svg)
      return contourMaskCache
    }

    /** 橙色流光层：只让亮带穿过等高线，静态线稿本身不重绘。 */
    function ContourFlow() {
      var mask = 'url("' + contourMaskUri() + '")'
      return h(
        'div',
        {
          className: '__rp_flow',
          'aria-hidden': 'true',
          style: { maskImage: mask, WebkitMaskImage: mask },
        },
        h('div', { className: '__rp_flowBand' }),
      )
    }

    function ContourLayer(props) {
      var layer = props && props.layer === 1 ? 1 : 0
      var patternId = 'rpContour' + layer
      var paths = CONTOUR_RINGS.concat(layer === 0 ? CONTOUR_STRAYS : [])
      return h(
        'div',
        {
          className: layer === 1 ? '__rp_contour __rp_contourAlt' : '__rp_contour',
          'aria-hidden': 'true',
        },
        h(
          'svg',
          { className: '__rp_contourSvg', viewBox: '0 0 480 480', preserveAspectRatio: 'xMidYMid slice' },
          h(
            'defs',
            null,
            h(
              'pattern',
              { id: patternId, width: 148, height: 148, patternUnits: 'userSpaceOnUse' },
              paths.map(function (d, index) {
                return h('path', {
                  key: index,
                  d: d,
                  fill: 'none',
                  stroke: 'currentColor',
                  strokeWidth: 0.5,
                  strokeLinejoin: 'round',
                })
              }),
            ),
          ),
          h('rect', { width: '100%', height: '100%', fill: 'url(#' + patternId + ')' }),
        ),
      )
    }

    // #region vendor-contour-field
    var ContourEngine = (function () {
      /** Seeded contour artwork. Dependency-free ESM; WebGL + editable SVG fallback. */
      const DEFAULT_OPTIONS = Object.freeze({
        field: Object.freeze({ scale: Object.freeze([3.7, 4.93]), octaves: 3, bands: 48, warp: 1.35, speed: 0.018, seed: 721 }),
        style: Object.freeze({ color: '#b8bdbb', background: '#111416', alpha: 0.64, lineWidth: 0.85, softness: 0.8,
          fade: Object.freeze([0.48, 0.82]), edgeFade: 0.10, dashed: true, accentColor: '#b9701a', accent: 0, tile: false }),
        respectReducedMotion: true, motion: true, fps: 30, maxDpr: 2, renderer: 'auto',
      });
      const number = (v, fallback, min, max) => Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : fallback;
      const hex = (v, fallback) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fallback;
      const pair = (v, fallback, min, max) => [0, 1].map(i => number(Array.isArray(v) ? v[i] : undefined, fallback[i], min, max));
      function normalizeOptions(patch = {}, base = DEFAULT_OPTIONS) {
        const p = patch && typeof patch === 'object' ? patch : {}, f = p.field || {}, s = p.style || {}, b = base.field, t = base.style;
        const fade = pair(s.fade, t.fade, 0, 1.5).sort((a, b) => a - b);
        if (fade[1] - fade[0] < 0.01) fade[1] = fade[0] + 0.01;
        return {
          field: { scale: pair(f.scale, b.scale, 0.5, 12), octaves: Math.round(number(f.octaves, b.octaves, 1, 6)),
            bands: number(f.bands, b.bands, 4, 96), warp: number(f.warp, b.warp, 0, 4),
            speed: number(f.speed, b.speed, 0, 0.15), seed: Math.floor(number(f.seed, b.seed, 0, 999999)) },
          style: { color: hex(s.color, t.color), background: hex(s.background, t.background),
            alpha: number(s.alpha, t.alpha, 0, 1), lineWidth: number(s.lineWidth, t.lineWidth, 0.25, 4),
            softness: number(s.softness, t.softness, 0.1, 2), fade, edgeFade: number(s.edgeFade, t.edgeFade, 0, 0.4),
            dashed: typeof s.dashed === 'boolean' ? s.dashed : t.dashed,
            accentColor: hex(s.accentColor, t.accentColor), accent: number(s.accent, t.accent, 0, 1),
            tile: typeof s.tile === 'boolean' ? s.tile : t.tile },
          respectReducedMotion: typeof p.respectReducedMotion === 'boolean' ? p.respectReducedMotion : base.respectReducedMotion,
          motion: typeof p.motion === 'boolean' ? p.motion : base.motion,
          fps: number(p.fps, base.fps, 1, 60), maxDpr: number(p.maxDpr, base.maxDpr, 1, 2),
          renderer: ['auto', 'svg'].includes(p.renderer) ? p.renderer : base.renderer,
        };
      }
      const fract = x => x - Math.floor(x);
      const hash = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
      const mix = (a, b, t) => a + (b - a) * t;
      function noise(x, y) {
        const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
        const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10), uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
        return mix(mix(hash(ix, iy), hash(ix + 1, iy), ux), mix(hash(ix, iy + 1), hash(ix + 1, iy + 1), ux), uy);
      }
      function fbm(x, y, octaves) {
        let v = 0, a = 0.5, total = 0;
        for (let i = 0; i < octaves; i++) {
          v += a * noise(x, y); total += a;
          const nx = (x * 0.8 + y * 0.6) * 2.02 + 8.1;
          y = (-x * 0.6 + y * 0.8) * 2.02 + 3.7; x = nx; a *= 0.5;
        }
        return v / total;
      }
      /** CPU field for vector export and static fallback. */
      function sampleField(x, y, time = 0, options = DEFAULT_OPTIONS) {
        const f = options.field, t = time * f.speed;
        const px = x * f.scale[0] + (f.seed % 997) * 0.013, py = y * f.scale[1] + Math.floor(f.seed / 997) * 0.017;
        const dx = Math.sin(t * 0.71) * 0.48, dy = Math.cos(t * 0.53) * 0.48;
        const qx = fbm(px + dx, py + dy, f.octaves) - 0.5, qy = fbm(px + 5.2 - dx * 0.73, py + 1.3 - dy * 0.73, f.octaves) - 0.5;
        const wx = px + f.warp * qx, wy = py + f.warp * qy;
        return fbm(wx, wy, f.octaves) * 0.78 + fbm(wx * 0.57 + 8.1, wy * 0.57 + 2.3, f.octaves) * 0.22;
      }
      function contourPaths(o, width, height, time) {
        const nx = Math.max(24, Math.min(150, Math.round(width / 11))), ny = Math.max(24, Math.round(nx * height / width));
        const values = new Float64Array((nx + 1) * (ny + 1));
        let min = Infinity, max = -Infinity;
        for (let y = 0; y <= ny; y++) for (let x = 0; x <= nx; x++) {
          const v = sampleField(x / nx, y / ny, time, o) * o.field.bands;
          values[y * (nx + 1) + x] = v; min = Math.min(min, v); max = Math.max(max, v);
        }
        const paths = [];
        for (let level = Math.ceil(min); level <= Math.floor(max); level++) {
          const segments = [], links = new Map();
          const add = (a, b) => {
            const i = segments.push([a, b]) - 1;
            for (const p of [a, b]) { if (!links.has(p.key)) links.set(p.key, []); links.get(p.key).push(i); }
          };
          for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
            const off = y * (nx + 1) + x, tl = values[off], tr = values[off + 1], bl = values[off + nx + 1], br = values[off + nx + 2];
            if (level < Math.min(tl, tr, bl, br) || level > Math.max(tl, tr, bl, br)) continue;
            const edges = [];
            const cross = (a, b, key, ax, ay, bx, by) => {
              if ((a >= level) === (b >= level)) return;
              const t = (level - a) / (b - a);
              edges.push({ key, x: (ax + (bx - ax) * t) * width / nx, y: (ay + (by - ay) * t) * height / ny });
            };
            cross(tl, tr, 'h' + x + ',' + y, x, y, x + 1, y);
            cross(tr, br, 'v' + (x + 1) + ',' + y, x + 1, y, x + 1, y + 1);
            cross(bl, br, 'h' + x + ',' + (y + 1), x, y + 1, x + 1, y + 1);
            cross(tl, bl, 'v' + x + ',' + y, x, y, x, y + 1);
            if (edges.length === 2) add(edges[0], edges[1]);
            if (edges.length === 4) {
              const connected = (tl >= level) === ((tl + tr + bl + br) / 4 >= level);
              if (connected) { add(edges[0], edges[1]); add(edges[2], edges[3]); }
              else { add(edges[0], edges[3]); add(edges[1], edges[2]); }
            }
          }
          const used = new Uint8Array(segments.length);
          const trace = (segmentIndex, endpoint) => {
            const points = [endpoint]; let current = endpoint, index = segmentIndex;
            while (index !== undefined && !used[index]) {
              used[index] = 1;
              const s = segments[index], next = s[0].key === current.key ? s[1] : s[0];
              points.push(next); current = next; index = links.get(next.key).find(i => !used[i]);
            }
            if (points.length < 3) return;
            const closed = points[0].key === points[points.length - 1].key;
            const d = points.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(2) + ' ' + p.y.toFixed(2)).join('') + (closed ? 'Z' : '');
            paths.push({ level, d });
          };
          for (const [key, indices] of links) if (indices.length === 1 && !used[indices[0]]) {
            const s = segments[indices[0]]; trace(indices[0], s[0].key === key ? s[0] : s[1]);
          }
          for (let i = 0; i < segments.length; i++) if (!used[i]) trace(i, segments[i][0]);
        }
        return paths;
      }
      function buildContourSVG(settings = {}, { width = 1536, height = 2048, time = 0, transparent = false } = {}) {
        const o = normalizeOptions(settings), s = o.style;
        width = Math.round(number(width, 1536, 16, 8192)); height = Math.round(number(height, 2048, 16, 8192)); time = number(time, 0, 0, 1000000);
        const edge = Math.max(0.1, s.edgeFade * 100);
        const paths = contourPaths(o, width, height, time).map(({ level, d }) => {
          const major = level % 5 === 0, dash = s.dashed && level % 5 === 2 ? ' stroke-dasharray="5 5"' : '';
          return '<path d="' + d + '" stroke-width="' + (s.lineWidth * (major ? 1.65 : 1)).toFixed(3) +
            '" stroke-opacity="' + (s.alpha * (major ? 1 : 0.68)).toFixed(3) + '"' + dash + '/>';
        }).join('');
        const stops = '<stop offset="0" stop-color="black"/><stop offset="' + edge + '%" stop-color="white"/>' +
          '<stop offset="' + (100 - edge) + '%" stop-color="white"/><stop offset="100%" stop-color="black"/>';
        return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">' +
          '<defs><linearGradient id="cx">' + stops + '</linearGradient><linearGradient id="cy" x1="0" y1="0" x2="0" y2="1">' + stops +
          '</linearGradient><mask id="mx"><rect width="100%" height="100%" fill="url(#cx)"/></mask>' +
          '<mask id="my"><rect width="100%" height="100%" fill="url(#cy)"/></mask></defs>' +
          (transparent ? '' : '<rect width="100%" height="100%" fill="' + s.background + '"/>') +
          '<g mask="url(#mx)"><g mask="url(#my)" fill="none" stroke="' + s.color + '" stroke-linecap="round" stroke-linejoin="round">' + paths + '</g></g></svg>';
      }
      
      const VERTEX = 'attribute vec2 a_position;void main(){gl_Position=vec4(a_position,0.,1.);}';
      const FRAGMENT = [
        '#extension GL_OES_standard_derivatives : enable',
        '#ifdef GL_FRAGMENT_PRECISION_HIGH',
        'precision highp float;',
        '#else',
        'precision mediump float;',
        '#endif',
        'uniform vec2 u_res; uniform float u_dpr,u_time; uniform vec2 u_scale;',
        'uniform float u_octaves,u_bands,u_warp,u_speed,u_seed;',
        'uniform vec3 u_color,u_background,u_accentColor;',
        'uniform float u_alpha,u_lineWidth,u_softness,u_edgeFade,u_dashed,u_accent,u_transparent,u_tile; uniform vec2 u_fade;',
        'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}',
        'float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*f*(f*(f*6.-15.)+10.);',
        'return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}',
        'float fbm(vec2 p){float v=0.,a=.5,total=0.;for(int i=0;i<6;i++){if(float(i)>=u_octaves)break;',
        'v+=a*noise(p);total+=a;p=mat2(.8,-.6,.6,.8)*p*2.02+vec2(8.1,3.7);a*=.5;}return v/total;}',
        'void main(){vec2 uv=vec2(gl_FragCoord.x/u_res.x,1.-gl_FragCoord.y/u_res.y);',
        'vec2 p=vec2(gl_FragCoord.x,gl_FragCoord.y)/u_res.y*u_scale.y+vec2(mod(u_seed,997.)*.013,floor(u_seed/997.)*.017);float t=u_time*u_speed;',
        'vec2 drift=vec2(sin(t*.71),cos(t*.53))*.48;vec2 q=vec2(fbm(p+drift),fbm(p+vec2(5.2,1.3)-drift*.73))-.5;',
        'vec2 w=p+u_warp*q;float f=fbm(w)*.78+fbm(w*.57+vec2(8.1,2.3))*.22;',
        'float level=f*u_bands,idx=floor(level+.5),dist=abs(level-idx);',
        'float grad=max(length(vec2(dFdx(level),dFdy(level))),.00001);',
        'float major=1.-step(.5,mod(idx,5.));float halfWidth=u_lineWidth*u_dpr*mix(1.,1.65,major)*.5;float soft=u_softness*u_dpr*.5;',
        'float line=1.-smoothstep(max(0.,halfWidth-soft)*grad,(halfWidth+soft)*grad,dist);',
        'float dashLine=1.-step(.5,abs(mod(idx,5.)-2.));float dash=smoothstep(-.15,.15,sin((p.x+p.y*.8)*72.));',
        'line*=mix(1.,dash,u_dashed*dashLine);float edge=min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y));',
        'float fade=1.;if(u_tile<.5){fade=smoothstep(.012,max(.013,u_edgeFade),edge);',
        'fade*=1.-smoothstep(u_fade.x,u_fade.y,length((uv-.5)*vec2(1.1,1.)));}',
        'float alpha=line*fade*u_alpha*mix(.68,1.,major);',
        'float sweep=pow(max(0.,sin(p.x*.8+p.y*.3-u_time*.12)),24.)*u_accent;',
        'vec3 color=mix(u_color,u_accentColor,sweep);',
        'if(u_transparent>.5)gl_FragColor=vec4(color,alpha);else gl_FragColor=vec4(mix(u_background,color,alpha),1.);}',
      ].join('\n');
      const rgb = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
      function makeGL(canvas, initial) {
        const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true, depth: false, stencil: false });
        if (!gl || !gl.getExtension('OES_standard_derivatives')) throw new Error('WebGL derivatives unavailable');
        const shaders = []; let program, buffer;
        const dispose = () => { if (buffer) gl.deleteBuffer(buffer); if (program) gl.deleteProgram(program); for (const shader of shaders) gl.deleteShader(shader); };
        try {
          const compile = (type, source) => { const s = gl.createShader(type); shaders.push(s); gl.shaderSource(s, source); gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
          program = gl.createProgram(); gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX)); gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
          gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
          gl.useProgram(program); gl.disable(gl.DITHER); gl.disable(gl.BLEND);
          buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
          const a = gl.getAttribLocation(program, 'a_position'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
          const uniforms = {};
          for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i++) { const name = gl.getActiveUniform(program, i).name; uniforms[name] = gl.getUniformLocation(program, name); }
          let options, color, background, accentColor;
          const update = next => { options = next; color = rgb(next.style.color); background = rgb(next.style.background); accentColor = rgb(next.style.accentColor); };
          update(initial);
          const draw = (time, width, height, dpr = 1, transparent = false) => {
            const f = options.field, s = options.style, u = uniforms;
            gl.useProgram(program); gl.viewport(0, 0, width, height);
            gl.uniform2f(u.u_res, width, height); gl.uniform1f(u.u_time, time); gl.uniform1f(u.u_dpr, dpr);
            gl.uniform2f(u.u_scale, f.scale[0], f.scale[1]); gl.uniform1f(u.u_octaves, f.octaves); gl.uniform1f(u.u_bands, f.bands);
            gl.uniform1f(u.u_warp, f.warp); gl.uniform1f(u.u_speed, f.speed); gl.uniform1f(u.u_seed, f.seed);
            gl.uniform3f(u.u_color, color[0], color[1], color[2]); gl.uniform3f(u.u_background, background[0], background[1], background[2]);
            gl.uniform3f(u.u_accentColor, accentColor[0], accentColor[1], accentColor[2]);
            gl.uniform1f(u.u_alpha, s.alpha); gl.uniform1f(u.u_lineWidth, s.lineWidth); gl.uniform1f(u.u_softness, s.softness);
            gl.uniform2f(u.u_fade, s.fade[0], s.fade[1]); gl.uniform1f(u.u_edgeFade, s.edgeFade);
            gl.uniform1f(u.u_dashed, s.dashed ? 1 : 0); gl.uniform1f(u.u_accent, s.accent); gl.uniform1f(u.u_transparent, transparent ? 1 : 0);
            gl.uniform1f(u.u_tile, s.tile ? 1 : 0);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
          };
          return { draw, update, destroy: dispose, release: () => gl.getExtension('WEBGL_lose_context')?.loseContext() };
        } catch (error) { dispose(); throw error; }
      }
      const clone = v => JSON.parse(JSON.stringify(v));
      const canvasBlob = c => new Promise((resolve, reject) => c.toBlob(b => b ? resolve(b) : reject(new Error('PNG export failed')), 'image/png'));
      async function svgToPNG(svg, width, height) {
        const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        const image = new Image(), canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        try {
          await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('SVG rasterization failed')); image.src = url; });
          canvas.getContext('2d').drawImage(image, 0, 0, width, height); return await canvasBlob(canvas);
        } finally { URL.revokeObjectURL(url); }
      }
      function createContourField({ canvas, onStateChange, ...settings } = {}) {
        if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('A canvas is required');
        const doc = canvas.ownerDocument, win = doc.defaultView;
        let options = normalizeOptions(settings), gpu = null, backend = 'svg', error = '';
        let destroyed = false, requested = options.motion, raf = 0, frames = 0, time = 0, lastStamp = null, lastDraw = -Infinity;
        let width = 1, height = 1, dpr = 1, fallback = null, band = null, bandAnimation = null, fallbackTimer = 0;
        const originalVisibility = canvas.style.visibility, parent = canvas.parentElement, originalPosition = parent?.style.position;
        const media = win.matchMedia('(prefers-reduced-motion: reduce)');
        const notify = () => { if (onStateChange) onStateChange(api.getState()); };
        const allowed = () => requested && options.motion && (options.field.speed > 0 || options.style.accent > 0) && !doc.hidden && !(options.respectReducedMotion && media.matches) &&
          canvas.closest('[data-motion]')?.getAttribute('data-motion') !== 'off';
        function clearFallback() {
          if (fallbackTimer) win.clearTimeout(fallbackTimer); fallbackTimer = 0;
          bandAnimation?.cancel(); bandAnimation = null; fallback?.remove(); fallback = null; band = null; canvas.style.visibility = originalVisibility;
        }
        function refreshFallback() {
          if (destroyed || backend !== 'svg' || !parent) return;
          if (!fallback) {
            if (win.getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
            fallback = doc.createElement('div'); fallback.setAttribute('aria-hidden', 'true'); fallback.dataset.contourFallback = '';
            Object.assign(fallback.style, { position: 'absolute', overflow: 'hidden', pointerEvents: 'none' }); parent.append(fallback);
          }
          const cw = canvas.clientWidth || 480, ch = canvas.clientHeight || 640;
          Object.assign(fallback.style, { left: canvas.offsetLeft + 'px', top: canvas.offsetTop + 'px', width: cw + 'px', height: ch + 'px', backgroundColor: options.style.background });
          canvas.style.visibility = 'hidden';
          const svg = buildContourSVG(options, { width: Math.round(cw), height: Math.round(ch), time, transparent: true });
          fallback.style.backgroundImage = 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")'; fallback.style.backgroundSize = '100% 100%';
          bandAnimation?.cancel(); band?.remove(); band = doc.createElement('div');
          const mask = buildContourSVG({ ...options, style: { ...options.style, color: '#ffffff', alpha: 1 } }, { width: Math.round(cw), height: Math.round(ch), time, transparent: true });
          Object.assign(band.style, { position: 'absolute', inset: '0', opacity: String(options.style.alpha * options.style.accent),
            maskImage: 'url("data:image/svg+xml,' + encodeURIComponent(mask) + '")', maskSize: '100% 100%' });
          const beam = doc.createElement('div');
          Object.assign(beam.style, { position: 'absolute', inset: '-10% auto -10% -45%', width: '45%', background: 'linear-gradient(90deg,transparent,' + options.style.accentColor + ',transparent)' });
          band.append(beam); fallback.append(band);
          bandAnimation = beam.animate([{ transform: 'translateX(-100%)' }, { transform: 'translateX(420%)' }], { duration: 11000, iterations: Infinity });
          if (!allowed() || options.style.accent === 0) bandAnimation.pause();
        }
        function draw() { if (destroyed) return; if (gpu) gpu.draw(time, width, height, dpr); frames++; }
        function tick(stamp) {
          raf = 0; if (destroyed || !allowed() || backend !== 'webgl') return;
          if (lastStamp !== null) time += Math.min(0.15, Math.max(0, (stamp - lastStamp) / 1000)); lastStamp = stamp;
          if (stamp - lastDraw >= 1000 / options.fps - 0.5) { draw(); lastDraw = stamp; }
          raf = win.requestAnimationFrame(tick);
        }
        function syncMotion() {
          if (raf) win.cancelAnimationFrame(raf); raf = 0; lastStamp = null; lastDraw = -Infinity;
          if (!destroyed && allowed()) { if (backend === 'webgl') raf = win.requestAnimationFrame(tick); else if (options.style.accent > 0) bandAnimation?.play(); else bandAnimation?.pause(); }
          else bandAnimation?.pause(); notify();
        }
        function resize() {
          if (destroyed) return;
          const rect = canvas.getBoundingClientRect(); dpr = Math.min(win.devicePixelRatio || 1, options.maxDpr, 2);
          width = Math.max(1, Math.round((rect.width || 480) * dpr)); height = Math.max(1, Math.round((rect.height || 640) * dpr));
          if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
          if (backend === 'svg') refreshFallback(); else draw();
        }
        function selectBackend() {
          gpu?.destroy(); gpu = null; clearFallback();
          if (options.renderer === 'auto') {
            try { gpu = makeGL(canvas, options); backend = 'webgl'; error = ''; } catch (reason) { backend = 'svg'; error = String(reason.message || reason); }
          } else { backend = 'svg'; error = ''; }
        }
        const contextLost = event => { event.preventDefault(); gpu = null; backend = 'svg'; error = 'WebGL context lost'; refreshFallback(); syncMotion(); };
        const contextRestored = () => { if (!destroyed) { selectBackend(); resize(); syncMotion(); } };
        const api = {
          setOptions(patch) {
            if (destroyed) return;
            const previous = options; options = normalizeOptions(patch, options);
            if (options.renderer !== previous.renderer) selectBackend(); else gpu?.update(options);
            if (backend === 'svg') {
              if (fallbackTimer) win.clearTimeout(fallbackTimer);
              fallbackTimer = win.setTimeout(() => { fallbackTimer = 0; refreshFallback(); syncMotion(); }, 60);
            } else if (options.maxDpr !== previous.maxDpr) resize(); else draw();
            syncMotion();
          },
          getOptions: () => clone(options),
          getState: () => ({ backend, running: !destroyed && allowed() && (backend === 'webgl' ? raf !== 0 : bandAnimation?.playState === 'running'),
            requestedRunning: requested, time, frames, width, height, dpr, destroyed, reducedMotion: media.matches, error }),
          start() { if (!destroyed) { requested = true; syncMotion(); } },
          stop() { requested = false; syncMotion(); },
          renderAt(seconds = 0) {
            if (destroyed) throw new Error('Contour field has been destroyed');
            requested = false; time = number(seconds, 0, 0, 1000000); syncMotion(); if (backend === 'svg') refreshFallback(); else draw();
          },
          exportSVG({ width = 1536, height = 2048, time: at = time, transparent = false, ...patch } = {}) {
            return buildContourSVG(normalizeOptions(patch, options), { width, height, time: at, transparent });
          },
          async exportPNG({ width: w = 1536, height: h = 2048, time: at = time, transparent = false, ...patch } = {}) {
            if (destroyed) throw new Error('Contour field has been destroyed');
            w = Math.round(number(w, 1536, 16, 8192)); h = Math.round(number(h, 2048, 16, 8192));
            at = number(at, time, 0, 1000000);
            const snapshot = normalizeOptions(patch, options), target = doc.createElement('canvas'); target.width = w; target.height = h;
            if (backend === 'svg') return svgToPNG(buildContourSVG(snapshot, { width: w, height: h, time: at, transparent }), w, h);
            let exporter;
            try { exporter = makeGL(target, snapshot); exporter.draw(at, w, h, 1, transparent); return await canvasBlob(target); }
            finally { exporter?.destroy(); exporter?.release(); }
          },
          destroy() {
            if (destroyed) return; requested = false; if (raf) win.cancelAnimationFrame(raf); raf = 0; destroyed = true;
            observer.disconnect(); motionObserver.disconnect(); media.removeEventListener('change', syncMotion);
            doc.removeEventListener('visibilitychange', syncMotion); win.removeEventListener('resize', resize);
            canvas.removeEventListener('webglcontextlost', contextLost); canvas.removeEventListener('webglcontextrestored', contextRestored);
            gpu?.destroy(); gpu = null; clearFallback(); if (parent) parent.style.position = originalPosition;
          },
        };
        const observer = new win.ResizeObserver(resize), motionObserver = new win.MutationObserver(syncMotion);
        for (let node = canvas; node; node = node.parentElement) motionObserver.observe(node, { attributes: true, attributeFilter: ['data-motion'] });
        selectBackend(); resize(); observer.observe(canvas); media.addEventListener('change', syncMotion); doc.addEventListener('visibilitychange', syncMotion);
        win.addEventListener('resize', resize); canvas.addEventListener('webglcontextlost', contextLost); canvas.addEventListener('webglcontextrestored', contextRestored);
        syncMotion(); return api;
      }
      
      return { DEFAULT_OPTIONS: DEFAULT_OPTIONS, normalizeOptions: normalizeOptions, sampleField: sampleField, buildContourSVG: buildContourSVG, createContourField: createContourField }
    })()
    // #endregion vendor-contour-field

    /* ── 显示偏好（本地保存，不经过 Host） ───────────────────────────── */

    /**
     * 等高线工坊的默认参数（和 GPT 交付的 DEFAULT_OPTIONS 对齐）。
     * 线色改成面板的灰白，掠光改成面板的琥珀 #ff7f00，默认给 35% 让流光可见。
     */
    var DEFAULT_STUDIO = {
      field: { scale: [3.7, 4.93], octaves: 3, bands: 48, warp: 1.35, speed: 0.006, seed: 721 },
      style: {
        color: '#b8bdbb',
        background: '#111416',
        alpha: 0.64,
        lineWidth: 0.85,
        softness: 0.8,
        fade: [0.48, 0.82],
        edgeFade: 0.1,
        dashed: true,
        accentColor: '#ff7f00',
        accent: 0.35,
      },
      motion: true,
      fps: 30,
      maxDpr: 2,
      renderer: 'auto',
      respectReducedMotion: true,
    }

    function studioDefaults() {
      return JSON.parse(JSON.stringify(DEFAULT_STUDIO))
    }

    var DEFAULT_FROST = { enabled: true, blur: 20, opacity: 0.06, saturation: 140 }

    function frostDefaults() {
      return JSON.parse(JSON.stringify(DEFAULT_FROST))
    }

    var DEFAULT_PRICING = { inputPerM: 0, outputPerM: 0 }

    function pricingDefaults() {
      return JSON.parse(JSON.stringify(DEFAULT_PRICING))
    }

    /**
     * 性能模式的“效果开关”注册表。
     * 以后新增窗口动画时，把 id 加进 EFFECT_DEFS：visual 默认开、performance 默认关；
     * 动画元素加 `.__rp_fx`，CSS 会按 data-effect-window 自动停掉。
     */
    var EFFECT_DEFS = [
      { id: 'contourMotion', key: 'effectContour' },
      { id: 'tilt', key: 'effectTilt' },
      { id: 'scan', key: 'effectScan' },
      { id: 'blur', key: 'effectBlur' },
      { id: 'reveal', key: 'effectReveal' },
      { id: 'flow', key: 'effectFlow' },
      { id: 'windowAnimations', key: 'effectWindow' },
      { id: 'statusPulse', key: 'effectPulse' },
      // 战术网格（地图模式）：静态 CSS，没有动画开销，性能模式默认也关掉只为「更素」。
      { id: 'grid', key: 'effectGrid' },
    ]
    var EFFECT_KEYS = EFFECT_DEFS.map(function (effect) {
      return effect.id
    })

    function visualEffects() {
      var out = {}
      EFFECT_KEYS.forEach(function (key) {
        out[key] = true
      })
      return out
    }

    function performanceEffects() {
      var out = {}
      EFFECT_KEYS.forEach(function (key) {
        out[key] = false
      })
      return out
    }

    function effectsForMode(mode) {
      return mode === 'performance' ? performanceEffects() : visualEffects()
    }

    function normalizeEffects(input, mode) {
      var out = effectsForMode(mode)
      if (input && typeof input === 'object') {
        EFFECT_KEYS.forEach(function (key) {
          if (typeof input[key] === 'boolean') out[key] = input[key]
        })
      }
      return out
    }

    function activeEffects() {
      return normalizeEffects(prefs.effects, prefs.mode)
    }

    function defaultProfile(mode) {
      var studio = studioDefaults()
      if (mode === 'performance') {
        studio.motion = false
      }
      return {
        contour: 'studio',
        surface: mode === 'performance' ? 0.5 : 0.45,
        studio: studio,
        frost: frostDefaults(),
        effects: effectsForMode(mode),
      }
    }

    var PREFS_KEY = 'dsh-running-panel:prefs'
    var soulScope = null
    var echoT = null
    var echoWorkspace = null
    var echoConversation = null
    var clientSessions = null
    var prefs = {
      mode: 'visual',
      scheme: 'auto',
      contour: 'studio',
      surface: 0.45,
      studio: studioDefaults(),
      frost: frostDefaults(),
      pricing: pricingDefaults(),
      budgetTokens: 3000,
      /** 预算线：'auto' = 上下文窗口 × budgetRatio，夹在 budgetMin～budgetMax；'fixed' = 用 budgetTokens。 */
      budgetMode: 'auto',
      budgetRatio: 0.01,
      budgetMin: 3000,
      budgetMax: 20000,
      /** 最近一次会话上报的上下文窗口（tok）；没有会话上报时预算线按它算。 */
      lastContextWindow: 0,
      /** 菜单（设置、装配窗口）开关时的淡入淡出时长（毫秒，0 = 即时）和背景模糊半径（px）。 */
      menuFadeMs: 140,
      menuBlurPx: 10,
      corner: true,
      /** 专注模式：目标开始后没用过的行变淡。默认关。 */
      focusMode: false,
      /** 新技能自动翻译：后台用 DSH 默认模型补中文名和说明。默认开。 */
      autoTranslate: true,
      /** 没有目标时用模型推断一个目标提议（点了才算数）。默认开。 */
      inferGoal: true,
      /**
       * 后台模型调用的总同意：'' 未决定（面板顶部出说明卡）| 'granted' | 'declined'。
       * 没同意之前，翻译 / 推断目标 / 灵感收集都不会自动调用模型（单项开关默认开，只在同意后生效）。
       */
      modelConsent: '',
      /** 每轮结束后自动收集灵感与分支（关键词预筛，命中才调模型）。默认开。 */
      collectIdeas: true,
      /** 合成音效：默认关（长时间开着干活的工具，声音默认开容易烦）。音量 0..1。 */
      sfx: false,
      sfxVolume: 0.6,
      pins: { skills: [], libs: [] },
      effects: visualEffects(),
      profiles: {},
      folds: {},
    }
    var prefsStore = { version: 0, listeners: new Set() }

    function clamp01(value) {
      return Math.min(1, Math.max(0, Number(value) || 0))
    }

    function loadPrefs() {
      try {
        var raw = window.localStorage.getItem(PREFS_KEY)
        if (raw) {
          var parsed = JSON.parse(raw)
          if (parsed && typeof parsed === 'object') {
            if (parsed.mode === 'performance' || parsed.mode === 'visual') prefs.mode = parsed.mode
            if (parsed.effects && typeof parsed.effects === 'object') {
              prefs.effects = normalizeEffects(parsed.effects, prefs.mode)
            } else {
              prefs.effects = effectsForMode(prefs.mode)
            }
            if (parsed.profiles && typeof parsed.profiles === 'object') prefs.profiles = parsed.profiles
            // 旧版本只有 gl / svg；全面接入工坊后统一迁移到 studio。
            if (parsed.contour === 'studio' || parsed.contour === 'off') prefs.contour = parsed.contour
            else if (parsed.contour) prefs.contour = 'studio'
            if (typeof parsed.surface === 'number') prefs.surface = clamp01(parsed.surface)
            if (parsed.folds && typeof parsed.folds === 'object') prefs.folds = Object.assign({}, parsed.folds)
            if (parsed.frost && typeof parsed.frost === 'object') {
              prefs.frost = Object.assign(frostDefaults(), parsed.frost)
              prefs.frost.blur = Math.min(32, Math.max(0, Number(prefs.frost.blur) || 0))
              prefs.frost.opacity = Math.min(0.3, Math.max(0, Number(prefs.frost.opacity) || 0))
              prefs.frost.saturation = Math.min(200, Math.max(100, Number(prefs.frost.saturation) || 100))
            }
            if (parsed.pricing && typeof parsed.pricing === 'object') {
              prefs.pricing = Object.assign(pricingDefaults(), parsed.pricing)
              prefs.pricing.inputPerM = Math.max(0, Number(prefs.pricing.inputPerM) || 0)
              prefs.pricing.outputPerM = Math.max(0, Number(prefs.pricing.outputPerM) || 0)
            }
            if (parsed.budgetMode === 'fixed' || parsed.budgetMode === 'auto') prefs.budgetMode = parsed.budgetMode
            if (parsed.budgetTokens != null) {
              var budgetTokens = Math.round(Number(parsed.budgetTokens))
              if (Number.isFinite(budgetTokens) && budgetTokens > 0) prefs.budgetTokens = budgetTokens
            }
            ;['budgetRatio', 'budgetMin', 'budgetMax', 'lastContextWindow', 'menuFadeMs', 'menuBlurPx'].forEach(function (key) {
              var n = Number(parsed[key])
              if (parsed[key] != null && Number.isFinite(n) && n >= 0) prefs[key] = n
            })
            if (parsed.corner != null) prefs.corner = parsed.corner !== false
            prefs.focusMode = parsed.focusMode === true
            prefs.autoTranslate = parsed.autoTranslate !== false
            prefs.inferGoal = parsed.inferGoal !== false
            prefs.collectIdeas = parsed.collectIdeas !== false
            if (parsed.modelConsent === 'granted' || parsed.modelConsent === 'declined') prefs.modelConsent = parsed.modelConsent
            prefs.sfx = parsed.sfx === true
            if (parsed.sfxVolume != null) prefs.sfxVolume = clamp01(parsed.sfxVolume)
            if (parsed.scheme === 'light' || parsed.scheme === 'dark') prefs.scheme = parsed.scheme
            if (parsed.pins && typeof parsed.pins === 'object') {
              prefs.pins = {
                skills: Array.isArray(parsed.pins.skills) ? parsed.pins.skills.filter(function (v) { return typeof v === 'string' }) : [],
                libs: Array.isArray(parsed.pins.libs) ? parsed.pins.libs.filter(function (v) { return typeof v === 'string' }) : [],
              }
            }
            if (parsed.studio && typeof parsed.studio === 'object') {
              var saved = parsed.studio
              var base = studioDefaults()
              prefs.studio = Object.assign(base, saved)
              prefs.studio.field = Object.assign(base.field, saved.field || {})
              prefs.studio.style = Object.assign(base.style, saved.style || {})
              // 旧默认 0.018 对“微动”来说偏快；一次性降到 0.006。
              if (prefs.studio.field.speed === 0.018) prefs.studio.field.speed = 0.006
            }
          }
        }
      } catch (error) {
        /* 隐私模式下 localStorage 不可用，保持默认 */
      }
    }

    function savePrefs() {
      try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
      } catch (error) {
        /* 存不了也不影响本次会话 */
      }
    }

    function notifyPrefs() {
      prefsStore.version += 1
      prefsStore.listeners.forEach(function (listener) {
        try {
          listener()
        } catch (error) {
          /* 单个订阅者失败不影响其他 */
        }
      })
    }

    function setPref(key, value) {
      prefs[key] = value
      savePrefs()
      notifyPrefs()
    }

    /** 只改工坊参数的一小块，保留其余字段；主题切换不能重置 motion/fps/未来字段。 */
    function setStudio(patch) {
      var base = prefs.studio && typeof prefs.studio === 'object' ? prefs.studio : studioDefaults()
      var next = Object.assign({}, base)
      next.field = Object.assign({}, base.field || {}, (patch && patch.field) || {})
      next.style = Object.assign({}, base.style || {}, (patch && patch.style) || {})
      if (patch) {
        Object.keys(patch).forEach(function (key) {
          if (key !== 'field' && key !== 'style') next[key] = patch[key]
        })
      }
      setPref('studio', next)
    }

    function captureProfile() {
      return {
        contour: prefs.contour,
        surface: prefs.surface,
        studio: JSON.parse(JSON.stringify(prefs.studio)),
        frost: JSON.parse(JSON.stringify(prefs.frost)),
        effects: normalizeEffects(prefs.effects, prefs.mode),
      }
    }

    function applyProfile(profile, mode) {
      var next = profile && typeof profile === 'object' ? profile : defaultProfile(mode)
      prefs.contour = next.contour === 'off' ? 'off' : 'studio'
      prefs.surface = clamp01(next.surface == null ? 0.45 : next.surface)
      var studio = next.studio && typeof next.studio === 'object' ? next.studio : studioDefaults()
      prefs.studio = Object.assign(studioDefaults(), studio)
      prefs.studio.field = Object.assign(studioDefaults().field, studio.field || {})
      prefs.studio.style = Object.assign(studioDefaults().style, studio.style || {})
      prefs.frost = Object.assign(frostDefaults(), next.frost || {})
      prefs.frost.blur = Math.min(32, Math.max(0, Number(prefs.frost.blur) || 0))
      prefs.frost.opacity = Math.min(0.3, Math.max(0, Number(prefs.frost.opacity) || 0))
      prefs.frost.saturation = Math.min(200, Math.max(100, Number(prefs.frost.saturation) || 100))
      prefs.effects = normalizeEffects(next.effects, mode)
    }

    /**
     * 切视效/性能模式：
     * 先保存当前模式的所有效果相关设置，再载入目标模式的存档；主题（黑白）作为全局偏好
     * 复制到目标，避免切模式把纸白/墨黑重置掉。
     */
    function switchMode(mode) {
      var target = mode === 'performance' ? 'performance' : 'visual'
      if (target === prefs.mode) return
      var profiles = Object.assign({}, prefs.profiles || {})
      profiles[prefs.mode] = captureProfile()
      var profile = profiles[target]
        ? JSON.parse(JSON.stringify(profiles[target]))
        : defaultProfile(target)
      var palette = {
        background: prefs.studio.style.background,
        color: prefs.studio.style.color,
        accentColor: prefs.studio.style.accentColor,
      }
      profile.studio = Object.assign({}, studioDefaults(), profile.studio || {})
      profile.studio.style = Object.assign({}, studioDefaults().style, profile.studio.style || {}, palette)
      profiles[target] = profile
      prefs.profiles = profiles
      prefs.mode = target
      applyProfile(profile, target)
      savePrefs()
      notifyPrefs()
    }

    function setEffect(id, enabled) {
      if (EFFECT_KEYS.indexOf(id) === -1) return
      var next = Object.assign({}, activeEffects())
      next[id] = Boolean(enabled)
      prefs.effects = next
      savePrefs()
      notifyPrefs()
    }

    function resetPrefs() {
      prefs.mode = 'visual'
      prefs.contour = 'studio'
      prefs.surface = 0.45
      prefs.studio = studioDefaults()
      prefs.frost = frostDefaults()
      prefs.effects = visualEffects()
      prefs.profiles = { performance: defaultProfile('performance') }
      prefs.folds = {}
      prefs.pricing = pricingDefaults()
      prefs.budgetMode = 'auto'
      prefs.budgetTokens = 3000
      prefs.budgetRatio = 0.01
      prefs.budgetMin = 3000
      prefs.budgetMax = 20000
      prefs.menuFadeMs = 140
      prefs.menuBlurPx = 10
      savePrefs()
      notifyPrefs()
    }

    /** 记住分组/库的展开状态；id 形如 `tools`、`lib:skill:addyosmani`。 */
    function setFold(id, open) {
      if (!id) return
      var next = Object.assign({}, prefs.folds)
      next[id] = open
      setPref('folds', next)
    }

    function setFrost(patch) {
      var next = Object.assign({}, frostDefaults(), prefs.frost, patch || {})
      next.blur = Math.min(32, Math.max(0, Number(next.blur) || 0))
      next.opacity = Math.min(0.3, Math.max(0, Number(next.opacity) || 0))
      next.saturation = Math.min(200, Math.max(100, Number(next.saturation) || 100))
      setPref('frost', next)
    }

    function setPricing(patch) {
      var next = Object.assign({}, pricingDefaults(), prefs.pricing, patch || {})
      next.inputPerM = Math.max(0, Number(next.inputPerM) || 0)
      next.outputPerM = Math.max(0, Number(next.outputPerM) || 0)
      setPref('pricing', next)
    }

    /** 手动锁定面板配色；传 auto 交还给 DSH 主题。 */
    function setPanelScheme(value) {
      prefs.scheme = value === 'light' || value === 'dark' ? value : 'auto'
      savePrefs()
      notifyPrefs()
      applyDshScheme()
    }

    function setStudioPalette(dark) {
      setStudio({
        style: dark
          ? { background: '#111416', color: '#b8bdbb', accentColor: '#ff7f00' }
          : { background: '#f4f2ed', color: '#434b50', accentColor: '#b9701a' },
      })
    }

    function usePrefs() {
      var pair = React.useState(prefsStore.version)
      var version = pair[0]
      var setVersion = pair[1]
      React.useEffect(function () {
        var sync = function () {
          setVersion(prefsStore.version)
        }
        prefsStore.listeners.add(sync)
        return function () {
          prefsStore.listeners.delete(sync)
        }
      }, [])
      return version
    }

    /**
     * 工坊连续场直接当面板背景。
     * 引擎从 Host 路由动态 import，不把 23KB 模块抄进 client.js。
     */
    function ContourStudioBackground() {
      var version = usePrefs()
      var canvasRef = React.useRef(null)
      var fieldRef = React.useRef(null)
      var prefsRef = React.useRef(prefs.studio)
      prefsRef.current = prefs.studio
      var failPair = React.useState('')
      var failed = failPair[0]
      var setFailed = failPair[1]

      React.useEffect(function () {
        var canvas = canvasRef.current
        if (!canvas) return undefined
        var motion = activeEffects().contourMotion
        var field
        try {
          field = ContourEngine.createContourField(
            Object.assign({}, prefsRef.current, {
              canvas: canvas,
              motion: motion,
              style: Object.assign({}, prefsRef.current.style, { tile: false }),
            }),
          )
        } catch (error) {
          setFailed(String((error && error.message) || error))
          return undefined
        }
        if (field.getState().backend !== 'webgl') {
          field.destroy()
          setFailed('WebGL unavailable')
          return undefined
        }
        fieldRef.current = field
        if (motion) field.start()
        else field.renderAt(0)
        return function () {
          field.destroy()
          fieldRef.current = null
        }
      }, [])

      React.useEffect(
        function () {
          if (!fieldRef.current) return
          var motion = activeEffects().contourMotion
          fieldRef.current.setOptions(
            Object.assign({}, prefsRef.current, {
              motion: motion,
              style: Object.assign({}, prefsRef.current.style, { tile: false }),
            }),
          )
          if (motion) fieldRef.current.start()
          else {
            fieldRef.current.stop()
            fieldRef.current.renderAt(0)
          }
        },
        [version],
      )

      if (failed) return h(ContourGL)

      var edgeFade = Math.min(0.4, Math.max(0, Number(prefs.studio.style.edgeFade) || 0.1))
      var fadePct = Math.min(40, Math.max(2, edgeFade * 200))
      var edgeMask =
        'radial-gradient(ellipse at center, #000 0%, #000 ' + (100 - fadePct) + '%, transparent 100%)'

      return h('canvas', {
        className: '__rp_studioCanvas',
        ref: canvasRef,
        'aria-hidden': 'true',
        title: failed || undefined,
        style: { maskImage: edgeMask, WebkitMaskImage: edgeMask },
      })
    }

    /* ── WebGL 等高线（域扭曲噪声 → 等值带） ─────────────────────────── */

    var GL_VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}'
    var GL_FRAG = [
      'precision mediump float;',
      'uniform vec2 u_res;',
      'uniform float u_time;',
      'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
      'float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);',
      ' return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}',
      'float fbm(vec2 p){float v=0.0;float a=0.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.02;a*=0.5;}return v;}',
      'void main(){',
      ' vec2 uv=gl_FragCoord.xy/u_res;',
      ' vec2 p=uv*vec2(2.6,3.6);',
      ' float t=u_time*0.018;',
      ' vec2 q=vec2(fbm(p+t),fbm(p+vec2(5.2,1.3)-t));',
      ' float f=fbm(p+1.8*q);',
      ' float band=abs(fract(f*8.0)-0.5);',
      ' float line=smoothstep(0.455,0.5,band);',
      ' vec2 d=uv-0.5;',
      ' float fade=1.0-smoothstep(0.22,0.52,length(d*vec2(1.1,1.0)));',
      ' float a=line*fade*0.18; gl_FragColor=vec4(vec3(0.5)*a,a);',
      '}',
    ].join('\n')

    /**
     * WebGL 等高线层：域扭曲 FBM 取等值带，条带随 time 缓慢流动（真·变形）。
     * 任何一步失败都静默回退到 SVG 层；只在可见且启用时跑 rAF。
     */
    function ContourGL(props) {
      var ref = React.useRef(null)
      var failPair = React.useState(false)
      var failed = failPair[0]
      var setFailed = failPair[1]
      React.useEffect(
        function () {
          var canvas = ref.current
          if (!canvas || typeof window === 'undefined') return undefined
          var gl = null
          var program = null
          var raf = 0
          var frameCount = 0
          try {
            gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: false })
            if (!gl) throw new Error('no-webgl')
            var compile = function (type, source) {
              var shader = gl.createShader(type)
              gl.shaderSource(shader, source)
              gl.compileShader(shader)
              if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('shader')
              return shader
            }
            program = gl.createProgram()
            gl.attachShader(program, compile(gl.VERTEX_SHADER, GL_VERT))
            gl.attachShader(program, compile(gl.FRAGMENT_SHADER, GL_FRAG))
            gl.linkProgram(program)
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('link')
            gl.useProgram(program)
            var buffer = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
            var loc = gl.getAttribLocation(program, 'a')
            gl.enableVertexAttribArray(loc)
            gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
            var uRes = gl.getUniformLocation(program, 'u_res')
            var uTime = gl.getUniformLocation(program, 'u_time')
            var start = 0
            var reduce =
              window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
            var draw = function (stamp) {
              if (!start) start = stamp
              var ratio = Math.min(window.devicePixelRatio || 1, 2)
              var width = canvas.clientWidth || 1
              var height = canvas.clientHeight || 1
              if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
                canvas.width = Math.round(width * ratio)
                canvas.height = Math.round(height * ratio)
              }
              gl.viewport(0, 0, canvas.width, canvas.height)
              gl.clearColor(0, 0, 0, 0)
              gl.clear(gl.COLOR_BUFFER_BIT)
              gl.uniform2f(uRes, canvas.width, canvas.height)
              gl.uniform1f(uTime, reduce ? 0 : (stamp - start) / 1000)
              gl.drawArrays(gl.TRIANGLES, 0, 3)
              frameCount += 1
              raf = reduce ? 0 : window.requestAnimationFrame(draw)
            }
            raf = window.requestAnimationFrame(draw)
            canvas.style.opacity = '1'
          } catch (error) {
            setFailed(true)
            return undefined
          }
          return function () {
            if (raf) window.cancelAnimationFrame(raf)
            try {
              if (gl && program) gl.deleteProgram(program)
            } catch (error) {
              /* 上下文可能已丢失 */
            }
          }
        },
        [],
      )
      if (failed) return null
      return h('canvas', { className: '__rp_gl', ref: ref, 'aria-hidden': 'true' })
    }

    /* ── 显示设置面板 ────────────────────────────────────────────────── */

    var uiStore = {
      open: false,
      version: 0,
      listeners: new Set(),
      set: function (value) {
        uiStore.open = value
        uiStore.version += 1
        uiStore.listeners.forEach(function (listener) {
          try {
            listener()
          } catch (error) {
            /* 单个订阅者失败不影响其他 */
          }
        })
      },
    }

    function useUiVersion() {
      var pair = React.useState(uiStore.version)
      var setVersion = pair[1]
      React.useEffect(function () {
        var sync = function () {
          setVersion(uiStore.version)
        }
        uiStore.listeners.add(sync)
        return function () {
          uiStore.listeners.delete(sync)
        }
      }, [])
      return pair[0]
    }

    /** 只有它订阅 uiStore，齿轮点下去才会真的重渲染。 */
    function SettingsHost(props) {
      useUiVersion()
      if (!uiStore.open) return null
      var sheet = h(SettingsSheet, { t: props.t })
      // 设置浮层必须挂到 body：面板里父级有 transform/动画，会把 fixed + z-index
      // 关在一个低层 stacking context 里，底下的列表就会画到浮层上面。
      if (ReactDOM && typeof ReactDOM.createPortal === 'function' && typeof document !== 'undefined' && document.body) {
        return ReactDOM.createPortal(sheet, document.body)
      }
      return sheet
    }

    function StudioSlider(props) {
      return h(
        'div',
        { className: '__rp_sheetRow __rp_sheetRowStack' },
        h(
          'div',
          { className: '__rp_sheetLabelRow' },
          h('span', { className: '__rp_sheetLabel' }, props.label),
          h('span', { className: '__rp_sheetValue' }, props.text),
        ),
        h('input', {
          type: 'range',
          className: '__rp_range',
          name: 'rp-studio-slider',
          'aria-label': props.label,
          min: props.min,
          max: props.max,
          step: props.step,
          value: props.value,
          onChange: function (event) {
            props.onChange(Number(event.target.value))
          },
        }),
      )
    }

    function SettingsFold(props) {
      var initialOpen =
        typeof prefs.folds[props.id] === 'boolean' ? prefs.folds[props.id] : props.defaultOpen === true
      var pair = React.useState(initialOpen)
      var open = pair[0]
      var setOpen = pair[1]
      return h(
        'div',
        { className: '__rp_setFold' },
        h(
          'button',
          {
            type: 'button',
            className: '__rp_setFoldHead',
            'aria-expanded': open ? 'true' : 'false',
            onClick: function (event) {
              var next = !open
              sfxFor(event, next ? 'expand' : 'collapse')
              setOpen(next)
              setFold(props.id, next)
            },
          },
          h('span', { className: '__rp_caret', 'aria-hidden': 'true' }, open ? '▾' : '▸'),
          h('span', null, props.title),
        ),
        open ? h('div', { className: '__rp_setFoldBody' }, props.children) : null,
      )
    }

    function FrostSettings(props) {
      var t = props.t
      usePrefs()
      var frost = prefs.frost
      return h(
        'div',
        { className: '__rp_studioSettings' },
        h(
          'label',
          { className: '__rp_sheetRow __rp_checkRow' },
          h('input', {
            type: 'checkbox',
            name: 'rp-frost-enabled',
            checked: frost.enabled,
            onChange: function (event) {
              setFrost({ enabled: event.target.checked })
            },
          }),
          h('span', { className: '__rp_sheetLabel' }, t('frostEnabled')),
        ),
        h(StudioSlider, {
          label: t('frostBlur'),
          text: String(Math.round(frost.blur)) + ' px',
          min: 0,
          max: 32,
          step: 1,
          value: frost.blur,
          onChange: function (value) {
            setFrost({ blur: value })
          },
        }),
        h(StudioSlider, {
          label: t('frostOpacity'),
          text: Math.round(frost.opacity * 100) + '%',
          min: 0,
          max: 0.3,
          step: 0.01,
          value: frost.opacity,
          onChange: function (value) {
            setFrost({ opacity: value })
          },
        }),
        h(StudioSlider, {
          label: t('frostSaturation'),
          text: String(Math.round(frost.saturation)) + '%',
          min: 100,
          max: 200,
          step: 5,
          value: frost.saturation,
          onChange: function (value) {
            setFrost({ saturation: value })
          },
        }),
        h('div', { className: '__rp_sheetHint' }, t('frostHint')),
      )
    }

    function PricingSettings(props) {
      var t = props.t
      usePrefs()
      var pricing = prefs.pricing
      return h(
        'div',
        { className: '__rp_studioSettings' },
        h('div', { className: '__rp_sheetHint' }, t('pricingHint')),
        h(
          'div',
          { className: '__rp_sheetRow' },
          h('span', { className: '__rp_sheetLabel' }, t('pricingInput')),
          h('div', { className: '__rp_priceRow' },
            h('input', {
              type: 'number',
              className: '__rp_priceInput',
              name: 'rp-pricing-input',
              'aria-label': t('pricingInput'),
              min: 0,
              step: 0.01,
              value: pricing.inputPerM,
              onChange: function (event) {
                setPricing({ inputPerM: Number(event.target.value) || 0 })
              },
            }),
            h('span', { className: '__rp_priceUnit' }, t('pricingUnit')),
          ),
        ),
        h(
          'div',
          { className: '__rp_sheetRow' },
          h('span', { className: '__rp_sheetLabel' }, t('pricingOutput')),
          h('div', { className: '__rp_priceRow' },
            h('input', {
              type: 'number',
              className: '__rp_priceInput',
              name: 'rp-pricing-output',
              'aria-label': t('pricingOutput'),
              min: 0,
              step: 0.01,
              value: pricing.outputPerM,
              onChange: function (event) {
                setPricing({ outputPerM: Number(event.target.value) || 0 })
              },
            }),
            h('span', { className: '__rp_priceUnit' }, t('pricingUnit')),
          ),
        ),
      )
    }

    /**
     * 预算线设置：软目标，只影响提示，不触发任何停用。
     * 自动档把规则（比例、下限、上限）摊开给人看，并说清窗口大小从哪来、代入几档窗口是多少。
     */
    function BudgetSettings(props) {
      var t = props.t
      usePrefs()
      var auto = prefs.budgetMode !== 'fixed'
      var rule = budgetRule()
      var win = budgetWindow()
      var limit = budgetLimitTokens()
      var numberRow = function (key, label, value, min, max, step, onValue, dim) {
        return h(
          'div',
          { key: key, className: '__rp_sheetRow', style: dim ? { opacity: 0.55 } : undefined },
          h('span', { className: '__rp_sheetLabel' }, label),
          h(
            'div',
            { className: '__rp_priceRow' },
            h('input', {
              type: 'number',
              className: '__rp_priceInput',
              name: 'rp-' + key,
              'aria-label': label,
              min: min,
              max: max,
              step: step,
              value: value,
              onChange: function (event) {
                var n = Math.round(Number(event.target.value))
                if (Number.isFinite(n) && n > 0) onValue(Math.min(max, Math.max(min, n)))
              },
            }),
            h('span', { className: '__rp_priceUnit' }, 'tok'),
          ),
        )
      }
      var status = !auto
        ? t('budgetFixedHint')
        : win.source === 'none'
          ? fill(t('budgetAutoUnknown'), 'n', formatTokens(limit))
          : fill(fill(fill(fill(fill(t(win.source === 'live' ? 'budgetAutoLive' : 'budgetAutoRemembered'), 'window', formatTokens(win.tokens)), 'pct', budgetPct(rule.ratio)), 'raw', formatTokens(Math.round(win.tokens * rule.ratio))), 'range', formatTokens(rule.min) + '～' + formatTokens(rule.max)), 'n', formatTokens(limit))
      var examples = [['128k', 128000], ['512k', 512000], ['1M', 1000000], ['2M', 2000000]].map(function (pair) {
        return pair[0] + ' → ' + formatTokens(autoBudgetTokens(pair[1]))
      })
      return h(
        'div',
        { className: '__rp_studioSettings' },
        h('div', { className: '__rp_sheetHint' }, t('budgetHint')),
        h(
          'div',
          { className: '__rp_sheetRow' },
          h('span', { className: '__rp_sheetLabel' }, t('budgetModeLabel')),
          h(
            'div',
            { className: '__rp_seg' },
            [['auto', t('budgetModeAuto')], ['fixed', t('budgetModeFixed')]].map(function (mode) {
              return h('button', { key: mode[0], type: 'button', 'aria-pressed': (auto ? 'auto' : 'fixed') === mode[0] ? 'true' : 'false', onClick: function () { setPref('budgetMode', mode[0]) } }, mode[1])
            }),
          ),
        ),
        h('div', { className: '__rp_sheetHint __rp_budgetStatus' }, status),
        auto
          ? h(StudioSlider, {
              label: t('budgetRatio'),
              text: budgetPct(rule.ratio),
              min: 0.0025,
              max: 0.03,
              step: 0.0025,
              value: rule.ratio,
              onChange: function (value) { setPref('budgetRatio', Math.round(value * 10000) / 10000) },
            })
          : null,
        auto ? numberRow('budget-min', t('budgetMin'), rule.min, 500, 100000, 500, function (n) { setPref('budgetMin', n); if (n > rule.max) setPref('budgetMax', n) }) : null,
        auto ? numberRow('budget-max', t('budgetMax'), rule.max, 1000, 200000, 1000, function (n) { setPref('budgetMax', Math.max(n, rule.min)) }) : null,
        auto ? h('div', { className: '__rp_sheetHint' }, fill(t('budgetExamples'), 'list', examples.join(' · '))) : null,
        numberRow('budget-tokens', auto ? t('budgetFallback') : t('budgetTarget'), prefs.budgetTokens, 500, 200000, 100, function (n) { setPref('budgetTokens', n) }, auto),
      )
    }
    function budgetPct(ratio) {
      return Math.round(ratio * 10000) / 100 + '%'
    }

    /** 菜单（设置、装配窗口）开关的淡入淡出时长与背景模糊。 */
    function menuFadeMs() {
      var n = Number(prefs.menuFadeMs)
      return Number.isFinite(n) ? Math.max(0, Math.min(600, Math.round(n))) : 140
    }
    function menuBlurPx() {
      var n = Number(prefs.menuBlurPx)
      return Number.isFinite(n) ? Math.max(0, Math.min(24, Math.round(n))) : 10
    }
    function menuMotionStyle() {
      return { '--rp-menu-fade': menuFadeMs() + 'ms', '--rp-menu-blur': menuBlurPx() + 'px' }
    }
    /** 关菜单时先淡出再卸载；时长为 0 时立刻关。返回 [正在关, 请求关闭]。 */
    function useMenuClose(close) {
      var pair = React.useState(false)
      var timer = React.useRef(0)
      var closeRef = React.useRef(close)
      closeRef.current = close
      React.useEffect(function () {
        return function () { clearTimeout(timer.current) }
      }, [])
      var request = function () {
        if (pair[0]) return
        var ms = menuFadeMs()
        if (!ms) {
          closeRef.current()
          return
        }
        pair[1](true)
        timer.current = setTimeout(function () { closeRef.current() }, ms)
      }
      return [pair[0], request]
    }
    function MenuMotionSettings(props) {
      var t = props.t
      usePrefs()
      var ms = menuFadeMs()
      return h(
        'div',
        { className: '__rp_studioSettings' },
        h(StudioSlider, {
          label: t('menuFade'),
          text: ms ? ms + ' ms' : t('menuFadeInstant'),
          min: 0,
          max: 600,
          step: 20,
          value: ms,
          onChange: function (value) { setPref('menuFadeMs', value) },
        }),
        h(StudioSlider, {
          label: t('menuBlur'),
          text: menuBlurPx() ? menuBlurPx() + ' px' : t('menuBlurOff'),
          min: 0,
          max: 24,
          step: 1,
          value: menuBlurPx(),
          onChange: function (value) { setPref('menuBlurPx', value) },
        }),
        h('div', { className: '__rp_sheetHint' }, t('menuMotionHint')),
      )
    }

    var CONTOUR_WORKSHOP_URL = 'https://xdeemoh.github.io/contour-workshop/' // online version (GitHub Pages); source: https://github.com/XDeemoH/contour-workshop

    /** 设置浮层里的「等高线设置」：直接改 prefs.studio，背景实时重绘。 */
    function ContourStudioSettings(props) {
      var t = props.t
      usePrefs()
      var studio = prefs.studio
      var field = studio.field
      var style = studio.style
      var setField = function (patch) {
        setStudio({ field: patch })
      }
      var setStyle = function (patch) {
        setStudio({ style: patch })
      }
      var palette = function (dark) {
        setStudioPalette(dark)
      }
      var percent = function (value) {
        return Math.round(value * 100) + '%'
      }
      return h(
        SettingsFold,
        { id: 'settings:studio', title: t('studioSection'), defaultOpen: true },
        h(
          'div',
          { className: '__rp_studioSettings' },
        h(
          'div',
          { className: '__rp_sheetRow' },
          h('span', { className: '__rp_sheetLabel' }, t('studioPalette')),
          h(
            'div',
            { className: '__rp_seg' },
            h(
              'button',
              {
                type: 'button',
                className: '__rp_segBtn',
                'data-on': String(style.background || '').toLowerCase() === '#111416' ? '1' : undefined,
                onClick: function () {
                  palette(true)
                },
              },
              t('studioDark'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: '__rp_segBtn',
                'data-on': String(style.background || '').toLowerCase() === '#f4f2ed' ? '1' : undefined,
                onClick: function () {
                  palette(false)
                },
              },
              t('studioLight'),
            ),
          ),
        ),
        h(
          'div',
          { className: '__rp_sheetRow' },
          h('span', { className: '__rp_sheetLabel' }, t('studioSeed')),
          h(
            'div',
            { className: '__rp_seedRow' },
            h('input', {
              type: 'number',
              className: '__rp_seedInput',
              name: 'rp-studio-seed',
              'aria-label': t('studioSeed'),
              min: 0,
              max: 999999,
              value: field.seed,
              onChange: function (event) {
                setField({ seed: Math.max(0, Math.min(999999, Math.floor(Number(event.target.value) || 0))) })
              },
            }),
            h(
              'button',
              {
                type: 'button',
                className: '__rp_linkBtn',
                onClick: function () {
                  setField({ seed: Math.floor(Math.random() * 1000000) })
                },
              },
              t('studioReroll'),
            ),
          ),
        ),
        h(StudioSlider, {
          label: t('studioSurface'),
          text: percent(prefs.surface),
          min: 0,
          max: 1,
          step: 0.01,
          value: prefs.surface,
          onChange: function (value) {
            setPref('surface', value)
          },
        }),
        h(StudioSlider, {
          label: t('studioSpeed'),
          text: field.speed.toFixed(3),
          min: 0,
          max: 0.05,
          step: 0.001,
          value: field.speed,
          onChange: function (value) {
            setField({ speed: value })
          },
        }),
        h(StudioSlider, {
          label: t('studioEdge'),
          text: percent(style.edgeFade),
          min: 0.02,
          max: 0.3,
          step: 0.01,
          value: style.edgeFade,
          onChange: function (value) {
            setStyle({ edgeFade: value })
          },
        }),
        h(StudioSlider, {
          label: t('studioScale'),
          text: field.scale[0].toFixed(1),
          min: 1,
          max: 7,
          step: 0.1,
          value: field.scale[0],
          onChange: function (value) {
            setField({ scale: [value, Math.round(value * 1.333 * 100) / 100] })
          },
        }),
        h(StudioSlider, {
          label: t('studioBands'),
          text: String(field.bands),
          min: 10,
          max: 80,
          step: 1,
          value: field.bands,
          onChange: function (value) {
            setField({ bands: value })
          },
        }),
        h(StudioSlider, {
          label: t('studioWarp'),
          text: field.warp.toFixed(2),
          min: 0,
          max: 3,
          step: 0.05,
          value: field.warp,
          onChange: function (value) {
            setField({ warp: value })
          },
        }),
        h(StudioSlider, {
          label: t('studioOctaves'),
          text: String(field.octaves),
          min: 1,
          max: 5,
          step: 1,
          value: field.octaves,
          onChange: function (value) {
            setField({ octaves: value })
          },
        }),
        h(StudioSlider, {
          label: t('studioLineWidth'),
          text: style.lineWidth.toFixed(2) + ' px',
          min: 0.35,
          max: 2,
          step: 0.05,
          value: style.lineWidth,
          onChange: function (value) {
            setStyle({ lineWidth: value })
          },
        }),
        h(StudioSlider, {
          label: t('studioAlpha'),
          text: percent(style.alpha),
          min: 0.02,
          max: 1,
          step: 0.01,
          value: style.alpha,
          onChange: function (value) {
            setStyle({ alpha: value })
          },
        }),
        h(StudioSlider, {
          label: t('studioAccent'),
          text: percent(style.accent),
          min: 0,
          max: 1,
          step: 0.01,
          value: style.accent,
          onChange: function (value) {
            setStyle({ accent: value })
          },
        }),
        h(
          'div',
          { className: '__rp_sheetRow' },
          h('span', { className: '__rp_sheetLabel' }, t('studioLineColor')),
          h('input', {
            type: 'color',
            className: '__rp_color',
            name: 'rp-studio-line-color',
            'aria-label': t('studioLineColor'),
            value: style.color,
            onChange: function (event) {
              setStyle({ color: event.target.value })
            },
          }),
        ),
        h(
          'label',
          { className: '__rp_sheetRow __rp_checkRow' },
          h('input', {
            type: 'checkbox',
            name: 'rp-studio-dashed',
            'aria-label': t('studioDashed'),
            checked: style.dashed,
            onChange: function (event) {
              setStyle({ dashed: event.target.checked })
            },
          }),
          h('span', { className: '__rp_sheetLabel' }, t('studioDashed')),
        ),
        // 完整版工坊（独立仓库）：照片转等高线、轮廓发光、PNG/SVG 导出
        h(
          'div',
          { className: '__rp_sheetRow' },
          h('span', { className: '__rp_sheetLabel' }, t('studioMore')),
          h('a', { className: '__rp_linkBtn', href: CONTOUR_WORKSHOP_URL, target: '_blank', rel: 'noopener noreferrer', style: { textDecoration: 'none' } }, t('studioMoreLink')),
        ),
      )
    )
  }

    function SettingsModeBar(props) {
      var t = props.t
      usePrefs()
      var effects = activeEffects()
      var modes = [
        ['visual', t('modeVisual')],
        ['performance', t('modePerformance')],
      ]
      return h(
        'div',
        { className: '__rp_modeBar' },
        h(
          'div',
          { className: '__rp_modeSwitch' },
          modes.map(function (mode) {
            return h(
              'button',
              {
                key: mode[0],
                type: 'button',
                className: '__rp_segBtn',
                'data-on': prefs.mode === mode[0] ? '1' : undefined,
                'aria-pressed': prefs.mode === mode[0] ? 'true' : 'false',
                onClick: function () {
                  switchMode(mode[0])
                },
              },
              mode[1],
            )
          }),
        ),
        h(
          'div',
          { className: '__rp_modeHint' },
          t(prefs.mode === 'performance' ? 'modePerformanceHint' : 'modeVisualHint'),
        ),
        h(
          'div',
          { className: '__rp_effectGrid' },
          EFFECT_DEFS.map(function (effect) {
            return h(
              'label',
              { key: effect.id, className: '__rp_effect', title: t(effect.key) },
              h('input', {
                type: 'checkbox',
                name: 'rp-effect-' + effect.id,
                checked: effects[effect.id] !== false,
                onChange: function (event) {
                  setEffect(effect.id, event.target.checked)
                },
              }),
              h('span', null, t(effect.key)),
            )
          }),
        ),
      )
    }

    function SettingsResetDialog(props) {
      var t = props.t
      var dialog = h(
        'div',
        {
          className: '__rp_confirmWrap',
          onClick: function (event) {
            if (event.target === event.currentTarget) props.onCancel()
          },
        },
        h(
          'div',
          {
            className: '__rp_confirm',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': t('resetTitle'),
          },
          h('h3', null, t('resetTitle')),
          h('p', null, t('resetBody')),
          h(
            'div',
            { className: '__rp_confirmActions' },
            h(
              'button',
              {
                type: 'button',
                className: '__rp_linkBtn',
                autoFocus: true,
                onClick: props.onCancel,
              },
              t('resetCancel'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: '__rp_resetBtn',
                onClick: props.onConfirm,
              },
              t('resetConfirm'),
            ),
          ),
        ),
      )
      return portalToBody(dialog)
    }

    /** Host 报的插件版本（每帧快照都带 pluginVersion）；设置窗口右下角显示。 */
    var pluginVersionSeen = ''
    /** 界面自己的版本：构建时由 tools/build-client.mjs 写入。 */
    var CLIENT_VERSION = '1.1.3'

    /**
     * 界面每次刷新都换新，Host 只在 DSH 进程启动时加载一次：装完新包只刷新页面，
     * 两半就会不一致，新功能打到旧 Host 上只会得到看不懂的报错。对不上就在面板顶部说清楚。
     */
    function hostOutdated() {
      return Boolean(pluginVersionSeen) && pluginVersionSeen !== CLIENT_VERSION
    }

    function VersionMismatch(props) {
      var t = props.t
      if (!hostOutdated()) return null
      return h(
        'div',
        { className: '__rp_warnBox __rp_versionWarn', role: 'alert', key: 'version-mismatch' },
        fill(fill(t('versionMismatch'), 'client', CLIENT_VERSION), 'host', pluginVersionSeen),
      )
    }

    /**
     * 设置窗口：左侧分类列表、右侧当前分类的设置行（标签在左、值在右，开关、滑条带数值）、
     * 底部按键提示；背景虚化，和装配窗口同一套 PULSE 视觉（「PULSE //」标头、琥珀色左边条、下划线页签）。
     * 里面的控件沿用原来的组件，只换外观。
     */
    var SETTINGS_CATS = [
      ['general', 'setCatGeneral'],
      ['visual', 'setCatVisual'],
      ['model', 'setCatModel'],
      ['sound', 'setCatSound'],
      ['background', 'setCatBackground'],
      ['budget', 'setCatBudget'],
      ['pricing', 'setCatPricing'],
    ]
    var settingsCatSeen = 'general'

    CSS += '\n' + [
      '.__rp_setWrap{position:fixed;inset:0;z-index:430;display:flex;align-items:center;justify-content:center;padding:32px;box-sizing:border-box;overscroll-behavior:contain;color:#d9dee2;font-size:13.5px;line-height:1.45;background:rgba(6,9,11,.34);-webkit-backdrop-filter:blur(var(--rp-menu-blur,10px)) saturate(.8) brightness(.62);backdrop-filter:blur(var(--rp-menu-blur,10px)) saturate(.8) brightness(.62);animation:__rp_loIn var(--rp-menu-fade,.14s) ease-out both}',
      '.__rp_setWrap[data-closing="1"],.__rp_lo[data-closing="1"]{animation:__rp_loOut var(--rp-menu-fade,.14s) ease-in both;pointer-events:none}',
      '@keyframes __rp_loOut{to{opacity:0}}',
      '.__rp_setWin{box-sizing:border-box;width:min(1080px,100%);height:min(720px,100%);display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;gap:14px}',
      '.__rp_setTop{display:flex;align-items:flex-start;gap:18px}',
      '.__rp_setHeading{display:flex;flex-direction:column;gap:4px}',
      '.__rp_setKicker{color:var(--rp-amber,#ff8a1f);letter-spacing:.2em;font-size:11px;font-weight:600}',
      '.__rp_setTitle{font-size:22px;font-weight:600;letter-spacing:.04em;line-height:1.1}',
      '.__rp_setClose{margin-left:auto;background:none;border:1px solid #3a4248;border-radius:4px;color:#d9dee2;width:30px;height:30px;cursor:pointer;font:inherit}',
      '.__rp_setClose:hover{border-color:var(--rp-amber,#ff8a1f)}',
      '.__rp_setTabs{display:flex;align-items:flex-end;gap:22px;border-bottom:1px solid #2b3338}',
      '.__rp_setTab{padding:4px 2px 8px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:none;color:#8a949b;font:inherit;font-size:14px;cursor:pointer}',
      '.__rp_setTab:hover{color:#e7e9ec}',
      '.__rp_setTab[aria-selected="true"]{color:#e7e9ec;border-bottom-color:var(--rp-amber,#ff8a1f)}',
      '.__rp_setBody{display:grid;grid-template-columns:200px minmax(0,1fr);gap:24px;min-height:0}',
      '.__rp_setCats{display:flex;flex-direction:column;gap:2px;padding-top:4px;overflow:auto}',
      '.__rp_setCat{flex:none;padding:8px 12px;border:0;border-left:2px solid transparent;border-radius:0 4px 4px 0;background:none;color:#aab3b9;font:inherit;font-size:14px;cursor:pointer;text-align:left;animation:__rp_mosaicIn .9s steps(5,end) both}',
      '.__rp_setCat:hover{background:rgba(255,255,255,.04);color:#e7e9ec}',
      '.__rp_setCat:focus-visible{outline:2px solid #fff;outline-offset:-2px}',
      '.__rp_setCat[aria-selected="true"]{border-left-color:var(--rp-amber,#ff8a1f);background:rgba(255,138,31,.09);color:var(--rp-amber,#ff8a1f)}',
      '.__rp_setPane{min-height:0;overflow:auto;overscroll-behavior:contain;padding:0 8px 4px 0;display:flex;flex-direction:column;gap:0;animation:__rp_mosaicIn .8s steps(5,end) both}',
      '.__rp_setPaneTitle{font-size:18px;font-weight:600;letter-spacing:.03em;margin:2px 0 10px}',
      // 设置行：细分隔线列表，标签在左，值在右。
      '.__rp_setPane .__rp_sheetRow{display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:14px;min-height:44px;box-sizing:border-box;padding:6px 10px;border-bottom:1px solid rgba(217,222,226,.08);border-radius:4px}',
      '.__rp_setPane .__rp_sheetRow:hover{background:rgba(255,255,255,.03)}',
      '.__rp_setPane .__rp_sheetRowStack{display:grid;grid-template-columns:minmax(0,1fr) 70px minmax(120px,40%);align-items:center}',
      '.__rp_setPane .__rp_sheetRowStack .__rp_sheetLabelRow{display:contents}',
      '.__rp_setPane .__rp_sheetLabel{font-size:14px;color:#d9dee2}',
      '.__rp_setPane .__rp_sheetValue{font-size:13px;color:#aab3b9;text-align:right;font-variant-numeric:tabular-nums}',
      '.__rp_setPane .__rp_sheetHint{font-size:12px;color:#8a949b;opacity:1;padding:6px 10px}',
      '.__rp_setPane .__rp_checkRow{flex-direction:row-reverse!important;justify-content:space-between!important;cursor:pointer}',
      // 嵌套的开关行（翻译、音效里的）：外层已有分隔线，里层不再叠。
      '.__rp_setPane .__rp_sheetRow .__rp_checkRow{width:100%;padding:0;border:0;min-height:30px}',
      '.__rp_setPane .__rp_sheetRow[style]{align-items:stretch}',
      // 开关：圆角滑块，打开时琥珀色。
      '.__rp_setPane input[type="checkbox"]{-webkit-appearance:none;appearance:none;flex:none;margin:0;width:36px;height:20px;border-radius:10px;position:relative;cursor:pointer;background:#3a4248;border:0;transition:background .15s}',
      '.__rp_setPane input[type="checkbox"]::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#d9dee2;transition:transform .15s cubic-bezier(.22,1,.36,1)}',
      '.__rp_setPane input[type="checkbox"]:checked{background:var(--rp-amber,#ff8a1f)}',
      '.__rp_setPane input[type="checkbox"]:checked::after{transform:translateX(16px);background:#1b1206}',
      '.__rp_setPane input[type="checkbox"]:focus-visible{outline:2px solid #fff;outline-offset:2px}',
      '.__rp_setPane input[type="checkbox"]:disabled{opacity:.4;cursor:default}',
      // 滑条：圆角细轨 + 琥珀色圆点。
      '.__rp_setPane .__rp_range{-webkit-appearance:none;appearance:none;width:100%;height:16px;margin:0;background:linear-gradient(#3a4248,#3a4248) center/100% 3px no-repeat;border-radius:2px}',
      '.__rp_setPane .__rp_range::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:var(--rp-amber,#ff8a1f);border:0}',
      '.__rp_setPane .__rp_range::-moz-range-thumb{width:13px;height:13px;border-radius:50%;background:var(--rp-amber,#ff8a1f);border:0}',
      '.__rp_setPane .__rp_seg{flex-wrap:nowrap;gap:4px}',
      '.__rp_setPane .__rp_segBtn,.__rp_setPane .__rp_seg > button{flex:0 0 auto;min-width:64px;border:1px solid #3a4248;border-radius:4px;background:transparent;color:#aab3b9;padding:3px 12px;font:inherit;font-size:13px;cursor:pointer}',
      '.__rp_setPane .__rp_segBtn:hover,.__rp_setPane .__rp_seg > button:hover{color:#e7e9ec}',
      '.__rp_setPane .__rp_segBtn[data-on="1"],.__rp_setPane .__rp_seg > button[aria-pressed="true"]{border-color:var(--rp-amber,#ff8a1f);background:rgba(255,138,31,.1);color:var(--rp-amber,#ff8a1f)}',
      '.__rp_setPane .__rp_priceInput{background:rgba(0,0,0,.3);border:1px solid #3a4248;color:#e7e9ec;padding:4px 8px;width:110px;font:inherit}',
      '.__rp_setPane .__rp_priceUnit{color:#8a949b}',
      '.__rp_setPane .__rp_modeBar{display:flex;flex-direction:column;gap:6px}',
      '.__rp_setPane .__rp_modeSwitch{display:flex;gap:4px}',
      '.__rp_setPane .__rp_modeSwitch .__rp_segBtn{flex:1 1 0;padding:7px 10px}',
      '.__rp_setPane .__rp_modeHint{font-size:12px;color:#8a949b;padding:4px 10px 6px}',
      '.__rp_setPane .__rp_effectGrid{display:flex;flex-direction:column;gap:0}',
      '.__rp_setPane .__rp_effect{display:flex;flex-direction:row-reverse;justify-content:space-between;align-items:center;gap:14px;min-height:44px;box-sizing:border-box;padding:6px 10px;font-size:14px;color:#d9dee2;border-bottom:1px solid rgba(217,222,226,.08)}',
      '.__rp_setPane .__rp_setFold{border-top:0;margin-top:10px;padding-top:0}',
      '.__rp_setPane .__rp_setFoldHead{color:var(--rp-amber,#ff8a1f);font-size:12px;letter-spacing:.16em}',
      '.__rp_setPane .__rp_studioSettings{display:flex;flex-direction:column;gap:0}',
      '.__rp_setPane .__rp_goalBtn{border:1px solid #3a4248;background:transparent;color:#d9dee2;padding:4px 10px;font:inherit;cursor:pointer}',
      '.__rp_setFoot{display:flex;align-items:center;gap:16px;flex-wrap:wrap;border-top:1px solid #2b3338;padding-top:10px;color:#8a949b;font-size:12px}',
      '.__rp_setKey{display:flex;align-items:center;gap:6px;padding:0;border:0;background:none;color:#8a949b;font:inherit;cursor:pointer}',
      'button.__rp_setKey:hover{color:#e7e9ec}',
      'span.__rp_setKey{cursor:default}',
      '.__rp_setKey kbd{font:inherit;font-size:11px;padding:0 5px;border:1px solid #3a4248;border-radius:3px;color:#d9dee2}',
      '.__rp_setWin .__rp_sheetVersion{margin:0 0 0 auto;font-size:12px;color:#8a949b}',
      '@media (max-width:760px){.__rp_setWrap{padding:16px}.__rp_setBody{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}.__rp_setCats{flex-direction:row;flex-wrap:wrap;padding-top:6px;overflow:visible}.__rp_setCat{flex:1 1 auto;padding:7px 10px}.__rp_setCat{border-left:0;border-bottom:2px solid transparent;border-radius:0}.__rp_setCat[aria-selected="true"]{border-bottom-color:var(--rp-amber,#ff8a1f)}span.__rp_setKey{display:none}}',
      '@media (prefers-reduced-motion:reduce){.__rp_setWrap,.__rp_setCat,.__rp_setPane{animation:none!important}}',
    ].join('\n')

    function settingsPane(t, cat, modes) {
      var row = function (name, key, checked, onChange) {
        return h(
          'label',
          { key: name, className: '__rp_sheetRow __rp_checkRow' },
          h('input', { type: 'checkbox', name: name, 'aria-label': t(key), checked: checked, onChange: function (event) { onChange(event.target.checked) } }),
          h('span', { className: '__rp_sheetLabel' }, t(key)),
        )
      }
      var seg = function (key, label, options, current, onPick) {
        return h(
          'div',
          { key: key, className: '__rp_sheetRow' },
          h('span', { className: '__rp_sheetLabel' }, label),
          h(
            'div',
            { className: '__rp_seg' },
            options.map(function (option) {
              return h('button', { key: option[0], type: 'button', className: '__rp_segBtn', 'data-on': current === option[0] ? '1' : undefined, onClick: function () { onPick(option[0]) } }, option[1])
            }),
          ),
        )
      }
      if (cat === 'visual') return [h(SettingsModeBar, { key: 'mode', t: t }), h(SettingsFold, { key: 'menu', id: 'settings:menu', title: t('menuMotionSection'), defaultOpen: true }, h(MenuMotionSettings, { t: t }))]
      if (cat === 'model') {
        // 后台模型调用：总开关在上，下面三项只在总开关打开时生效。
        return [
          h(ModelConsentSetting, { key: 'consent', t: t }),
          // 总开关没开时下面三项不生效：调暗，免得看起来已经在跑。
          h(
            'div',
            { key: 'gated', style: { display: 'flex', flexDirection: 'column', gap: '6px', opacity: prefs.modelConsent === 'granted' ? 1 : 0.45 } },
            row('rp-infer-goal', 'inferGoalToggle', prefs.inferGoal !== false, function (v) { setPref('inferGoal', v) }),
            row('rp-collect-ideas', 'collectIdeasToggle', prefs.collectIdeas !== false, function (v) { setPref('collectIdeas', v) }),
            h(TranslateSettings, { t: t }),
          ),
        ]
      }
      if (cat === 'sound') return [h(SfxSettings, { key: 'sfx', t: t })]
      if (cat === 'background') {
        return [
          seg('contour', t('contourLabel'), modes, prefs.contour, function (mode) { setPref('contour', mode) }),
          prefs.contour === 'studio' ? h(ContourStudioSettings, { key: 'studio', t: t }) : null,
          h(SettingsFold, { key: 'frost', id: 'settings:frost', title: t('frostSection'), defaultOpen: true }, h(FrostSettings, { t: t })),
        ]
      }
      if (cat === 'budget') return [h(BudgetSettings, { key: 'budget', t: t })]
      if (cat === 'pricing') return [h(PricingSettings, { key: 'pricing', t: t })]
      return [
        row('rp-corner', 'cornerToggle', prefs.corner !== false, function (v) { setPref('corner', v) }),
        row('rp-focus', 'goalFocusToggle', prefs.focusMode === true, function (v) { setPref('focusMode', v) }),
        seg('scheme', t('schemeLabel'), [['auto', t('schemeAuto')], ['light', t('themeLight')], ['dark', t('themeDark')]], prefs.scheme || 'auto', function (mode) { setPanelScheme(mode) }),
      ]
    }

    function SettingsSheet(props) {
      var t = props.t
      usePrefs()
      var resetPair = React.useState(false)
      var resetOpen = resetPair[0]
      var setResetOpen = resetPair[1]
      var closing = useMenuClose(function () { uiStore.set(false) })
      var requestClose = closing[1]
      var requestCloseRef = React.useRef(requestClose)
      requestCloseRef.current = requestClose
      var catPair = React.useState(settingsCatSeen)
      var cat = catPair[0]
      var tabPair = React.useState('options')
      var tab = tabPair[0]
      var setTab = tabPair[1]
      var modes = [
        ['studio', t('contourStudio')],
        ['off', t('contourOff')],
      ]
      var pickCat = function (next, event) {
        if (next === cat) return
        settingsCatSeen = next
        if (event) sfxFor(event, 'expand')
        catPair[1](next)
      }
      var stepCat = function (delta) {
        var ids = SETTINGS_CATS.map(function (c) { return c[0] })
        var index = ids.indexOf(cat)
        pickCat(ids[(index + delta + ids.length) % ids.length])
      }
      var stateRef = React.useRef(null)
      stateRef.current = { resetOpen: resetOpen, tab: tab, stepCat: stepCat }
      // 按键：Esc 关闭、← → 切换页签、↑ ↓ 切换分类、R 恢复默认值；正在输入时只认 Esc。
      React.useEffect(function () {
        if (typeof document === 'undefined') return undefined
        var onKey = function (event) {
          var state = stateRef.current
          if (!state || state.resetOpen || event.ctrlKey || event.metaKey || event.altKey) return
          var target = event.target || {}
          var typing = (target.tagName === 'INPUT' && target.type !== 'checkbox' && target.type !== 'range') || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable
          if (event.key === 'Escape') {
            event.preventDefault()
            requestCloseRef.current()
            return
          }
          if (typing) return
          var key = String(event.key || '').toLowerCase()
          if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && target.type !== 'range') {
            event.preventDefault()
            setTab(state.tab === 'options' ? 'about' : 'options')
          } else if (key === 'r') {
            event.preventDefault()
            setResetOpen(true)
          } else if (state.tab === 'options' && (event.key === 'ArrowDown' || event.key === 'ArrowUp') && target.type !== 'range') {
            event.preventDefault()
            state.stepCat(event.key === 'ArrowDown' ? 1 : -1)
          }
        }
        document.addEventListener('keydown', onKey, true)
        return function () {
          document.removeEventListener('keydown', onKey, true)
        }
      }, [])
      var catLabel = (SETTINGS_CATS.filter(function (c) { return c[0] === cat })[0] || SETTINGS_CATS[0])[1]
      var tabButton = function (id, key) {
        return h(
          'button',
          {
            key: id,
            type: 'button',
            role: 'tab',
            className: '__rp_setTab',
            'aria-selected': tab === id ? 'true' : 'false',
            onClick: function (event) {
              if (tab === id) return
              sfxFor(event, 'expand')
              setTab(id)
            },
          },
          t(key),
        )
      }
      var about = h(
        'div',
        { key: 'about', className: '__rp_setPane' },
        h('h2', { className: '__rp_setPaneTitle' }, 'PULSE'),
        h(VersionMismatch, { t: t }),
        h('div', { className: '__rp_sheetRow' }, h('span', { className: '__rp_sheetLabel' }, t('setAboutClient')), h('span', { className: '__rp_sheetValue' }, 'v' + CLIENT_VERSION)),
        h('div', { className: '__rp_sheetRow' }, h('span', { className: '__rp_sheetLabel' }, t('setAboutHost')), h('span', { className: '__rp_sheetValue' }, pluginVersionSeen ? 'v' + pluginVersionSeen : t('setAboutHostUnknown'))),
        h('div', { className: '__rp_sheetHint' }, t('setAboutBody')),
      )
      var options = h(
        'div',
        { className: '__rp_setBody' },
        h(
          'div',
          { className: '__rp_setCats', role: 'tablist', 'aria-orientation': 'vertical' },
          SETTINGS_CATS.map(function (c, index) {
            return h(
              'button',
              {
                key: c[0],
                type: 'button',
                role: 'tab',
                className: '__rp_setCat',
                style: { animationDelay: 80 + index * 60 + 'ms' },
                'aria-selected': cat === c[0] ? 'true' : 'false',
                onClick: function (event) {
                  pickCat(c[0], event)
                },
              },
              t(c[1]),
            )
          }),
        ),
        h(
          'div',
          { key: cat, className: '__rp_setPane', role: 'tabpanel' },
          h('h2', { className: '__rp_setPaneTitle' }, t(catLabel) + t('setTitleSuffix')),
          settingsPane(t, cat, modes),
        ),
      )
      return h(
        'div',
        {
          className: '__rp_setWrap',
          'data-closing': closing[0] ? '1' : undefined,
          style: menuMotionStyle(),
          onClick: function (event) {
            if (event.target === event.currentTarget) requestClose()
          },
        },
        h(
          'div',
          { className: '__rp_setWin', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('setTitle') },
          h(
            'div',
            { className: '__rp_setTop' },
            h('div', { className: '__rp_setHeading' }, h('span', { className: '__rp_setKicker' }, 'PULSE //'), h('span', { className: '__rp_setTitle' }, t('setTitle'))),
            h('button', { type: 'button', className: '__rp_setClose', 'aria-label': t('setKeyBack'), onClick: requestClose }, '✕'),
          ),
          h(
            'div',
            { className: '__rp_setTabs', role: 'tablist' },
            tabButton('options', 'setTabOptions'),
            tabButton('about', 'setTabAbout'),
          ),
          tab === 'about' ? about : options,
          h(
            'div',
            { className: '__rp_setFoot' },
            h('span', { className: '__rp_setKey', 'aria-hidden': 'true' }, h('kbd', null, '← →'), t('setKeyTabs')),
            h('span', { className: '__rp_setKey', 'aria-hidden': 'true' }, h('kbd', null, '↑ ↓'), t('setKeyCats')),
            h('button', { type: 'button', className: '__rp_setKey', onClick: requestClose }, h('kbd', null, 'Esc'), t('setKeyBack')),
            h('button', { type: 'button', className: '__rp_setKey', onClick: function () { setResetOpen(true) } }, h('kbd', null, 'R'), t('setKeyReset')),
            pluginVersionSeen
              ? h('div', { className: '__rp_sheetVersion', 'aria-label': 'PULSE ' + pluginVersionSeen }, 'PULSE v' + pluginVersionSeen)
              : null,
          ),
          resetOpen
            ? h(SettingsResetDialog, {
                t: t,
                onCancel: function () {
                  setResetOpen(false)
                },
                onConfirm: function () {
                  resetPrefs()
                  setResetOpen(false)
                },
              })
            : null,
        ),
      )
    }

    function isLightHex(hex) {
      if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return false
      var r = parseInt(hex.slice(1, 3), 16)
      var g = parseInt(hex.slice(3, 5), 16)
      var b = parseInt(hex.slice(5, 7), 16)
      return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150
    }
    function shell(children, t, opts) {
      var fx = activeEffects()
      var studioLight = prefs.contour === 'studio' && isLightHex(prefs.studio.style.background)
      var frostOn = prefs.frost.enabled && fx.blur
      return h(
        'div',
        {
          className: '__rp_root',
          'data-motion': MOTION,
          'data-studio': prefs.contour === 'studio' ? '1' : undefined,
          'data-studio-light': studioLight ? '1' : undefined,
          'data-performance': prefs.mode === 'performance' ? '1' : undefined,
          'data-effect-scan': fx.scan ? 'on' : 'off',
          'data-effect-grid': fx.grid ? 'on' : 'off',
          'data-effect-reveal': fx.reveal ? 'on' : 'off',
          'data-effect-flow': fx.flow ? 'on' : 'off',
          'data-effect-window': fx.windowAnimations ? 'on' : 'off',
          'data-effect-status': fx.statusPulse ? 'on' : 'off',
          'data-reveal': opts && opts.reveal ? '1' : undefined,
          // 合成音效：按钮点击统一在这里发一声；展开收起等自己发声的会打标记跳过。
          onClick: sfxClickDelegate,
          style: {
            '--rp-frost-alpha': frostOn ? String(prefs.frost.opacity) : '0',
            '--rp-frost-blur': (frostOn ? prefs.frost.blur : 0) + 'px',
            '--rp-frost-saturate': (frostOn ? prefs.frost.saturation : 100) + '%',
          },
          ref: function (node) {
            panelRootEl = node
          },
        },
        prefs.contour === 'studio' ? h(ContourStudioBackground) : null,
        prefs.contour === 'studio'
          ? h('div', {
              className: '__rp_surface',
              'aria-hidden': 'true',
              style: { background: prefs.studio.style.background, opacity: prefs.surface },
            })
          : null,
        h('div', { className: '__rp_scanWrap', 'aria-hidden': 'true' }, h('div', { className: '__rp_scanBar' })),
        opts && opts.reveal ? h(PixelateDefs) : null,
        h(
          'div',
          { className: '__rp_scroll' },
          h(
            'div',
            { className: '__rp_inner', style: opts && opts.reveal ? { filter: 'url(#__rp_px)' } : undefined },
            h(VersionMismatch, { t: t }),
            children,
          ),
        ),
        null,
      )
    }

    function rowStateOf(state, phase) {
      if (!state || !state.round) return 'idle'
      return phase === 'spent' ? 'spent' : 'active'
    }

    function phaseLabel(t, phase) {
      if (phase === 'active') return t('phaseActive')
      if (phase === 'spent') return t('phaseSpent')
      return t('phaseIdle')
    }

    /** 分组标题：优先用本地化键，退回 Host 给的中文标题。 */
    function groupTitle(t, group) {
      var key = 'group.' + group.id
      var text = t(key)
      return text && text !== key ? text : group.title
    }

    /** 一组 {kind,name} 条目按 tag 聚合，形如「代码 5 · 设计 2」；tag 文本随语言变化。 */
    function tagSummaryOf(t, entries) {
      var counts = {}
      entries.forEach(function (entry) {
        var tag = tagOfItem(entry.kind, entry.name)
        counts[tag] = (counts[tag] || 0) + 1
      })
      var tags = Object.keys(counts).sort(function (a, b) {
        return counts[b] - counts[a] || a.localeCompare(b)
      })
      return tags
        .map(function (tag) {
          return tagLabel(tag) + ' ' + String(counts[tag])
        })
        .join(' · ')
    }

    function tagSummary(t, kind, items) {
      return tagSummaryOf(
        t,
        items.map(function (item) {
          return { kind: kind, name: item.name }
        }),
      )
    }

    /** 置顶区的淡出程度：连续几轮没调用就淡几分，满 4 轮已回落（不会画到这里）。 */
    function fadeOf(misses, spent) {
      // 本轮调用过的满亮；回合结束先退一档，之后每空转一轮再退一档，最低 0.32。
      var level = Math.max(0, misses || 0) + (spent ? 0.5 : 0)
      return Math.max(0.32, 1 - level * 0.17)
    }

    /**
     * 「正在运行」的阅读顺序：本轮在调用的浮在最上（最近一次调用在前），
     * 其余按空转轮数由少到多往下沉，同档再按最近调用时间。
     */
    function sortRunning(list) {
      return list.slice().sort(function (a, b) {
        var ra = (a.state && a.state.round) > 0 ? 1 : 0
        var rb = (b.state && b.state.round) > 0 ? 1 : 0
        if (ra !== rb) return rb - ra
        var ma = (a.state && a.state.misses) || 0
        var mb = (b.state && b.state.misses) || 0
        if (ma !== mb) return ma - mb
        return ((b.state && b.state.at) || 0) - ((a.state && a.state.at) || 0)
      })
    }

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


    /* ── 悬停说明：body 层固定浮层，不参与任何 overflow 裁切 ─────────── */

    var TIP_SHOW_DELAY = 500
    var TIP_GAP = 6
    var TIP_EDGE = 8
    var tipEl = null
    var tipTimer = 0
    var tipAnchor = null
    var rowTipsInstalled = false

    /** 纯函数：算出浮层位置，永远留在视口内（下方放不下就翻到上方）。 */
    function clampTipPlacement(rect, size, view) {
      var gap = TIP_GAP
      var edge = TIP_EDGE
      var width = Math.max(0, Number(size && size.width) || 0)
      var height = Math.max(0, Number(size && size.height) || 0)
      var viewW = Math.max(edge * 2, Number(view && view.width) || 0)
      var viewH = Math.max(edge * 2, Number(view && view.height) || 0)
      var left = Math.min(Math.max(Number(rect.left) || 0, edge), Math.max(edge, viewW - width - edge))
      var top = (Number(rect.bottom) || 0) + gap
      if (top + height > viewH - edge && (Number(rect.top) || 0) - height - gap >= edge) {
        top = (Number(rect.top) || 0) - height - gap
      }
      top = Math.max(edge, Math.min(top, Math.max(edge, viewH - height - edge)))
      return { left: Math.round(left), top: Math.round(top) }
    }

    function currentViewport() {
      if (typeof window === 'undefined') return { width: 0, height: 0 }
      return {
        width: window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 0,
        height: window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 0,
      }
    }

    function ensureTipEl() {
      if (typeof document === 'undefined' || !document.body) return null
      if (tipEl && tipEl.parentNode) return tipEl
      var el = document.createElement('div')
      el.className = '__rp_tipLayer'
      el.setAttribute('role', 'tooltip')
      el.setAttribute('aria-hidden', 'true')
      document.body.appendChild(el)
      tipEl = el
      return el
    }

    /** 隐藏并清空浮层；定时器一起清掉，防止离开后还弹出来。 */
    function hideRowTip() {
      if (tipTimer) {
        clearTimeout(tipTimer)
        tipTimer = 0
      }
      tipAnchor = null
      if (!tipEl) return
      tipEl.removeAttribute('data-open')
      tipEl.setAttribute('aria-hidden', 'true')
      tipEl.textContent = ''
    }

    function showRowTip(anchor) {
      var text = anchor && anchor.getAttribute ? anchor.getAttribute('data-desc') : ''
      if (!text) return
      var el = ensureTipEl()
      if (!el) return
      el.textContent = text
      var placement = clampTipPlacement(anchor.getBoundingClientRect(), { width: el.offsetWidth, height: el.offsetHeight }, currentViewport())
      el.style.left = placement.left + 'px'
      el.style.top = placement.top + 'px'
      el.setAttribute('data-open', '1')
      el.setAttribute('aria-hidden', 'false')
    }

    /** 事件委托装一次就够了；返回卸载函数，插件停用时把监听和浮层一起收走。 */
    function installRowTips() {
      if (typeof document === 'undefined' || rowTipsInstalled) return null
      rowTipsInstalled = true

      function anchorOf(node) {
        return node && node.closest ? node.closest('[data-desc]') : null
      }
      function onOver(event) {
        var anchor = anchorOf(event.target)
        if (anchor === tipAnchor) return
        hideRowTip()
        tipAnchor = anchor
        if (!anchor) return
        tipTimer = setTimeout(function () {
          tipTimer = 0
          showRowTip(anchor)
        }, TIP_SHOW_DELAY)
      }
      function onOut(event) {
        if (!tipAnchor) return
        var next = event.relatedTarget
        if (next && tipAnchor.contains(next)) return
        hideRowTip()
      }
      function onScroll() {
        if (tipAnchor || tipEl) hideRowTip()
      }
      function onKey(event) {
        if (event.key === 'Escape') hideRowTip()
      }

      document.addEventListener('mouseover', onOver, true)
      document.addEventListener('mouseout', onOut, true)
      document.addEventListener('scroll', onScroll, true)
      document.addEventListener('keydown', onKey, true)
      window.addEventListener('resize', onScroll)
      return function uninstallRowTips() {
        document.removeEventListener('mouseover', onOver, true)
        document.removeEventListener('mouseout', onOut, true)
        document.removeEventListener('scroll', onScroll, true)
        document.removeEventListener('keydown', onKey, true)
        window.removeEventListener('resize', onScroll)
        hideRowTip()
        if (tipEl && tipEl.parentNode) tipEl.parentNode.removeChild(tipEl)
        tipEl = null
        rowTipsInstalled = false
      }
    }

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
    /* ── ECHO 现场重建：Echo 详情里还原收藏那一轮 ─────────────────────────── */

    /**
     * 默认收起，点「重建现场」才去取（旧会话要解压磁盘日志）。展示：
     * 触发指令、轮次 / 用时 / 步数 / 工具次数 / 模型 / token、当轮加载的技能、
     * 一条时间轨道（每次工具调用一个刻度，位置 = 开始时刻，宽度 = 耗时，失败标红），
     * 以及耗时最多的几个工具。只有名字、时间和计数，不显示工具参数和结果。
     */

    CSS += '\n' + [
      '.__rp_scene{margin:0 16px 10px;border:1px solid rgba(255,127,0,.32);border-left:2px solid #ff7f00;border-radius:4px;background:rgba(255,127,0,.04);font-size:12.5px;line-height:1.5}',
      '.__rp_sceneHead{display:flex;align-items:center;gap:8px;padding:6px 10px}',
      '.__rp_sceneTag{font-size:10px;letter-spacing:.18em;color:#ff7f00;font-weight:600}',
      '.__rp_sceneHint{flex:1 1 auto;min-width:0;color:#9aa2ad;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
      '.__rp_sceneBtn{flex:none;border:1px solid rgba(255,127,0,.5);background:transparent;color:#ff9a3c;border-radius:3px;font:inherit;font-size:12px;padding:1px 8px;cursor:pointer}',
      '.__rp_sceneBtn:hover{background:rgba(255,127,0,.12)}',
      '.__rp_sceneBtn:disabled{opacity:.5;cursor:default}',
      '.__rp_sceneBody{padding:0 10px 10px;display:flex;flex-direction:column;gap:8px}',
      '.__rp_sceneAsk{color:#e7e9ec;border-left:2px solid rgba(255,127,0,.6);padding-left:8px;white-space:pre-wrap;word-break:break-word}',
      '.__rp_sceneStats{display:flex;flex-wrap:wrap;gap:4px 14px;color:#b8bdbb;font-variant-numeric:tabular-nums}',
      '.__rp_sceneStats b{color:#e7e9ec;font-weight:600}',
      '.__rp_sceneSkills{display:flex;flex-wrap:wrap;gap:4px}',
      '.__rp_sceneSkill{border:1px solid rgba(255,127,0,.45);color:#ffb26b;border-radius:3px;padding:0 6px;font-size:11.5px}',
      '.__rp_sceneTrack{position:relative;height:18px;border-top:1px solid rgba(255,255,255,.14);border-bottom:1px solid rgba(255,255,255,.14);background:repeating-linear-gradient(90deg,rgba(255,255,255,.06) 0 1px,transparent 1px 10%)}',
      '.__rp_sceneTick{position:absolute;top:3px;bottom:3px;min-width:2px;background:#ff7f00;opacity:.8;border-radius:1px}',
      '.__rp_sceneTick[data-skill="1"]{background:#ffd27a;opacity:1}',
      '.__rp_sceneTick[data-ok="0"]{background:#e5533d;opacity:1}',
      '.__rp_sceneAxis{display:flex;justify-content:space-between;color:#7d858f;font-size:10.5px;font-variant-numeric:tabular-nums}',
      '.__rp_sceneTop{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:2px 12px;color:#b8bdbb;font-variant-numeric:tabular-nums}',
      '.__rp_sceneTop span:first-child{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:#e7e9ec}',
      '.__rp_sceneErr{color:#e5533d}',
    ].join('\n')

    function sceneDuration(ms) {
      return ms > 0 ? formatMs(ms) : '—'
    }

    function sceneToolLabel(row) {
      if (row.name === 'skill' && row.skill) return nameOf('skill', row.skill) || row.skill
      return nameOf('tool', row.name) || row.name
    }

    function sceneStatsLine(t, scene) {
      var parts = [
        [t('sceneTurn'), String(scene.turn)],
        [t('sceneDuration'), scene.durationMs ? sceneDuration(scene.durationMs) : t('sceneOpen')],
        [t('sceneSteps'), String(scene.steps)],
        [t('sceneTools'), String(scene.toolCount)],
      ]
      if (scene.model) parts.push([t('sceneModel'), scene.model.replace(/^[^/]+\//, '') + (scene.reasoningEffort ? ' · ' + scene.reasoningEffort : '')])
      if (scene.usage && (scene.usage.inputTokens || scene.usage.outputTokens)) {
        parts.push([t('sceneTokens'), formatTokens(scene.usage.inputTokens) + ' / ' + formatTokens(scene.usage.outputTokens)])
      }
      return parts
    }

    function EchoScene(props) {
      var t = props.t
      var pair = React.useState({ status: 'idle', scene: null, error: '' })
      var state = pair[0]
      var setState = pair[1]
      var aliveRef = React.useRef(true)
      React.useEffect(function () {
        return function () {
          aliveRef.current = false
        }
      }, [])
      var load = function () {
        setState({ status: 'loading', scene: null, error: '' })
        fetch('/dsh-running-panel/echo?scene=' + encodeURIComponent(props.echoId))
          .then(function (response) {
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
          .then(function (value) {
            if (aliveRef.current) setState({ status: 'ready', scene: value.scene, error: '' })
          })
          .catch(function (error) {
            if (aliveRef.current) setState({ status: 'error', scene: null, error: String((error && error.message) || error) })
          })
      }
      var scene = state.scene
      var head = h(
        'div',
        { className: '__rp_sceneHead' },
        h('span', { className: '__rp_sceneTag' }, 'ECHO //'),
        h(
          'span',
          { className: '__rp_sceneHint', role: state.status === 'error' ? 'alert' : undefined },
          state.status === 'error'
            ? state.error === 'session_gone'
              ? t('sceneGone')
              : state.error === 'session required' || hostOutdated()
                ? t('hostOutdatedShort') // 旧 Host 没有 ?scene= 分支，落到兜底的 session required
                : fill(t('sceneFailed'), 'reason', state.error)
            : state.status === 'loading'
              ? t('sceneLoading')
              : scene
                ? t('sceneReady')
                : t('sceneIdle'),
        ),
        state.status === 'ready'
          ? null
          : h('button', { type: 'button', className: '__rp_sceneBtn', disabled: state.status === 'loading', onClick: load }, state.status === 'error' ? t('sceneRetry') : t('sceneLoad')),
      )
      if (!scene) return h('div', { className: '__rp_scene' }, head)

      var span = Math.max(1, scene.durationMs || scene.tools.reduce(function (max, row) {
        return Math.max(max, row.offsetMs + row.ms)
      }, 0))
      var body = [
        scene.ask ? h('div', { key: 'ask', className: '__rp_sceneAsk', title: t('sceneAsk') }, scene.ask) : null,
        h(
          'div',
          { key: 'stats', className: '__rp_sceneStats' },
          sceneStatsLine(t, scene).map(function (part) {
            return h('span', { key: part[0] }, part[0] + ' ', h('b', null, part[1]))
          }),
        ),
        scene.skills.length
          ? h(
              'div',
              { key: 'skills', className: '__rp_sceneSkills', 'aria-label': t('sceneSkills') },
              scene.skills.map(function (name) {
                return h('span', { key: name, className: '__rp_sceneSkill', title: name }, nameOf('skill', name) || name)
              }),
            )
          : null,
        scene.tools.length
          ? h(
              'div',
              { key: 'track', className: '__rp_sceneTrack', role: 'img', 'aria-label': fill(t('sceneTrackLabel'), 'n', scene.toolCount) },
              scene.tools.map(function (row, index) {
                var left = Math.min(100, (row.offsetMs / span) * 100)
                var width = Math.min(100 - left, (row.ms / span) * 100)
                return h('span', {
                  key: index,
                  className: '__rp_sceneTick',
                  'data-ok': row.ok === false ? '0' : undefined,
                  'data-skill': row.name === 'skill' ? '1' : undefined,
                  title: sceneToolLabel(row) + ' · ' + sceneDuration(row.ms) + (row.ok === false ? ' · ' + t('sceneError') : ''),
                  style: { left: left + '%', width: width + '%' },
                })
              }),
            )
          : null,
        scene.tools.length
          ? h('div', { key: 'axis', className: '__rp_sceneAxis' }, h('span', null, '0'), h('span', null, sceneDuration(span)))
          : null,
        scene.summary.length
          ? h(
              'div',
              { key: 'top', className: '__rp_sceneTop' },
              scene.summary.slice(0, 6).reduce(function (cells, row) {
                var key = row.name + ':' + (row.skill || '')
                cells.push(h('span', { key: key + ':n', title: row.skill || row.name }, sceneToolLabel(row)))
                cells.push(h('span', { key: key + ':c' }, '×' + row.n + (row.errors ? ' ' : ''), row.errors ? h('span', { className: '__rp_sceneErr' }, fill(t('sceneErrors'), 'n', row.errors)) : null))
                cells.push(h('span', { key: key + ':ms' }, sceneDuration(row.ms)))
                return cells
              }, []),
            )
          : h('div', { key: 'none', className: '__rp_sceneHint' }, t('sceneNoTools')),
        scene.toolsTruncated ? h('div', { key: 'trunc', className: '__rp_sceneHint' }, fill(t('sceneTruncated'), 'n', scene.tools.length)) : null,
      ]
      return h('div', { className: '__rp_scene' }, head, h('div', { className: '__rp_sceneBody' }, body))
    }
    /* ── 自动提议收藏：「可能值得收藏」的回合，点了才收藏 ───────────────── */

    /**
     * Host 按信号打分（用户的肯定、交付了文件、失败后修好、大回合），这里只展示前 3 条。
     * 没有提议时整块不渲染，不占面板位置。「忽略」按会话记在本地，不再出现。
     * 收藏走和对话里书签按钮同一个 POST /echo。
     */

    CSS += '\n' + [
      '.__rp_suggest{margin:8px 0;border:1px dashed color-mix(in srgb,var(--rp-amber) 45%,transparent);border-radius:4px;padding:6px 8px;display:flex;flex-direction:column;gap:6px;font-size:13px}',
      '.__rp_suggestHead{display:flex;align-items:baseline;gap:8px}',
      '.__rp_suggestTitle{font-size:11px;letter-spacing:.14em;color:var(--rp-amber);font-weight:600}',
      '.__rp_suggestHint{flex:1 1 auto;min-width:0;color:var(--dsw-alias-label-tertiary);font-size:11.5px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
      '.__rp_suggestRow{display:flex;align-items:center;gap:8px;min-width:0}',
      '.__rp_suggestMain{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}',
      '.__rp_suggestAsk{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:var(--dsw-alias-label-primary)}',
      '.__rp_suggestWhy{display:flex;flex-wrap:wrap;gap:4px}',
      '.__rp_suggestChip{font-size:11px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:3px;padding:0 5px;line-height:1.5}',
      '.__rp_suggestChip[data-reason=praised]{color:var(--rp-amber);border-color:color-mix(in srgb,var(--rp-amber) 45%,transparent)}',
      '.__rp_suggestErr{color:var(--dsw-alias-state-error-primary);font-size:12px}',
    ].join('\n')

    var ECHO_DISMISS_KEY = '__rp_echo_dismissed'

    function echoDismissedSet() {
      try {
        var raw = window.localStorage.getItem(ECHO_DISMISS_KEY)
        var map = raw ? JSON.parse(raw) : {}
        return new Set(Object.keys(map && typeof map === 'object' ? map : {}))
      } catch (error) {
        return new Set()
      }
    }

    function dismissEchoSuggestion(sessionId, messageId) {
      try {
        var raw = window.localStorage.getItem(ECHO_DISMISS_KEY)
        var map = (raw && JSON.parse(raw)) || {}
        map[sessionId + ':' + messageId] = Date.now()
        var keys = Object.keys(map).sort(function (a, b) { return map[b] - map[a] }).slice(0, 500)
        var trimmed = {}
        keys.forEach(function (key) { trimmed[key] = map[key] })
        window.localStorage.setItem(ECHO_DISMISS_KEY, JSON.stringify(trimmed))
      } catch (error) {
        /* 隐私模式：本次渲染里隐藏即可 */
      }
    }

    function suggestReasonText(t, reason, item) {
      if (reason === 'praised') return item.feedback ? fill(t('suggestPraised'), 'q', item.feedback) : t('suggestPraisedPlain')
      if (reason === 'approved') return t('suggestApproved')
      if (reason === 'delivered') return t('suggestDelivered')
      if (reason === 'recovered') return t('suggestRecovered')
      if (reason === 'big') return fill(t('suggestBig'), 'n', item.tools || 0)
      return reason
    }

    function EchoSuggestions(props) {
      var t = props.t
      var sessionId = props.sessionId
      var pair = React.useState([])
      var items = pair[0]
      var setItems = pair[1]
      var hiddenPair = React.useState({})
      var hidden = hiddenPair[0]
      var setHidden = hiddenPair[1]
      var busyPair = React.useState('')
      var busy = busyPair[0]
      var setBusy = busyPair[1]
      var errPair = React.useState('')
      var error = errPair[0]
      var setError = errPair[1]
      var aliveRef = React.useRef(true)
      React.useEffect(function () {
        return function () {
          aliveRef.current = false
        }
      }, [])
      // 一轮结束（阶段 / 轮次变化）或收藏库变化时重取；Host 按事件数缓存，重取很便宜。
      var trigger = String(props.phase || '') + ':' + String(props.round || 0)
      React.useEffect(
        function () {
          if (!sessionId) return undefined
          var cancelled = false
          var load = function () {
            fetch('/dsh-running-panel/echo?suggest=' + encodeURIComponent(sessionId), { cache: 'no-store' })
              .then(function (response) {
                return response.ok ? response.json() : { suggestions: [] }
              })
              .then(function (body) {
                if (!cancelled && aliveRef.current) setItems(Array.isArray(body && body.suggestions) ? body.suggestions : [])
              })
              .catch(function () {})
          }
          load()
          var changed = function () {
            load()
          }
          window.addEventListener('dsh-running-panel:echo-changed', changed)
          return function () {
            cancelled = true
            window.removeEventListener('dsh-running-panel:echo-changed', changed)
          }
        },
        [sessionId, trigger],
      )

      var dismissed = echoDismissedSet()
      var visible = items
        .filter(function (item) {
          return !hidden[item.messageId] && !dismissed.has(sessionId + ':' + item.messageId)
        })
        .slice(0, 3)
      if (!visible.length) return null

      var save = function (item) {
        setBusy(item.messageId)
        setError('')
        fetch('/dsh-running-panel/echo', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionId, messageId: item.messageId }),
        })
          .then(function (response) {
            return response
              .json()
              .catch(function () {
                return {}
              })
              .then(function (body) {
                if (!response.ok) throw new Error((body && body.error) || 'HTTP ' + response.status)
                return body
              })
          })
          .then(function () {
            sfxPlay('done')
            if (!aliveRef.current) return
            setBusy('')
            setHidden(function (previous) {
              var next = Object.assign({}, previous)
              next[item.messageId] = true
              return next
            })
            try {
              window.dispatchEvent(new CustomEvent('dsh-running-panel:echo-changed', { detail: { sessionId: sessionId } }))
            } catch (failure) {
              /* ignore */
            }
          })
          .catch(function (failure) {
            if (!aliveRef.current) return
            setBusy('')
            var code = String((failure && failure.message) || failure)
            setError(code === 'echo_capacity_reached' ? t('goalFull') : fill(t('suggestFailed'), 'reason', code))
          })
      }
      var dismiss = function (item) {
        dismissEchoSuggestion(sessionId, item.messageId)
        setHidden(function (previous) {
          var next = Object.assign({}, previous)
          next[item.messageId] = true
          return next
        })
      }

      return h(
        'div',
        { className: '__rp_suggest', role: 'region', 'aria-label': t('suggestTitle') },
        h(
          'div',
          { className: '__rp_suggestHead' },
          h('span', { className: '__rp_suggestTitle' }, t('suggestTitle')),
          h('span', { className: '__rp_suggestHint' }, t('suggestHint')),
        ),
        visible.map(function (item) {
          return h(
            'div',
            { key: item.messageId, className: '__rp_suggestRow' },
            h(
              'div',
              { className: '__rp_suggestMain' },
              h('span', { className: '__rp_suggestAsk', title: item.answer || item.ask }, fill(t('suggestTurn'), 'n', item.turn) + ' · ' + (item.ask || item.answer || '')),
              h(
                'span',
                { className: '__rp_suggestWhy' },
                item.reasons.map(function (reason) {
                  return h('span', { key: reason, className: '__rp_suggestChip', 'data-reason': reason }, suggestReasonText(t, reason, item))
                }),
              ),
            ),
            h('button', { type: 'button', className: '__rp_goalBtn', 'data-primary': '1', disabled: busy === item.messageId, onClick: function () { save(item) } }, busy === item.messageId ? t('menuSaving') : t('suggestSave')),
            h('button', { type: 'button', className: '__rp_goalBtn', 'aria-label': t('suggestDismiss'), title: t('suggestDismiss'), onClick: function () { dismiss(item) } }, '✕'),
          )
        }),
        error ? h('div', { className: '__rp_suggestErr', role: 'alert' }, error) : null,
      )
    }
    /* ── 目标层：一行目标条 + 抽屉 + 专注模式 ──────────────────────────── */

    /**
     * 当前目标有两个来源，同一时间只显示一个：
     * 1) DSH 原生 /goal（会话投影 `goal`）：只读，阶段 / 轮数照抄；complete 时记进 PULSE 历史。
     * 2) PULSE 自己的工作区目标（快照 `goal`，存在 Echo 存储里）：可设、改写、完成、移除。
     * 都没有时，用会话标题给一个带 ? 的提议——不点「设为目标」就不写任何东西。
     *
     * 专注模式（设置里开，默认关）：目标开始之后没被调用过的技能 / 工具行降到 40% 不透明度。
     * 不隐藏、不改排序。没有目标时什么都不变淡。
     */

    CSS += '\n' + [
      /* 追踪任务（地图右侧任务栏的样式）：切角、左侧 琥珀橙竖条、「追踪中」小标签、菱形标记、底部分段进度。 */
      '.__rp_goal{position:relative;display:flex;align-items:center;gap:8px;min-height:28px;margin:6px 0 2px;padding:4px 10px 5px 8px;border:1px solid var(--dsw-alias-border-l1);border-left:2px solid var(--rp-amber);border-radius:0;background:linear-gradient(90deg,color-mix(in srgb,var(--rp-amber) 10%,transparent),color-mix(in srgb,var(--rp-amber) 3%,transparent) 60%);clip-path:polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,0 100%);font-size:13px;line-height:1.4;cursor:pointer;user-select:none}',
      '.__rp_goalTag{flex:none;font-size:9.5px;font-weight:600;letter-spacing:.2em;color:var(--rp-amber);text-transform:uppercase;opacity:.9}',
      '.__rp_goal[data-kind=empty] .__rp_goalTag{color:var(--dsw-alias-label-tertiary)}',
      '@container (max-width: 380px){.__rp_goal[data-kind=proposal] .__rp_goalTag{display:none}.__rp_goal{gap:6px}}',
      '.__rp_goalProgress{position:absolute;left:10px;right:12px;bottom:2px;height:2px;display:flex;gap:2px;pointer-events:none}',
      '.__rp_goalSeg{flex:1 1 0;background:color-mix(in srgb,var(--rp-amber) 18%,transparent)}',
      '.__rp_goalSeg[data-on="1"]{background:var(--rp-amber)}',
      '.__rp_goal[data-phase=blocked] .__rp_goalSeg[data-on="1"]{background:var(--rp-rust)}',
      '.__rp_goal:hover{background:color-mix(in srgb,var(--rp-amber) 9%,transparent)}',
      '.__rp_goal:focus-visible{outline:1px solid var(--rp-amber);outline-offset:1px}',
      '.__rp_goal[data-kind=empty]{border-left-color:var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary)}',
      '.__rp_goal[data-kind=proposal]{border-left-style:dashed;cursor:default}',
      '.__rp_goalMark{flex:none;width:14px;text-align:center;color:var(--rp-amber);font-size:11px}',
      '.__rp_goal[data-kind=empty] .__rp_goalMark{color:var(--dsw-alias-label-tertiary)}',
      '.__rp_goalText{flex:1 1 auto;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
      '.__rp_goalMeta{flex:none;color:var(--dsw-alias-label-tertiary);font-size:11px;letter-spacing:.04em;white-space:nowrap}',
      '.__rp_goalBadge{flex:none;font-size:10px;letter-spacing:.12em;color:var(--rp-amber);border:1px solid color-mix(in srgb,var(--rp-amber) 45%,transparent);border-radius:3px;padding:0 4px;line-height:1.5}',
      '.__rp_goal[data-phase=blocked] .__rp_goalMark,.__rp_goal[data-phase=blocked] .__rp_goalMeta{color:var(--rp-rust)}',
      '.__rp_goal[data-phase=paused] .__rp_goalMark{opacity:.55}',
      '.__rp_goalBtn{flex:none;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);border-radius:3px;font:inherit;font-size:12px;padding:1px 7px;cursor:pointer;line-height:1.5}',
      '.__rp_goalBtn:hover{color:var(--dsw-alias-label-primary);border-color:var(--rp-amber)}',
      '.__rp_goalBtn[data-primary="1"]{color:var(--rp-amber);border-color:color-mix(in srgb,var(--rp-amber) 55%,transparent)}',
      '.__rp_goalBtn[data-danger="1"]:hover{color:var(--rp-rust);border-color:var(--rp-rust)}',
      '.__rp_goalBtn:disabled{opacity:.45;cursor:default}',
      '.__rp_goalDrawer{margin:0 0 8px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-top:none;border-radius:0 0 3px 3px;background:var(--dsw-alias-bg-layer-1);font-size:13px;display:flex;flex-direction:column;gap:8px}',
      '.__rp_goalActions{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
      '.__rp_goalNote{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5}',
      '.__rp_goalInput{width:100%;box-sizing:border-box;height:28px;border:1px solid var(--dsw-alias-border-l2);border-radius:3px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:0 8px}',
      '.__rp_goalInput:focus{outline:none;border-color:var(--rp-amber)}',
      '.__rp_goalErr{color:var(--dsw-alias-state-error-primary);font-size:12px}',
      '.__rp_goalHistTitle{font-size:11px;letter-spacing:.14em;color:var(--dsw-alias-label-tertiary);text-transform:uppercase}',
      '.__rp_goalHist{display:flex;align-items:center;gap:6px;min-height:22px;color:var(--dsw-alias-label-secondary)}',
      '.__rp_goalHist[data-status=stale]{opacity:.6}',
      '.__rp_goalHist .__rp_goalText{font-size:12px}',
      '.__rp_goalHist .__rp_goalBtn{visibility:hidden}',
      '.__rp_goalHist:hover .__rp_goalBtn,.__rp_goalHist:focus-within .__rp_goalBtn{visibility:visible}',
      '.__rp_goalFocus{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      ':is(.__rp_row,.__rp_libRow)[data-unfocused="1"]{opacity:.4;transition:opacity .18s ease}',
      ':is(.__rp_row,.__rp_libRow)[data-unfocused="1"]:hover,:is(.__rp_row,.__rp_libRow)[data-unfocused="1"]:focus-within{opacity:1}',
      'html[data-rp-scheme="light"] .__rp_goalInput{background:#fffdf7}',
    ].join('\n')

    /** 专注模式的起点（毫秒）；0 = 不变淡。SessionBoard 提供，CapabilityRow 读。 */
    var FocusContext = React.createContext(0)

    function goalRelevant(state, since) {
      if (!(since > 0)) return true
      return Boolean(state && Number(state.at) >= since)
    }

    /* DSH 原生目标：会话绑定可能晚于面板出现，找不到就隔几秒再找。 */
    function dshGoalFace(sessionId) {
      try {
        var binding = clientSessions && typeof clientSessions.binding === 'function' ? clientSessions.binding(sessionId) : null
        var projections = binding && binding.session && binding.session.projections
        return projections && typeof projections.faceOf === 'function' ? projections.faceOf('goal') : null
      } catch (error) {
        return null
      }
    }

    function readDshGoal(face) {
      try {
        var value = face && typeof face.getSnapshot === 'function' ? face.getSnapshot() : null
        if (!value || !value.goal || typeof value.goal.objective !== 'string') return null
        return {
          id: String(value.goal.id || ''),
          revision: Number(value.goal.revision) || 0,
          objective: value.goal.objective,
          phase: String(value.goal.phase || 'active'),
          rounds: Number(value.roundsStarted) || 0,
          max: Number(value.goal.maxGoalRounds) || 0,
          createdAt: Number(value.createdAt) || 0,
          blocked: value.goal.blockedReason && value.goal.blockedReason.message ? String(value.goal.blockedReason.message) : '',
        }
      } catch (error) {
        return null
      }
    }

    function useDshGoal(sessionId) {
      var pair = React.useState(null)
      var goal = pair[0]
      var setGoal = pair[1]
      React.useEffect(
        function () {
          setGoal(null)
          if (!sessionId) return undefined
          var alive = true
          var timer = null
          var unsubscribe = null
          var last = ''
          var tries = 0
          var attach = function () {
            if (!alive) return
            var face = dshGoalFace(sessionId)
            if (!face) {
              // 没有会话服务就不等；有服务但绑定还没建好，等一分钟（20 × 3 s）就放弃。
              if (clientSessions && typeof clientSessions.binding === 'function' && tries < 20) {
                tries += 1
                timer = setTimeout(attach, 3000)
              }
              return
            }
            var sync = function () {
              if (!alive) return
              var next = readDshGoal(face)
              var key = JSON.stringify(next)
              if (key === last) return
              last = key
              setGoal(next)
            }
            sync()
            if (typeof face.subscribe === 'function') {
              var off = face.subscribe(sync)
              unsubscribe = typeof off === 'function' ? off : null
            }
          }
          attach()
          return function () {
            alive = false
            if (timer) clearTimeout(timer)
            if (unsubscribe) unsubscribe()
          }
        },
        [sessionId],
      )
      return goal
    }

    /** DSH 目标是否占着目标条：complete 之后让位给 PULSE 自己的目标。 */
    function dshGoalLive(dsh) {
      return Boolean(dsh && dsh.phase !== 'complete')
    }

    /** 专注起点：DSH 目标优先（它在跑就是当下的事），其次 PULSE 当前目标。 */
    function goalFocusSince(dsh, pulse) {
      if (dshGoalLive(dsh)) return dsh.createdAt || 0
      return pulse && pulse.current ? pulse.current.createdAt || 0 : 0
    }

    var recordedDshGoals = new Set()
    var requestedInference = new Set()

    /** 该不该请求推断：开关开着、没有 DSH 目标和 PULSE 目标、没被「不用」、这一轮已结束、上次不是失败。 */
    function shouldInferGoal(props, dismissed) {
      if (!modelAllowed('inferGoal') || dismissed || !props.sessionId) return false
      if (dshGoalLive(props.dsh)) return false
      if (!props.goal || props.goal.current) return false
      if (props.phase === 'active') return false
      var proposal = props.proposal
      if (proposal && (proposal.status === 'running' || proposal.status === 'error')) return false
      // 有待做灵感时，提议直接用灵感，不再花一次模型调用。
      if (props.ideas && props.ideas.counts && props.ideas.counts.open > 0) return false
      return true
    }

    function goalRequest(method, body, query) {
      return fetch('/dsh-running-panel/goal' + (query || ''), {
        method: method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
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

    /* 「不用」过的提议按会话记在本地，免得每次打开都问。 */
    var GOAL_DISMISS_KEY = '__rp_goal_dismissed'
    function goalDismissed(sessionId) {
      try {
        var raw = window.localStorage.getItem(GOAL_DISMISS_KEY)
        var map = raw ? JSON.parse(raw) : {}
        return Boolean(map && map[sessionId])
      } catch (error) {
        return false
      }
    }
    function dismissGoal(sessionId) {
      try {
        var raw = window.localStorage.getItem(GOAL_DISMISS_KEY)
        var map = (raw && JSON.parse(raw)) || {}
        map[sessionId] = Date.now()
        var keys = Object.keys(map).sort(function (a, b) { return map[b] - map[a] }).slice(0, 200)
        var trimmed = {}
        keys.forEach(function (key) { trimmed[key] = map[key] })
        window.localStorage.setItem(GOAL_DISMISS_KEY, JSON.stringify(trimmed))
      } catch (error) {
        /* 隐私模式：只在本次渲染里不再显示 */
      }
    }

    function goalErrorText(t, error) {
      var code = String((error && error.message) || error || '')
      // 旧 Host 没有 /goal 路由：给出能照着做的提示，而不是「HTTP 404」。
      if (hostOutdated()) return t('hostOutdatedShort')
      if (code === 'goal_title_too_long') return fill(t('goalTooLong'), 'n', GOAL_TITLE_MAX)
      if (code === 'goal_workspace_unknown') return t('goalNoWorkspace')
      if (code === 'echo_capacity_reached') return t('goalFull')
      return fill(t('goalFailed'), 'reason', code)
    }

    var GOAL_TITLE_MAX = 200

    function phaseText(t, phase) {
      if (phase === 'paused') return t('goalPhasePaused')
      if (phase === 'blocked') return t('goalPhaseBlocked')
      if (phase === 'complete') return t('goalPhaseComplete')
      return t('goalPhaseActive')
    }

    /** 一行输入：输入法组字时回车不提交，Esc 取消。 */
    function GoalInput(props) {
      var t = props.t
      var pair = React.useState(props.initial || '')
      var value = pair[0]
      var setValue = pair[1]
      var tooLong = Array.from(value.trim()).length > GOAL_TITLE_MAX
      var submit = function () {
        if (props.busy || tooLong || !value.trim()) return
        props.onSubmit(value.trim())
      }
      return h(
        'div',
        { className: '__rp_goalActions', style: { flexWrap: 'nowrap' } },
        h('input', {
          className: '__rp_goalInput',
          autoFocus: true,
          value: value,
          placeholder: props.placeholder || t('goalNewPlaceholder'),
          'aria-label': props.placeholder || t('goalNewPlaceholder'),
          disabled: props.busy,
          onChange: function (event) {
            setValue(event.target.value)
          },
          onKeyDown: function (event) {
            if (event.nativeEvent && (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) return
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              props.onCancel()
            }
          },
        }),
        h('button', { type: 'button', className: '__rp_goalBtn', 'data-primary': '1', disabled: props.busy || tooLong || !value.trim(), onClick: submit }, props.busy ? t('menuSaving') : t('menuSave')),
        h('button', { type: 'button', className: '__rp_goalBtn', disabled: props.busy, onClick: props.onCancel }, t('menuCancel')),
        tooLong ? h('span', { className: '__rp_goalErr' }, fill(t('goalTooLong'), 'n', GOAL_TITLE_MAX)) : null,
      )
    }

    function GoalBar(props) {
      var t = props.t
      var sessionId = props.sessionId
      var pulse = props.goal
      var dsh = props.dsh
      usePrefs()
      var openPair = React.useState(false)
      var open = openPair[0]
      var setOpen = openPair[1]
      var editPair = React.useState('')
      var editing = editPair[0] // '' | 'new' | 'edit'
      var setEditing = editPair[1]
      var busyPair = React.useState(false)
      var busy = busyPair[0]
      var setBusy = busyPair[1]
      var errPair = React.useState('')
      var error = errPair[0]
      var setError = errPair[1]
      var dismissPair = React.useState(function () {
        return goalDismissed(sessionId)
      })
      var dismissed = dismissPair[0]
      var setDismissed = dismissPair[1]
      var aliveRef = React.useRef(true)
      React.useEffect(function () {
        return function () {
          aliveRef.current = false
        }
      }, [])

      // DSH 目标完成：记一条 PULSE 历史（Host 按目标 id 去重，这里只是少发几次）。
      var dshDoneKey = dsh && dsh.phase === 'complete' ? dsh.id : ''
      React.useEffect(
        function () {
          if (!dshDoneKey || !sessionId || recordedDshGoals.has(dshDoneKey)) return
          recordedDshGoals.add(dshDoneKey)
          goalRequest('POST', { sessionId: sessionId, dsh: { id: dsh.id, objective: dsh.objective, createdAt: dsh.createdAt } }).catch(function () {
            recordedDshGoals.delete(dshDoneKey)
          })
        },
        [dshDoneKey, sessionId],
      )

      // 没有任何目标时，请 Host 用模型推断一个提议。只在一轮结束后（不在 agent 跑的时候），
      // 同一会话同一轮只请求一次；Host 再按「每 3 轮最多一次」节流。失败不自动重试。
      var proposal = props.proposal || null
      // 灵感收集：一轮结束（或面板打开）时请求一次。
      var captureKey = shouldCaptureIdeas(props) ? sessionId + ':' + (Number(props.round) || 0) : ''
      React.useEffect(
        function () {
          if (!captureKey || requestedCapture.has(captureKey)) return
          requestedCapture.add(captureKey)
          ideaFetch('POST', { sessionId: sessionId, capture: true }).catch(function () {})
        },
        [captureKey],
      )
      var inferKey = shouldInferGoal(props, dismissed) ? sessionId + ':' + (Number(props.round) || 0) : ''
      React.useEffect(
        function () {
          if (!inferKey || requestedInference.has(inferKey)) return
          requestedInference.add(inferKey)
          goalRequest('POST', { sessionId: sessionId, infer: true }).catch(function () {})
        },
        [inferKey],
      )

      var run = function (promise, after) {
        setBusy(true)
        setError('')
        return promise
          .then(function () {
            if (!aliveRef.current) return
            setBusy(false)
            setEditing('')
            if (after) after()
          })
          .catch(function (failure) {
            if (!aliveRef.current) return
            setBusy(false)
            setError(goalErrorText(t, failure))
          })
      }
      var create = function (title, source) {
        return run(goalRequest('POST', { sessionId: sessionId, title: title, source: source || 'owner' }))
      }
      var patch = function (id, body, after) {
        return run(goalRequest('PATCH', Object.assign({ id: id }, body)), after)
      }
      var remove = function (id) {
        return run(goalRequest('DELETE', null, '?id=' + encodeURIComponent(id)))
      }

      if (!pulse) return null // Echo 存储没就绪或读坏了：storageWarning 已经在报
      var current = pulse.current
      var live = dshGoalLive(dsh)
      var focusOn = prefs.focusMode === true
      var modelProposal = proposal && proposal.status === 'ready' && proposal.title ? String(proposal.title) : ''
      var ideaProposal = props.ideas && props.ideas.open && props.ideas.open[0] ? props.ideas.open[0] : null
      var proposalText = ideaProposal ? ideaProposal.text : modelProposal || String(props.sessionTitle || '').trim()
      var inferring = Boolean(proposal && proposal.status === 'running')
      var proposing = !live && !current && proposalText && !dismissed && !editing

      var kind = live ? 'dsh' : current ? 'pulse' : proposing ? 'proposal' : 'empty'
      var toggle = function () {
        if (kind === 'proposal') return
        setError('')
        if (kind === 'empty' && !open) {
          setOpen(true)
          setEditing('new')
          return
        }
        setOpen(!open)
        if (open) setEditing('')
      }

      var bar
      if (kind === 'proposal') {
        bar = h(
          'div',
          { className: '__rp_goal', 'data-kind': 'proposal', 'data-source': ideaProposal ? 'idea' : modelProposal ? 'model' : 'title', title: ideaProposal ? t('goalIdeaTip') : modelProposal ? t('goalInferredModelTip') : t('goalInferredTip') },
          h('span', { className: '__rp_goalTag' }, ideaProposal ? t('goalTagIdea') : t('goalTagProposal')),
          h('span', { className: '__rp_goalMark', 'aria-hidden': 'true' }, '◇'),
          h('span', { className: '__rp_goalText' }, proposalText),
          inferring && !ideaProposal ? h('span', { className: '__rp_goalMeta', role: 'status' }, t('goalInferring')) : null,
          props.ideas && props.ideas.counts && (props.ideas.counts.open || props.ideas.counts.done)
            ? h('button', { type: 'button', className: '__rp_goalBtn', 'aria-expanded': open ? 'true' : 'false', onClick: function (event) { sfxFor(event, open ? 'collapse' : 'expand'); setOpen(!open) } }, fill(t('ideaBarCount'), 'n', props.ideas.counts.open) + (open ? ' ▴' : ' ▾'))
            : null,
          h('button', { type: 'button', className: '__rp_goalBtn', 'data-primary': '1', disabled: busy, onClick: function () { ideaProposal ? run(ideaFetch('POST', { sessionId: sessionId, goalFrom: ideaProposal.id })) : create(proposalText.slice(0, GOAL_TITLE_MAX), 'inferred') } }, t('goalAccept')),
          h('button', { type: 'button', className: '__rp_goalBtn', disabled: busy, onClick: function () { setOpen(true); setEditing('new') } }, t('goalEdit')),
          h('button', { type: 'button', className: '__rp_goalBtn', 'aria-label': t('goalDismiss'), title: t('goalDismiss'), disabled: busy, onClick: function () { dismissGoal(sessionId); setDismissed(true) } }, '✕'),
        )
      } else {
        // 推断出的目标还没确认：「待确认 ◇」（空心）；确认后才是「追踪中 ◆」。
        var unconfirmed = kind === 'pulse' && current.source === 'inferred'
        var mark = kind === 'empty' ? '+' : unconfirmed ? '◇' : '◆'
        // DSH /goal 的轮数画成分段进度（最多 24 段，轮数更多时按比例点亮）。
        var segments = null
        if (kind === 'dsh' && dsh.max > 0) {
          var count = Math.min(24, dsh.max)
          var lit = Math.round((Math.min(dsh.rounds, dsh.max) / dsh.max) * count)
          segments = h(
            'span',
            { className: '__rp_goalProgress', 'aria-hidden': 'true' },
            Array.from({ length: count }, function (_, index) {
              return h('span', { key: index, className: '__rp_goalSeg', 'data-on': index < lit ? '1' : undefined })
            }),
          )
        }
        var text = kind === 'dsh' ? dsh.objective : kind === 'pulse' ? current.title : t('goalEmpty')
        var meta = ''
        if (kind === 'dsh') {
          meta = phaseText(t, dsh.phase)
          if (dsh.max) meta += ' · ' + fill(fill(t('goalRounds'), 'n', dsh.rounds), 'max', dsh.max)
        } else if (pulse.doneCount) {
          meta = fill(t('goalDoneCount'), 'n', pulse.doneCount)
        }
        if (props.ideas && props.ideas.counts && props.ideas.counts.open) meta = (meta ? meta + ' · ' : '') + fill(t('ideaBarCount'), 'n', props.ideas.counts.open)
        bar = h(
          'div',
          {
            className: '__rp_goal',
            'data-kind': kind,
            'data-phase': kind === 'dsh' ? dsh.phase : undefined,
            role: 'button',
            tabIndex: 0,
            'aria-expanded': open ? 'true' : 'false',
            title: kind === 'dsh' && dsh.blocked ? dsh.blocked : text,
            onClick: toggle,
            onKeyDown: function (event) {
              if (event.target !== event.currentTarget) return
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                toggle()
              }
            },
          },
          kind === 'empty' ? null : h('span', { className: '__rp_goalTag', title: unconfirmed ? t('goalInferredTip') : undefined }, unconfirmed ? t('goalTagUnconfirmed') : t('goalTagTracked')),
          h('span', { className: '__rp_goalMark', 'aria-hidden': 'true' }, mark),
          kind === 'dsh' ? h('span', { className: '__rp_goalBadge' }, t('goalDshBadge')) : null,
          h('span', { className: '__rp_goalText' }, text),
          focusOn && kind !== 'empty' ? h('span', { className: '__rp_goalBadge' }, t('goalFocusOn')) : null,
          meta ? h('span', { className: '__rp_goalMeta' }, meta) : null,
          segments,
        )
      }

      var drawer = null
      if (open || editing) {
        var parts = []
        if (kind === 'dsh') {
          parts.push(h('div', { key: 'dsh', className: '__rp_goalNote' }, dsh.blocked ? dsh.blocked + ' — ' + t('goalDshManaged') : t('goalDshManaged')))
        } else if (kind === 'pulse' && editing !== 'edit') {
          parts.push(
            h(
              'div',
              { key: 'acts', className: '__rp_goalActions' },
              current.source === 'inferred'
                ? h('button', { type: 'button', className: '__rp_goalBtn', 'data-primary': '1', disabled: busy, onClick: function () { patch(current.id, { confirm: true }) } }, t('goalConfirm'))
                : null,
              h('button', { type: 'button', className: '__rp_goalBtn', 'data-primary': current.source !== 'inferred' ? '1' : undefined, disabled: busy, onClick: function (event) { if (event && event.nativeEvent) event.nativeEvent.__rpSfx = true; patch(current.id, { status: 'done' }, function () { sfxPlay('done'); if (modelAllowed('collectIdeas') && props.ideas && props.ideas.counts && props.ideas.counts.open) ideaFetch('POST', { sessionId: sessionId, check: true }).catch(function () {}) }) } }, t('goalDone')),
              h('button', { type: 'button', className: '__rp_goalBtn', disabled: busy, onClick: function () { setEditing('edit') } }, t('goalEdit')),
              h('button', { type: 'button', className: '__rp_goalBtn', disabled: busy, onClick: function () { setEditing('new') } }, t('goalNew')),
              h('button', { type: 'button', className: '__rp_goalBtn', 'data-danger': '1', disabled: busy, onClick: function () { remove(current.id) } }, t('goalRemove')),
            ),
          )
        }
        if (editing === 'edit' && current) {
          parts.push(h(GoalInput, { key: 'edit', t: t, initial: current.title, busy: busy, onCancel: function () { setEditing('') }, onSubmit: function (title) { patch(current.id, { title: title, confirm: true }) } }))
        } else if (editing === 'new') {
          parts.push(h(GoalInput, { key: 'new', t: t, initial: !current && !live && !dismissed ? proposalText : '', busy: busy, onCancel: function () { setEditing(''); if (kind === 'empty' || kind === 'proposal') setOpen(false) }, onSubmit: function (title) { create(title, 'owner') } }))
          if (current || live) parts.push(h('div', { key: 'hint', className: '__rp_goalNote' }, live ? t('goalDshParallel') : t('goalReplaceHint')))
        } else if (kind === 'empty' || kind === 'dsh') {
          if (kind === 'empty') parts.push(h('div', { key: 'new-btn', className: '__rp_goalActions' }, h('button', { type: 'button', className: '__rp_goalBtn', 'data-primary': '1', onClick: function () { setEditing('new') } }, t('goalNew'))))
        }
        if (error) parts.push(h('div', { key: 'err', className: '__rp_goalErr', role: 'alert' }, error))
        parts.push(
          h(
            'label',
            { key: 'focus', className: '__rp_goalFocus' },
            h('input', {
              type: 'checkbox',
              checked: focusOn,
              onChange: function (event) {
                setPref('focusMode', event.target.checked)
              },
            }),
            h('span', null, t('goalFocusToggle')),
          ),
        )
        parts.push(h(IdeaPanel, { key: 'ideas', t: t, sessionId: sessionId, ideas: props.ideas }))
        if (pulse.history && pulse.history.length) {
          parts.push(h('div', { key: 'hist-title', className: '__rp_goalHistTitle' }, t('goalHistory')))
          pulse.history.slice(0, 10).forEach(function (item) {
            parts.push(
              h(
                'div',
                { key: item.id, className: '__rp_goalHist', 'data-status': item.status },
                h('span', { className: '__rp_goalMark', 'aria-hidden': 'true' }, item.status === 'done' ? '✓' : '↷'),
                item.dsh ? h('span', { className: '__rp_goalBadge' }, t('goalDshBadge')) : null,
                h('span', { className: '__rp_goalText', title: item.title }, item.title),
                h('span', { className: '__rp_goalMeta' }, (item.status === 'stale' ? t('goalStale') + ' · ' : '') + dateOnly(item.doneAt || item.updatedAt)),
                item.dsh ? null : h('button', { type: 'button', className: '__rp_goalBtn', disabled: busy, onClick: function () { patch(item.id, { status: 'open' }) } }, t('goalReopen')),
                h('button', { type: 'button', className: '__rp_goalBtn', 'data-danger': '1', 'aria-label': t('goalRemove'), title: t('goalRemove'), disabled: busy, onClick: function () { remove(item.id) } }, '✕'),
              ),
            )
          })
        }
        drawer = h('div', { className: '__rp_goalDrawer' }, parts)
      } else if (error) {
        drawer = h('div', { className: '__rp_goalDrawer' }, h('div', { className: '__rp_goalErr', role: 'alert' }, error))
      }
      return h('div', { className: '__rp_goalWrap' }, bar, drawer)
    }
    /* ── 灵感与分支：目标抽屉里的一块 ───────────────────────────────────── */

    /**
     * 开发路上助手给的方向、你说的「以后再做」，按工作区收在这里：
     * 待做（带来源、可跳回原对话、可设为目标）/ 进行中（已是目标）/ 已完成（折叠）。
     * 「可能已完成」是模型对照最近对话的判断，要你点「确认完成」才算。
     * 收集在每轮结束后自动请求（设置里可关）；回填历史会先告诉你要调几次模型。
     */

    CSS += '\n' + [
      '.__rp_ideas{display:flex;flex-direction:column;gap:6px;border-top:1px dashed var(--dsw-alias-border-l1);padding-top:8px}',
      '.__rp_ideasHead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.__rp_ideasTitle{font-size:11px;letter-spacing:.14em;color:var(--rp-amber);font-weight:600}',
      '.__rp_ideasCount{font-size:11.5px;color:var(--dsw-alias-label-tertiary)}',
      '.__rp_ideasTools{margin-left:auto;display:flex;gap:4px;flex-wrap:wrap}',
      '.__rp_idea{display:flex;align-items:flex-start;gap:6px;min-width:0;padding:3px 0}',
      '.__rp_ideaMark{flex:none;width:12px;color:var(--rp-amber);font-size:10px;line-height:1.9}',
      '.__rp_idea[data-status=doing] .__rp_ideaMark{color:var(--rp-teal)}',
      '.__rp_idea[data-status=done]{opacity:.62}',
      '.__rp_ideaMain{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}',
      '.__rp_ideaText{font-size:12.5px;line-height:1.45;color:var(--dsw-alias-label-primary);word-break:break-word}',
      '.__rp_ideaMeta{display:flex;flex-wrap:wrap;gap:4px;align-items:center;font-size:11px;color:var(--dsw-alias-label-tertiary)}',
      '.__rp_ideaChip{border:1px solid var(--dsw-alias-border-l1);border-radius:3px;padding:0 4px;line-height:1.5}',
      '.__rp_ideaChip[data-kind=maybe]{color:var(--rp-amber);border-color:color-mix(in srgb,var(--rp-amber) 50%,transparent)}',
      '.__rp_ideaActs{flex:none;display:flex;gap:3px;visibility:hidden}',
      '.__rp_idea:hover .__rp_ideaActs,.__rp_idea:focus-within .__rp_ideaActs,.__rp_idea[data-maybe="1"] .__rp_ideaActs{visibility:visible}',
      '.__rp_ideaActs .__rp_goalBtn{padding:0 6px;font-size:11.5px}',
      '.__rp_ideasNote{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.5}',
      '.__rp_ideasErr{font-size:12px;color:var(--dsw-alias-state-error-primary)}',
    ].join('\n')

    // goalRequest 打的是 /goal；灵感走自己的路由。
    function ideaFetch(method, body, query) {
      return fetch('/dsh-running-panel/idea' + (query || ''), {
        method: method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
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

    var requestedCapture = new Set()

    /** 一轮结束（或面板打开）时请求一次收集；同一会话同一轮只发一次，Host 自己记着扫到哪了。 */
    function shouldCaptureIdeas(props) {
      if (!modelAllowed('collectIdeas') || !props.sessionId) return false
      if (props.phase === 'active') return false
      return Boolean(props.ideas)
    }

    function ideaSourceText(t, source) {
      if (source === 'user') return t('ideaFromUser')
      if (source === 'history') return t('ideaFromHistory')
      if (source === 'manual') return t('ideaFromManual')
      return t('ideaFromAssistant')
    }

    function IdeaPanel(props) {
      var t = props.t
      var sessionId = props.sessionId
      var ideas = props.ideas
      var busyPair = React.useState('')
      var busy = busyPair[0]
      var setBusy = busyPair[1]
      var errPair = React.useState('')
      var error = errPair[0]
      var setError = errPair[1]
      var donePair = React.useState(false)
      var showDone = donePair[0]
      var setShowDone = donePair[1]
      var estimatePair = React.useState(null)
      var estimate = estimatePair[0]
      var setEstimate = estimatePair[1]
      var addPair = React.useState(false)
      var adding = addPair[0]
      var setAdding = addPair[1]
      var aliveRef = React.useRef(true)
      React.useEffect(function () {
        return function () {
          aliveRef.current = false
        }
      }, [])
      if (!ideas) return null
      var state = ideas.state || {}
      var counts = ideas.counts || { open: 0, doing: 0, done: 0 }

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
            var code = String((failure && failure.message) || failure)
            setError(hostOutdated() ? t('hostOutdatedShort') : code === 'echo_capacity_reached' ? t('goalFull') : fill(t('ideaFailed'), 'reason', code))
          })
      }
      var patch = function (idea, body, sound) {
        return act(idea.id, ideaFetch('PATCH', Object.assign({ id: idea.id }, body)), function () {
          if (sound) sfxPlay(sound)
        })
      }
      var toGoal = function (idea) {
        return act(idea.id, ideaFetch('POST', { sessionId: sessionId, goalFrom: idea.id }))
      }

      var row = function (idea) {
        var maybe = idea.status === 'open' && idea.maybeDone
        var canJump = Boolean(idea.sessionId && idea.messageId)
        return h(
          'div',
          { key: idea.id, className: '__rp_idea', 'data-status': idea.status, 'data-maybe': maybe ? '1' : undefined },
          h('span', { className: '__rp_ideaMark', 'aria-hidden': 'true' }, idea.status === 'done' ? '✓' : idea.status === 'doing' ? '◆' : '◇'),
          h(
            'div',
            { className: '__rp_ideaMain' },
            h('span', { className: '__rp_ideaText' }, idea.text),
            h(
              'span',
              { className: '__rp_ideaMeta' },
              h('span', { className: '__rp_ideaChip' }, ideaSourceText(t, idea.source)),
              idea.status === 'doing' ? h('span', { className: '__rp_ideaChip' }, t('ideaDoing')) : null,
              maybe ? h('span', { className: '__rp_ideaChip', 'data-kind': 'maybe', title: idea.maybeDone.evidence || '' }, t('ideaMaybeDone')) : null,
              h('span', null, dateOnly(idea.status === 'done' ? idea.doneAt : idea.createdAt)),
            ),
          ),
          h(
            'span',
            { className: '__rp_ideaActs' },
            maybe
              ? [
                  h('button', { key: 'yes', type: 'button', className: '__rp_goalBtn', 'data-primary': '1', disabled: busy === idea.id, onClick: function (event) { if (event && event.nativeEvent) event.nativeEvent.__rpSfx = true; patch(idea, { status: 'done' }, 'done') } }, t('ideaConfirmDone')),
                  h('button', { key: 'no', type: 'button', className: '__rp_goalBtn', disabled: busy === idea.id, onClick: function () { patch(idea, { dismissMaybe: true }) } }, t('ideaNotDone')),
                ]
              : null,
            idea.status === 'open' && !maybe
              ? [
                  h('button', { key: 'goal', type: 'button', className: '__rp_goalBtn', 'data-primary': '1', disabled: busy === idea.id, onClick: function () { toGoal(idea) } }, t('ideaToGoal')),
                  h('button', { key: 'done', type: 'button', className: '__rp_goalBtn', disabled: busy === idea.id, onClick: function (event) { if (event && event.nativeEvent) event.nativeEvent.__rpSfx = true; patch(idea, { status: 'done' }, 'done') } }, t('goalDone')),
                  h('button', { key: 'drop', type: 'button', className: '__rp_goalBtn', 'aria-label': t('ideaDrop'), title: t('ideaDrop'), disabled: busy === idea.id, onClick: function () { patch(idea, { status: 'dropped' }) } }, '✕'),
                ]
              : null,
            idea.status === 'done' ? h('button', { key: 'reopen', type: 'button', className: '__rp_goalBtn', disabled: busy === idea.id, onClick: function () { patch(idea, { status: 'open' }) } }, t('goalReopen')) : null,
            canJump
              ? h('button', { key: 'jump', type: 'button', className: '__rp_goalBtn', 'aria-label': t('ideaJump'), title: t('ideaJump'), onClick: function () { openEchoAnchor({ sessionId: idea.sessionId, messageId: idea.messageId }) } }, '↗')
              : null,
          ),
        )
      }

      var status = ''
      if (state.capturing) status = t('ideaCapturing')
      else if (state.checking) status = t('ideaChecking')
      else if (state.backfill && state.backfill.running) status = fill(fill(fill(t('ideaBackfilling'), 'done', state.backfill.done), 'total', state.backfill.total || '?'), 'added', state.backfill.added)
      else if (state.backfill && state.backfill.error) status = fill(t('ideaFailed'), 'reason', state.backfill.error)
      else if (state.backfill && state.backfill.total) status = fill(t('ideaBackfilled'), 'added', state.backfill.added)
      else if (state.lastError) status = fill(t('ideaFailed'), 'reason', state.lastError)

      var backfillRunning = Boolean(state.backfill && state.backfill.running)
      var nodes = [
        h(
          'div',
          { key: 'head', className: '__rp_ideasHead' },
          h('span', { className: '__rp_ideasTitle' }, t('ideaTitle')),
          h('span', { className: '__rp_ideasCount' }, fill(fill(t('ideaCounts'), 'open', counts.open), 'done', counts.done)),
          h(
            'span',
            { className: '__rp_ideasTools' },
            h('button', { type: 'button', className: '__rp_goalBtn', onClick: function () { setAdding(!adding) } }, t('ideaAdd')),
            counts.open
              ? h('button', { type: 'button', className: '__rp_goalBtn', disabled: state.checking, onClick: function () { act('check', ideaFetch('POST', { sessionId: sessionId, check: true })) } }, t('ideaCheck'))
              : null,
            h(
              'button',
              {
                type: 'button',
                className: '__rp_goalBtn',
                disabled: backfillRunning || busy === 'estimate',
                onClick: function () {
                  act('estimate', ideaFetch('GET', null, '?estimate=1&session=' + encodeURIComponent(sessionId)), function (value) {
                    setEstimate(value)
                  })
                },
              },
              t('ideaBackfill'),
            ),
          ),
        ),
      ]
      if (adding) {
        nodes.push(
          h(GoalInput, {
            key: 'add',
            t: t,
            placeholder: t('ideaAddPlaceholder'),
            busy: busy === 'add',
            onCancel: function () {
              setAdding(false)
            },
            onSubmit: function (text) {
              act('add', ideaFetch('POST', { sessionId: sessionId, text: text }), function () {
                setAdding(false)
              })
            },
          }),
        )
      }
      if (estimate) {
        nodes.push(
          h(
            'div',
            { key: 'estimate', className: '__rp_ideasNote' },
            estimate.calls
              ? fill(fill(fill(t('ideaEstimate'), 'sessions', estimate.sessions), 'turns', estimate.turns), 'calls', estimate.calls)
              : fill(t('ideaEstimateNone'), 'sessions', estimate.sessions),
            ' ',
            estimate.calls
              ? h('button', { type: 'button', className: '__rp_goalBtn', 'data-primary': '1', onClick: function () { setEstimate(null); act('backfill', ideaFetch('POST', { sessionId: sessionId, backfill: true })) } }, t('ideaBackfillStart'))
              : null,
            ' ',
            h('button', { type: 'button', className: '__rp_goalBtn', onClick: function () { setEstimate(null) } }, t('menuCancel')),
          ),
        )
      }
      if (status) nodes.push(h('div', { key: 'status', className: '__rp_ideasNote', role: 'status' }, status))
      if (error) nodes.push(h('div', { key: 'err', className: '__rp_ideasErr', role: 'alert' }, error))
      ;(ideas.doing || []).forEach(function (idea) {
        nodes.push(row(idea))
      })
      ;(ideas.open || []).forEach(function (idea) {
        nodes.push(row(idea))
      })
      if (!counts.open && !counts.doing) nodes.push(h('div', { key: 'empty', className: '__rp_ideasNote' }, t('ideaEmpty')))
      if (counts.done) {
        nodes.push(
          h('button', { key: 'done-toggle', type: 'button', className: '__rp_linkBtn', style: { alignSelf: 'flex-start', fontSize: '12px' }, onClick: function (event) { sfxFor(event, showDone ? 'collapse' : 'expand'); setShowDone(!showDone) } }, (showDone ? '▾ ' : '▸ ') + fill(t('ideaDoneList'), 'n', counts.done)),
        )
        if (showDone)
          (ideas.done || []).forEach(function (idea) {
            nodes.push(row(idea))
          })
      }
      return h('div', { className: '__rp_ideas', role: 'region', 'aria-label': t('ideaTitle') }, nodes)
    }
    /* ── 技能装配窗口（战术装备界面式） ─────────────────────────────── */

    /**
     * 打开时整个 DSH 界面模糊压暗成景深背景；左边是一个向右倾斜的大圆盘（视觉 / 编码 / 思考 / 执行
     * 四类占比 + 内圈预算），右边是装配窗口：顶部配置页签、四张数据卡、按占用分段的预算条、
     * 按类别分列的技能磁贴、详情栏、底部按键提示。
     * 拖磁贴到预算条或圆盘上 = 装上，把预算条上的段拖回技能区 = 卸下，点一下也能装卸。
     * 「应用」先预演（停用 / 恢复 / 保留别的对话在用的），确认才搬目录，可撤销。
     */

    CSS += '\n' + [
      '.__rp_lo{position:fixed;inset:0;z-index:440;display:flex;align-items:center;justify-content:center;gap:36px;padding:28px 32px;box-sizing:border-box;overscroll-behavior:contain;color:#d9dee2;font-size:13px;line-height:1.45;background:rgba(6,9,11,.32);animation:__rp_loIn var(--rp-menu-fade,.14s) ease-out both}',
      '.__rp_lo[data-blur="1"]{-webkit-backdrop-filter:blur(var(--rp-menu-blur,10px)) saturate(.8) brightness(.62);backdrop-filter:blur(var(--rp-menu-blur,10px)) saturate(.8) brightness(.62)}',
      // 只淡入不透明度：模糊半径从 0 动画到 12px 要每帧重新模糊整个 DSH 页面，打开时明显发慢。
      '@keyframes __rp_loIn{from{opacity:0}}',
      '.__rp_loStage{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:14px;perspective:1100px}',
      '.__rp_loRing{transform:rotateY(18deg);transform-origin:center;transition:transform .3s ease-out,filter .2s ease-out}',
      '.__rp_loRing[data-drop="1"]{filter:drop-shadow(0 0 18px rgba(255,138,31,.45))}',
      '.__rp_loLegend{width:260px;transform:rotateY(18deg);display:flex;flex-direction:column;gap:3px}',
      '.__rp_loLegendRow{display:flex;align-items:center;gap:8px}',
      '.__rp_loLegendRow i{width:9px;height:9px;flex:none}',
      '.__rp_loLegendRow b{margin-left:auto;font-weight:500;font-variant-numeric:tabular-nums}',
      '.__rp_loLegendRow[data-bias="1"] b{color:var(--rp-amber,#ff8a1f)}',
      '.__rp_loPanel{box-sizing:border-box;flex:0 1 1280px;min-width:0;max-height:calc(100vh - 56px);overflow:hidden;background:rgba(14,19,23,.92);border:1px solid #2b3338;border-radius:6px;padding:18px 22px;display:flex;flex-direction:column;gap:14px}',
      '.__rp_loPanel > *{animation:__rp_mosaicIn 1.1s steps(5,end) both}',
      ...[1, 2, 3, 4, 5, 6, 7].map(function (n) { return '.__rp_loPanel > *:nth-child(' + n + '){animation-delay:' + (120 + (n - 1) * 90) + 'ms}' }),
      '.__rp_loHead{display:flex;align-items:center;gap:14px;flex-wrap:wrap;border-bottom:1px solid #2b3338;padding-bottom:8px}',
      '.__rp_loKicker{color:var(--rp-amber,#ff8a1f);letter-spacing:.18em;font-size:11px;font-weight:600}',
      '.__rp_loTitle{font-size:16px;font-weight:600}',
      '.__rp_loTab{background:none;border:0;border-bottom:2px solid transparent;color:#8a949b;font:inherit;padding:2px 2px 4px;cursor:pointer}',
      '.__rp_loTab[aria-selected="true"]{color:#e7e9ec;border-bottom-color:var(--rp-amber,#ff8a1f)}',
      '.__rp_loTab:hover{color:#e7e9ec}',
      '.__rp_loStats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}',
      '.__rp_loStat{border:1px solid #2b3338;padding:8px 12px}',
      '.__rp_loStat span{display:block;color:#8a949b;font-size:11px}',
      '.__rp_loStat strong{font-size:22px;font-weight:600;font-variant-numeric:tabular-nums}',
      '.__rp_loStat small{color:#8a949b;font-size:11px;margin-left:4px}',
      '.__rp_loStat[data-over="1"] strong{color:var(--rp-rust,#e5533d)}',
      '.__rp_loBar{position:relative;height:30px;border:1px solid #2b3338;display:flex;gap:2px;padding:2px;overflow:hidden;box-sizing:border-box;transition:border-color .15s}',
      '.__rp_loBar[data-drop="1"]{border-color:var(--rp-amber,#ff8a1f)}',
      '.__rp_loSeg{flex:0 1 auto;min-width:2px;cursor:grab;transition:filter .12s}',
      '.__rp_loSeg:hover,.__rp_loSeg[data-focus="1"]{filter:brightness(1.35)}',
      '.__rp_loSeg[data-builtin="1"]{background:repeating-linear-gradient(45deg,#3a4248 0 4px,#30373c 4px 8px);cursor:default}',
      '.__rp_loLimit{position:absolute;top:0;bottom:0;width:2px;background:#fff;pointer-events:none;box-shadow:0 0 0 1px rgba(0,0,0,.5)}',
      '.__rp_loBarHint{display:flex;justify-content:space-between;gap:10px;color:#8a949b;font-size:11px}',
      '.__rp_loPanel > *{flex-shrink:0}',
      // 只有磁贴 + 详情这一块滚动，标题、预算条、底部按键始终可见、不被压住。
      '.__rp_loPanel > .__rp_loBody{flex:1 1 auto;min-height:200px;overflow:auto;overscroll-behavior:contain;padding-right:6px}',
      '.__rp_loBody{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:20px;align-items:start}',
      '.__rp_loBody > .__rp_loDetail{position:sticky;top:0}',
      '.__rp_loCols{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px 18px;align-content:start}',
      '.__rp_loLibs{display:flex;flex-direction:column;gap:6px;min-height:120px}',
      '.__rp_loLibs[data-drop="1"]{outline:1px dashed var(--rp-amber,#ff8a1f);outline-offset:4px}',
      '.__rp_loLib{border:1px solid #2b3338;background:rgba(160,170,178,.04)}',
      '.__rp_loLib[data-open="1"]{border-color:#3a4248}',
      '.__rp_loLibHead{display:flex;align-items:center;gap:8px;padding:2px 8px 2px 0}',
      '.__rp_loLibToggle{flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:10px;padding:9px 12px;border:0;background:none;color:#d9dee2;font:inherit;font-size:14px;text-align:left;cursor:pointer}',
      '.__rp_loLibToggle:hover{background:rgba(160,170,178,.08)}',
      '.__rp_loLibToggle:focus-visible{outline:2px solid #fff;outline-offset:-2px}',
      '.__rp_loLibCaret{width:12px;color:#8a949b}',
      '.__rp_loLibName{flex:1 1 auto;min-width:7em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}',
      '.__rp_loLibCount{flex:none;color:#8a949b;font-size:12px;font-variant-numeric:tabular-nums}',
      '.__rp_loLibStripe{flex:0 4 140px;min-width:24px;height:5px;display:flex;gap:1px}',
      '.__rp_loLibStripe i{display:block;height:5px;flex-basis:0}',
      '.__rp_loLibTok{flex:none;width:70px;text-align:right;color:#8a949b;font-size:12px;font-variant-numeric:tabular-nums}',
      '.__rp_loLibAll{flex:none;font-size:12px;padding:3px 10px}',
      '.__rp_loLib > .__rp_loCols{padding:4px 12px 10px;animation:__rp_mosaicIn .6s steps(4,end) both}',
      '.__rp_loColHead{color:#8a949b;font-size:11px;border-bottom:1px solid #2b3338;margin-bottom:8px;padding-bottom:3px;display:flex;justify-content:space-between}',
      '.__rp_loTile{display:flex;align-items:center;gap:6px;width:100%;box-sizing:border-box;margin-bottom:6px;padding:7px 10px;border:1px solid #3a4248;background:transparent;color:#d9dee2;font:inherit;font-size:13px;text-align:left;cursor:pointer;transition:transform .1s cubic-bezier(.22,1,.36,1),filter .14s ease-out .05s}',
      '.__rp_loTile:hover{transform:translateY(-1px);filter:brightness(1.12)}',
      '.__rp_loTile:active{transform:scale(.97)}',
      '.__rp_loTile:focus-visible,.__rp_loTile[data-focus="1"]{outline:2px solid #fff;outline-offset:-2px}',
      '.__rp_loTile[data-on="1"]{border-color:transparent;color:#1b1206}',
      '.__rp_loTile[data-locked="1"]{opacity:.6;cursor:not-allowed}',
      '.__rp_loTile[data-missing="1"]{opacity:.4}',
      '.__rp_loTileName{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.__rp_loTileTok{flex:none;font-variant-numeric:tabular-nums;font-size:11.5px;opacity:.85}',
      '.__rp_loDetail{border:1px solid #2b3338;padding:12px 14px;display:flex;flex-direction:column;gap:7px;align-self:start;position:sticky;top:0}',
      '.__rp_loDetailKicker{color:var(--rp-amber,#ff8a1f);font-size:11px;letter-spacing:.12em}',
      '.__rp_loDetailName{font-size:15px;font-weight:600}',
      '.__rp_loKV{display:flex;justify-content:space-between;gap:8px}',
      '.__rp_loKV span:first-child{color:#8a949b}',
      '.__rp_loCmp{height:4px;background:#2b3338}',
      '.__rp_loCmp i{display:block;height:4px}',
      '.__rp_loSub{color:#8a949b;font-size:11px;border-top:1px solid #2b3338;padding-top:4px;margin-top:2px}',
      '.__rp_loFoot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;border-top:1px solid #2b3338;padding-top:8px}',
      '.__rp_loKeys{display:flex;gap:12px;color:#8a949b;font-size:11px;flex-wrap:wrap;margin-right:auto}',
      '.__rp_loKeys kbd{font:inherit;color:#d9dee2}',
      '.__rp_loBtn{border:1px solid #3a4248;background:transparent;color:#d9dee2;font:inherit;padding:6px 14px;cursor:pointer}',
      '.__rp_loBtn:hover{border-color:var(--rp-amber,#ff8a1f)}',
      '.__rp_loBtn[data-primary="1"]{border-color:var(--rp-amber,#ff8a1f);color:var(--rp-amber,#ff8a1f)}',
      '.__rp_loBtn:disabled{opacity:.45;cursor:default}',
      '.__rp_loNote{color:#8a949b;font-size:12px}',
      '.__rp_loErr{color:#e5533d;font-size:12px}',
      '.__rp_loPreview{border:1px solid #2b3338;padding:9px 11px;display:flex;flex-direction:column;gap:6px}',
      '@media (max-width:1180px){.__rp_lo{flex-direction:column;justify-content:flex-start;overflow:auto}.__rp_loRing,.__rp_loLegend{transform:none}.__rp_loPanel{flex:0 0 auto;width:100%;max-height:none}.__rp_loPanel > .__rp_loBody{overflow:visible}.__rp_loBody > .__rp_loDetail{position:static}.__rp_loBody{grid-template-columns:minmax(0,1fr)}.__rp_loStats{grid-template-columns:repeat(2,minmax(0,1fr))}}',
      '@media (prefers-reduced-motion:reduce){.__rp_lo,.__rp_loPanel > *{animation:none!important}}',
    ].join('\n')

    var LO_GROUPS = ['visual', 'code', 'thought', 'ops']
    var LO_COLORS = { visual: '#ff8a1f', code: '#2f8f8d', thought: '#e8b93c', ops: '#c8553a' }
    var LO_DRAG = 'text/x-pulse-skill'

    function loadoutFetch(query) {
      return fetch('/dsh-running-panel/loadout' + (query || ''), { cache: 'no-store' }).then(function (response) {
        return response.json().catch(function () { return {} }).then(function (value) {
          if (!response.ok) throw new Error((value && value.error) || 'HTTP ' + response.status)
          return value
        })
      })
    }

    /** 装配的纯计算：分组占比、预算、偏向（导出给测试）。 */
    function loadoutStats(skills, equipped, builtinTokens, limit) {
      var byGroup = { visual: 0, code: 0, thought: 0, ops: 0 }
      var used = Number(builtinTokens) || 0
      var count = 0
      var week = Date.now() - 7 * 86400000
      var recent = 0
      skills.forEach(function (skill) {
        if (!equipped[skill.name]) return
        count += 1
        used += skill.tokens
        byGroup[LO_GROUPS.indexOf(skill.group) >= 0 ? skill.group : 'ops'] += skill.tokens
        if (skill.lastAt >= week) recent += 1
      })
      var userTotal = byGroup.visual + byGroup.code + byGroup.thought + byGroup.ops
      var bias = ''
      var best = 0
      LO_GROUPS.forEach(function (group) {
        if (byGroup[group] > best) {
          best = byGroup[group]
          bias = group
        }
      })
      return {
        used: used,
        count: count,
        recent: recent,
        byGroup: byGroup,
        share: LO_GROUPS.reduce(function (out, group) { out[group] = userTotal ? byGroup[group] / userTotal : 0; return out }, {}),
        bias: userTotal ? bias : '',
        limit: limit,
        over: used > limit,
      }
    }

    /** 按常用补满：在剩余预算里按累计使用次数从高到低装上（跳过找不到的）。 */
    function fillByUsage(skills, equipped, builtinTokens, limit) {
      var next = Object.assign({}, equipped)
      var used = (Number(builtinTokens) || 0) + skills.reduce(function (sum, s) { return sum + (next[s.name] ? s.tokens : 0) }, 0)
      skills
        .filter(function (s) { return !next[s.name] && s.movable !== false && s.uses > 0 })
        .sort(function (a, b) { return b.uses - a.uses || b.lastAt - a.lastAt })
        .forEach(function (s) {
          if (used + s.tokens > limit) return
          next[s.name] = true
          used += s.tokens
        })
      return next
    }

    function LoadoutRing(props) {
      var stats = props.stats
      var r = 36
      var c = 2 * Math.PI * r
      var offset = 0
      var arcs = []
      LO_GROUPS.forEach(function (group) {
        var share = stats.share[group]
        if (!share) return
        var len = Math.max(0, share * c - 1.2)
        arcs.push(h('circle', { key: group, cx: 50, cy: 50, r: r, fill: 'none', stroke: LO_COLORS[group], strokeWidth: 7, strokeDasharray: len.toFixed(2) + ' ' + (c - len).toFixed(2), strokeDashoffset: (-offset).toFixed(2), transform: 'rotate(-90 50 50)' }))
        offset += share * c
      })
      var ir = 27
      var ic = 2 * Math.PI * ir
      var pct = stats.limit ? Math.min(1, stats.used / stats.limit) : 0
      return h(
        'svg',
        { width: props.size, height: props.size, viewBox: '0 0 100 100', role: 'img', 'aria-label': props.label },
        h('circle', { cx: 50, cy: 50, r: 47, fill: 'none', stroke: '#2b3338', strokeWidth: 0.4 }),
        h('circle', { cx: 50, cy: 50, r: 45, fill: 'none', stroke: 'rgba(255,138,31,.35)', strokeWidth: 1.6, strokeDasharray: '.4 1.4' }),
        h('circle', { cx: 50, cy: 50, r: r, fill: 'none', stroke: '#252d32', strokeWidth: 7 }),
        arcs,
        h('circle', { cx: 50, cy: 50, r: ir, fill: 'none', stroke: '#2b3338', strokeWidth: 1.4 }),
        h('circle', { cx: 50, cy: 50, r: ir, fill: 'none', stroke: stats.over ? '#e5533d' : '#ff8a1f', strokeWidth: 1.4, strokeDasharray: (ic * pct).toFixed(2) + ' ' + ic.toFixed(2), transform: 'rotate(-90 50 50)' }),
        h('text', { x: 50, y: 47, textAnchor: 'middle', fill: '#e7e9ec', fontSize: 13, fontWeight: 600 }, String(stats.count)),
        h('text', { x: 50, y: 55, textAnchor: 'middle', fill: '#8a949b', fontSize: 4.6 }, props.countLabel),
        h('text', { x: 50, y: 63, textAnchor: 'middle', fill: stats.over ? '#e5533d' : '#ff8a1f', fontSize: 4.6 }, props.budgetLabel),
      )
    }

    /** 装配窗口里哪些库展开着：这一页里记住，下次打开还是那样。 */
    var loOpenLibsSeen = {}
    function LoadoutWindow(props) {
      var t = props.t
      var closingPair = useMenuClose(props.onClose)
      var requestClose = closingPair[1]
      var openPair = React.useState(function () { return Object.assign({}, loOpenLibsSeen) })
      var openLibs = openPair[0]
      var setOpenLibs = openPair[1]
      var dataPair = React.useState(null)
      var data = dataPair[0]
      var setData = dataPair[1]
      var equippedPair = React.useState(null)
      var equipped = equippedPair[0]
      var setEquipped = equippedPair[1]
      var tabPair = React.useState('current')
      var tab = tabPair[0]
      var setTab = tabPair[1]
      var focusPair = React.useState('')
      var focus = focusPair[0]
      var setFocus = focusPair[1]
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
      var noticePair = React.useState('')
      var notice = noticePair[0]
      var setNotice = noticePair[1]
      var namingPair = React.useState(false)
      var naming = namingPair[0]
      var setNaming = namingPair[1]
      var managePair = React.useState(false)
      var managing = managePair[0]
      var setManaging = managePair[1]
      var dropPair = React.useState('')
      var dropZone = dropPair[0]
      var setDropZone = dropPair[1]
      var aliveRef = React.useRef(true)

      var load = function (keepDraft) {
        return loadoutFetch('?session=' + encodeURIComponent(props.sessionId || sessionStore.id || '')).then(function (value) {
          if (!aliveRef.current) return
          setData(value)
          if (!keepDraft) {
            var live = {}
            ;(value.skills || []).forEach(function (s) { if (s.live) live[s.name] = true })
            setEquipped(live)
          }
        })
      }
      React.useEffect(function () {
        load(false).catch(function (failure) {
          if (aliveRef.current) setError(String((failure && failure.message) || failure))
        })
        sfxPlay('open')
        return function () {
          aliveRef.current = false
        }
      }, [])

      var skills = (data && data.skills) || []
      var byName = {}
      skills.forEach(function (s) { byName[s.name] = s })
      var draft = equipped || {}
      var builtinTokens = (data && data.builtin && data.builtin.tokens) || 0
      var contextWindow = (data && data.contextWindow) || budgetWindow().tokens
      // 窗口自己拿到了上下文大小：自动模式直接按它算（快照还没到也不会退回固定值）。
      var limit = prefs.budgetMode !== 'fixed' && autoBudgetTokens(contextWindow) ? autoBudgetTokens(contextWindow) : budgetLimitTokens()
      var stats = loadoutStats(skills, draft, builtinTokens, limit)
      var profiles = (data && data.profiles && data.profiles.profiles) || []

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
            var code = String((failure && failure.message) || failure)
            setError(typeof profileErrorText === 'function' ? profileErrorText(t, code) : code)
          })
      }
      var setOn = function (name, on) {
        var skill = byName[name]
        if (!skill) return
        if (!on && skill.inUse && skill.inUse.length) {
          setNotice(fill(t('loLockedNotice'), 'sessions', skill.inUse.map(function (s) { return s.title }).join('、')))
          return
        }
        setNotice('')
        setPreview(null)
        setResult(null)
        setEquipped(function (previous) {
          var next = Object.assign({}, previous)
          if (on) next[name] = true
          else delete next[name]
          return next
        })
        sfxPlay(on ? 'expand' : 'collapse')
      }
      var pickTab = function (id) {
        setTab(id)
        setPreview(null)
        setResult(null)
        if (id === 'current') {
          var live = {}
          skills.forEach(function (s) { if (s.live) live[s.name] = true })
          setEquipped(live)
          return
        }
        var profile = profiles.find(function (p) { return p.id === id })
        if (!profile) return
        var next = {}
        profile.skills.forEach(function (name) { if (byName[name]) next[name] = true })
        // 别的对话正在用的技能不能卸：切到配置时也保持装着。
        skills.forEach(function (s) { if (s.live && s.inUse && s.inUse.length) next[s.name] = true })
        setEquipped(next)
      }
      var fill_ = function () {
        setEquipped(fillByUsage(skills, draft, builtinTokens, limit))
        sfxPlay('expand')
      }
      var clear = function () {
        var next = {}
        skills.forEach(function (s) { if (s.live && s.inUse && s.inUse.length) next[s.name] = true })
        setEquipped(next)
        sfxPlay('collapse')
      }
      var applyPreview = function () {
        var names = Object.keys(draft).filter(function (name) { return draft[name] })
        act('preview', profileFetch('POST', { previewSkills: names, sessionId: props.sessionId || sessionStore.id || '', label: tab === 'current' ? '' : ((profiles.find(function (p) { return p.id === tab }) || {}).name || '') }), setPreview)
      }
      var confirmApply = function () {
        act('apply', profileFetch('POST', { apply: preview.switchId }), function (value) {
          sfxPlay('done')
          setResult(value)
          setPreview(null)
          load(true).catch(function () {})
        })
      }
      var undo = function () {
        act('undo', profileFetch('POST', { undo: true }), function () {
          setResult(null)
          load(false).catch(function () {})
        })
      }

      var onKeyDown = function (event) {
        var typing = event.target && /^(INPUT|TEXTAREA)$/.test(event.target.tagName)
        if (event.key === 'Escape') {
          event.preventDefault()
          if (!busy) requestClose()
          return
        }
        if (typing) return
        if ((event.ctrlKey || event.metaKey) && (event.key === 's' || event.key === 'S')) {
          event.preventDefault()
          setNaming(true)
        } else if (event.key === 'f' || event.key === 'F') {
          event.preventDefault()
          fill_()
        } else if (event.key === 'Enter' && !preview && !result && event.target === event.currentTarget) {
          event.preventDefault()
          applyPreview()
        }
      }
      var dropProps = function (zone, onDrop) {
        return {
          'data-drop': dropZone === zone ? '1' : undefined,
          onDragOver: function (event) {
            event.preventDefault()
            if (dropZone !== zone) setDropZone(zone)
          },
          onDragLeave: function () {
            if (dropZone === zone) setDropZone('')
          },
          onDrop: function (event) {
            event.preventDefault()
            setDropZone('')
            var name = event.dataTransfer && event.dataTransfer.getData(LO_DRAG)
            if (name) onDrop(name)
          },
        }
      }
      var dragProps = function (name, from) {
        return {
          draggable: true,
          onDragStart: function (event) {
            if (event.dataTransfer) {
              event.dataTransfer.setData(LO_DRAG, name)
              event.dataTransfer.setData('text/plain', name)
              event.dataTransfer.effectAllowed = 'move'
            }
            setFocus(name)
          },
          'data-from': from,
        }
      }

      /* ── 左：倾斜大圆盘 + 四类图例 ── */
      var stage = h(
        'div',
        { className: '__rp_loStage' },
        h(
          'div',
          Object.assign({ className: '__rp_loRing', title: t('loRingTip') }, dropProps('ring', function (name) { setOn(name, true) })),
          h(LoadoutRing, { stats: stats, size: 320, label: t('loRingTip'), countLabel: t('loCountLabel'), budgetLabel: fill(t('loBudgetPct'), 'n', Math.round((stats.used / Math.max(1, stats.limit)) * 100)) }),
        ),
        h(
          'div',
          { className: '__rp_loLegend' },
          LO_GROUPS.map(function (group) {
            return h(
              'div',
              { key: group, className: '__rp_loLegendRow', 'data-bias': stats.bias === group ? '1' : undefined },
              h('i', { style: { background: LO_COLORS[group] } }),
              h('span', null, t('cat.' + group)),
              h('b', null, Math.round(stats.share[group] * 100) + '%' + (stats.bias === group ? ' · ' + t('loBias') : '')),
            )
          }),
          h('div', { className: '__rp_loNote', style: { marginTop: '4px' } }, stats.over ? fill(t('loOver'), 'n', formatTokens(stats.used - stats.limit)) : fill(t('loLeft'), 'n', formatTokens(stats.limit - stats.used))),
        ),
      )

      /* ── 右：装配窗口 ── */
      var head = h(
        'div',
        { key: 'head', className: '__rp_loHead', role: 'tablist' },
        h('span', { className: '__rp_loKicker' }, 'LOADOUT //'),
        h('span', { className: '__rp_loTitle' }, t('loTitle')),
        [{ id: 'current', name: t('loTabCurrent') }].concat(profiles).map(function (p) {
          return h('button', { key: p.id, type: 'button', role: 'tab', className: '__rp_loTab', 'aria-selected': tab === p.id ? 'true' : 'false', onClick: function () { pickTab(p.id) } }, p.name)
        }),
        h('button', { type: 'button', className: '__rp_loTab', onClick: function () { setNaming(true) } }, t('loTabNew')),
        h('button', { type: 'button', className: '__rp_loTab', onClick: function () { setManaging(true) } }, t('loManage')),
        h('button', { type: 'button', className: '__rp_loBtn', style: { marginLeft: 'auto' }, 'aria-label': t('profileClose'), disabled: Boolean(busy), onClick: requestClose }, '✕'),
      )
      var statCards = h(
        'div',
        { key: 'stats', className: '__rp_loStats' },
        h('div', { className: '__rp_loStat', 'data-over': stats.over ? '1' : undefined }, h('span', null, t('loStatBudget')), h('strong', null, formatTokens(stats.used)), h('small', null, '/ ' + formatTokens(stats.limit) + ' tok')),
        h('div', { className: '__rp_loStat' }, h('span', null, t('loStatCount')), h('strong', null, String(stats.count)), h('small', null, t('loCountLabel'))),
        h('div', { className: '__rp_loStat' }, h('span', null, t('loStatContext')), h('strong', null, contextWindow ? (Math.round((stats.used / contextWindow) * 1000) / 10) + '%' : '—')),
        h('div', { className: '__rp_loStat' }, h('span', null, t('loStatRecent')), h('strong', null, String(stats.recent)), h('small', null, '/ ' + stats.count)),
      )
      var scale = Math.max(stats.limit, stats.used, 1)
      var segs = skills
        .filter(function (s) { return draft[s.name] })
        .sort(function (a, b) { return LO_GROUPS.indexOf(a.group) - LO_GROUPS.indexOf(b.group) || b.tokens - a.tokens })
      var bar = h(
        'div',
        Object.assign({ key: 'bar', className: '__rp_loBar', role: 'list', 'aria-label': t('loBarLabel') }, dropProps('bar', function (name) { setOn(name, true) })),
        builtinTokens ? h('div', { className: '__rp_loSeg', 'data-builtin': '1', role: 'listitem', title: fill(fill(t('loBuiltin'), 'n', data.builtin.count), 'tok', formatTokens(builtinTokens)), style: { width: ((builtinTokens / scale) * 100) + '%' } }) : null,
        segs.map(function (s) {
          return h('div', Object.assign({
            key: s.name,
            className: '__rp_loSeg',
            role: 'listitem',
            'data-focus': focus === s.name ? '1' : undefined,
            title: (nameOf('skill', s.name) || s.name) + ' · ' + s.tokens + ' tok',
            style: { width: ((s.tokens / scale) * 100) + '%', background: LO_COLORS[s.group] || LO_COLORS.ops },
            onMouseEnter: function () { setFocus(s.name) },
            onClick: function () { setFocus(s.name) },
          }, dragProps(s.name, 'bar')))
        }),
        h('div', { className: '__rp_loLimit', style: { left: 'calc(' + ((stats.limit / scale) * 100) + '% - 1px)' } }),
      )
      var barHint = h(
        'div',
        { key: 'barhint', className: '__rp_loBarHint' },
        h('span', null, notice || t('loBarHint')),
        h('span', null, prefs.budgetMode === 'fixed' ? t('loLimitFixed') : contextWindow ? t('loLimitAuto') : t('loLimitFixed')),
      )

      // 技能区：按库分组、默认收起，点开才是具体技能（几十个技能也不会把窗口拉得很长）；
      // 也是「拖回来卸下」的放置区。库头显示装了几个、占多少、四类颜色条，可一键全装 / 全卸。
      var libOrder = []
      var byLib = {}
      skills.forEach(function (s) {
        var lib = s.lib || 'user'
        if (!byLib[lib]) {
          byLib[lib] = []
          libOrder.push(lib)
        }
        byLib[lib].push(s)
      })
      libOrder.sort(function (a, b) {
        return (a === 'user' ? 1 : 0) - (b === 'user' ? 1 : 0) || byLib[b].length - byLib[a].length || a.localeCompare(b)
      })
      var isOpen = function (lib) {
        if (typeof openLibs[lib] === 'boolean') return openLibs[lib]
        return libOrder.length <= 1
      }
      var toggleLib = function (lib) {
        var next = !isOpen(lib)
        loOpenLibsSeen[lib] = next
        setOpenLibs(Object.assign({}, openLibs, (function () { var o = {}; o[lib] = next; return o })()))
        sfxPlay(next ? 'expand' : 'collapse')
      }
      var setMany = function (list, on) {
        var skipped = []
        setPreview(null)
        setResult(null)
        setEquipped(function (previous) {
          var next = Object.assign({}, previous)
          list.forEach(function (s) {
            if (on) next[s.name] = true
            else if (s.inUse && s.inUse.length && next[s.name]) skipped.push(s)
            else delete next[s.name]
          })
          return next
        })
        setNotice(skipped.length ? fill(t('loLibKept'), 'n', skipped.length) : '')
        sfxPlay(on ? 'expand' : 'collapse')
      }
      var tileOf = function (s) {
        var on = Boolean(draft[s.name])
        var locked = on && s.inUse && s.inUse.length > 0
        var color = LO_COLORS[s.group] || LO_COLORS.ops
        return h(
          'button',
          Object.assign({
            key: s.name,
            type: 'button',
            className: '__rp_loTile',
            'data-on': on ? '1' : undefined,
            'data-locked': locked ? '1' : undefined,
            'data-focus': focus === s.name ? '1' : undefined,
            'aria-pressed': on ? 'true' : 'false',
            title: s.name,
            // 装上：整块填类别色；没装：左边一道类别色，分类信息不丢。
            style: on ? { background: color } : { boxShadow: 'inset 3px 0 0 ' + color },
            onMouseEnter: function () { setFocus(s.name) },
            onFocus: function () { setFocus(s.name) },
            onClick: function (event) {
              if (event && event.nativeEvent) event.nativeEvent.__rpSfx = true
              setOn(s.name, !on)
            },
          }, dragProps(s.name, 'library')),
          h('span', { className: '__rp_loTileName' }, (locked ? '🔒 ' : '') + (nameOf('skill', s.name) || s.name)),
          h('span', { className: '__rp_loTileTok' }, String(s.tokens)),
        )
      }
      var cols = h(
        'div',
        Object.assign({ className: '__rp_loLibs' }, dropProps('library', function (name) { setOn(name, false) })),
        libOrder.map(function (lib) {
          var list = byLib[lib].slice().sort(function (a, b) {
            return LO_GROUPS.indexOf(a.group) - LO_GROUPS.indexOf(b.group) || b.uses - a.uses || a.name.localeCompare(b.name)
          })
          var onList = list.filter(function (s) { return draft[s.name] })
          var onTokens = onList.reduce(function (sum, s) { return sum + s.tokens }, 0)
          var allOn = onList.length === list.length
          var open = isOpen(lib)
          var shares = LO_GROUPS.map(function (group) {
            return { group: group, n: onList.filter(function (s) { return s.group === group }).length }
          })
          return h(
            'div',
            { key: lib, className: '__rp_loLib', 'data-open': open ? '1' : undefined },
            h(
              'div',
              { className: '__rp_loLibHead' },
              h(
                'button',
                { type: 'button', className: '__rp_loLibToggle', 'aria-expanded': open ? 'true' : 'false', title: typeof libTip === 'function' ? libTip(t, lib, list.length) : lib, onClick: function () { toggleLib(lib) } },
                h('span', { className: '__rp_loLibCaret', 'aria-hidden': 'true' }, open ? '▾' : '▸'),
                h('span', { className: '__rp_loLibName' }, libLabel(lib)),
                h('span', { className: '__rp_loLibCount' }, onList.length + ' / ' + list.length),
                // 这个库装上的部分按四类上色；空的就是一条暗线。
                h(
                  'span',
                  { className: '__rp_loLibStripe', 'aria-hidden': 'true' },
                  shares.map(function (share) {
                    return share.n ? h('i', { key: share.group, style: { flexGrow: share.n, background: LO_COLORS[share.group] } }) : null
                  }),
                  h('i', { key: 'off', style: { flexGrow: list.length - onList.length, background: '#2b3338' } }),
                ),
                h('span', { className: '__rp_loLibTok' }, formatTokens(onTokens) + ' tok'),
              ),
              h('button', { type: 'button', className: '__rp_loBtn __rp_loLibAll', onClick: function () { setMany(list, !allOn) } }, allOn ? t('loLibAllOff') : t('loLibAllOn')),
            ),
            open ? h('div', { className: '__rp_loCols' }, list.map(tileOf)) : null,
          )
        }),
      )

      // 详情栏
      var focused = byName[focus] || segs[0] || skills[0]
      var detail = null
      if (focused) {
        var isOn = Boolean(draft[focused.name])
        var withIt = stats.used + (isOn ? 0 : focused.tokens)
        var withoutIt = stats.used - (isOn ? focused.tokens : 0)
        // 现在 → 装上后 / 卸下后
        var before = stats.used
        var afterUsed = isOn ? withoutIt : withIt
        var groupShareAfter = (function () {
          var total = LO_GROUPS.reduce(function (sum, g) { return sum + stats.byGroup[g] }, 0) + (isOn ? 0 : focused.tokens)
          var mine = stats.byGroup[focused.group] + (isOn ? 0 : focused.tokens)
          return total ? Math.round((mine / total) * 100) : 0
        })()
        detail = h(
          'div',
          { className: '__rp_loDetail' },
          h('div', { className: '__rp_loDetailKicker' }, t('loDetail')),
          h('div', { className: '__rp_loDetailName' }, nameOf('skill', focused.name) || focused.name),
          h('div', { className: '__rp_loNote' }, focused.name + ' · ' + (libLabel(focused.lib) || focused.lib) + ' · ' + t('cat.' + focused.group)),
          focused.description ? h('div', { style: { color: '#b9c0c5', fontSize: '12px' } }, tipOf('skill', focused.name, focused.description)) : null,
          h('div', { className: '__rp_loKV' }, h('span', null, t('loTokens')), h('span', null, focused.tokens + ' tok')),
          h('div', { className: '__rp_loKV' }, h('span', null, t('loUses')), h('span', null, '×' + focused.uses + (focused.lastAt ? ' · ' + dateOnly(focused.lastAt) : ''))),
          h('div', { className: '__rp_loKV' }, h('span', null, isOn ? t('loBudgetWithout') : t('loBudgetWith')), h('span', null, Math.round((before / Math.max(1, stats.limit)) * 100) + '% → ' + Math.round((afterUsed / Math.max(1, stats.limit)) * 100) + '%')),
          h('div', { className: '__rp_loCmp' }, h('i', { style: { width: Math.min(100, (before / scale) * 100) + '%', background: '#ff8a1f' } })),
          h('div', { className: '__rp_loCmp' }, h('i', { style: { width: Math.min(100, (afterUsed / scale) * 100) + '%', background: afterUsed > stats.limit ? '#e5533d' : '#e8b93c' } })),
          isOn ? null : h('div', { className: '__rp_loKV' }, h('span', null, t('loBiasAfter')), h('span', null, t('cat.' + focused.group) + ' ' + Math.round(stats.share[focused.group] * 100) + '% → ' + groupShareAfter + '%')),
          focused.inUse && focused.inUse.length ? h('div', { className: '__rp_loErr' }, fill(t('loInUse'), 'sessions', focused.inUse.map(function (s) { return s.title }).join('、'))) : null,
          focused.recent && focused.recent.length
            ? [h('div', { key: 'rt', className: '__rp_loSub' }, t('loRecent')), h('div', { key: 'rv', style: { fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '1px' } }, focused.recent.map(function (r, index) { return h('span', { key: index }, (r.title || r.sessionId) + ' · ' + dateOnly(r.at)) }))]
            : null,
          focused.together && focused.together.length
            ? [h('div', { key: 'tt', className: '__rp_loSub' }, t('loTogether')), h('div', { key: 'tv', style: { fontSize: '12px' } }, focused.together.map(function (name) { return nameOf('skill', name) || name }).join(' · '))]
            : null,
        )
      }
      var body = h('div', { key: 'body', className: '__rp_loBody' }, cols, detail)

      var lower = null
      if (naming) {
        lower = h(GoalInput, { key: 'naming', t: t, placeholder: t('profileNamePlaceholder'), busy: busy === 'save', onCancel: function () { setNaming(false) }, onSubmit: function (name) {
          act('save', profileFetch('POST', { name: name, skills: Object.keys(draft).filter(function (k) { return draft[k] }), libs: (prefs.pins && prefs.pins.libs) || [] }), function () {
            setNaming(false)
            load(true).catch(function () {})
          })
        } })
      } else if (preview) {
        var nothing = !preview.park.length && !preview.restore.length
        lower = h(
          'div',
          { key: 'preview', className: '__rp_loPreview' },
          h('div', { className: '__rp_switchGroup', 'data-kind': 'park' }, h('div', { className: '__rp_switchTitle' }, fill(t('profileWillPark'), 'n', preview.park.length)), h('div', { className: '__rp_switchNames' }, skillList(preview.park))),
          h('div', { className: '__rp_switchGroup', 'data-kind': 'restore' }, h('div', { className: '__rp_switchTitle' }, fill(t('profileWillRestore'), 'n', preview.restore.length)), h('div', { className: '__rp_switchNames' }, skillList(preview.restore.map(function (r) { return r.name })))),
          preview.keepInUse.length ? h('div', { className: '__rp_switchGroup' }, h('div', { className: '__rp_switchTitle' }, fill(t('profileKeepInUse'), 'n', preview.keepInUse.length)), h('div', { className: '__rp_switchNames' }, skillList(preview.keepInUse.map(function (r) { return r.name })))) : null,
          preview.missing.length ? h('div', { className: '__rp_switchGroup' }, h('div', { className: '__rp_switchTitle' }, fill(t('profileMissing'), 'n', preview.missing.length)), h('div', { className: '__rp_switchNames' }, skillList(preview.missing))) : null,
          nothing ? h('div', { className: '__rp_loNote' }, t('profileNothing')) : null,
          h(
            'div',
            { className: '__rp_loFoot', style: { borderTop: 0, paddingTop: 0 } },
            nothing ? null : h('button', { type: 'button', className: '__rp_loBtn', 'data-primary': '1', disabled: Boolean(busy), onClick: confirmApply }, busy === 'apply' ? t('profileApplying') : t('profileConfirm')),
            h('button', { type: 'button', className: '__rp_loBtn', disabled: Boolean(busy), onClick: function () { setPreview(null) } }, t('profileBack')),
          ),
        )
      } else if (result) {
        lower = h(
          'div',
          { key: 'result', className: '__rp_loPreview' },
          h('div', null, fill(fill(t('profileDone'), 'parked', result.parked.length), 'restored', result.restored.length)),
          result.failed && result.failed.length ? h('div', { className: '__rp_loErr' }, fill(t('profilePartFailed'), 'names', result.failed.map(function (row) { return row.name + '（' + row.error + '）' }).join('、'))) : null,
          h('div', { className: '__rp_loFoot', style: { borderTop: 0, paddingTop: 0 } }, h('button', { type: 'button', className: '__rp_loBtn', disabled: Boolean(busy), onClick: undo }, t('profileUndo')), h('button', { type: 'button', className: '__rp_loBtn', 'data-primary': '1', onClick: requestClose }, t('profileClose'))),
        )
      }
      var foot = h(
        'div',
        { key: 'foot', className: '__rp_loFoot' },
        h(
          'div',
          { className: '__rp_loKeys' },
          h('span', null, h('kbd', null, t('loKeyClick')), ' ', t('loKeyToggle')),
          h('span', null, h('kbd', null, '[F]'), ' ', t('loKeyFill')),
          h('span', null, h('kbd', null, '[Ctrl+S]'), ' ', t('loKeySave')),
          h('span', null, h('kbd', null, '[Enter]'), ' ', t('loKeyApply')),
          h('span', null, h('kbd', null, '[Esc]'), ' ', t('loKeyClose')),
        ),
        h('button', { type: 'button', className: '__rp_loBtn', disabled: !data || Boolean(busy), onClick: fill_ }, t('loFill')),
        h('button', { type: 'button', className: '__rp_loBtn', disabled: !data || Boolean(busy), onClick: clear }, t('loClear')),
        h('button', { type: 'button', className: '__rp_loBtn', disabled: !data || Boolean(busy), onClick: function () { pickTab('current') } }, t('loReset')),
        h('button', { type: 'button', className: '__rp_loBtn', disabled: !data || Boolean(busy), onClick: function () { setNaming(true) } }, t('loSave')),
        h('button', { type: 'button', className: '__rp_loBtn', 'data-primary': '1', disabled: !data || Boolean(busy), onClick: applyPreview }, busy === 'preview' ? t('loPreviewing') : t('loApply')),
      )

      var panelChildren = [head, statCards, bar, barHint, body]
      if (lower) panelChildren.push(lower)
      panelChildren.push(foot)
      if (error) panelChildren.push(h('div', { key: 'err', className: '__rp_loErr', role: 'alert' }, error))
      if (!data && !error) panelChildren.splice(1, 0, h('div', { key: 'loading', className: '__rp_loNote' }, t('loading')))

      var blur = prefs.mode !== 'performance' && activeEffects().blur !== false
      return portalToBody(
        h(
          'div',
          {
            className: '__rp_lo',
            'data-blur': blur ? '1' : undefined,
            'data-closing': closingPair[0] ? '1' : undefined,
            style: menuMotionStyle(),
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': t('loTitle'),
            tabIndex: -1,
            ref: function (node) {
              if (node && !node.__rpFocused) {
                node.__rpFocused = true
                try { node.focus() } catch (failure) { /* ignore */ }
              }
            },
            onKeyDown: onKeyDown,
            onMouseDown: function (event) {
              if (event.target === event.currentTarget && !busy) props.onClose()
            },
          },
          stage,
          h('div', { className: '__rp_loPanel' }, panelChildren),
          managing ? h(ProfilesDialog, { t: t, sessionId: props.sessionId, onClose: function () { setManaging(false); load(true).catch(function () {}) } }) : null,
        ),
      )
    }

    function LoadoutButton(props) {
      var t = props.t
      var openPair = React.useState(false)
      var open = openPair[0]
      var setOpen = openPair[1]
      return h(
        React.Fragment,
        null,
        h('button', { type: 'button', className: '__rp_optimize', title: t('loButtonTip'), onClick: function () { setOpen(true) } }, t('loButton')),
        open ? h(LoadoutWindow, { t: t, sessionId: props.sessionId, onClose: function () { setOpen(false) } }) : null,
      )
    }
    /* ── 动效与音效：战术风格的圆盘状态、首次打开的马赛克显现、合成音效 ──────── */

    /**
     * 节奏参考加载圆盘、地图展开和菜单打开的录像（逐帧分析，见 CHANGELOG 1.0.18）。
     * - 圆盘：闲置时圆心心跳 + 12 点小亮标；工作时内圈三段、亮弧带拖尾每 1.2 s 扫一圈；
     *   闲置→工作「点燃」一下；结束时扫描在 1.5 s 内褪成余辉。
     * - 每次启动 DSH 第一次打开侧栏：各分区先成色块、再从马赛克变清晰，带一次过曝白闪，
     *   从上到下错开；圆盘外圈顺时针画出、数字逐位解码。之后不再播。
     * - 音效：Web Audio 现场合成，不带任何音频文件、不用游戏原声；默认关。
     * 全部尊重「性能模式 / 关闭动效 / 系统减少动态效果」。
     */

    CSS += '\n' + [
      /* 圆盘：12 点亮标、心跳、三段缺口、扫描、点燃闪光、预算环的亮外沿和前端刻度 */
      '.__rp_ringMark{stroke:var(--rp-amber);stroke-width:.8;opacity:.9}',
      '.__rp_ringInnerHair{stroke:color-mix(in srgb,var(--rp-amber) 70%,transparent);opacity:.24}',
      '.__rp_ringSvg[data-phase=idle] .__rp_ringInnerHair,.__rp_ringSvg[data-phase=spent] .__rp_ringInnerHair{animation:__rp_heart 2.4s ease-out infinite}',
      '@keyframes __rp_heart{0%,100%{opacity:.22}5%{opacity:.85}12%{opacity:.28}18%{opacity:.6}32%{opacity:.22}}',
      '.__rp_ringSweep{transform-origin:50px 50px;animation:__rp_ringSpin 1.2s linear infinite;opacity:1;transition:opacity 1.5s ease-out,visibility 0s linear 1.5s;visibility:visible}',
      '.__rp_ringSvg:not([data-phase=active]) .__rp_ringSweep{opacity:0;visibility:hidden}',
      '.__rp_ringSvg[data-phase=active] .__rp_ringSweep{transition:opacity .25s ease-out,visibility 0s}',
      '.__rp_sweepLead{stroke:var(--rp-amber);opacity:.95}',
      '.__rp_sweepMid{stroke:var(--rp-amber);opacity:.38}',
      '.__rp_sweepTail{stroke:var(--rp-amber);opacity:.14}',
      '.__rp_sweepTick{stroke:#fff;stroke-width:.7;opacity:.95}',
      '.__rp_ringFlash{stroke:var(--rp-amber);opacity:0;pointer-events:none}',
      '.__rp_ringSvg[data-ignite="1"] .__rp_ringFlash{animation:__rp_ignite .7s cubic-bezier(.2,.7,.3,1) both}',
      '.__rp_ringSvg[data-ignite="1"] .__rp_ringCore{animation:__rp_igniteCore .7s ease-out both}',
      '@keyframes __rp_ignite{0%{opacity:.9;stroke-width:9}100%{opacity:0;stroke-width:6.5}}',
      '@keyframes __rp_igniteCore{0%{opacity:1}100%{opacity:.85}}',
      '.__rp_budgetEdge{stroke:var(--rp-amber);stroke-width:.35;opacity:.95}',
      '.__rp_budgetTick{stroke:#fff;stroke-width:.6;opacity:.9}',
      /* 首次打开：圆盘外圈顺时针画出 */
      '.__rp_ringSvg[data-intro="1"] .__rp_ringIntroMask{animation:__rp_ringDraw 1.6s cubic-bezier(.3,.6,.2,1) .25s both}',
      '@keyframes __rp_ringDraw{from{stroke-dashoffset:302}to{stroke-dashoffset:0}}',
      /* 首次打开：分区的马赛克显现（只改动画名 / 时长 / 曲线，保留原有的逐个延迟） */
      /* 1.0.20：放慢到约 2 s——先是 0.25 s 的空玻璃，再逐块（每块隔 90 ms）由色块变清晰。 */
      '.__rp_root[data-reveal="1"] .__rp_inner > *{animation-name:__rp_mosaicIn;animation-duration:1.5s;animation-timing-function:steps(6,end)}',
      ...[1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return '.__rp_root[data-reveal="1"] .__rp_inner > *:nth-child(' + n + '){animation-delay:' + (250 + (n - 1) * 90) + 'ms}' }),
      '.__rp_root[data-reveal="1"] .__rp_inner > *:nth-child(n+9){animation-delay:950ms}',
      '@keyframes __rp_mosaicIn{0%{opacity:0;filter:brightness(2.8) saturate(0) blur(5px)}12%{opacity:.9;filter:brightness(2.6) saturate(0) blur(4px)}30%{opacity:1;filter:brightness(2) saturate(.2) blur(3px)}60%{filter:brightness(1.35) saturate(.6) blur(1.4px)}85%{filter:brightness(1.08) saturate(.9) blur(.4px)}100%{opacity:1;filter:none}}',
      '.__rp_pxDefs{position:absolute;width:0;height:0;overflow:hidden}',
      /* 关掉动效时：扫描停在一个静止的亮弧，心跳和点燃都不播 */
      '.__rp_root[data-motion=off] .__rp_ringSweep,.__rp_root[data-performance="1"] .__rp_ringSweep{animation:none}',
      '.__rp_root[data-motion=off] .__rp_ringInnerHair,.__rp_root[data-effect-status="off"] .__rp_ringInnerHair{animation:none!important}',
      '.__rp_root[data-effect-reveal="off"][data-reveal="1"] .__rp_inner > *{animation:none!important}',
      '@media (prefers-reduced-motion:reduce){.__rp_ringSweep,.__rp_ringInnerHair,.__rp_ringFlash,.__rp_ringIntroMask{animation:none!important}.__rp_root[data-reveal="1"] .__rp_inner > *{animation:none!important}}',
    ].join('\n')

    /* ── 首次打开（每次启动 DSH 一次） ─────────────────────────────────── */

    var revealPlayed = false
    var REVEAL_START = 250
    var REVEAL_STEP = 150
    var REVEAL_TOTAL = 2100
    var REVEAL_KEY = '__rp_revealed'

    /**
     * 「每次启动 DSH 只播一次」：模块变量管同一次加载；sessionStorage 管侧栏被拆掉重挂、
     * 页面被刷新的情况（DSH 重启后 sessionStorage 是新的，所以下次启动还会播）。
     */
    function revealAlreadyPlayed() {
      if (revealPlayed) return true
      try {
        return window.sessionStorage && window.sessionStorage.getItem(REVEAL_KEY) === '1'
      } catch (error) {
        return false
      }
    }

    function markRevealPlayed() {
      revealPlayed = true
      try {
        if (window.sessionStorage) window.sessionStorage.setItem(REVEAL_KEY, '1')
      } catch (error) {
        /* 存不了就只靠模块变量 */
      }
    }

    function revealAllowed() {
      try {
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
      } catch (error) {
        /* 老环境没有 matchMedia */
      }
      return activeEffects().reveal !== false
    }

    /**
     * 侧栏面板第一次拿到快照时返回 true（约 2 s），之后一直 false。
     * 马赛克：.__rp_inner 套一个 SVG 像素化滤镜，格子从 20px 逐级降到 2px 再撤掉。
     */
    function useFirstReveal(ready) {
      var pair = React.useState(false)
      var on = pair[0]
      var setOn = pair[1]
      React.useEffect(
        function () {
          if (!ready || revealAlreadyPlayed()) return undefined
          markRevealPlayed()
          if (!revealAllowed()) return undefined
          setOn(true)
          sfxPlay('open')
          // 1.0.20：格子 20 → 2 px 分 8 级，从 0.25 s 起每 150 ms 一级，整个显现约 2 s。
          var sizes = [20, 16, 12, 9, 6, 4, 3, 2]
          var timers = sizes.map(function (size, index) {
            return setTimeout(function () {
              setPixelSize(size)
            }, REVEAL_START + index * REVEAL_STEP)
          })
          timers.push(
            setTimeout(function () {
              setOn(false)
            }, REVEAL_TOTAL),
          )
          return function () {
            timers.forEach(clearTimeout)
          }
        },
        [ready],
      )
      return on
    }

    /** 像素化滤镜：flood 一个小方块 → 平铺成网格采样 → 膨胀回格子大小。 */
    function setPixelSize(size) {
      try {
        var flood = document.getElementById('__rp_pxFlood')
        var composite = document.getElementById('__rp_pxTileSize')
        var dilate = document.getElementById('__rp_pxDilate')
        if (!flood || !composite || !dilate) return
        var half = Math.max(1, Math.floor(size / 2))
        flood.setAttribute('x', String(half))
        flood.setAttribute('y', String(half))
        composite.setAttribute('width', String(size))
        composite.setAttribute('height', String(size))
        dilate.setAttribute('radius', String(half))
      } catch (error) {
        /* 滤镜只是装饰 */
      }
    }

    function PixelateDefs() {
      return h(
        'svg',
        { className: '__rp_pxDefs', 'aria-hidden': 'true', focusable: 'false' },
        h(
          'filter',
          { id: '__rp_px', x: '0', y: '0', width: '100%', height: '100%' },
          h('feFlood', { id: '__rp_pxFlood', x: '10', y: '10', width: '2', height: '2' }),
          h('feComposite', { id: '__rp_pxTileSize', width: '20', height: '20' }),
          h('feTile', { result: 'grid' }),
          h('feComposite', { in: 'SourceGraphic', in2: 'grid', operator: 'in' }),
          h('feMorphology', { id: '__rp_pxDilate', operator: 'dilate', radius: '10' }),
        ),
      )
    }

    /* ── 圆盘数字的逐位解码（首次打开时） ──────────────────────────────── */

    var DECODE_GLYPHS = '0123456789#%/<>'

    /** step 0..steps：已经「解开」的位从左往右增加，其余位显示随机字形。 */
    function decodeText(text, step, steps, random) {
      var value = String(text)
      var rnd = typeof random === 'function' ? random : Math.random
      if (step >= steps) return value
      var settled = Math.floor((step / steps) * value.length)
      var out = ''
      for (var i = 0; i < value.length; i += 1) {
        out += i < settled ? value.charAt(i) : DECODE_GLYPHS.charAt(Math.floor(rnd() * DECODE_GLYPHS.length))
      }
      return out
    }

    /* ── 合成音效 ───────────────────────────────────────────────────────── */

    var sfxState = { ctx: null, last: {} }

    function sfxEnabled() {
      return prefs.sfx === true && (Number(prefs.sfxVolume) || 0) > 0
    }

    function sfxContext() {
      if (sfxState.ctx) return sfxState.ctx
      var Ctor = window.AudioContext || window.webkitAudioContext
      if (!Ctor) return null
      try {
        sfxState.ctx = new Ctor()
      } catch (error) {
        sfxState.ctx = null
      }
      return sfxState.ctx
    }

    /** 一个音：振荡器 + 指数衰减包络。freq 可以是 [起, 止] 做滑音。 */
    function sfxTone(ctx, out, at, options) {
      var osc = ctx.createOscillator()
      var gain = ctx.createGain()
      osc.type = options.type || 'sine'
      var from = Array.isArray(options.freq) ? options.freq[0] : options.freq
      var to = Array.isArray(options.freq) ? options.freq[1] : options.freq
      osc.frequency.setValueAtTime(from, at)
      if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + options.dur)
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(options.gain, at + Math.min(0.006, options.dur / 4))
      gain.gain.exponentialRampToValueAtTime(0.0001, at + options.dur)
      osc.connect(gain)
      gain.connect(out)
      osc.start(at)
      osc.stop(at + options.dur + 0.02)
    }

    /** 一段带通滤波噪声（气流 / 扫描声）。 */
    function sfxNoise(ctx, out, at, options) {
      var length = Math.ceil(ctx.sampleRate * options.dur)
      var buffer = ctx.createBuffer(1, length, ctx.sampleRate)
      var data = buffer.getChannelData(0)
      for (var i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1
      var src = ctx.createBufferSource()
      src.buffer = buffer
      var filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.Q.value = options.q || 1.2
      filter.frequency.setValueAtTime(options.from, at)
      filter.frequency.exponentialRampToValueAtTime(options.to, at + options.dur)
      var gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(options.gain, at + options.dur * 0.3)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + options.dur)
      src.connect(filter)
      filter.connect(gain)
      gain.connect(out)
      src.start(at)
      src.stop(at + options.dur + 0.02)
    }

    /** 音色表：都很短、偏高频、不刺耳。gain 是相对值，再乘总音量。 */
    var SFX = {
      click: function (ctx, out, t0) {
        sfxTone(ctx, out, t0, { freq: [2600, 1900], dur: 0.035, gain: 0.5, type: 'sine' })
      },
      expand: function (ctx, out, t0) {
        sfxTone(ctx, out, t0, { freq: 880, dur: 0.05, gain: 0.35, type: 'triangle' })
        sfxTone(ctx, out, t0 + 0.055, { freq: 1320, dur: 0.06, gain: 0.35, type: 'triangle' })
      },
      collapse: function (ctx, out, t0) {
        sfxTone(ctx, out, t0, { freq: 1320, dur: 0.05, gain: 0.3, type: 'triangle' })
        sfxTone(ctx, out, t0 + 0.055, { freq: 880, dur: 0.06, gain: 0.3, type: 'triangle' })
      },
      open: function (ctx, out, t0) {
        sfxNoise(ctx, out, t0, { from: 380, to: 2400, dur: 0.32, gain: 0.35, q: 0.9 })
        sfxTone(ctx, out, t0 + 0.24, { freq: 1600, dur: 0.07, gain: 0.4, type: 'sine' })
        sfxTone(ctx, out, t0 + 0.33, { freq: 2400, dur: 0.05, gain: 0.25, type: 'sine' })
      },
      done: function (ctx, out, t0) {
        sfxTone(ctx, out, t0, { freq: 990, dur: 0.09, gain: 0.35, type: 'sine' })
        sfxTone(ctx, out, t0 + 0.085, { freq: 1480, dur: 0.14, gain: 0.35, type: 'sine' })
      },
      ignite: function (ctx, out, t0) {
        sfxTone(ctx, out, t0, { freq: [110, 165], dur: 0.32, gain: 0.55, type: 'sine' })
        sfxNoise(ctx, out, t0, { from: 300, to: 900, dur: 0.22, gain: 0.12, q: 2 })
      },
    }

    /** 播一个音效。没开、没有 AudioContext、或者同一个音 60 ms 内重复，都直接返回 false。 */
    function sfxPlay(name) {
      if (!sfxEnabled() || !SFX[name]) return false
      var ctx = sfxContext()
      if (!ctx) return false
      var now = Date.now()
      if (sfxState.last[name] && now - sfxState.last[name] < 60) return false
      sfxState.last[name] = now
      try {
        if (ctx.state === 'suspended' && typeof ctx.resume === 'function') ctx.resume()
        var master = ctx.createGain()
        master.gain.value = Math.min(1, Math.max(0, Number(prefs.sfxVolume) || 0)) * 0.35
        master.connect(ctx.destination)
        SFX[name](ctx, master, ctx.currentTime + 0.005)
        return true
      } catch (error) {
        return false
      }
    }

    /**
     * 面板根节点上的点击委托：按钮 / role=button 发一声「嗒」。
     * 展开收起、完成之类自己发声的地方会在事件上打标记，这里就不再重复。
     */
    function sfxClickDelegate(event) {
      if (!sfxEnabled()) return
      var native = event && event.nativeEvent
      if (native && native.__rpSfx) return
      var target = event && event.target
      var hit = target && typeof target.closest === 'function' ? target.closest('button,[role=button],summary,input[type=checkbox]') : null
      if (hit && !hit.disabled) sfxPlay('click')
    }

    /** 自己发声的交互调用它：播指定音效，并让根节点的点击委托跳过这一次。 */
    function sfxFor(event, name) {
      if (event && event.nativeEvent) event.nativeEvent.__rpSfx = true
      return sfxPlay(name)
    }

    /** 设置窗口里的音效一行：开关 + 音量 + 试听。 */
    function SfxSettings(props) {
      var t = props.t
      var on = prefs.sfx === true
      return h(
        'div',
        { className: '__rp_sheetRow', style: { flexDirection: 'column', alignItems: 'stretch', gap: '6px' } },
        h(
          'label',
          { className: '__rp_checkRow', style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          h('input', {
            type: 'checkbox',
            name: 'rp-sfx',
            'aria-label': t('sfxToggle'),
            checked: on,
            onChange: function (event) {
              setPref('sfx', event.target.checked)
              if (event.target.checked) sfxPlay('open')
            },
          }),
          h('span', { className: '__rp_sheetLabel' }, t('sfxToggle')),
        ),
        on
          ? h(StudioSlider, {
              label: t('sfxVolume'),
              text: Math.round((Number(prefs.sfxVolume) || 0) * 100) + '%',
              min: 0,
              max: 1,
              step: 0.05,
              value: Number(prefs.sfxVolume) || 0,
              onChange: function (value) {
                setPref('sfxVolume', value)
              },
            })
          : null,
        on
          ? h(
              'div',
              { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } },
              ['click', 'expand', 'collapse', 'open', 'done', 'ignite'].map(function (name) {
                return h(
                  'button',
                  {
                    key: name,
                    type: 'button',
                    className: '__rp_goalBtn',
                    onClick: function () {
                      sfxPlay(name)
                    },
                  },
                  t('sfx.' + name),
                )
              }),
            )
          : null,
      )
    }
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
    /* ── 跟随 DSH 主题：宿主把 bg-base 换成亮色时整层换纸白 ─────────────── */

    var schemeObserver = null
    var schemeMedia = null
    var schemeTimer = 0

    /** 只认 #rgb / #rrggbb / rgb() / rgba()；解析不了返回 null。 */
    function parseCssColor(value) {
      var text = String(value || '').trim().toLowerCase()
      if (!text) return null
      var hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/)
      if (hex) {
        var raw = hex[1]
        if (raw.length === 3) raw = raw.charAt(0) + raw.charAt(0) + raw.charAt(1) + raw.charAt(1) + raw.charAt(2) + raw.charAt(2)
        return [parseInt(raw.slice(0, 2), 16), parseInt(raw.slice(2, 4), 16), parseInt(raw.slice(4, 6), 16)]
      }
      var rgb = text.match(/^rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/)
      if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
      return null
    }

    function relativeLuminance(rgb) {
      var channels = rgb.map(function (value) {
        var v = Math.min(255, Math.max(0, value)) / 255
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
      })
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
    }

    /** 背景色亮度 → light / dark；解析不了返回 null，交给系统偏好兜底。 */
    function schemeFromColor(value) {
      var rgb = parseCssColor(value)
      if (!rgb) return null
      return relativeLuminance(rgb) > 0.5 ? 'light' : 'dark'
    }

    /** 宿主可能把令牌挂在 body 上，也可能只用 data-theme / class 标记：都试一遍。 */
    function schemeHintFromDom() {
      if (typeof document === 'undefined') return null
      var body = document.body
      // DSH 把暗色主题挂在 body 上：body[data-ds-dark-theme]。亮色是「没有这个属性」。
      if (body && body.hasAttribute && body.hasAttribute('data-ds-dark-theme')) return 'dark'
      var targets = [body, document.documentElement]
      for (var i = 0; i < targets.length; i += 1) {
        var node = targets[i]
        if (!node || typeof window === 'undefined') continue
        try {
          var value = window.getComputedStyle(node).getPropertyValue('--dsw-alias-bg-base')
          var fromToken = schemeFromColor(value)
          if (fromToken) return fromToken
        } catch (error) {
          /* 这个节点上没有令牌 */
        }
      }
      var html = document.documentElement
      if (!html) return null
      var marks = [
        html.getAttribute('data-theme'),
        html.getAttribute('data-color-scheme'),
        html.getAttribute('data-dsw-theme'),
        html.className,
        body && body.getAttribute ? body.getAttribute('data-theme') : '',
        body ? body.className : '',
      ]
      var text = marks.filter(Boolean).join(' ').toLowerCase()
      if (/\blight\b/.test(text)) return 'light'
      if (/\bdark\b/.test(text)) return 'dark'
      return null
    }

    function detectDshScheme() {
      if (typeof document !== 'undefined' && typeof window !== 'undefined') {
        var hinted = schemeHintFromDom()
        if (hinted) return hinted
        try {
          if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
        } catch (error) {
          /* 没有 matchMedia */
        }
      }
      return 'dark'
    }

    /** 面板配色：auto 跟 DSH；light / dark 是用户在设置里手动锁定的。 */
    function effectiveScheme() {
      if (prefs.scheme === 'light' || prefs.scheme === 'dark') return prefs.scheme
      return detectDshScheme()
    }

    /** 把判定写到 <html> 上，CSS 用 html[data-rp-scheme="light"] 收口。 */
    function applyDshScheme() {
      if (typeof document === 'undefined' || !document.documentElement) return
      var scheme = effectiveScheme()
      if (document.documentElement.getAttribute('data-rp-scheme') !== scheme) {
        document.documentElement.setAttribute('data-rp-scheme', scheme)
      }
    }

    /** 宿主切主题不会通知插件：盯 html + body 的属性变化（DSH 把暗色标记在 body 上）。 */
    function installSchemeWatch() {
      if (typeof document === 'undefined' || typeof window === 'undefined') return null
      applyDshScheme()
      var schedule = function () {
        if (schemeTimer) window.clearTimeout(schemeTimer)
        schemeTimer = window.setTimeout(function () {
          schemeTimer = 0
          applyDshScheme()
        }, 60)
      }
      try {
        schemeObserver = new MutationObserver(schedule)
        schemeObserver.observe(document.documentElement, { attributes: true })
        if (document.body) schemeObserver.observe(document.body, { attributes: true })
      } catch (error) {
        schemeObserver = null
      }
      try {
        schemeMedia = window.matchMedia('(prefers-color-scheme: light)')
        if (schemeMedia && schemeMedia.addEventListener) schemeMedia.addEventListener('change', schedule)
      } catch (error) {
        schemeMedia = null
      }
      return function uninstallSchemeWatch() {
        if (schemeTimer) window.clearTimeout(schemeTimer)
        schemeTimer = 0
        if (schemeObserver) schemeObserver.disconnect()
        schemeObserver = null
        try {
          if (schemeMedia && schemeMedia.removeEventListener) schemeMedia.removeEventListener('change', schedule)
        } catch (error) {
          /* ignore */
        }
        schemeMedia = null
        document.documentElement.removeAttribute('data-rp-scheme')
      }
    }

    /* ── 新技能自动翻译：触发与状态 ─────────────────────────────────────── */

    /**
     * Host 只在被请求时翻译（POST /translate）。这里决定什么时候请求：
     * 设置开着、快照说有待翻译、没在跑、上次没失败，并且待翻译数比上次触发时多了——
     * 这样同一批不会因为每帧快照反复触发；失败后只能在设置里手动重试。
     */
    var translateStore = { value: null, listeners: new Set() }
    var autoTranslateBaseline = 0

    function noteTranslate(value) {
      if (!value || typeof value !== 'object') return
      var previous = translateStore.value
      translateStore.value = value
      if (JSON.stringify(previous) === JSON.stringify(value)) return
      translateStore.listeners.forEach(function (listener) {
        try {
          listener()
        } catch (error) {
          /* 渲染层自己的错误不扩散 */
        }
      })
    }

    function useTranslateStatus() {
      var pair = React.useState(0)
      var bump = pair[1]
      React.useEffect(function () {
        var sync = function () {
          bump(function (n) {
            return n + 1
          })
        }
        translateStore.listeners.add(sync)
        return function () {
          translateStore.listeners.delete(sync)
        }
      }, [])
      return translateStore.value
    }

    function requestTranslation() {
      return fetch('/dsh-running-panel/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
        .then(function (response) {
          return response.json().catch(function () {
            return null
          })
        })
        .then(function (value) {
          if (value && typeof value === 'object' && 'pending' in value) noteTranslate(value)
          return value
        })
    }

    /** 每帧快照调用一次：决定要不要替用户点「翻译」。返回是否发起了请求。 */
    function maybeAutoTranslate(status) {
      if (!status || typeof status !== 'object') return false
      var pending = Number(status.pending) || 0
      if (status.running) return false
      if (pending < autoTranslateBaseline) autoTranslateBaseline = pending
      if (!modelAllowed('autoTranslate') || status.lastError || pending <= autoTranslateBaseline) return false
      autoTranslateBaseline = pending
      requestTranslation().catch(function () {})
      return true
    }

    function translateErrorText(t, code) {
      var key = {
        llm_unavailable: 'translateNoLlm',
        no_default_model: 'translateNoModel',
        translate_unparseable: 'translateUnparseable',
        translate_timeout: 'translateTimeout',
      }[code]
      return key ? t(key) : fill(t('translateFailedRaw'), 'code', code)
    }

    function translateStatusText(t, status) {
      if (!status) return hostOutdated() ? t('hostOutdatedShort') : t('translateUnknown')
      if (status.running) return t('translateRunning') + (status.model ? ' · ' + status.model : '')
      if (status.lastError) return translateErrorText(t, status.lastError)
      if (status.pending > 0) return fill(t('translatePending'), 'n', status.pending)
      if (status.lastAt) return fill(t('translateDone'), 'n', status.lastCount || 0)
      return t('translateNone')
    }

    /** 设置窗口里的一块：开关 + 状态 + 手动按钮（自动关掉或失败时用）。 */
    function TranslateSettings(props) {
      var t = props.t
      var status = useTranslateStatus()
      var pending = status ? Number(status.pending) || 0 : 0
      var running = Boolean(status && status.running)
      return h(
        'div',
        { className: '__rp_sheetRow', style: { flexDirection: 'column', alignItems: 'stretch', gap: '6px' } },
        h(
          'label',
          { className: '__rp_checkRow', style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          h('input', {
            type: 'checkbox',
            name: 'rp-translate',
            'aria-label': t('translateToggle'),
            checked: prefs.autoTranslate !== false,
            onChange: function (event) {
              setPref('autoTranslate', event.target.checked)
            },
          }),
          h('span', { className: '__rp_sheetLabel' }, t('translateToggle')),
        ),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 } },
          h(
            'span',
            {
              className: '__rp_sheetHint',
              role: 'status',
              style: { flex: '1 1 auto', minWidth: 0, color: status && status.lastError ? 'var(--dsw-alias-state-error-primary)' : undefined },
            },
            translateStatusText(t, status),
          ),
          h(
            'button',
            {
              type: 'button',
              className: '__rp_goalBtn',
              disabled: running || (pending === 0 && !(status && status.lastError)),
              onClick: function () {
                requestTranslation().catch(function () {})
              },
            },
            running ? t('translateRunningShort') : t('translateNow'),
          ),
        ),
      )
    }
    /* ── 能力行（右侧当前会话用） ─────────────────────────────────────── */

    /** 统一把浮层挂到 body，避免被面板的 overflow 裁掉。 */
    function portalToBody(node) {
      if (ReactDOM && typeof ReactDOM.createPortal === 'function' && typeof document !== 'undefined' && document.body) {
        // React 合成事件沿组件树冒泡，不沿 DOM 树：不拦住的话，在对话框里右键会再弹行菜单，
        // 回车、点击也会落到能力行 / 分组标题等祖先的处理函数上。
        // 外层 .__rp_portal 同时携带面板的设计令牌（--rp-amber 等），body 下也拿得到。
        return ReactDOM.createPortal(h('div', PORTAL_PROPS, node), document.body)
      }
      return node
    }

    var stopPortalEvent = function (event) {
      event.stopPropagation()
    }
    /* Esc 要继续冒到 window：菜单 / Echo 详情的关闭监听挂在 window 上。 */
    var stopPortalKey = function (event) {
      if (event.key !== 'Escape') event.stopPropagation()
    }
    var PORTAL_PROPS = {
      className: '__rp_portal',
      onClick: stopPortalEvent,
      onDoubleClick: stopPortalEvent,
      onMouseDown: stopPortalEvent,
      onMouseUp: stopPortalEvent,
      onPointerDown: stopPortalEvent,
      onPointerUp: stopPortalEvent,
      onContextMenu: stopPortalEvent,
      onKeyDown: stopPortalKey,
      onKeyUp: stopPortalKey,
      onFocus: stopPortalEvent,
      onBlur: stopPortalEvent,
      onDragStart: stopPortalEvent,
      onCopy: stopPortalEvent,
    }

    /** Electron 里 window.prompt 是空实现，所有输入都走这个对话框。 */
    function EntryEditor(props) {
      var t = props.t
      var valuePair = React.useState(props.value || '')
      var value = valuePair[0]
      var setValue = valuePair[1]
      var max = props.maxLength || (props.multiline ? 400 : 60)
      var trimmed = String(value || '').trim()
      var tooLong = trimmed.length > max
      var busy = Boolean(props.busy)
      var canSave = Boolean(trimmed) && !tooLong && !busy
      var submit = function () {
        if (canSave) props.onSave(trimmed)
      }
      var onKeyDown = function (event) {
        // 输入法正在组字时的回车是「选词」，不是「保存」——中文改名的必经路径。
        var composing = event.nativeEvent && (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)
        if (composing) return
        if (event.key === 'Escape') {
          event.preventDefault()
          props.onCancel()
          return
        }
        if (event.key === 'Enter' && (!props.multiline || event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          submit()
        }
      }
      var fieldProps = {
        value: value,
        autoFocus: true,
        maxLength: max + 20,
        'aria-invalid': tooLong ? 'true' : undefined,
        onChange: function (event) {
          setValue(event.target.value)
        },
        onKeyDown: onKeyDown,
      }
      return portalToBody(
        h(
          'div',
          {
            className: '__rp_confirmWrap',
            onMouseDown: function (event) {
              if (event.target === event.currentTarget && !busy) props.onCancel()
            },
          },
          h(
            'div',
            { className: '__rp_confirm', role: 'dialog', 'aria-modal': 'true', 'aria-label': props.title },
            h('h3', null, props.title),
            props.multiline
              ? h('textarea', Object.assign({ className: '__rp_editorArea', rows: 5 }, fieldProps))
              : h('input', Object.assign({ className: '__rp_editorInput' }, fieldProps)),
            tooLong
              ? h('p', { className: '__rp_editorError', role: 'alert' }, fill(t('editorTooLong'), 'n', max))
              : props.error
                ? h('p', { className: '__rp_editorError', role: 'alert' }, fill(t('editorSaveFailed'), 'reason', props.error))
                : null,
            h(
              'div',
              { className: '__rp_confirmActions' },
              h('button', { type: 'button', className: '__rp_editorBtn', onClick: props.onCancel }, t('menuCancel')),
              h(
                'button',
                { type: 'button', className: '__rp_editorBtn', 'data-primary': '1', disabled: !canSave, onClick: submit },
                busy ? t('menuSaving') : t('menuSave'),
              ),
            ),
          ),
        ),
      )
    }

    /** 通用确认框（面板内，不用 window.confirm）。Esc / 点外面 = 取消。 */
    function ConfirmDialog(props) {
      var t = props.t
      return portalToBody(
        h(
          'div',
          {
            className: '__rp_confirmWrap',
            onMouseDown: function (event) {
              if (event.target === event.currentTarget) props.onCancel()
            },
            onKeyDown: function (event) {
              if (event.key === 'Escape') props.onCancel()
            },
          },
          h(
            'div',
            { className: '__rp_confirm', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': props.title },
            h('h3', null, props.title),
            props.message ? h('p', null, props.message) : null,
            h(
              'div',
              { className: '__rp_confirmActions' },
              h('button', { type: 'button', className: '__rp_editorBtn', autoFocus: true, onClick: props.onCancel }, t('menuCancel')),
              h(
                'button',
                { type: 'button', className: '__rp_editorBtn', 'data-primary': '1', 'data-danger': props.danger ? '1' : undefined, onClick: props.onConfirm },
                props.confirmLabel || t('menuSave'),
              ),
            ),
          ),
        ),
      )
    }

    /** 调用记录：本会话来自行状态，跨会话来自快照 history。 */
    function EntryCalls(props) {
      var t = props.t
      var dataPair = React.useState(null)
      var data = dataPair[0]
      var setData = dataPair[1]
      React.useEffect(
        function () {
          var alive = true
          fetch('/dsh-running-panel/snapshot', { cache: 'no-store' })
            .then(function (response) {
              return response && response.ok ? response.json() : null
            })
            .then(function (json) {
              if (alive) setData(json || {})
            })
            .catch(function () {
              if (alive) setData({})
            })
          return function () {
            alive = false
          }
        },
        [],
      )
      var key = props.kind + ':' + props.name
      var lifetime = null
      if (data) {
        var list = props.kind === 'skill' ? (data.history && data.history.top) || [] : (data.history && data.history.toolTop) || []
        for (var i = 0; i < list.length; i += 1) {
          if (list[i] && list[i].key === key) {
            lifetime = list[i]
            break
          }
        }
      }
      var st = props.state || null
      var rows = [
        [t('callsRound'), st ? fill(t('roundCount'), 'n', st.round || 0) : '—'],
        [t('callsTotal'), st && st.total ? fill(t('totalCount'), 'n', st.total) : '—'],
        [t('callsLast'), st && st.at ? formatTime(st.at) : '—'],
        [t('callsMs'), st && st.lastMs ? formatMs(st.lastMs) : '—'],
        [
          t('callsLifetime'),
          lifetime ? String(lifetime.n || 0) + (lifetime.ms ? ' · ' + formatMs(lifetime.ms) : '') : t('callsNone'),
        ],
      ]
      return portalToBody(
        h(
          'div',
          {
            className: '__rp_confirmWrap',
            onMouseDown: function (event) {
              if (event.target === event.currentTarget) props.onClose()
            },
          },
          h(
            'div',
            { className: '__rp_confirm', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('menuCalls') },
            h('h3', null, (props.label || props.name) + ' · ' + t('menuCalls')),
            h(
              'dl',
              { className: '__rp_calls' },
              rows.map(function (row, index) {
                return h(
                  'div',
                  { key: index, className: '__rp_callsRow' },
                  h('dt', null, row[0]),
                  h('dd', null, row[1]),
                )
              }),
            ),
            h('p', { className: '__rp_callsHint' }, t('callsHint')),
            h(
              'div',
              { className: '__rp_confirmActions' },
              h('button', { type: 'button', className: '__rp_editorBtn', onClick: props.onClose }, t('menuCancel')),
            ),
          ),
        ),
      )
    }

    /** 条目右键菜单：定位到鼠标点，点外面或 Esc 关；方向键在菜单项之间移动。 */
    function RowMenu(props) {
      var t = props.t
      var items = props.items || []
      var boxRef = React.useRef(null)
      var onCloseRef = React.useRef(props.onClose)
      onCloseRef.current = props.onClose
      React.useEffect(function () {
        var close = function (event) {
          var box = boxRef.current
          if (event && event.target && box && box.contains(event.target)) return
          onCloseRef.current()
        }
        var onKey = function (event) {
          if (event.key === 'Escape') onCloseRef.current()
        }
        window.addEventListener('mousedown', close, true)
        window.addEventListener('keydown', onKey)
        window.addEventListener('scroll', close, true)
        window.addEventListener('resize', close)
        window.addEventListener('blur', close)
        return function () {
          window.removeEventListener('mousedown', close, true)
          window.removeEventListener('keydown', onKey)
          window.removeEventListener('scroll', close, true)
          window.removeEventListener('resize', close)
          window.removeEventListener('blur', close)
        }
      }, [])
      var width = 212
      var viewportW = (typeof window !== 'undefined' && window.innerWidth) || 1280
      var viewportH = (typeof window !== 'undefined' && window.innerHeight) || 800
      var left = Math.max(8, Math.min(props.x, viewportW - width - 8))
      var top = Math.max(8, Math.min(props.y, viewportH - items.length * 31 - 14))
      // 按条数估算只是首帧位置；挂载后按真实高度再夹一次（长标签换行 / 字体缩放时估算会偏）。
      var layoutEffect = React.useLayoutEffect || React.useEffect
      layoutEffect(function () {
        var box = boxRef.current
        if (!box || typeof box.getBoundingClientRect !== 'function') return
        var rect = box.getBoundingClientRect()
        var nextTop = Math.max(8, Math.min(props.y, viewportH - rect.height - 8))
        var nextLeft = Math.max(8, Math.min(props.x, viewportW - rect.width - 8))
        box.style.top = nextTop + 'px'
        box.style.left = nextLeft + 'px'
        var first = box.querySelector('[role="menuitem"]:not([disabled])')
        if (first && typeof first.focus === 'function') first.focus({ preventScroll: true })
      }, [props.x, props.y])
      var onMenuKey = function (event) {
        var box = boxRef.current
        if (!box || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End')) return
        event.preventDefault()
        var list = Array.prototype.slice.call(box.querySelectorAll('[role="menuitem"]:not([disabled])'))
        if (!list.length) return
        var index = list.indexOf(document.activeElement)
        var next = event.key === 'Home' ? 0
          : event.key === 'End' ? list.length - 1
            : event.key === 'ArrowDown' ? (index + 1) % list.length
              : (index - 1 + list.length) % list.length
        list[next].focus()
      }
      var node = h(
        'div',
        {
          className: '__rp_menu',
          role: 'menu',
          'aria-label': t('rowMenu'),
          ref: boxRef,
          style: { left: left + 'px', top: top + 'px', width: width + 'px' },
          onKeyDown: onMenuKey,
          onContextMenu: function (event) {
            event.preventDefault()
          },
        },
        items.map(function (item, index) {
          return h(
            'button',
            {
              key: index,
              type: 'button',
              role: 'menuitem',
              className: '__rp_menuItem',
              'data-danger': item.danger ? '1' : undefined,
              disabled: item.disabled ? true : undefined,
              title: item.title || undefined,
              onClick: function () {
                if (item.disabled) return
                props.onClose()
                item.onSelect()
              },
            },
            item.label,
          )
        }),
      )
      return portalToBody(node)
    }

    /** 复制纯文本：异步剪贴板失败时退回 execCommand。 */
    function copyPlain(text) {
      var legacy = function () {
        try {
          var area = document.createElement('textarea')
          area.value = text
          area.setAttribute('readonly', 'readonly')
          area.style.position = 'fixed'
          area.style.opacity = '0'
          document.body.appendChild(area)
          area.select()
          document.execCommand('copy')
          document.body.removeChild(area)
        } catch (error) {
          /* 复制失败不报错 */
        }
      }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).catch(legacy)
          return
        }
      } catch (error) {
        /* 退回 execCommand */
      }
      legacy()
    }

    /**
     * 分组标题的右键菜单 + 改名对话框（技能组、冷层组、历史常用组共用）。
     * 返回 [onContextMenu, 浮层节点]；组名写进覆盖层 names['lib:<id>']。
     */
    function useLibMenu(t, kind, lib) {
      var menuPair = React.useState(null)
      var menu = menuPair[0]
      var setMenu = menuPair[1]
      var editorPair = React.useState(null)
      var editor = editorPair[0]
      var setEditor = editorPair[1]
      var aliveRef = React.useRef(true)
      React.useEffect(function () {
        return function () {
          aliveRef.current = false
        }
      }, [])
      var open = function (event) {
        event.preventDefault()
        event.stopPropagation()
        setMenu({ x: event.clientX, y: event.clientY })
      }
      var save = function (text) {
        if (!text || (editor && editor.busy)) return
        var locale = overlayLocale()
        var key = 'lib:' + lib
        setEditor(function (previous) {
          return previous ? Object.assign({}, previous, { busy: true, error: '' }) : previous
        })
        fetch('/dsh-running-panel/name', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: 'lib', name: lib, field: 'name', text: text, locale: locale }),
        })
          .then(function (response) {
            if (!response.ok) {
              return response.json().catch(function () { return {} }).then(function (body) {
                throw new Error((body && body.error) || 'HTTP ' + response.status)
              })
            }
            entryOverrides.names[key] = text
            bumpCatalog()
            if (aliveRef.current) setEditor(null)
            return refreshCatalog().then(function (ok) {
              if (!ok || entryOverrides.names[key] !== text) return
              delete entryOverrides.names[key]
              if (libLabel(lib) !== text) entryOverrides.names[key] = text
              else bumpCatalog()
            })
          })
          .catch(function (error) {
            if (!aliveRef.current) return
            setEditor(function (previous) {
              return previous ? Object.assign({}, previous, { busy: false, error: String((error && error.message) || error) }) : previous
            })
          })
      }
      var items = [
        {
          label: t('libRename'),
          onSelect: function () {
            setEditor({ value: libLabel(lib), busy: false, error: '' })
          },
        },
        {
          label: t('libCopyName'),
          onSelect: function () {
            copyPlain(libLabel(lib))
          },
        },
      ]
      if (sourceOf(lib)) {
        items.push({
          label: t('libOpenRepo'),
          onSelect: function () {
            try {
              window.open(sourceOf(lib), '_blank', 'noopener,noreferrer')
            } catch (error) {
              /* 打不开就算了 */
            }
          },
        })
      }
      if (kind === 'skill') {
        items.push({
          label: isPinnedLib(lib) ? t('unpinLib') : t('pinLib'),
          onSelect: function () {
            togglePin('lib', lib)
          },
        })
      }
      var nodes = [
        menu
          ? h(RowMenu, {
              key: 'lib-menu',
              t: t,
              x: menu.x,
              y: menu.y,
              items: items,
              onClose: function () {
                setMenu(null)
              },
            })
          : null,
        editor
          ? h(EntryEditor, {
              key: 'lib-editor',
              t: t,
              title: t('libRenameTitle'),
              value: editor.value,
              busy: editor.busy,
              error: editor.error,
              onCancel: function () {
                setEditor(null)
              },
              onSave: save,
            })
          : null,
      ]
      return [open, nodes]
    }

    function CapabilityRow(props) {
      var t = props.t
      var state = props.state
      var stateName = rowStateOf(state, props.phase)
      usePrefs()
      var focusSince = React.useContext(FocusContext)
      var unfocused = !goalRelevant(state, focusSince)
      var pinned = props.kind === 'skill' && isPinnedSkill(props.name)
      var repoUrl = props.repoUrl || (props.lib ? sourceOf(props.lib) : '')
      var busyPair = React.useState(false)
      var busy = busyPair[0]
      var setBusy = busyPair[1]
      var failPair = React.useState(false)
      var failed = failPair[0]
      var setFailed = failPair[1]
      var insertPair = React.useState(false)
      var insertFailed = insertPair[0]
      var setInsertFailed = insertPair[1]
      // 停用时发现别的会话正在用：[{ sessionId, title }]，弹确认框。
      var inUsePair = React.useState(null)
      var inUseBy = inUsePair[0]
      var setInUseBy = inUsePair[1]
      var aliveRef = React.useRef(true)
      React.useEffect(function () {
        return function () {
          aliveRef.current = false
        }
      }, [])
      var menuPair = React.useState(null)
      var menu = menuPair[0]
      var setMenu = menuPair[1]
      var openMenu = function (event) {
        event.preventDefault()
        event.stopPropagation()
        setMenu({ x: event.clientX, y: event.clientY })
      }
      var copyText = function (text) {
        // 异步剪贴板在窗口失焦 / 权限不足时会 reject：那时再退回 execCommand，而不是静默失败。
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(function () {
              copyTextLegacy(text)
            })
            return
          }
        } catch (error) {
          /* 退回 execCommand */
        }
        copyTextLegacy(text)
      }
      var copyTextLegacy = function (text) {
        try {
          var area = document.createElement('textarea')
          area.value = text
          area.setAttribute('readonly', 'readonly')
          area.style.position = 'fixed'
          area.style.opacity = '0'
          document.body.appendChild(area)
          area.select()
          document.execCommand('copy')
          document.body.removeChild(area)
        } catch (error) {
          /* 复制失败不报错 */
        }
      }
      var revealItem = function (file) {
        fetch('/dsh-running-panel/reveal', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: props.kind, name: props.name, file: Boolean(file) }),
        }).catch(function () {})
      }
      var editorPair = React.useState(null)
      var editor = editorPair[0]
      var setEditor = editorPair[1]
      var callsPair = React.useState(false)
      var callsOpen = callsPair[0]
      var setCallsOpen = callsPair[1]
      var openEditor = function (field) {
        setEditor({
          busy: false,
          error: '',
          field: field,
          value: field === 'desc'
            ? tipOf(props.kind, props.name, props.description)
            : props.label || props.name,
        })
      }
      var saveEntry = function (raw) {
        var field = editor && editor.field === 'desc' ? 'desc' : 'name'
        var text = String(raw || '').trim()
        if (!text || (editor && editor.busy)) return
        var locale = overlayLocale()
        var key = props.kind + ':' + props.name
        setEditor(function (previous) {
          return previous ? Object.assign({}, previous, { busy: true, error: '' }) : previous
        })
        fetch('/dsh-running-panel/name', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: props.kind, name: props.name, field: field, text: text, locale: locale }),
        })
          .then(function (response) {
            if (response.ok) return response.json().catch(function () { return {} })
            return response
              .json()
              .catch(function () { return {} })
              .then(function (body) {
                throw new Error((body && body.error) || 'HTTP ' + response.status)
              })
          })
          .then(function () {
            var section = field === 'desc' ? 'descs' : 'names'
            // 先本地生效：覆盖值立即显示，同时写进当前语言那一列的词典缓存。
            entryOverrides[section][key] = text
            if (catalogStore.data) {
              if (!catalogStore.data[section]) catalogStore.data[section] = {}
              var patch = {}
              patch[locale] = text
              catalogStore.data[section][key] = Object.assign({}, catalogStore.data[section][key] || {}, patch)
            }
            bumpCatalog()
            if (aliveRef.current) setEditor(null)
            // 再和 Host 对齐：词典拿到新值后撤掉本地覆盖，之后以服务端（含外部编辑）为准。
            return refreshCatalog().then(function (ok) {
              if (!ok || entryOverrides[section][key] !== text) return
              delete entryOverrides[section][key]
              // 只有词典 / locale 服务真的给出新值时才撤覆盖；否则留着，免得名字闪回旧值。
              var resolved = field === 'desc' ? tipOf(props.kind, props.name, props.description) : nameOf(props.kind, props.name)
              if (resolved !== text) entryOverrides[section][key] = text
              else bumpCatalog()
            })
          })
          .catch(function (error) {
            if (!aliveRef.current) return
            setEditor(function (previous) {
              return previous
                ? Object.assign({}, previous, { busy: false, error: String((error && error.message) || error) })
                : previous
            })
          })
      }
      var park = function (force) {
        if (busy) return
        setBusy(true)
        setFailed(false)
        fetch('/dsh-running-panel/park', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          // 带上当前会话：Host 只拿「别的」会话正在用来拦，当前会话里停用是你自己的决定。
          body: JSON.stringify({ name: props.name, action: 'park', sessionId: sessionStore.id || '', force: force === true }),
        })
          .then(function (response) {
            if (response.ok) return null
            return response.json().catch(function () { return {} }).then(function (value) {
              if (response.status === 409 && value && value.error === 'in-use' && Array.isArray(value.sessions)) return value.sessions
              throw new Error('park')
            })
          })
          .then(function (sessions) {
            // 成功时把最后的 busy 留着：快照一到这一行就会消失，不需要再写状态。
            if (!sessions || !aliveRef.current) return
            setBusy(false)
            setInUseBy(sessions)
          })
          .catch(function () {
            if (!aliveRef.current) return
            setFailed(true)
            setBusy(false)
          })
      }
      var meta = ''
      if (stateName !== 'idle') {
        meta = fill(t('roundCount'), 'n', state.round)
        if (state.total > state.round) meta += ' · ' + fill(t('totalCount'), 'n', state.total)
        if (state.lastMs) meta += ' · ' + formatMs(state.lastMs)
        if (state.at) meta += ' · ' + fill(t('lastAt'), 't', formatTime(state.at))
      }
      var menuItems = []
      if (props.kind === 'skill') {
        menuItems.push({
          label: t('menuInsert'),
          onSelect: function () {
            Promise.resolve(insertSkillReference(props.name)).then(function (ok) {
              if (aliveRef.current && !ok) setInsertFailed(true)
            })
          },
        })
      }
      menuItems.push({
        label: t('menuRename'),
        onSelect: function () {
          openEditor('name')
        },
      })
      menuItems.push({
        label: t('menuEditDesc'),
        onSelect: function () {
          openEditor('desc')
        },
      })
      menuItems.push({
        label: t('menuCalls'),
        onSelect: function () {
          setCallsOpen(true)
        },
      })
      // 只有 ~/.agents/skills 里的自装技能有本地目录；内置 / 预设技能点了只会 404。
      var localSkill = props.kind === 'skill' && props.parkable === true
      if (props.kind === 'skill') {
        menuItems.push({
          label: t('menuReveal'),
          disabled: !localSkill,
          onSelect: function () {
            revealItem(false)
          },
        })
        menuItems.push({
          label: t('menuOpenFile'),
          disabled: !localSkill,
          onSelect: function () {
            revealItem(true)
          },
        })
      }
      menuItems.push({
        label: t('menuCopyName'),
        onSelect: function () {
          copyText(props.label || props.name)
        },
      })
      menuItems.push({
        label: t('menuCopyId'),
        onSelect: function () {
          copyText(props.name)
        },
      })
      if (props.kind === 'skill') {
        menuItems.push({
          label: pinned ? t('menuUnpin') : t('menuPin'),
          onSelect: function () {
            togglePin('skill', props.name)
          },
        })
        menuItems.push({ label: t('menuPark'), danger: true, disabled: !localSkill || busy, onSelect: park })
      }
      return h(
        'div',
        {
          className: props.kind === 'skill' ? '__rp_row __rp_rowSkill' : '__rp_row',
          'data-state': stateName,
          'data-unfocused': unfocused ? '1' : undefined,
          'data-warn': state && state.error ? '1' : undefined,
          'data-desc': tipOf(props.kind, props.name, props.description) || undefined,
          title: meta || undefined,
          onContextMenu: openMenu,
        },
        h('span', { className: '__rp_dot', 'aria-hidden': 'true' }),
        h('span', { className: '__rp_name' }, props.label || props.name),
        props.alt ? h('span', { className: '__rp_nameAlt' }, props.alt) : null,
        props.tokens ? h('span', { className: '__rp_costTag', title: t('costRowTip') }, '~' + formatTokens(props.tokens) + ' tok') : null,
        state && state.error ? h('span', { className: '__rp_warnTag' }, t('hasError')) : null,
        props.kind === 'skill'
          ? h(
              'span',
              { className: '__rp_rowActions', 'data-pinned': pinned ? '1' : undefined },
              h(
                'button',
                {
                  type: 'button',
                  className: '__rp_rowAct',
                  'aria-label': t('callSkill'),
                  title: t('callSkillTip'),
                  'data-failed': insertFailed ? '1' : undefined,
                  onClick: function () {
                    Promise.resolve(insertSkillReference(props.name)).then(function (ok) {
                      if (!aliveRef.current) return
                      setInsertFailed(!ok)
                      if (ok) {
                        window.setTimeout(function () {
                          if (aliveRef.current) setInsertFailed(false)
                        }, 900)
                      }
                    })
                  },
                },
                '↪',
              ),
              repoUrl
                ? h(
                    'a',
                    {
                      className: '__rp_rowAct',
                      href: repoUrl,
                      target: '_blank',
                      rel: 'noreferrer noopener',
                      title: t('openRepo'),
                      'aria-label': t('openRepo'),
                      onClick: function (event) {
                        event.stopPropagation()
                      },
                    },
                    '↗',
                  )
                : null,
              props.parkable === true
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: '__rp_rowAct',
                      'aria-label': t('parkSkill'),
                      disabled: busy,
                      'data-failed': failed ? '1' : undefined,
                      title: failed ? t('parkSkillFailed') : t('parkSkillTip'),
                      onClick: park,
                    },
                    busy ? '…' : '⊘',
                  )
                : null,
              h(
                'button',
                {
                  type: 'button',
                  className: '__rp_rowPin',
                  'data-on': pinned ? '1' : undefined,
                  'aria-label': pinned ? t('unpinSkill') : t('pinSkill'),
                  'aria-pressed': pinned ? 'true' : 'false',
                  title: pinned ? t('unpinSkillTip') : t('pinSkillTip'),
                  onClick: function () {
                    togglePin('skill', props.name)
                  },
                },
                pinned ? '★' : '☆',
              ),
            )
          : null,
        menu
          ? h(RowMenu, {
              t: t,
              x: menu.x,
              y: menu.y,
              onClose: function () {
                setMenu(null)
              },
              items: menuItems,
            })
          : null,
        editor
          ? h(EntryEditor, {
              t: t,
              title: editor.field === 'desc' ? t('editorDescTitle') : t('editorNameTitle'),
              value: editor.value,
              multiline: editor.field === 'desc',
              busy: editor.busy,
              error: editor.error,
              onCancel: function () {
                setEditor(null)
              },
              onSave: saveEntry,
            })
          : null,
        callsOpen
          ? h(EntryCalls, {
              t: t,
              kind: props.kind,
              name: props.name,
              label: props.label,
              state: state,
              onClose: function () {
                setCallsOpen(false)
              },
            })
          : null,
        inUseBy
          ? h(ConfirmDialog, {
              t: t,
              title: t('inUseTitle'),
              message: fill(t('inUseMessage'), 'sessions', inUseBy.map(function (row) { return '「' + row.title + '」' }).join('、')),
              confirmLabel: t('inUseConfirm'),
              danger: true,
              onCancel: function () {
                setInUseBy(null)
              },
              onConfirm: function () {
                setInUseBy(null)
                park(true)
              },
            })
          : null,
      )
    }

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

    /* ── SSE 订阅 ────────────────────────────────────────────────────── */

    function useSnapshot(url) {
      var pair = React.useState({ url: url, snapshot: null, failed: false })
      var state = pair[0]
      var setState = pair[1]
      React.useEffect(
        function () {
          var alive = true
          var status = function (failed) {
            if (!alive) return
            setState(function (previous) {
              return { url: url, snapshot: previous.url === url ? previous.snapshot : null, failed: failed }
            })
          }
          var onMessage = function (message) {
            if (!alive) return
            try {
              var parsed = JSON.parse(message.data)
              if (parsed && typeof parsed.pluginVersion === 'string') pluginVersionSeen = parsed.pluginVersion
              if (parsed && parsed.context && Number(parsed.context.contextWindow) > 0) contextWindowSeen = Number(parsed.context.contextWindow)
              // 记住最近一次见到的窗口：没有会话上报时预算线仍按它自动算，而不是退回固定值。
              if (parsed && parsed.context && Number(parsed.context.contextWindow) > 0 && Number(prefs.lastContextWindow) !== contextWindowSeen) {
                try {
                  setPref('lastContextWindow', contextWindowSeen)
                } catch (error) {
                  prefs.lastContextWindow = contextWindowSeen // 存不了就只记在内存里，不能挡住快照
                }
              }
              if (parsed && parsed.translate) {
                noteTranslate(parsed.translate)
                maybeAutoTranslate(parsed.translate)
              }
              setState({ url: url, snapshot: parsed, failed: false })
            } catch (error) {
              /* 非法分片忽略，等下一帧 */
            }
          }
          var source = null
          var timer = null
          var delay = 2000
          // 浏览器在 4xx/5xx（例如宿主认证服务尚未就绪时的 503、未登录的 401）后会关闭 EventSource 且不再自动重连，
          // 所以连接被关闭时由这里退避重开（2s 起，最长 30s）；网络中断这类可自动重连的错误仍交给浏览器。
          var connect = function () {
            timer = null
            if (!alive) return
            try {
              source = new EventSource(url)
            } catch (error) {
              status(true)
              return
            }
            source.onmessage = onMessage
            // 重连成功就把“重连中”撤掉，不必等下一帧数据。
            source.onopen = function () {
              delay = 2000
              status(false)
            }
            source.onerror = function () {
              status(true)
              if (alive && source && source.readyState === 2 && timer === null) {
                timer = setTimeout(connect, delay)
                delay = Math.min(delay * 2, 30000)
              }
            }
          }
          connect()
          return function () {
            alive = false
            if (timer !== null) clearTimeout(timer)
            if (source) source.close()
          }
        },
        [url],
      )
      return state.url === url ? [state.snapshot, state.failed] : [null, false]
    }

    /* ── 全局看板（左侧主要栏位） ─────────────────────────────────────── */

    function GlobalCard(props) {
      var t = props.t
      var row = props.row
      var calls = row.active && row.active.length ? row.active : []
      var warn = calls.some(function (call) {
        return call.error
      })
      return h(
        'div',
        { className: '__rp_card', 'data-running': row.running ? '1' : undefined, 'data-warn': warn ? '1' : undefined },
        h(
          'div',
          { className: '__rp_cardHead' },
          h('span', { className: '__rp_dot', 'aria-hidden': 'true' }),
          h('span', { className: '__rp_cardTitle', title: row.title || row.id }, row.title || shortId(row.id)),
          h('span', { className: '__rp_cardId' }, shortId(row.id)),
          h(
            'span',
            { className: '__rp_chip', 'data-phase': row.running ? 'active' : row.phase },
            row.running ? t('phaseRunning') : phaseLabel(t, row.phase),
            row.round ? ' · ' + fill(t('round'), 'n', row.round) : '',
          ),
          h('span', { className: '__rp_rowMeta' }, row.lastAt ? fill(t('lastAt'), 't', formatTime(row.lastAt)) : ''),
          row.tokens && (row.tokens.input || row.tokens.output)
            ? h(
                'span',
                { className: '__rp_rowMeta', title: t('tokenTip') },
                t('tokenTotal') + ' ' + formatTokens(row.tokens.input) + ' / ' + formatTokens(row.tokens.output),
              )
            : null,
          row.alerts && row.alerts.length
            ? h('span', { className: '__rp_alertChip' }, t('alertsTitle') + ' ' + String(row.alerts.length))
            : null,
        ),
        h(
          'div',
          { className: '__rp_calls' },
          calls.length
            ? calls.map(function (call) {
                return h(CallRow, { key: call.name, t: t, call: call })
              })
            : h('span', { className: '__rp_empty' }, t('noCalls')),
        ),
        (row.children || []).length
          ? h(
              'div',
              { className: '__rp_calls' },
              row.children.map(function (child) {
                return h(ChildNode, { key: child.id, t: t, child: child })
              }),
            )
          : null,
      )
    }

    function SessionSearch(props) {
      var t = props.t
      var pair = React.useState({ query: '', items: [], loading: false, error: false })
      var state = pair[0]
      var setState = pair[1]
      var controllerRef = React.useRef(null)
      var timerRef = React.useRef(0)

      React.useEffect(
        function () {
          if (timerRef.current) window.clearTimeout(timerRef.current)
          var query = state.query.trim()
          if (query.length < 2) {
            if (controllerRef.current) controllerRef.current.abort()
            setState(function (previous) {
              return Object.assign({}, previous, { items: [], loading: false, error: false })
            })
            return undefined
          }
          timerRef.current = window.setTimeout(function () {
            if (controllerRef.current) controllerRef.current.abort()
            var controller = new AbortController()
            controllerRef.current = controller
            setState(function (previous) {
              return Object.assign({}, previous, { loading: true, error: false })
            })
            fetch('/dsh-running-panel/search?q=' + encodeURIComponent(query), {
              cache: 'no-store',
              signal: controller.signal,
            })
              .then(function (response) {
                return response.json().then(function (body) {
                  if (!response.ok) throw new Error((body && body.error) || 'search failed')
                  return body
                })
              })
              .then(function (body) {
                setState(function (previous) {
                  return Object.assign({}, previous, {
                    items: Array.isArray(body.items) ? body.items : [],
                    loading: false,
                    error: false,
                  })
                })
              })
              .catch(function (error) {
                if (error && error.name === 'AbortError') return
                console.error('[running-panel] session search error', error)
                setState(function (previous) {
                  return Object.assign({}, previous, { loading: false, error: true })
                })
              })
          }, 280)
          return function () {
            if (timerRef.current) window.clearTimeout(timerRef.current)
          }
        },
        [state.query],
      )

      function titleFor(sessionId) {
        try {
          if (!clientSessions || !clientSessions.list) return sessionId
          var snapshot = clientSessions.list.getSnapshot()
          var row = snapshot && snapshot.byId ? snapshot.byId[sessionId] : null
          return (row && row.title) || sessionId
        } catch (error) {
          return sessionId
        }
      }

      function openResult(item) {
        openEchoAnchor(item)
      }

      return h(
        GroupSection,
        {
          id: 'session-search',
          title: t('sessionSearchTitle'),
          count: state.items.length,
          defaultOpen: false,
          body: h(
            'div',
            { className: '__rp_section' },
            h(
              'div',
              { className: '__rp_echoSearch' },
              h('input', {
                type: 'search',
                className: '__rp_echoSearchInput',
                value: state.query,
                placeholder: t('sessionSearchPlaceholder'),
                'aria-label': t('sessionSearchPlaceholder'),
                onChange: function (event) {
                  setState(function (previous) {
                    return Object.assign({}, previous, { query: event.target.value })
                  })
                },
              }),
            ),
            h('div', { className: '__rp_sheetHint' }, t('sessionSearchTip')),
            state.loading
              ? h('div', { className: '__rp_sheetHint' }, t('sessionSearchLoading'))
              : state.error
                ? h('div', { className: '__rp_sheetHint' }, t('sessionSearchError'))
                : state.items.length
                  ? state.items.map(function (item) {
                      return h(
                        'button',
                        {
                          key: item.sessionId + ':' + String(item.snippet || '').slice(0, 12),
                          type: 'button',
                          className: '__rp_sessionHit',
                          onClick: function () {
                            openResult(item)
                          },
                        },
                        h(
                          'span',
                          { className: '__rp_sessionHitTitle' },
                          item.sessionTitle || titleFor(item.sessionId),
                        ),
                        item.floor
                          ? h('span', { className: '__rp_sessionHitMeta' }, fill(t('echoFloor'), 'n', item.floor))
                          : null,
                        h('span', { className: '__rp_sessionHitSnippet' }, item.snippet),
                      )
                    })
                  : state.query.trim().length >= 2
                    ? h('div', { className: '__rp_sheetHint' }, t('sessionSearchNoResult'))
                    : null,
          ),
        },
      )
    }

    function storageWarning(snapshot, t) {
      var storage = snapshot && snapshot.storage
      if (!storage && !(snapshot && snapshot.undoError)) return null
      var messages = []
      var details = []
      ;['usage', 'echoes', 'catalog'].forEach(function (kind) {
        if (!storage || !storage[kind] || !storage[kind].error) return
        messages.push(t(kind === 'usage' ? 'storageUsageError' : kind === 'catalog' ? 'storageCatalogError' : 'storageEchoError'))
        details.push(String(storage[kind].error))
      })
      if (snapshot.undoError) {
        messages.push(t('undoStoreError'))
        details.push(String(snapshot.undoError))
      }
      return messages.length
        ? h('div', { key: 'storage-warning', className: '__rp_warnBox', role: 'alert', title: details.join('\n') }, messages.join(' '))
        : null
    }

    function GlobalBoard(props) {
      var t = props.t
      var snapshot = props.snapshot
      var nodes = []
      nodes.push(storageWarning(snapshot, t))

      nodes.push(
        h(
          'header',
          { className: '__rp_head', key: 'head' },
          h('h2', { className: '__rp_title' }, t('globalTitle')),
          h('span', { className: '__rp_sub' }, t('globalSubtitle')),
        ),
      )

      nodes.push(
        h(
          'div',
          { className: '__rp_stats', key: 'stats' },
          h(
            'div',
            { className: '__rp_stat' },
            h('span', { className: '__rp_statValue' }, String(snapshot.summary.running)),
            h('span', { className: '__rp_statLabel' }, t('runningLabel')),
          ),
          h(
            'div',
            { className: '__rp_stat' },
            h('span', { className: '__rp_statValue' }, String(snapshot.summary.observed)),
            h('span', { className: '__rp_statLabel' }, t('observedLabel')),
          ),
        ),
      )

      nodes.push(
        h(
          'section',
          { className: '__rp_group', key: 'running' },
          h(
            'div',
            { className: '__rp_groupHead' },
            h('h3', { className: '__rp_groupTitle' }, t('runningLabel')),
            h('span', { className: '__rp_groupCount' }, String(snapshot.running.length)),
          ),
          snapshot.running.length
            ? snapshot.running.map(function (row) {
                return h(GlobalCard, { key: row.id, t: t, row: row })
              })
            : h('span', { className: '__rp_empty' }, t('noRunning')),
        ),
      )

      nodes.push(
        h(
          'section',
          { className: '__rp_group', key: 'recent' },
          h(
            'div',
            { className: '__rp_groupHead' },
            h('h3', { className: '__rp_groupTitle' }, t('recentLabel')),
            h('span', { className: '__rp_groupCount' }, String(snapshot.recent.length)),
          ),
          snapshot.recent.length
            ? snapshot.recent.map(function (row) {
                return h(GlobalCard, { key: row.id, t: t, row: row })
              })
            : h('span', { className: '__rp_empty' }, t('noRecent')),
        ),
      )



      nodes.push(h(SessionSearch, { key: 'session-search', t: t }))
      nodes.push(h(EchoGroup, { key: 'echo', t: t }))

      return shell(nodes, t)
    }

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

    /* ── 会话看板（右侧栏） ──────────────────────────────────────────── */

    function SoulPersonaBlock(props) {
      var t = props.t
      var scope = props.scope
      var sessionId = props.sessionId
      var pair = React.useState(function () {
        return scope.getSnapshot()
      })
      var snapshot = pair[0]
      var setSnapshot = pair[1]
      var busyPair = React.useState(false)
      var busy = busyPair[0]
      var setBusy = busyPair[1]
      var failPair = React.useState(false)
      var failed = failPair[0]
      var setFailed = failPair[1]

      React.useEffect(
        function () {
          var alive = true
          var sync = function () {
            if (alive) setSnapshot(scope.getSnapshot())
          }
          var unsubscribe = typeof scope.subscribe === 'function' ? scope.subscribe(sync) : null
          return function () {
            alive = false
            if (unsubscribe) unsubscribe()
          }
        },
        [scope],
      )

      if (!snapshot || snapshot.status !== 'ready' || !snapshot.value) return null
      var value = snapshot.value
      if (value.showPersonaSwitcher === false) return null
      var cards = value.cards && typeof value.cards === 'object' ? value.cards : {}
      var sessions = value.sessions && typeof value.sessions === 'object' ? value.sessions : {}
      var choice = sessions[sessionId] || ''
      if (choice && choice !== 'none' && !(choice in cards)) choice = ''
      var names = Object.keys(cards).sort()

      function onChange(event) {
        if (busy) return
        var nextChoice = event.target.value
        var current = scope.getSnapshot()
        if (!current || current.status !== 'ready' || !current.value) {
          setFailed(true)
          return
        }
        var next = Object.assign({}, current.value.sessions || {})
        if (nextChoice === '') delete next[sessionId]
        else next[sessionId] = nextChoice
        setBusy(true)
        setFailed(false)
        var run =
          typeof scope.mutate === 'function'
            ? scope.mutate([{ op: 'set', path: ['sessions'], value: next }], current.revision)
            : scope.set('sessions', next)
        Promise.resolve(run)
          .then(function () {
            setSnapshot(scope.getSnapshot())
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
        { className: '__rp_section', key: 'soul' },
        h('div', { className: '__rp_sectionTitle' }, t('soulTitle')),
        h(
          'label',
          { className: '__rp_soulRow', title: t('soulHint') },
          h('span', { className: '__rp_soulBadge' }, 'SOUL'),
          h(
            'select',
            {
              className: '__rp_soulSelect',
              value: choice,
              disabled: busy,
              'aria-label': t('soulTitle'),
              onChange: onChange,
            },
            h('option', { value: '' }, t('soulAuto')),
            h('option', { value: 'none' }, t('soulNone')),
            names.map(function (name) {
              return h('option', { key: name, value: name }, name)
            }),
          ),
          failed ? h('span', { className: '__rp_warnTag' }, t('soulError')) : null,
        ),
        !names.length ? h('div', { className: '__rp_sheetHint' }, t('soulEmpty')) : null,
      )
    }

    /**
     * 回声正文只做“去格式”，不做概括：不调用模型、不增加 token。
     * 目的是让人读到对话，而不是命令/表格/标题符号。
     */
    function echoReadable(text) {
      var value = String(text || '')
      value = value.replace(/```[\s\S]*?```/g, ' ')
      value = value.replace(/`([^`]+)`/g, '$1')
      value = value.replace(/^#{1,6}\s+/gm, '')
      value = value.replace(/^\s*\|?[-: ]+\|?[-: |]*$/gm, '')
      value = value.replace(/\*\*([^*]+)\*\*/g, '$1')
      value = value.replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
      value = value.replace(/\|/g, ' ')
      value = value.replace(/<\/?[a-z][^>]*>/gi, '')
      value = value.replace(/\n{3,}/g, '\n\n')
      return value.trim()
    }

    /**
     * 拖拽载荷：一条回声变成能直接落进输入框的引用块。
     * 只带标题、楼号和 Q/A 前若干字，不整段搬运——拖一次不该吃满预算。
     */
    function echoDragText(item, limits) {
      var maxQ = (limits && limits.maxQuestion) || 240
      var maxA = (limits && limits.maxAnswer) || 600
      var clip = function (text, max) {
        // 按码点截断：按 UTF-16 单元切会把 emoji / 生僻字劈成半个代理对。
        var chars = Array.from(echoReadable(text).replace(/\s+/g, ' ').trim())
        return chars.length > max ? chars.slice(0, max - 1).join('') + '…' : chars.join('')
      }
      var title = String((item && (item.title || item.sessionTitle)) || '').trim() || 'Echo'
      var floor = item && item.anchorFloor ? item.anchorFloor : 1
      var zhLabel = typeof isChineseLocale !== 'function' || isChineseLocale()
      var lines = [zhLabel ? '【Echo · ' + title + '】第 ' + floor + ' 楼' : '[Echo · ' + title + '] #' + floor]
      var question = clip(item && item.questionText, maxQ)
      var answer = clip(item && item.answerText, maxA)
      if (question) lines.push('Q: ' + question)
      if (answer) lines.push('A: ' + answer)
      return lines.join('\n')
    }

    function escapeHtml(text) {
      return String(text).replace(/[&<>]/g, function (ch) {
        return ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : '&gt;'
      })
    }

    /**
     * 选区复制：
     * - 在气泡里框选文字：只选了一条里的一段 → 抄选中的那段；跨了两条以上 → 这些消息整条按原格式复制。
     * - 框选了整条气泡（在气泡外拖动画框、Ctrl / Shift 加选）→ 选中的消息整条按原格式复制。
     * 纯文本是原始 Markdown（带「用户 / 助手」标头），同时写一份 HTML，粘到 Word / Notion 里保留格式。
     */
    function copyEchoSelection(event, root, opts) {
      if (!event || !event.clipboardData || typeof window === 'undefined') return null
      var selection = window.getSelection()
      var hasSelection = Boolean(selection && !selection.isCollapsed && selection.rangeCount && (!root || root.contains(selection.anchorNode)))
      var payload = null
      if (hasSelection) {
        var touched = echoMessagesInSelection(selection, root, opts)
        if (touched.length >= 2) payload = echoCopyPayload(touched, opts && opts.labels)
        else {
          var selected = String(selection).replace(/ /g, ' ')
          if (!selected.trim()) return null
          payload = {
            text: selected,
            html: selected
              .split(/\n{2,}/)
              .map(function (block) {
                return '<p>' + escapeHtml(block).replace(/\n/g, '<br>') + '</p>'
              })
              .join(''),
            count: 0,
          }
        }
      } else if (opts && opts.picked && Array.isArray(opts.messages)) {
        var list = opts.messages.filter(function (message) { return message && opts.picked[message.id] })
        if (list.length) payload = echoCopyPayload(list, opts.labels)
      }
      if (!payload) return null
      var text = payload.text
      var html = payload.html
      try {
        event.clipboardData.setData('text/plain', text)
        event.clipboardData.setData('text/html', html)
        event.preventDefault()
      } catch (error) {
        /* 写剪贴板失败就让浏览器自己处理 */
        return null
      }
      return payload
    }

    /** 选区碰到了哪些气泡（按页面顺序）。 */
    function echoMessagesInSelection(selection, root, opts) {
      if (!root || !opts || !Array.isArray(opts.messages) || typeof root.querySelectorAll !== 'function') return []
      var ids = {}
      Array.prototype.forEach.call(root.querySelectorAll('[data-msg-id]'), function (node) {
        if (selection.containsNode(node, true)) ids[node.getAttribute('data-msg-id')] = true
      })
      return opts.messages.filter(function (message) { return message && ids[message.id] })
    }

    /** 整条消息的复制内容：原始 Markdown + 渲染好的 HTML。 */
    function echoCopyPayload(list, labels) {
      var labelOf = function (message) {
        return message.role === 'user' ? (labels && labels.user) || 'User' : (labels && labels.assistant) || 'Assistant'
      }
      return {
        text: list
          .map(function (message) {
            return '**' + labelOf(message) + '**\n\n' + String(message.text || '').replace(/\r\n/g, '\n').trim()
          })
          .join('\n\n'),
        html: list
          .map(function (message) {
            return '<p><strong>' + escapeHtml(labelOf(message)) + '</strong></p>' + echoMarkdownHtml(message.text)
          })
          .join(''),
        count: list.length,
      }
    }

    function escapeAttr(text) {
      return escapeHtml(text).replace(/"/g, '&quot;')
    }

    /** 行内 Markdown → HTML：先转义，代码段不再处理粗体等，链接只认 http(s)。 */
    function echoInlineHtml(text) {
      return String(text)
        .split(/(`[^`\n]+`)/)
        .map(function (part) {
          if (/^`[^`\n]+`$/.test(part)) return '<code>' + escapeHtml(part.slice(1, -1)) + '</code>'
          return escapeHtml(part)
            .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (all, label, url) {
              return '<a href="' + escapeAttr(url) + '">' + label + '</a>'
            })
            .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
            .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
            .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
            .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
        })
        .join('')
    }

    /** 够用的 Markdown 渲染（标题、段落、列表、引用、代码块、表格、分隔线），只用于复制出去的 HTML。 */
    function echoMarkdownHtml(markdown) {
      var lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n')
      var out = []
      var i = 0
      var isTableSep = function (line) {
        return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line || '')
      }
      var cells = function (line) {
        return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (cell) { return cell.trim() })
      }
      var blockStart = function (line) {
        return /^\s*(```|#{1,6}\s|>|[-*+]\s|\d+[.)]\s)/.test(line) || /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)
      }
      while (i < lines.length) {
        var line = lines[i]
        var fence = /^\s*```/.exec(line)
        if (fence) {
          var code = []
          i += 1
          while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++])
          i += 1
          out.push('<pre><code>' + escapeHtml(code.join('\n')) + '</code></pre>')
          continue
        }
        var heading = /^\s*(#{1,6})\s+(.*)$/.exec(line)
        if (heading) {
          out.push('<h' + heading[1].length + '>' + echoInlineHtml(heading[2]) + '</h' + heading[1].length + '>')
          i += 1
          continue
        }
        if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
          out.push('<hr>')
          i += 1
          continue
        }
        if (line.indexOf('|') >= 0 && isTableSep(lines[i + 1])) {
          var head = cells(line)
          i += 2
          var rows = []
          while (i < lines.length && lines[i].indexOf('|') >= 0 && lines[i].trim()) rows.push(cells(lines[i++]))
          out.push(
            '<table><thead><tr>' + head.map(function (c) { return '<th>' + echoInlineHtml(c) + '</th>' }).join('') + '</tr></thead><tbody>' +
              rows.map(function (row) { return '<tr>' + row.map(function (c) { return '<td>' + echoInlineHtml(c) + '</td>' }).join('') + '</tr>' }).join('') +
              '</tbody></table>',
          )
          continue
        }
        var listMatch = /^\s*([-*+]|\d+[.)])\s+/.exec(line)
        if (listMatch) {
          var ordered = /\d/.test(listMatch[1])
          var items = []
          while (i < lines.length) {
            var m = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i])
            if (!m || /\d/.test(m[1]) !== ordered) break
            items.push('<li>' + echoInlineHtml(m[2]) + '</li>')
            i += 1
          }
          out.push((ordered ? '<ol>' : '<ul>') + items.join('') + (ordered ? '</ol>' : '</ul>'))
          continue
        }
        if (/^\s*>/.test(line)) {
          var quote = []
          while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(echoInlineHtml(lines[i++].replace(/^\s*>\s?/, '')))
          out.push('<blockquote>' + quote.join('<br>') + '</blockquote>')
          continue
        }
        if (!line.trim()) {
          i += 1
          continue
        }
        var para = []
        while (i < lines.length && lines[i].trim() && !(para.length && blockStart(lines[i])) && !(lines[i].indexOf('|') >= 0 && isTableSep(lines[i + 1]))) para.push(echoInlineHtml(lines[i++]))
        out.push('<p>' + para.join('<br>') + '</p>')
      }
      return out.join('')
    }

    function BookmarkIcon(props) {
      var size = props && props.size ? props.size : 16
      // 战术风格回声标记：六边形外壳 + 三条脉冲，明显区别于普通书签/星标。
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: 'none',
          className: '__rp_echoMark',
          'aria-hidden': 'true',
        },
        h('path', {
          d: 'M12 2.4 20.6 7.2v9.6L12 21.6 3.4 16.8V7.2Z',
          fill: props && props.filled ? 'currentColor' : 'none',
          fillOpacity: props && props.filled ? 0.14 : 0,
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinejoin: 'round',
        }),
        h('path', {
          d: 'M7.4 9.2h9.2M7.4 12h5.8M7.4 14.8h9.2',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
        }),
        h('circle', { cx: 12, cy: 12, r: 1.35, fill: 'currentColor' }),
      )
    }

    // #region echo-navigation-core
    /** Exact identity and visible geometry only; never search message text. */
    function echoAnchorNode(snapshot, messageId) {
      if (!snapshot || !snapshot.nodes || typeof snapshot.nodes.get !== 'function') return null
      var order = snapshot.order || []
      for (var i = 0; i < order.length; i += 1) {
        var node = snapshot.nodes.get(order[i])
        var data = node && node.data
        if (!data) continue
        if ((node.kind === 'user' || node.kind === 'steering') && String(data.messageId || '') === messageId) return node
        if (node.kind === 'assistant-step' && data.finalNode && String(data.finalNode.messageId || '') === messageId) return node
      }
      return null
    }

    function echoAnchorVisible(node, root, env) {
      if (!node || node.isConnected === false || !root.contains(node) || !node.getClientRects().length) return false
      var rect = node.getBoundingClientRect()
      var view = env.document.documentElement
      var bounds = { top: 0, left: 0, bottom: view.clientHeight, right: view.clientWidth }
      for (var element = node; element; element = element.parentElement) {
        if (element.hasAttribute && element.hasAttribute('hidden')) return false
        var style = env.style(element)
        if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') return false
        if (element !== node && element.getBoundingClientRect && /auto|scroll|hidden|clip/.test(style.overflowY + ' ' + style.overflowX)) {
          var clip = element.getBoundingClientRect()
          bounds.top = Math.max(bounds.top, clip.top)
          bounds.bottom = Math.min(bounds.bottom, clip.bottom)
          bounds.left = Math.max(bounds.left, clip.left)
          bounds.right = Math.min(bounds.right, clip.right)
        }
      }
      return Math.min(rect.bottom, bounds.bottom) - Math.max(rect.top, bounds.top) >= Math.min(20, rect.bottom - rect.top) &&
        Math.min(rect.right, bounds.right) - Math.max(rect.left, bounds.left) >= Math.min(20, rect.right - rect.left) &&
        rect.bottom > rect.top && rect.right > rect.left
    }

    async function locateEchoAnchor(item, env) {
      var sessionId = String((item && item.sessionId) || '')
      var messageId = String((item && (item.anchorMessageId || item.messageId)) || '')
      if (!sessionId || !messageId) return { ok: false, reason: 'missing-identity' }
      var deadline = env.now() + 20000
      var check = function () {
        var selection = env.workspace.selection && env.workspace.selection.getSnapshot()
        if (!env.isCurrent() || (selection && selection.sessionId !== sessionId)) throw new Error('cancelled')
        if (env.now() >= deadline) throw new Error('timeout')
      }
      var perform = async function (promise) {
        var settled = false, failure
        Promise.resolve(promise).then(function () { settled = true }, function (error) { failure = error || new Error('history-failed'); settled = true })
        while (!settled) { check(); await env.delay(80) }
        check()
        if (failure) throw failure
      }
      try {
        if (!env.workspace || !env.sessions || !env.conversation || !env.isCurrent()) throw new Error(env.isCurrent() ? 'unavailable' : 'cancelled')
        env.workspace.openSession(sessionId)
        var binding
        for (var wait = 0; wait < 40 && !binding; wait += 1) {
          check()
          binding = env.sessions.binding(sessionId)
          if (!binding) await env.delay(100)
        }
        if (!binding || !binding.session) throw new Error('unavailable')
        var session = binding.session
        if (typeof session.open === 'function') await perform(session.open())
        var conversation = env.conversation.binding(sessionId)
        if (typeof conversation.activate === 'function') conversation.activate('chat')
        var target = conversation.target('chat')
        var modelNode = null
        for (var page = 0; page <= 12; page += 1) {
          check()
          modelNode = echoAnchorNode(target.getSnapshot(), messageId)
          if (modelNode) break
          var state = session.getSnapshot()
          if (!state.hasMore || page === 12 || typeof session.loadOlder !== 'function') break
          if (state.loadingOlder) { await env.delay(100); page -= 1; continue }
          await perform(session.loadOlder())
          await env.delay(100)
        }
        if (!modelNode) throw new Error('history-limit')
        var previous = null
        for (var attempt = 0; attempt < 30; attempt += 1) {
          check()
          var roots = Array.prototype.slice.call(env.document.querySelectorAll('[data-conversation-session]'))
          for (var r = 0; r < roots.length; r += 1) {
            var root = roots[r]
            if (root.getAttribute('data-conversation-session') !== sessionId) continue
            var rows = Array.prototype.slice.call(root.querySelectorAll('[data-chat-node-key]'))
            for (var n = 0; n < rows.length; n += 1) {
              var node = rows[n]
              if (node.getAttribute('data-chat-node-key') !== String(modelNode.key) || node.getAttribute('data-chat-group-part') === 'reasoning') continue
              if (echoAnchorVisible(node, root, env) && previous === node) return { ok: true, node: node }
              previous = echoAnchorVisible(node, root, env) ? node : null
              // This is the shipped searchable-hidden reveal contract. Do not remove React-owned hidden attributes.
              node.dispatchEvent(new env.Event('beforematch', { bubbles: true }))
              node.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' })
            }
          }
          await env.delay(100)
        }
        throw new Error('not-visible')
      } catch (error) {
        return { ok: false, reason: String((error && error.message) || error) }
      }
    }
    // #endregion echo-navigation-core

    var echoNoticeStore = { value: null, listeners: new Set(), sequence: 0, timer: 0 }
    var echoNavigationSequence = 0
    var echoAnchorHighlight = null
    function showEchoNotice(value) {
      if (echoNoticeStore.timer) window.clearTimeout(echoNoticeStore.timer)
      echoNoticeStore.timer = 0
      echoNoticeStore.value = value
      echoNoticeStore.listeners.forEach(function (listener) { listener(value) })
    }
    function EchoFeedback(props) {
      var pair = React.useState(echoNoticeStore.value)
      React.useEffect(function () {
        var sync = function (value) { pair[1](value) }
        echoNoticeStore.listeners.add(sync)
        sync(echoNoticeStore.value)
        return function () { echoNoticeStore.listeners.delete(sync) }
      }, [])
      var notice = pair[0]
      if (!notice) return null
      var label = props.t(notice.key)
      Object.keys(notice.values || {}).forEach(function (key) { label = fill(label, key, notice.values[key]) })
      return h('div', {
        className: '__rp_warnBox', role: notice.error ? 'alert' : 'status', title: notice.details || undefined,
        style: { position: 'fixed', right: '18px', bottom: '18px', maxWidth: '420px', padding: '12px', zIndex: 10000,
          background: 'var(--dsw-alias-bg-layer-1)', border: '1px solid var(--dsw-alias-border-l1)', borderRadius: '8px' },
      }, label, h('button', { type: 'button', className: '__rp_linkBtn', 'aria-label': props.t('echoClose'), onClick: function () {
        echoNavigationSequence += 1
        showEchoNotice(null)
      } }, '✕'))
    }
    function openEchoAnchor(item) {
      var request = ++echoNavigationSequence
      if (echoAnchorHighlight) { echoAnchorHighlight(); echoAnchorHighlight = null }
      showEchoNotice({ key: 'echoLocating' })
      return locateEchoAnchor(item, {
        workspace: echoWorkspace, sessions: clientSessions, conversation: echoConversation, document: document,
        Event: window.Event, now: Date.now, style: function (node) { return window.getComputedStyle(node) },
        delay: function (ms) { return new Promise(function (resolve) { window.setTimeout(resolve, ms) }) },
        isCurrent: function () { return request === echoNavigationSequence },
      }).then(function (result) {
        if (request !== echoNavigationSequence) return result
        if (!result.ok && result.reason === 'cancelled') { showEchoNotice(null); return result }
        showEchoNotice({ key: result.ok ? 'echoLocated' : result.reason === 'missing-identity' ? 'echoAnchorMissing' : 'echoLocateFailed', error: !result.ok, details: result.ok ? '' : result.reason })
        if (result.ok) {
          result.node.classList.add('__rp_searchHit')
          var timer = window.setTimeout(function () { result.node.classList.remove('__rp_searchHit') }, 2200)
          echoAnchorHighlight = function () { window.clearTimeout(timer); result.node.classList.remove('__rp_searchHit') }
          echoNoticeStore.timer = window.setTimeout(function () { if (request === echoNavigationSequence) showEchoNotice(null) }, 3000)
        }
        return result
      })
    }

    function EchoActionButton(props) {
      var t = echoT || function (key) { return key }
      var sessionId = props.sessionId || sessionStore.id
      var pair = React.useState('idle')
      var status = pair[0]
      var setStatus = pair[1]
      var capacityPair = React.useState(null)
      var capacity = capacityPair[0]
      if (!sessionId || !props.messageId) return null
      var labels = {
        idle: t('echoFavorite'),
        saving: t('echoSaving'),
        saved: t('echoSaved'),
        merged: t('echoMerged'),
        pending: t('echoPending'),
        error: t('echoError'),
      }
      var label = status === 'full' && capacity
        ? fill(fill(t('echoCapacityFull'), 'n', capacity.count), 'limit', capacity.limit)
        : labels[status] || labels.idle
      var pressed = status === 'saved' || status === 'merged' || status === 'pending'
      function save() {
        if (status === 'saving' || pressed) return
        setStatus('saving')
        fetch('/dsh-running-panel/echo', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionId, messageId: props.messageId }),
        })
          .then(function (response) {
            return response.json().then(function (body) {
              if (!response.ok) {
                var error = new Error(body && body.error ? body.error : 'echo failed')
                error.body = body
                throw error
              }
              return body
            })
          })
          .then(function (body) {
            setStatus(body.merged ? 'merged' : body.pending ? 'pending' : 'saved')
            if (typeof sfxPlay === 'function') sfxPlay('done')
            try {
              window.dispatchEvent(
                new CustomEvent('dsh-running-panel:echo-changed', { detail: { sessionId: sessionId } }),
              )
            } catch (error) {
              /* ignore */
            }
          })
          .catch(function (error) {
            if (error && error.body && error.body.error === 'echo_capacity_reached') {
              var limit = error.body.capacity || error.body
              capacityPair[1]({ count: limit.count, limit: limit.limit })
              setStatus('full')
              showEchoNotice({ key: 'echoCapacityFull', values: { n: limit.count, limit: limit.limit }, error: true })
            } else {
              setStatus('error')
              showEchoNotice({ key: 'echoError', error: true })
            }
          })
      }
      return h(
        'button',
        {
          type: 'button',
          className: '__rp_echoAction',
          'data-state': status,
          'data-pressed': pressed ? '1' : undefined,
          title: label,
          'aria-label': label,
          'aria-pressed': pressed ? 'true' : 'false',
          disabled: status === 'saving' || pressed,
          onClick: save,
        },
        h(BookmarkIcon, { filled: pressed, size: 24 }),
        status === 'saving' ? h('span', { className: '__rp_echoSpin', 'aria-hidden': 'true' }) : null,
      )
    }

    function useEchoes() {
      var pair = React.useState({ items: [], loading: true, error: '', capacity: null })
      var state = pair[0]
      var setState = pair[1]
      var reload = React.useCallback(function () {
        fetch('/dsh-running-panel/echo?all=1', { cache: 'no-store' })
          .then(function (response) {
            if (!response.ok) throw new Error('echo list failed')
            return response.json()
          })
          .then(function (body) {
            setState({ items: Array.isArray(body.echoes) ? body.echoes : [], loading: false, error: '', capacity: body.capacity || null })
          })
          .catch(function () {
            setState({ items: [], loading: false, error: 'load', capacity: null })
          })
      }, [])
      React.useEffect(
        function () {
          reload()
          var changed = function () {
            reload()
          }
          window.addEventListener('dsh-running-panel:echo-changed', changed)
          var timer = window.setInterval(function () {
            if (!document.hidden) reload()
          }, 10000)
          return function () {
            window.removeEventListener('dsh-running-panel:echo-changed', changed)
            window.clearInterval(timer)
          }
        },
        [reload],
      )
      return [state, reload]
    }

    function EchoContextModal(props) {
      var t = props.t
      var item = props.item
      var detail = props.detail
      var full = Boolean(props.full)
      var fullLoading = Boolean(props.fullLoading)
      var fullError = Boolean(props.fullError)
      var detailError = Boolean(props.detailError)
      var sessionAlive = props.sessionAlive !== false
      var messages = detail && Array.isArray(detail.messages) ? detail.messages : []
      var anchorId = item.anchorMessageId
      var anchorQuestionId = ''
      var anchorIndex = messages.findIndex(function (message) {
        return message && message.id === anchorId
      })
      for (var i = anchorIndex >= 0 ? anchorIndex : messages.length - 1; i >= 0; i -= 1) {
        if (messages[i] && messages[i].role === 'user') {
          anchorQuestionId = messages[i].id
          break
        }
      }
      var questionRef = React.useRef(null)
      var contextRef = React.useRef(null)
      // 框选整条气泡：picked 记选中的消息 id；marquee 是正在画的框（相对滚动内容的坐标）。
      var pickedPair = React.useState({})
      var picked = pickedPair[0]
      var setPicked = pickedPair[1]
      var marqueePair = React.useState(null)
      var marquee = marqueePair[0]
      var setMarquee = marqueePair[1]
      var copiedPair = React.useState(0)
      var copied = copiedPair[0]
      var setCopied = copiedPair[1]
      var pickedCount = Object.keys(picked).length
      var copyOpts = { messages: messages, picked: picked, labels: { user: t('echoUser'), assistant: t('echoAssistant') } }
      var copyRef = React.useRef(copyOpts)
      copyRef.current = copyOpts
      var afterCopy = function (payload) {
        if (payload && payload.count) setCopied(payload.count)
      }
      var afterCopyRef = React.useRef(afterCopy)
      afterCopyRef.current = afterCopy
      var pickAll = function () {
        var all = {}
        messages.forEach(function (message) { if (message && message.id) all[message.id] = true })
        setPicked(all)
      }
      var pickAllRef = React.useRef(pickAll)
      pickAllRef.current = pickAll
      var copyPicked = function () {
        if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return
        var selection = window.getSelection()
        if (selection) selection.removeAllRanges()
        // execCommand 会派发一次 copy 事件，由下面的监听按原格式写剪贴板。
        document.execCommand('copy')
      }
      React.useEffect(function () {
        if (typeof document === 'undefined') return undefined
        // 选区为空时 Ctrl+C 的 copy 事件不会落到对话区里，在 document 上兜住。
        var onCopy = function (event) {
          if (event.defaultPrevented) return
          var root = contextRef.current
          if (!root) return
          var target = event.target
          if (target && target.closest && target.closest('input,textarea,[contenteditable="true"]')) return
          var selection = window.getSelection()
          var inside = selection && !selection.isCollapsed && root.contains(selection.anchorNode)
          if (!inside && !Object.keys(copyRef.current.picked).length) return
          afterCopyRef.current(copyEchoSelection(event, root, copyRef.current))
        }
        document.addEventListener('copy', onCopy)
        return function () {
          document.removeEventListener('copy', onCopy)
        }
      }, [])
      React.useEffect(
        function () {
          if (!copied) return undefined
          var timer = setTimeout(function () { setCopied(0) }, 1800)
          return function () { clearTimeout(timer) }
        },
        [copied],
      )
      var onContextMouseDown = function (event) {
        var root = contextRef.current
        if (event.button !== 0 || !detail || !root) return
        var target = event.target
        var additive = event.ctrlKey || event.metaKey || event.shiftKey
        var bubble = target && target.closest ? target.closest('[data-msg-id]') : null
        if (bubble) {
          // 在气泡里：普通拖动是选文字；Ctrl / Shift 点一下是加选 / 取消这一条。
          if (!additive) return
          event.preventDefault()
          var id = bubble.getAttribute('data-msg-id')
          setPicked(function (previous) {
            var next = Object.assign({}, previous)
            if (next[id]) delete next[id]
            else next[id] = true
            return next
          })
          return
        }
        if (target && target.closest && target.closest('button,a,input,textarea')) return
        var rect = root.getBoundingClientRect()
        if (event.clientX > rect.left + root.clientWidth) return // 点在滚动条上
        event.preventDefault()
        if (typeof root.focus === 'function') root.focus({ preventScroll: true })
        var selection = window.getSelection()
        if (selection) selection.removeAllRanges()
        var start = { x: event.clientX - rect.left + root.scrollLeft, y: event.clientY - rect.top + root.scrollTop }
        var base = additive ? Object.assign({}, picked) : {}
        var last = { x: event.clientX, y: event.clientY }
        var moved = false
        var update = function () {
          var r = root.getBoundingClientRect()
          var cur = { x: last.x - r.left + root.scrollLeft, y: last.y - r.top + root.scrollTop }
          if (!moved && Math.abs(cur.x - start.x) < 4 && Math.abs(cur.y - start.y) < 4) return
          moved = true
          var box = { left: Math.min(start.x, cur.x), top: Math.min(start.y, cur.y), right: Math.max(start.x, cur.x), bottom: Math.max(start.y, cur.y) }
          setMarquee(box)
          var next = Object.assign({}, base)
          Array.prototype.forEach.call(root.querySelectorAll('[data-msg-id]'), function (node) {
            var b = node.getBoundingClientRect()
            var top = b.top - r.top + root.scrollTop
            var left = b.left - r.left + root.scrollLeft
            if (left < box.right && left + b.width > box.left && top < box.bottom && top + b.height > box.top) next[node.getAttribute('data-msg-id')] = true
          })
          setPicked(next)
        }
        var onMove = function (moveEvent) {
          // 松手事件可能被宿主吞掉：移动时发现已经没按键，就当松手。
          if (moveEvent.buttons === 0) return onUp()
          last = { x: moveEvent.clientX, y: moveEvent.clientY }
          var r = root.getBoundingClientRect()
          // 拖到上下边缘时自动滚动，长对话也能一口气框下去。
          if (moveEvent.clientY < r.top + 28) root.scrollTop -= 16
          else if (moveEvent.clientY > r.bottom - 28) root.scrollTop += 16
          update()
        }
        var done = false
        var onUp = function () {
          if (done) return
          done = true
          window.removeEventListener('mousemove', onMove, true)
          window.removeEventListener('mouseup', onUp, true)
          window.removeEventListener('pointerup', onUp, true)
          window.removeEventListener('blur', onUp)
          root.removeEventListener('scroll', update)
          setMarquee(null)
          if (!moved && !additive) setPicked({})
        }
        // 捕获阶段监听：宿主里有处理器会拦住冒泡的 mouseup。
        window.addEventListener('mousemove', onMove, true)
        window.addEventListener('mouseup', onUp, true)
        window.addEventListener('pointerup', onUp, true)
        window.addEventListener('blur', onUp)
        root.addEventListener('scroll', update)
      }
      var pickedRef = React.useRef(picked)
      pickedRef.current = picked
      var copyPickedRef = React.useRef(copyPicked)
      copyPickedRef.current = copyPicked
      React.useEffect(
        function () {
          var onKey = function (event) {
            var typing = event.target && event.target.closest && event.target.closest('input,textarea,[contenteditable="true"]')
            if ((event.ctrlKey || event.metaKey) && (event.key === 'a' || event.key === 'A') && !typing) {
              event.preventDefault()
              var selection = window.getSelection()
              if (selection) selection.removeAllRanges()
              pickAllRef.current()
              return
            }
            // 没有选中文字时浏览器不派发 copy 事件：有框选的气泡就自己触发复制。
            if ((event.ctrlKey || event.metaKey) && (event.key === 'c' || event.key === 'C') && !typing && Object.keys(pickedRef.current).length) {
              var current = window.getSelection()
              var root = contextRef.current
              if (!current || current.isCollapsed || !root || !root.contains(current.anchorNode)) {
                event.preventDefault()
                copyPickedRef.current()
              }
              return
            }
            if (event.key !== 'Escape') return
            // 先清掉选中，再按一次才关窗。
            if (Object.keys(pickedRef.current).length) {
              setPicked({})
              return
            }
            props.onClose()
          }
          // 捕获阶段：宿主会在冒泡阶段拦下 Ctrl+A / Ctrl+C。
          window.addEventListener('keydown', onKey, true)
          return function () {
            window.removeEventListener('keydown', onKey, true)
          }
        },
        [props.onClose],
      )
      React.useEffect(
        function () {
          var context = contextRef.current
          var anchor = questionRef.current
          if (!detail || !context || !anchor) return
          var contextRect = context.getBoundingClientRect()
          var anchorRect = anchor.getBoundingClientRect()
          // 让收藏条目的“起点”落在可视区中央，上方留出上下文；不要把整段长消息的中部居中。
          var target = context.scrollTop + (anchorRect.top - contextRect.top) - context.clientHeight / 2
          context.scrollTo({ top: Math.max(0, target), behavior: 'auto' })
        },
        [detail],
      )
      var dialog = h(
        'div',
        {
          className: '__rp_echoModalWrap',
          onMouseDown: function (event) {
            if (event.target === event.currentTarget) props.onClose()
          },
        },
        h(
          'div',
          {
            className: '__rp_echoModal',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': t('echoContext'),
            onMouseDown: function (event) {
              event.stopPropagation()
            },
          },
          h(
            'div',
            { className: '__rp_echoModalHead' },
            h(
              'div',
              { className: '__rp_echoModalHeading' },
              h(BookmarkIcon, { size: 16 }),
              h('span', { className: '__rp_echoModalTitle' }, item.sessionTitle || t('echoTitle')),
            ),
            h(
              'button',
              { type: 'button', className: '__rp_echoModalClose', autoFocus: true, 'aria-label': t('echoClose'), onClick: props.onClose },
              '✕',
            ),
          ),
          h(
            'div',
            { className: '__rp_echoModalMeta' },
            formatEchoWhen(item.anchorAt || item.updatedAt),
            ' · ',
            fill(t('echoFloor'), 'n', item.anchorFloor || 1),
            ' · ',
            full ? t('echoContextFull') : t('echoContextWindow'),
            item.pending ? ' · ' + fill(t('echoPendingTag'), 'n', item.pendingAfter) : null,
            sessionAlive
              ? full
                ? null
                : h(
                    'button',
                    {
                      type: 'button',
                      className: '__rp_linkBtn',
                      disabled: fullLoading,
                      onClick: props.onLoadFull,
                    },
                    fullLoading ? t('echoLoading') : t('echoLoadFull'),
                  )
              : h('span', { className: '__rp_echoGone' }, t('echoSessionGone')),
            sessionAlive && echoWorkspace
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: '__rp_linkBtn',
                    onClick: function () {
                      props.onClose()
                      openEchoAnchor(item)
                    },
                  },
                  t('echoOpenSession'),
                )
              : null,
            fullError ? h('span', { className: '__rp_echoGone' }, t('echoFullFailed')) : null,
            pickedCount
              ? h(
                  'span',
                  { className: '__rp_echoPickBar' },
                  copied ? fill(t('echoCopied'), 'n', copied) : fill(t('echoPicked'), 'n', pickedCount),
                  h('button', { type: 'button', className: '__rp_linkBtn', onClick: copyPicked }, t('echoCopyPicked')),
                  h('button', { type: 'button', className: '__rp_linkBtn', onClick: function () { setPicked({}) } }, t('echoClearPicked')),
                )
              : null,
          ),
          h(EchoScene, { key: 'scene:' + item.id, t: t, echoId: item.id }),
          h(
            'div',
            {
              className: '__rp_echoContext',
              ref: contextRef,
              tabIndex: -1,
              'data-marquee': marquee ? '1' : undefined,
              onMouseDown: onContextMouseDown,
              onCopy: function (event) {
                afterCopy(copyEchoSelection(event, contextRef.current, copyOpts))
              },
            },
            marquee
              ? h('div', {
                  className: '__rp_echoMarquee',
                  'aria-hidden': 'true',
                  style: { left: marquee.left + 'px', top: marquee.top + 'px', width: marquee.right - marquee.left + 'px', height: marquee.bottom - marquee.top + 'px' },
                })
              : null,
            !detail
              ? h(
                  'div',
                  { className: '__rp_echoModalHint', role: detailError ? 'alert' : 'status' },
                  detailError ? t('echoDetailFailed') : t('echoLoading'),
                )
              : h(
                  React.Fragment,
                  null,
                  h('div', { className: '__rp_echoContextLabel' }, t('echoContextStart') + ' · ' + t('echoPickHint')),
                  messages.map(function (message) {
                    var isAnchor = anchorQuestionId ? message.id === anchorQuestionId : message.id === anchorId
                    return h(
                      'div',
                      {
                        key: message.id,
                        className: '__rp_echoCtxMsg',
                        'data-role': message.role,
                        'data-anchor': isAnchor ? '1' : undefined,
                        'data-picked': picked[message.id] ? '1' : undefined,
                        ref: isAnchor ? questionRef : undefined,
                      },
                      h(
                        'div',
                        { className: '__rp_echoCtxRole' },
                        message.role === 'user' ? t('echoUser') : t('echoAssistant'),
                      ),
                      h('div', { className: '__rp_echoCtxText', 'data-msg-id': message.id }, echoReadable(message.text)),
                    )
                  }),
                ),
          ),
        ),
      )
      return portalToBody(dialog)
    }

    function EchoGroup(props) {
      var t = props.t
      var statePair = useEchoes()
      var state = statePair[0]
      var reload = statePair[1]
      var modalPair = React.useState(null)
      var modal = modalPair[0]
      var setModal = modalPair[1]
      var detailPair = React.useState(null)
      var detail = detailPair[0]
      var setDetail = detailPair[1]
      var queryPair = React.useState('')
      var query = queryPair[0]
      var setQuery = queryPair[1]
      var pendingOnlyPair = React.useState(false)
      var pendingOnly = pendingOnlyPair[0]
      var setPendingOnly = pendingOnlyPair[1]
      var fullPair = React.useState(false)
      var full = fullPair[0]
      var setFull = fullPair[1]
      var fullLoadingPair = React.useState(false)
      var fullLoading = fullLoadingPair[0]
      var setFullLoading = fullLoadingPair[1]
      var fullErrorPair = React.useState(false)
      var fullError = fullErrorPair[0]
      var setFullError = fullErrorPair[1]
      var detailErrorPair = React.useState(false)
      var detailError = detailErrorPair[0]
      var setDetailError = detailErrorPair[1]
      var openConvsPair = React.useState({})
      var openConvs = openConvsPair[0]
      var setOpenConvs = openConvsPair[1]
      var contextRequest = React.useRef(0)
      React.useEffect(function () {
        return function () {
          contextRequest.current += 1
        }
      }, [])

      function closeContext() {
        contextRequest.current += 1
        setModal(null)
        setDetail(null)
        setDetailError(false)
        setFull(false)
        setFullLoading(false)
        setFullError(false)
      }

      function toggleConv(sessionId) {
        setOpenConvs(function (previous) {
          var next = Object.assign({}, previous)
          next[sessionId] = !next[sessionId]
          return next
        })
      }

      var searchQuery = query.trim().toLowerCase()
      var visibleItems = state.items.filter(function (item) {
        if (pendingOnly && !item.pending) return false
        if (!searchQuery) return true
        return [item.sessionTitle, item.title, item.questionText, item.answerText, item.note, (item.tags || []).join(' ')]
          .join(' ')
          .toLowerCase()
          .indexOf(searchQuery) !== -1
      })

      function titleFor(item) {
        if (item.sessionId === props.sessionId && props.sessionTitle) return props.sessionTitle
        return item.sessionTitle || item.title || t('echoUntitled')
      }

      function openContext(item) {
        var request = ++contextRequest.current
        setModal(item)
        setDetail(null)
        setDetailError(false)
        setFull(false)
        setFullLoading(false)
        setFullError(false)
        fetch('/dsh-running-panel/echo?id=' + encodeURIComponent(item.id), { cache: 'no-store' })
          .then(function (response) {
            if (!response.ok) throw new Error('echo detail failed')
            return response.json()
          })
          .then(function (body) {
            if (request !== contextRequest.current) return
            setDetail(body && body.echo ? body.echo : null)
          })
          .catch(function () {
            if (request !== contextRequest.current) return
            // 以前这里只 setDetail(null)，弹窗会永远停在「加载中」。
            setDetail(null)
            setDetailError(true)
          })
      }

      function loadFullContext() {
        if (!modal || !modal.sessionAlive || fullLoading) return
        var request = ++contextRequest.current
        var itemId = modal.id
        setFullLoading(true)
        setFullError(false)
        fetch('/dsh-running-panel/echo?context=' + encodeURIComponent(modal.id), { cache: 'no-store' })
          .then(function (response) {
            if (!response.ok) throw new Error('echo context failed')
            return response.json()
          })
          .then(function (body) {
            if (request !== contextRequest.current) return
            setDetail({
                id: itemId,
                messages: Array.isArray(body.messages) ? body.messages : [],
                anchorMessageId: body.anchorMessageId,
            })
            setFull(true)
            setFullLoading(false)
          })
          .catch(function () {
            if (request !== contextRequest.current) return
            setFullError(true)
            setFullLoading(false)
          })
      }

      var confirmPair = React.useState(null)
      var confirmItem = confirmPair[0]
      var setConfirmItem = confirmPair[1]

      // 删除确认用面板内对话框：Electron 里系统 confirm 不可靠，也和面板风格割裂。
      function removeItem(item, event) {
        if (event) event.stopPropagation()
        setConfirmItem(item)
      }

      function confirmRemove(item) {
        setConfirmItem(null)
        fetch('/dsh-running-panel/echo?id=' + encodeURIComponent(item.id), { method: 'DELETE' })
          .then(function (response) {
            if (!response.ok) throw new Error('echo delete failed')
            if (modal && modal.id === item.id) setModal(null)
            reload()
          })
          .catch(function () {
            /* 下一轮刷新再说 */
          })
      }

      var groups = []
      visibleItems.forEach(function (item) {
        var group = groups.find(function (entry) {
          return entry.sessionId === item.sessionId
        })
        if (!group) {
          group = { sessionId: item.sessionId, title: titleFor(item), updatedAt: 0, sessionAlive: true, items: [] }
          groups.push(group)
        }
        group.items.push(item)
        group.updatedAt = Math.max(group.updatedAt, item.updatedAt || 0)
        group.sessionAlive = group.sessionAlive && item.sessionAlive !== false
        if (item.sessionId === props.sessionId && props.sessionTitle) group.title = props.sessionTitle
      })
      groups.sort(function (a, b) {
        return b.updatedAt - a.updatedAt
      })
      groups.forEach(function (group) {
        group.items.sort(function (a, b) {
          return (b.updatedAt || 0) - (a.updatedAt || 0)
        })
      })

      return h(
        React.Fragment,
        null,
        h(
          GroupSection,
          {
            id: 'echo',
            className: '__rp_group __rp_echoGroup',
            title: h(
              'span',
              { className: '__rp_echoGroupTitle' },
              h(BookmarkIcon, { size: 17 }),
              h('span', null, t('echoLibrary')),
            ),
            count: visibleItems.length,
            meta: h(
              'button',
              {
                type: 'button',
                className: '__rp_echoRefresh',
                title: t('echoRefresh'),
                'aria-label': t('echoRefresh'),
                onClick: reload,
              },
              '↻',
            ),
            body: h(
              'div',
              { className: '__rp_section' },
              state.capacity
                ? h('div', { className: '__rp_sheetHint' }, fill(fill(t('echoCapacity'), 'n', state.capacity.count), 'limit', state.capacity.limit))
                : null,
              h(
                'div',
                { className: '__rp_echoSearch' },
                h('input', {
                  type: 'search',
                  className: '__rp_echoSearchInput',
                  value: query,
                  placeholder: t('echoSearchPlaceholder'),
                  'aria-label': t('echoSearchPlaceholder'),
                  onChange: function (event) {
                    setQuery(event.target.value)
                  },
                }),
                h(
                  'button',
                  {
                    type: 'button',
                    className: '__rp_echoFilter',
                    'data-on': pendingOnly ? '1' : undefined,
                    'aria-pressed': pendingOnly ? 'true' : 'false',
                    title: t('echoPendingFilter'),
                    onClick: function () {
                      setPendingOnly(!pendingOnly)
                    },
                  },
                  t('echoPendingFilter'),
                ),
              ),
              state.loading
                ? h('div', { className: '__rp_sheetHint' }, t('echoLoading'))
                : groups.length
                  ? groups.map(function (group) {
                      var isOpen = Boolean(searchQuery || pendingOnly || openConvs[group.sessionId])
                      return h(
                        'div',
                        { key: group.sessionId, className: '__rp_echoConv' },
                        h(
                          'div',
                          { className: '__rp_echoConvHead' },
                          h(
                            'button',
                            {
                              type: 'button',
                              className: '__rp_echoConvToggle',
                              'aria-expanded': isOpen ? 'true' : 'false',
                              title: t(isOpen ? 'collapse' : 'expand'),
                              onClick: function () {
                                toggleConv(group.sessionId)
                              },
                            },
                            h('span', { className: '__rp_caret', 'aria-hidden': 'true' }, isOpen ? '▾' : '▸'),
                            h('span', { className: '__rp_echoConvTitle' }, group.title),
                            h('span', { className: '__rp_echoConvCount' }, String(group.items.length)),
                          ),
                          !group.sessionAlive
                            ? h('span', { className: '__rp_echoGone' }, t('echoSessionGone'))
                            : null,
                          group.sessionAlive && echoWorkspace
                            ? h(
                                'button',
                                {
                                  type: 'button',
                                  className: '__rp_echoConvOpen',
                                  title: t('echoOpenSession'),
                                  'aria-label': t('echoOpenSession'),
                                  onClick: function (event) {
                                    event.stopPropagation()
                                    openEchoAnchor(group.items[0])
                                  },
                                },
                                '↗',
                              )
                            : null,
                        ),
                        isOpen
                          ? group.items.map(function (item) {
                          return h(
                            'div',
                            {
                              key: item.id,
                              className: '__rp_echoCard',
                              role: 'button',
                              tabIndex: 0,
                              draggable: true,
                              title: t('echoDragTip'),
                              onDragStart: function (event) {
                                try {
                                  event.dataTransfer.effectAllowed = 'copy'
                                  event.dataTransfer.setData('text/plain', echoDragText(item))
                                  event.dataTransfer.setData('application/x-pulse-echo', item.id)
                                } catch (error) {
                                  /* 拖拽载荷不可用时仍可点开详情复制 */
                                }
                              },
                              'aria-label': t('echoOpenContext'),
                              onClick: function () {
                                openContext(item)
                              },
                              onKeyDown: function (event) {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault()
                                  openContext(item)
                                }
                              },
                            },
                            h(
                              'div',
                              { className: '__rp_echoCardHead' },
                              h('span', { className: '__rp_echoTime' }, formatEchoWhen(item.anchorAt || item.updatedAt)),
                              h(
                                'span',
                                { className: '__rp_echoMeta' },
                                fill(t('echoFloor'), 'n', item.anchorFloor || 1) +
                                  (item.pending ? ' · ' + fill(t('echoPendingTag'), 'n', item.pendingAfter) : ''),
                              ),
                              h(
                                'button',
                                {
                                  type: 'button',
                                  className: '__rp_echoDelete',
                                  onClick: function (event) {
                                    removeItem(item, event)
                                  },
                                },
                                t('echoDelete'),
                              ),
                            ),
                            h(
                              'div',
                              { className: '__rp_echoQA' },
                              h(
                                'div',
                                { className: '__rp_echoQ' },
                                h('span', { className: '__rp_echoRole' }, t('echoUser')),
                                h(
                                  'span',
                                  { className: '__rp_echoPreviewWrap' },
                                  h(
                                    'span',
                                    { className: '__rp_echoPreview' },
                                    echoReadable(item.questionText || t('echoNoQuestion')).slice(0, 1200),
                                  ),
                                ),
                              ),
                              h(
                                'div',
                                { className: '__rp_echoA' },
                                h('span', { className: '__rp_echoRole' }, t('echoAssistant')),
                                h(
                                  'span',
                                  { className: '__rp_echoPreviewWrap' },
                                  h(
                                    'span',
                                    { className: '__rp_echoPreview' },
                                    echoReadable(item.answerText || t('echoEmpty')).slice(0, 1200),
                                  ),
                                ),
                              ),
                            ),
                          )
                        }) : null,
                      )
                    })
                  : h(
                      'div',
                      { className: '__rp_sheetHint' },
                      searchQuery || pendingOnly ? t('echoNoMatch') : t('echoEmpty'),
                    ),
            ),
          },
        ),
        confirmItem
          ? h(ConfirmDialog, {
              t: t,
              title: t('echoDelete'),
              message: t('echoDeleteConfirm'),
              confirmLabel: t('echoDelete'),
              danger: true,
              onCancel: function () {
                setConfirmItem(null)
              },
              onConfirm: function () {
                confirmRemove(confirmItem)
              },
            })
          : null,
        modal
          ? h(EchoContextModal, {
              t: t,
              item: modal,
              detail: detail && detail.id === modal.id ? detail : null,
              full: full,
              fullLoading: fullLoading,
              fullError: fullError,
              detailError: detailError,
              sessionAlive: modal.sessionAlive !== false,
              onLoadFull: loadFullContext,
              onClose: closeContext,
            })
          : null,
      )
    }

    function SessionBoard(props) {
      var t = props.t
      var snapshot = props.snapshot
      var nodes = []
      nodes.push(storageWarning(snapshot, t))
      var phase = snapshot.session.phase
      var pinned = sortRunning(snapshot.running || [])
      var isPinned = function (item) {
        return Boolean(item && item.state && item.state.pinned)
      }
      var freeSkills = snapshot.skills.items.filter(function (item) {
        return !isPinned(item)
      })
      var categories = snapshot.categories || []
      var model = ringModel(categories)
      var tiltRef = React.useRef(null)
      useRingTilt(tiltRef)
      var dshGoal = useDshGoal(snapshot.session.id)
      var focusSince = prefs.focusMode === true ? goalFocusSince(dshGoal, snapshot.goal) : 0
      var searchPair = React.useState('')
      var query = searchPair[0]
      var setQuery = searchPair[1]
      var noticePair = React.useState('')
      var notice = noticePair[0]
      var setNotice = noticePair[1]
      var handleInsert = function (entry) {
        if (insertIntoComposer(composerToken(entry))) {
          setNotice('')
        } else {
          setNotice(t('insertFailed'))
        }
      }

      /* 预算方案：先 dryRun 看单，再确认应用；应用后可撤销一次。 */
      var planPair = React.useState(null)
      var planState = planPair[0]
      var setPlanState = planPair[1]
      var planBody = function (extra) {
        return Object.assign(
          {
            sessionId: snapshot.session.id || '',
            pins: prefs.pins,
            limitTokens: budgetLimitTokens(),
          },
          extra || {},
        )
      }
      var openPlan = function () {
        setPlanState({ status: 'loading' })
        fetch('/dsh-running-panel/optimize', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(planBody({ dryRun: true })),
        })
          .then(function (response) {
            if (!response.ok) throw new Error('plan')
            return response.json()
          })
          .then(function (plan) {
            if (!plan || !plan.id) throw new Error('plan')
            setPlanState({ status: 'ready', plan: plan })
          })
          .catch(function () {
            setPlanState({ status: 'error' })
          })
      }
      var openSavedUndo = function () {
        var saved = snapshot.undoPlan
        if (!saved || !saved.id || !Array.isArray(saved.applied) || !saved.applied.length) return
        setPlanState({ status: 'applied', plan: saved, moved: saved.applied.length })
      }
      var planAction = function (extra, done) {
        var state = planState
        if (!state || !state.plan) return
        setPlanState({ status: 'applying', plan: state.plan, undoing: extra && extra.undo === true, moved: state.moved })
        fetch('/dsh-running-panel/optimize', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(planBody(Object.assign({ planId: state.plan.id }, extra || {}))),
        })
          .then(function (response) {
            if (!response.ok) throw new Error('plan action')
            return response.json()
          })
          .then(function (value) {
            done(value && value.ok === true, state.plan, value)
          })
          .catch(function () {
            done(false, state.plan)
          })
      }
      var applyPlan = function (names) {
        planAction({ park: Array.isArray(names) ? names : [] }, function (ok, plan, value) {
          var movedNames = value && Array.isArray(value.movedNames)
            ? value.movedNames
            : (Array.isArray(names) ? names.slice(0, (value && value.moved) || 0) : [])
          var applied = Array.from(new Set((plan.applied || []).concat(movedNames)))
          setPlanState(
            ok || (value && value.moved > 0)
              ? { status: 'applied', plan: Object.assign({}, plan, { applied: applied }), moved: applied.length, failedNames: (value && value.failed) || [] }
              : { status: 'failed', plan: plan },
          )
        })
      }
      var undoPlan = function () {
        planAction({ undo: true }, function (ok, plan, value) {
          var restored = value && Array.isArray(value.movedNames) ? value.movedNames : []
          var remaining = Array.isArray(plan.applied)
            ? plan.applied.filter(function (name) { return restored.indexOf(name) === -1 })
            : null
          setPlanState(ok ? null : {
            status: 'applied', plan: remaining ? Object.assign({}, plan, { applied: remaining }) : plan, undoFailed: true,
            moved: remaining && Array.isArray(value && value.movedNames)
              ? remaining.length
              : Math.max(0, (planState.moved || 0) - ((value && value.moved) || 0)),
            failedNames: (value && value.failed) || [],
          })
        })
      }
      if (planState && planState.plan) {
        nodes.push(
          h(BudgetPlanDialog, {
            key: planState.plan.id + ':' + JSON.stringify(planState.plan.applied || []),
            t: t,
            plan: planState.plan,
            busy: planState.status === 'applying',
            applied: planState.status === 'applied' || (planState.status === 'applying' && planState.undoing),
            moved: planState.moved || 0,
            failedNames: planState.failedNames || [],
            failed: planState.status === 'failed',
            undoFailed: planState.undoFailed === true,
            onApply: applyPlan,
            onUndo: undoPlan,
            onClose: function () {
              setPlanState(null)
            },
          }),
        )
      } else if (planState && planState.status === 'error') {
        nodes.push(h('div', { key: 'plan-error', className: '__rp_planError' }, t('planFailed')))
      }

      // 搜索：多关键词并集；一有查询就把下面所有分区（含英雄区）让位给结果。
      nodes.push(
        h(SearchBar, {
          key: 'search',
          t: t,
          value: query,
          onChange: function (value) {
            setNotice('')
            setQuery(value)
          },
        }),
      )
      if (query.trim()) {
        nodes.push(
          h(SearchResults, {
            key: 'search-results',
            t: t,
            results: searchEntries(buildSearchEntries(snapshot), query),
            onInsert: handleInsert,
            notice: notice,
          }),
        )
        return h(React.Fragment, null, nodes)
      }

      // 第一次用：后台模型调用要先征得同意（决定之后这块不再出现）。
      nodes.push(h(ModelConsent, { key: 'consent', t: t }))

      // 目标条：一行，点开是抽屉。在圆盘上方，先回答「现在该看什么」。
      nodes.push(
        h(GoalBar, {
          key: 'goal',
          t: t,
          sessionId: snapshot.session.id,
          sessionTitle: snapshot.session.title,
          goal: snapshot.goal,
          dsh: dshGoal,
          proposal: snapshot.goalProposal,
          ideas: snapshot.ideas,
          phase: phase,
          round: snapshot.session.round,
        }),
      )

      // 顶部英雄区：大圆盘居中，鼠标在面板里时按指针位置轻微倾斜。
      nodes.push(
        h(
          'div',
          { className: '__rp_hero', key: 'hero' },
          h(
            'div',
            { className: '__rp_heroTop' },
            h('span', { className: '__rp_heroCap' }, t('heroCaption')),
            h(
              'button',
              {
                type: 'button',
                className: '__rp_themeBtn',
                title: effectiveScheme() === 'light' ? t('themeDark') : t('themeLight'),
                'aria-label': effectiveScheme() === 'light' ? t('themeDark') : t('themeLight'),
                'data-scheme': effectiveScheme(),
                onClick: function () {
                  setPanelScheme(effectiveScheme() === 'light' ? 'dark' : 'light')
                },
                style: {
                  border: '1px solid var(--dsw-alias-border-l2)',
                  background: 'transparent',
                  color: 'var(--rp-amber)',
                  borderRadius: '4px',
                  minWidth: '26px',
                  minHeight: '26px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0',
                  cursor: 'pointer',
                  lineHeight: 1,
                },
              },
              effectiveScheme() === 'light' ? h(MoonIcon) : h(SunIcon),
            ),
            h(
              'button',
              {
                type: 'button',
                title: t('settingsTitle'),
                'aria-label': t('settingsTitle'),
                onClick: function () {
                  uiStore.set(!uiStore.open)
                },
                style: {
                  border: '1px solid var(--dsw-alias-border-l2)',
                  background: 'transparent',
                  color: 'var(--dsw-alias-label-secondary)',
                  borderRadius: '4px',
                  fontSize: '13px',
                  padding: '4px 7px',
                  minWidth: '26px',
                  minHeight: '26px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  lineHeight: 1.2,
                },
              },
              '⚙',
            ),
              h(SettingsHost, { t: t }),
              h(
                'span',
                { className: '__rp_chip', 'data-phase': phase },
                phaseLabel(t, phase),
                snapshot.session.round
                  ? h('span', { className: '__rp_chipRound' }, ' · ' + fill(t('round'), 'n', snapshot.session.round))
                  : null,
              ),
          ),
          h(
            'div',
            { className: '__rp_heroRow __rp_heroTilt', ref: tiltRef },
            h(
              'div',
              { className: '__rp_side __rp_sideLeft' },
              h('div', { className: '__rp_sideLabel' }, t('ringTitle')),
              h(RingLegend, { t: t, categories: categories, model: model }),
            ),
            h(
              'div',
              { className: '__rp_heroRing' },
              h(RingSvg, { t: t, categories: categories, model: model, size: 224, active: phase === 'active', phase: phase, sound: true, intro: props.reveal === true, budget: snapshot.budget ? Object.assign({}, snapshot.budget, { limit: budgetLimitChars() }) : null }),
            ),
            snapshot.budget
              ? h(
                  'div',
                  { className: '__rp_side __rp_sideRight', title: t('budgetTip') },
                  h('div', { className: '__rp_sideLabel' }, t('budgetLabel')),
                  h(
                    'div',
                    { className: '__rp_sideValue' },
                    Math.min(999, Math.round((snapshot.budget.chars / budgetLimitChars()) * 100)) + '%',
                  ),
                  h(
                    'div',
                    { className: '__rp_sideSub' },
                    formatTokens(Math.round(snapshot.budget.chars / 4)) + ' / ' + formatTokens(budgetLimitTokens()),
                  ),
                  // 技能装配：战术风格装配窗口（配置页签、预算条、磁贴、详情、预演应用）。
                  h(LoadoutButton, { t: t, sessionId: snapshot.session.id }),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: '__rp_optimize',
                      title: t('optimizeTip'),
                      onClick: openPlan,
                    },
                    t('optimize'),
                  ),
                  snapshot.undoPlan && Array.isArray(snapshot.undoPlan.applied) && snapshot.undoPlan.applied.length > 0
                    ? h(
                        'button',
                        {
                          type: 'button',
                          className: '__rp_optimize',
                          title: t('planRecoverUndoTip'),
                          disabled: Boolean(planState && planState.status === 'applying'),
                          onClick: openSavedUndo,
                        },
                        t('planRecoverUndo'),
                      )
                    : null,
                )
              : null,
          ),
          snapshot.context || (snapshot.tokens && (snapshot.tokens.roundInput || snapshot.tokens.roundOutput))
            ? h(
                'div',
                { className: '__rp_telemetry', key: 'telemetry' },
                snapshot.context
                  ? h(
                      'div',
                      { className: '__rp_telemetryCard', title: t('contextTip') },
                      h(
                        'div',
                        { className: '__rp_telemetryHead' },
                        h('span', { className: '__rp_telemetryKicker' }, 'CONTEXT'),
                        h('span', { className: '__rp_telemetryName' }, t('contextLabel')),
                        h(
                          'span',
                          { className: '__rp_telemetryValue' },
                          snapshot.context.pct != null ? snapshot.context.pct + '%' : t('contextUnknown'),
                        ),
                      ),
                      h(
                        'div',
                        { className: '__rp_telemetryBar' },
                        h('i', {
                          style: {
                            width: (snapshot.context.pct != null ? Math.min(100, snapshot.context.pct) : 0) + '%',
                          },
                        }),
                      ),
                      h(
                        'div',
                        { className: '__rp_telemetryFoot' },
                        formatTokens(snapshot.context.pressureTokens) +
                          ' / ' +
                          formatTokens(snapshot.context.contextWindow) +
                          ' tokens',
                      ),
                    )
                  : null,
                snapshot.tokens && (snapshot.tokens.roundInput || snapshot.tokens.roundOutput)
                  ? h(
                      'div',
                      { className: '__rp_telemetryCard', title: t('tokenTip') },
                      h(
                        'div',
                        { className: '__rp_telemetryHead' },
                        h('span', { className: '__rp_telemetryKicker' }, 'ROUND I/O'),
                        h('span', { className: '__rp_telemetryName' }, t('tokenRound')),
                        h(
                          'span',
                          { className: '__rp_telemetryValue' },
                          formatTokens(snapshot.tokens.roundInput) +
                            ' / ' +
                            formatTokens(snapshot.tokens.roundOutput),
                        ),
                      ),
                      h(
                        'div',
                        { className: '__rp_telemetryIO' },
                        h('span', { className: '__rp_telemetryIOKey' }, 'IN'),
                        h('b', null, formatTokens(snapshot.tokens.roundInput)),
                        h('span', { className: '__rp_telemetryIOKey' }, 'OUT'),
                        h('b', null, formatTokens(snapshot.tokens.roundOutput)),
                      ),
                    )
                  : null,
              )
            : null,
        ),
      )

      // 诊断：可能卡住的信号排在最前面，因为它是唯一“需要你现在处理”的信息。
      if (snapshot.alerts && snapshot.alerts.length) {
        nodes.push(
          h(
            'section',
            { className: '__rp_group __rp_alerts', key: 'alerts' },
            h(
              'div',
              { className: '__rp_groupHead' },
              h('h3', { className: '__rp_groupTitle' }, t('alertsTitle')),
              h('span', { className: '__rp_groupCount' }, String(snapshot.alerts.length)),
            ),
            h(
              'div',
              { className: '__rp_section' },
              snapshot.alerts.map(function (alert) {
                var template = alert.kind === 'errors' ? t('alertErrors') : t('alertRepeat')
                var text = fill(fill(template, 'tool', nameOf('tool', alert.tool)), 'n', alert.count)
                return h(
                  'div',
                  { key: alert.kind + ':' + alert.tool, className: '__rp_alertRow' },
                  h('span', { className: '__rp_warnTag', 'aria-hidden': 'true' }, '!'),
                  h('span', null, text),
                )
              }),
            ),
          ),
        )
      }

      // 成本估算：明确标注是提示词估算，不是供应商账单。
      if (snapshot.cost && snapshot.cost.top && snapshot.cost.top.length) {
        nodes.push(
          h(GroupSection, {
            key: 'cost',
            id: 'cost',
            t: t,
            defaultOpen: false,
            title: t('costTitle'),
            count:
              fill(t('costTotal'), 'n', formatTokens(snapshot.cost.totalTokens)) +
              (prefs.pricing.inputPerM > 0
                ? ' · ≈¥' + formatRmb((snapshot.cost.totalTokens / 1000000) * prefs.pricing.inputPerM) + ' ' + t('costRmbTip')
                : ' · ' + t('costRmbUnset')),
            body: h(
              'div',
              { className: '__rp_section' },
              h('div', { className: '__rp_sheetHint' }, t('costHint')),
              snapshot.cost.top.map(function (row) {
                return h(
                  'div',
                  { key: row.kind + ':' + row.name, className: '__rp_row', 'data-state': 'idle' },
                  h('span', { className: '__rp_dot', 'aria-hidden': 'true' }),
                  h('span', { className: '__rp_name' }, nameOf(row.kind, row.name)),
                  h('span', { className: '__rp_costTag', title: t('costRowTip') }, '~' + formatTokens(row.tokens) + ' tok'),
                  h('span', { className: '__rp_rowMeta' }, row.kind === 'skill' ? t('costKindSkill') : t('costKindTool')),
                )
              }),
            ),
          }),
        )
      }

      // 置顶区：技能与工具混排，谁被调用过就浮到这里；回合结束变淡，4 轮没再调用回落原分组。
      if (pinned.length) {
        nodes.push(
          h(GroupSection, {
            key: 'running',
            id: 'running',
            t: t,
            className: '__rp_group __rp_pinned',
            title: t('runningSection'),
            count: pinned.length,
            meta: h('span', { className: '__rp_groupTags' }, tagSummaryOf(t, pinned)),
            body: h(
              'div',
              { className: '__rp_section' },
              pinned.map(function (entry) {
                var record = entry.state || {}
                var stateName = record.round ? (phase === 'spent' ? 'spent' : 'active') : 'spent'
                var meta = record.round ? fill(t('roundCount'), 'n', record.round) : ''
                if (record.total > (record.round || 0)) {
                  meta += (meta ? ' · ' : '') + fill(t('totalCount'), 'n', record.total)
                }
                if (record.lastMs) meta += (meta ? ' · ' : '') + formatMs(record.lastMs)
                if (record.at) meta += (meta ? ' · ' : '') + fill(t('lastAt'), 't', formatTime(record.at))
                var hint =
                  record.misses > 0
                    ? fill(t('fadingTip'), 'n', Math.max(0, PIN_LIMIT - record.misses))
                    : t('runningHint')
                return h(
                  'div',
                  {
                    key: entry.kind + ':' + entry.name,
                    className: '__rp_row',
                    'data-state': stateName,
                    'data-warn': record.error ? '1' : undefined,
                    style: { opacity: fadeOf(record.misses, !record.round || phase === 'spent') },
                    title: hint,
                  },
                  h('span', { className: '__rp_dot', 'aria-hidden': 'true' }),
                  h('span', { className: '__rp_name' }, nameOf(entry.kind, entry.name)),
                  altNameOf(entry.kind, entry.name)
                    ? h('span', { className: '__rp_nameAlt' }, altNameOf(entry.kind, entry.name))
                    : null,
                  h('span', { className: '__rp_rowMeta' }, meta),
                )
              }),
            ),
          }),
        )
      }

      nodes.push(
        h(GroupSection, {
          key: 'skills',
          id: 'skills',
          t: t,
          title: t('skills'),
          count: snapshot.skills.count,
          meta: [
            snapshot.skills.items.length
              ? h('span', { key: 'tags', className: '__rp_groupTags' }, tagSummary(t, 'skill', snapshot.skills.items))
              : null,
            snapshot.skills.observable
              ? null
              : h('span', { key: 'unobs', className: '__rp_unobservable' }, t('unobservable')),
          ],
          body: h(
            'div',
            { className: '__rp_section' },
            freeSkills.length
              ? bucketByLib('skill', freeSkills).map(function (bucket) {
                  return h(LibraryGroup, {
                    key: bucket.lib,
                    t: t,
                    kind: 'skill',
                    lib: bucket.lib,
                    items: bucket.items,
                    phase: phase,
                  })
                })
              : snapshot.skills.items.length
                ? null
                : h('span', { className: '__rp_empty' }, t('emptyGroup')),
          ),
        }),
      )

      nodes.push(
        h(GroupSection, {
          key: 'tools',
          id: 'tools',
          t: t,
          title: t('tools'),
          count: snapshot.tools.total,
          meta: snapshot.tools.observable ? null : h('span', { className: '__rp_unobservable' }, t('unobservable')),
          body: snapshot.tools.groups.map(function (group) {
            var items = group.items.filter(function (item) {
              return !isPinned(item)
            })
            return h(
              'div',
              { className: '__rp_section', key: group.id },
              h(
                'div',
                { className: '__rp_sectionTitle' },
                groupTitle(t, group) + ' · ' + String(group.items.length),
                group.items.length ? h('span', { className: '__rp_groupTags' }, '  ' + tagSummary(t, 'tool', group.items)) : null,
              ),
              items.length
                ? bucketByLib('tool', items).map(function (bucket) {
                    return h(LibraryGroup, {
                      key: bucket.lib,
                      t: t,
                      kind: 'tool',
                      lib: bucket.lib,
                      items: bucket.items,
                      phase: phase,
                    })
                  })
                : null,
            )
          }),
        }),
      )

      nodes.push(
        h(GroupSection, {
          key: 'agents',
          id: 'agents',
          t: t,
          title: t('agents'),
          meta: snapshot.agents.observable ? null : h('span', { className: '__rp_unobservable' }, t('unobservable')),
          body: [
            h(
              'div',
              { className: '__rp_section', key: 'persona' },
              h('div', { className: '__rp_sectionTitle' }, t('persona')),
              h(
                'div',
                { className: '__rp_row', 'data-state': snapshot.agents.persona.observable ? 'active' : 'idle' },
                h('span', { className: '__rp_dot', 'aria-hidden': 'true' }),
                h('span', { className: '__rp_name' }, snapshot.agents.persona.label || t('noPersona')),
                h(
                  'span',
                  { className: '__rp_desc' },
                  snapshot.agents.persona.preset
                    ? fill(t('agentPresetLine'), 'x', snapshot.agents.persona.preset)
                    : snapshot.agents.persona.source || '',
                ),
              ),
            ),
            soulScope
              ? h(SoulPersonaBlock, {
                  key: 'soul',
                  t: t,
                  scope: soulScope,
                  sessionId: snapshot.session.id,
                })
              : null,
            h(
              'div',
              { className: '__rp_section', key: 'subagents' },
              h('div', { className: '__rp_sectionTitle' }, t('subagents') + ' · ' + String(snapshot.agents.children.length)),
              snapshot.agents.children.length
                ? snapshot.agents.children.map(function (child) {
                    return h(ChildNode, { key: child.id, t: t, child: child })
                  })
                : h('span', { className: '__rp_empty' }, t('noSubagents')),
            ),
          ],
        }),
      )


      // 冷层：已停用的技能可以在这里一键移回来（预算会随之上升）。
      if (snapshot.cold && snapshot.cold.items && snapshot.cold.items.length) {
        nodes.push(
          h(GroupSection, {
            key: 'cold',
            id: 'cold',
            t: t,
            title: t('coldTitle'),
            count: String(snapshot.cold.count) + ' · ' + String(snapshot.cold.chars) + ' 字符',
            body: h(
              'div',
              { className: '__rp_section' },
              bucketByLib('skill', snapshot.cold.items).map(function (bucket) {
                return h(ColdGroup, { key: bucket.lib, t: t, lib: bucket.lib, items: bucket.items })
              }),
            ),
          }),
        )
      }

      // 历史：落盘后的跨会话累计，重启不丢。按安装批次分组，每行直接显示累计次数与工时占比。
      if (snapshot.history && snapshot.history.top && snapshot.history.top.length) {
        nodes.push(
          h(GroupSection, {
            key: 'history',
            id: 'history',
            t: t,
            title: t('historyTitle'),
            count: fill(t('historySince'), 'd', dateOnly(snapshot.history.since)),
            body: h(HistoryGroups, { t: t, rows: snapshot.history.top }),
          }),
        )
      }

      // 自动提议收藏：没有提议时不渲染。
      nodes.push(
        h(EchoSuggestions, {
          key: 'echo-suggest',
          t: t,
          sessionId: snapshot.session.id,
          phase: phase,
          round: snapshot.session.round,
        }),
      )

      nodes.push(
        h(EchoGroup, {
          key: 'echo',
          t: t,
          sessionId: snapshot.session.id,
          sessionTitle: snapshot.title,
        }),
      )

      return h(FocusContext.Provider, { value: focusSince }, nodes)
    }

    /* ── 来源库折叠 ──────────────────────────────────────────────────── */

    function SunIcon() {
      return h(
        'svg',
        { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', 'aria-hidden': 'true' },
        h('circle', { cx: 12, cy: 12, r: 4, stroke: 'currentColor', strokeWidth: 1.8 }),
        h('path', {
          d: 'M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
        }),
      )
    }

    function MoonIcon() {
      return h(
        'svg',
        { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', 'aria-hidden': 'true' },
        h('path', {
          d: 'M20 15.6A8.2 8.2 0 0 1 8.4 4a8.3 8.3 0 1 0 11.6 11.6Z',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinejoin: 'round',
        }),
      )
    }

    function RepoIcon() {
      return h(
        'svg',
        {
          className: '__rp_repoIcon',
          viewBox: '0 0 24 24',
          fill: 'none',
          'aria-hidden': 'true',
        },
        h('path', {
          d: 'M3.2 6.6h5.2l1.8 2.1h9.6v10.2H3.2Z',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinejoin: 'round',
        }),
        h('circle', { cx: 8.7, cy: 13.1, r: 1.7, stroke: 'currentColor', strokeWidth: 1.6 }),
        h('circle', { cx: 15.2, cy: 15.3, r: 1.7, stroke: 'currentColor', strokeWidth: 1.6 }),
        h('path', {
          d: 'M10.4 13.1l3.1 2.2M15.8 9.1l5-5M17.7 4.1h3.1v3.1',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )
    }

    function RepoButton(props) {
      var label = props.t('openRepo')
      return h(
        'a',
        {
          className: '__rp_repoBtn',
          href: props.href,
          target: '_blank',
          rel: 'noreferrer noopener',
          title: label + ' · ' + props.href,
          'aria-label': label,
          onClick: function (event) {
            event.stopPropagation()
          },
        },
        h(RepoIcon),
        h('span', { className: '__rp_repoText' }, props.t('repoShort')),
      )
    }

    /**
     * 同一个库的多项折叠成一行（Chrome DevTools · 32 项），点开才看单项。
     * 只有一项的库不套这一层，直接渲染能力行 —— 否则会多出一层没有意义的层级。
     */
    function LibraryGroup(props) {
      var t = props.t
      var items = props.items
      var phase = props.phase
      usePrefs()
      // 专注模式：组里没有一项在目标开始后被调用过，组标题也一起变淡（折叠时才看得出）。
      var focusSince = React.useContext(FocusContext)
      var libUnfocused = focusSince > 0 && !items.some(function (item) {
        return goalRelevant(item.state, focusSince)
      })
      var libPinned = props.kind === 'skill' && isPinnedLib(props.lib)
      var libMenu = useLibMenu(t, props.kind, props.lib)
      var foldId = 'lib:' + props.kind + ':' + props.lib
      var initialOpen = typeof prefs.folds[foldId] === 'boolean' ? prefs.folds[foldId] : false
      var pair = React.useState(initialOpen)
      var open = pair[0]
      var setOpen = pair[1]
      var expandedPair = React.useState(false)
      var expanded = expandedPair[0]
      var setExpanded = expandedPair[1]
      var busyPair = React.useState(false)
      var busy = busyPair[0]
      var setBusy = busyPair[1]
      var failPair = React.useState(false)
      var failed = failPair[0]
      var setFailed = failPair[1]
      var skippedPair = React.useState([])
      var skipped = skippedPair[0]
      var setSkipped = skippedPair[1]
      var aliveRef = React.useRef(true)
      React.useEffect(function () {
        return function () {
          aliveRef.current = false
        }
      }, [])

      var parkable = items.filter(function (item) {
        return item.parkable === true
      })

      var parkAll = function () {
        if (busy || !parkable.length) return
        setBusy(true)
        setFailed(false)
        setSkipped([])
        var names = parkable.map(function (item) {
          return item.name
        })
        var index = 0
        var skippedNow = []
        var step = function () {
          if (!aliveRef.current) return
          if (index >= names.length) {
            setBusy(false)
            setSkipped(skippedNow)
            return
          }
          var name = names[index]
          index += 1
          fetch('/dsh-running-panel/park', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: name, action: 'park', sessionId: sessionStore.id || '' }),
          })
            .then(function (response) {
              // 别的会话正在用的：整库停用时跳过（不强停），结束后列出来。
              if (response.status === 409) {
                return response.json().catch(function () { return {} }).then(function (value) {
                  if (!value || value.error !== 'in-use') throw new Error('park')
                  skippedNow.push(name)
                  return step()
                })
              }
              if (!response.ok) throw new Error('park')
              return step()
            })
            .catch(function () {
              if (!aliveRef.current) return
              setFailed(true)
              setBusy(false)
            })
        }
        step()
      }

      // 工具少于 4 项不值得多一层，直接平铺；技能按安装批次分组，
      // 只要不是孤零零一个就保留组标题——组名就是「这是哪次装的」的记忆锚点。
      if (items.length < (props.kind === 'skill' ? 2 : 4)) {
        return items.map(function (item) {
          return h(CapabilityRow, {
            key: item.name,
            t: t,
            kind: props.kind,
            lib: props.lib,
            repoUrl: item.repoUrl,
            parkable: item.parkable,
            name: item.name,
            label: nameOf(props.kind, item.name),
            alt: altNameOf(props.kind, item.name),
            description: item.description,
            tokens: item.tokens,
            state: item.state,
            phase: phase,
          })
        })
      }

      var active = items.reduce(function (sum, item) {
        return sum + ((item.state && item.state.round) || 0)
      }, 0)

      return h(
        'div',
        { className: '__rp_lib' },
        h(
          'div',
          { className: '__rp_libRow', 'data-unfocused': libUnfocused ? '1' : undefined },
          h(
            'button',
            {
              type: 'button',
              className: '__rp_libToggle',
              'data-active': active > 0 ? '1' : undefined,
              'aria-expanded': open ? 'true' : 'false',
              title: libTip(t, props.lib, items.length) || undefined,
              onContextMenu: libMenu[0],
              onClick: function (event) {
                var next = !open
                sfxFor(event, next ? 'expand' : 'collapse')
                setOpen(next)
                setFold(foldId, next)
              },
            },
            h('span', { className: '__rp_caret', 'aria-hidden': 'true' }, open ? '▾' : '▸'),
            h('span', { className: '__rp_libName' }, libLabel(props.lib)),
            h('span', { className: '__rp_libCount' }, fill(t('libCount'), 'n', items.length)),
            active ? h('span', { className: '__rp_rowMeta' }, fill(t('roundCount'), 'n', active)) : null,
          ),
          props.kind === 'skill'
            ? h(
                'button',
                {
                  type: 'button',
                  className: '__rp_libPin',
                  'data-on': libPinned ? '1' : undefined,
                  'aria-pressed': libPinned ? 'true' : 'false',
                  'aria-label': libPinned ? t('unpinLib') : t('pinLib'),
                  title: libPinned ? t('unpinLibTip') : t('pinLibTip'),
                  onClick: function (event) {
                    event.stopPropagation()
                    togglePin('lib', props.lib)
                  },
                },
                libPinned ? '★' : '☆',
              )
            : null,
          sourceOf(props.lib)
            ? h(RepoButton, { t: t, href: sourceOf(props.lib) })
            : null,
          props.kind === 'skill' && props.lib === 'user'
            ? h(
                'button',
                {
                  type: 'button',
                  className: '__rp_libRestore __rp_libDir',
                  'aria-label': t('openSkillsDir'),
                  title: t('openSkillsDirTip'),
                  onClick: function (event) {
                    event.stopPropagation()
                    fetch('/dsh-running-panel/reveal', {
                      method: 'POST',
                      keepalive: true,
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ kind: 'root' }),
                    }).catch(function () {})
                  },
                },
                t('openSkillsDir'),
              )
            : null,
          parkable.length
            ? h(
                'button',
                {
                  type: 'button',
                  className: '__rp_libPark',
                  'aria-label': t('parkLib'),
                  'data-failed': failed ? '1' : undefined,
                  disabled: busy,
                  title: failed ? t('parkLibFailed') : t('parkLibTip'),
                  onClick: parkAll,
                },
                busy ? t('parkingLib') : t('parkLib'),
              )
            : null,
        ),
        skipped.length
          ? h(
              'div',
              { className: '__rp_libSkipped', role: 'status', style: { fontSize: '12px', color: 'var(--dsw-alias-state-warn-primary)', padding: '2px 0 4px 22px' } },
              fill(t('parkSkippedInUse'), 'names', skipped.map(function (name) { return nameOf('skill', name) || name }).join('、')),
            )
          : null,
        open
          ? h(
              'div',
              { className: '__rp_libBody' },
              (expanded ? items : items.slice(0, 30)).map(function (item) {
                return h(CapabilityRow, {
                  key: item.name,
                  t: t,
                  kind: props.kind,
                  lib: props.lib,
                  repoUrl: item.repoUrl,
                  parkable: item.parkable,
                  name: item.name,
                  label: nameOf(props.kind, item.name),
                  alt: altNameOf(props.kind, item.name),
                  description: item.description,
                  tokens: item.tokens,
                  state: item.state,
                  phase: phase,
                })
              }),
              items.length > 30
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: '__rp_libMore',
                      onClick: function () {
                        setExpanded(!expanded)
                      },
                    },
                    expanded ? t('collapseRows') : fill(t('showAllRows'), 'n', items.length),
                  )
                : null,
            )
          : null,
        libMenu[1][0],
        libMenu[1][1],
        open
          ? null
          : null,
      )
    }

    /** 历史常用的一行：名字 + 「×次数 · 工时 p%」，完整口径放在悬停说明里。 */
    function historyMeta(t, row) {
      var timeText =
        row.timeShare == null
          ? t('historyUnmeasured')
          : row.timeShare === 0 && row.ms > 0
            ? t('timeShareUnder')
            : fill(t('timeShare'), 'p', row.timeShare)
      var full =
        fill(t('totalCount'), 'n', row.n) +
        (row.share != null ? ' · ' + fill(t('historyShare'), 'p', row.share) : '') +
        (row.ms ? ' · ' + formatMs(row.ms) : '') +
        ' · ' +
        timeText
      var short =
        row.timeShare == null
          ? ''
          : row.timeShare === 0
            ? row.ms > 0 ? t('historyTimeUnder') : ''
            : fill(t('historyTimeShort'), 'p', row.timeShare)
      return { full: full, count: fill(t('historyRowMeta'), 'n', row.n), time: short }
    }

    function HistoryRow(props) {
      var t = props.t
      var row = props.row
      var parts = String(row.key).split(':')
      var kind = parts[0] === 'skill' ? 'skill' : 'tool'
      var name = parts.slice(1).join(':')
      var meta = historyMeta(t, row)
      return h(
        'div',
        { className: '__rp_row __rp_historyRow', 'data-state': 'idle', title: meta.full + ' · ' + t('historyTimeTip') },
        h('span', { className: '__rp_name' }, nameOf(kind, name)),
        altNameOf(kind, name) ? h('span', { className: '__rp_nameAlt' }, altNameOf(kind, name)) : null,
        h(
          'span',
          { className: '__rp_rowMeta' },
          meta.count,
          meta.time ? h('span', { className: '__rp_histShare' }, ' · ' + meta.time) : null,
        ),
      )
    }

    function HistoryLib(props) {
      var t = props.t
      var libMenu = useLibMenu(t, 'skill', props.lib)
      var foldId = 'history:' + props.lib
      var initialOpen = typeof prefs.folds[foldId] === 'boolean' ? prefs.folds[foldId] : props.defaultOpen
      var pair = React.useState(initialOpen)
      var open = pair[0]
      var setOpen = pair[1]
      var total = props.rows.reduce(function (sum, row) {
        return sum + (row.n || 0)
      }, 0)
      var share = props.rows.reduce(function (sum, row) {
        return sum + (row.timeShare || 0)
      }, 0)
      return h(
        'div',
        { className: '__rp_lib' },
        h(
          'div',
          { className: '__rp_libRow' },
          h(
            'button',
            {
              type: 'button',
              className: '__rp_libToggle',
              'aria-expanded': open ? 'true' : 'false',
              title: libTip(t, props.lib, 0) || undefined,
              onContextMenu: libMenu[0],
              onClick: function (event) {
                var next = !open
                sfxFor(event, next ? 'expand' : 'collapse')
                setOpen(next)
                setFold(foldId, next)
              },
            },
            h('span', { className: '__rp_caret', 'aria-hidden': 'true' }, open ? '▾' : '▸'),
            h('span', { className: '__rp_libName' }, libLabel(props.lib)),
            h(
              'span',
              { className: '__rp_libCount' },
              fill(t('historyGroupMeta'), 'n', total) + (share ? ' · ' + fill(t('historyTimeShort'), 'p', share) : ''),
            ),
          ),
        ),
        open
          ? h(
              'div',
              { className: '__rp_libBody' },
              props.rows.map(function (row) {
                return h(HistoryRow, { key: row.key, t: t, row: row })
              }),
            )
          : null,
        libMenu[1][0],
        libMenu[1][1],
      )
    }

    /** 历史常用按安装批次分组；组按累计次数排序，排第一的组默认展开。 */
    function HistoryGroups(props) {
      var t = props.t
      var map = {}
      var order = []
      ;(props.rows || []).slice(0, 40).forEach(function (row) {
        var parts = String(row.key).split(':')
        var kind = parts[0] === 'skill' ? 'skill' : 'tool'
        var lib = libOfItem(kind, parts.slice(1).join(':'))
        if (!map[lib]) {
          map[lib] = []
          order.push(lib)
        }
        map[lib].push(row)
      })
      var total = function (lib) {
        return map[lib].reduce(function (sum, row) {
          return sum + (row.n || 0)
        }, 0)
      }
      order.sort(function (a, b) {
        return total(b) - total(a)
      })
      return h(
        'div',
        { className: '__rp_section' },
        order.map(function (lib, index) {
          return h(HistoryLib, { key: lib, t: t, lib: lib, rows: map[lib], defaultOpen: index === 0 })
        }),
      )
    }

    /**
     * 大项外壳：技能 / 工具 / 正在运行共用一个可折叠的分区头。
     * 收起只藏正文，标题、计数、tag 摘要仍留在头上——收起后还能判断里面有没有东西。
     */
    function GroupSection(props) {
      var initialOpen = typeof prefs.folds[props.id] === 'boolean' ? prefs.folds[props.id] : props.defaultOpen !== false
      var pair = React.useState(initialOpen)
      var open = pair[0]
      var setOpen = pair[1]
      return h(
        'section',
        { className: props.className || '__rp_group' },
        h(
          'div',
          { className: '__rp_groupHead __rp_groupHeadToggle' },
          h(
            'h3',
            { className: '__rp_groupTitle' },
            h(
              'button',
              {
                type: 'button',
                className: '__rp_groupToggle',
                'aria-expanded': open ? 'true' : 'false',
                title: props.t ? props.t(open ? 'collapse' : 'expand') : '',
                onClick: function (event) {
                  var next = !open
                  sfxFor(event, next ? 'expand' : 'collapse')
                  setOpen(next)
                  setFold(props.id, next)
                },
              },
              h('span', { className: '__rp_caret', 'aria-hidden': 'true' }, open ? '▾' : '▸'),
              h('span', { className: '__rp_groupToggleText' }, props.title),
            ),
          ),
          props.count != null ? h('span', { className: '__rp_groupCount' }, String(props.count)) : null,
          props.meta || null,
        ),
        open ? props.body : null,
      )
    }

    /* ── 圆环统计（四个大类，实时按调用次数分） ────────────────────── */

    /** 圆环的口径：本轮有调用就用本轮，否则退回本会话累计。 */
    function ringModel(categories) {
      var roundSum = categories.reduce(function (sum, cat) {
        return sum + (cat.round || 0)
      }, 0)
      var totalSum = categories.reduce(function (sum, cat) {
        return sum + (cat.total || 0)
      }, 0)
      var basis = roundSum > 0 ? 'round' : 'total'
      return {
        basis: basis,
        sum: basis === 'round' ? roundSum : totalSum,
        roundSum: roundSum,
        totalSum: totalSum,
      }
    }

    function ringValue(cat, basis) {
      return basis === 'round' ? cat.round || 0 : cat.total || 0
    }

    /** 只有 SVG；尺寸与视差由外层负责，图例单独一排放在下面。 */
    function RingSvg(props) {
      var t = props.t
      var categories = props.categories || []
      var model = props.model
      var size = props.size || 190
      var budget = props.budget
      var active = props.active === true
      // 阶段：active 扫描、spent 余辉褪去、idle 心跳。老调用方只传 active 也能用。
      var phase = props.phase === 'active' || props.phase === 'spent' || props.phase === 'idle' ? props.phase : active ? 'active' : 'idle'
      var ignitePair = React.useState(false)
      var ignite = ignitePair[0]
      var setIgnite = ignitePair[1]
      var previousPhase = React.useRef(phase)
      React.useEffect(
        function () {
          var was = previousPhase.current
          previousPhase.current = phase
          if (phase !== 'active' || was === 'active') return undefined
          // 闲置 / 结束 → 工作：点燃一下（主圆盘才发声，右上角小圆盘不重复）。
          setIgnite(true)
          if (props.sound) sfxPlay('ignite')
          var timer = setTimeout(function () {
            setIgnite(false)
          }, 700)
          return function () {
            clearTimeout(timer)
          }
        },
        [phase],
      )
      // 首次打开：中间的数字逐位解码（约 0.5 s）。
      var decodePair = React.useState(props.intro ? 0 : -1)
      var decodeStep = decodePair[0]
      var setDecodeStep = decodePair[1]
      React.useEffect(
        function () {
          if (!props.intro) return undefined
          var step = 0
          var timer = setInterval(function () {
            step += 1
            setDecodeStep(step)
            if (step >= 10) clearInterval(timer)
          }, 110)
          return function () {
            clearInterval(timer)
          }
        },
        [props.intro],
      )
      var budgetPct = budget && budget.limit ? Math.min(100, Math.round((budget.chars / budget.limit) * 100)) : 0
      var budgetAngle = (budgetPct / 100) * 2 * Math.PI - Math.PI / 2
      var innerRadius = 27
      var innerCircumference = 2 * Math.PI * innerRadius
      var radius = 36
      var center = 50
      var stroke = 6.5
      var circumference = 2 * Math.PI * radius
      var gap = 2
      var offset = 0
      var segments = []

      categories.forEach(function (cat) {
        var value = ringValue(cat, model.basis)
        if (!value || !model.sum) return
        var fraction = value / model.sum
        var length = Math.max(0, fraction * circumference - gap)
        segments.push(
          h('circle', {
            key: cat.id,
            className: '__rp_ringSeg',
            'data-cat': cat.id,
            cx: center,
            cy: center,
            r: radius,
            fill: 'none',
            strokeWidth: stroke,
            strokeDasharray: length + ' ' + (circumference - length),
            strokeDashoffset: -offset,
            transform: 'rotate(-90 ' + center + ' ' + center + ')',
            strokeLinecap: 'butt',
          }),
        )
        offset += fraction * circumference
      })

      var summary = categories
        .map(function (cat) {
          return t('cat.' + cat.id) + ' ' + String(ringValue(cat, model.basis))
        })
        .join(' · ')

      // 同一页面里有主圆盘和右上角小圆盘，mask id 要各自唯一。
      var uid = React.useRef('rp' + Math.random().toString(36).slice(2, 8)).current
      var introId = uid + '-intro'
      // 内圈保持一整圈（1.0.20 起取消了三段缺口），扫描弧照常绕整圈跑。
      // 扫描弧：前端在 12 点方向（组内坐标），亮段 / 中段 / 拖尾依次往后，整组由 CSS 旋转。
      var sweepArc = function (deg, from, cls) {
        var len = (circumference * deg) / 360
        return h('circle', {
          className: cls,
          cx: center,
          cy: center,
          r: radius,
          fill: 'none',
          strokeWidth: stroke,
          strokeDasharray: len.toFixed(2) + ' ' + (circumference - len).toFixed(2),
          // 占 [-(from+deg), -from]：前端停在 -from，往后铺 deg 度。
          transform: 'rotate(' + (-90 - from - deg) + ' ' + center + ' ' + center + ')',
          strokeLinecap: 'butt',
        })
      }
      // 只在入场那段时间里显示解码字形；入场一结束（哪怕解码被拖慢、没走完）就回到真实数字，绝不停在乱码上。
      var ringNumber = props.intro && decodeStep >= 0 && decodeStep < 10 ? decodeText(String(model.sum), decodeStep, 10) : String(model.sum)

      return h(
        'svg',
        {
          className: '__rp_ringSvg',
          'data-active': active ? '1' : '0',
          'data-phase': phase,
          'data-ignite': ignite ? '1' : undefined,
          'data-intro': props.intro ? '1' : undefined,
          width: size,
          height: size,
          viewBox: '0 0 100 100',
          role: 'img',
          'aria-label': summary,
        },
        h(
          'defs',
          null,
          h(
            'radialGradient',
            { id: '__rp_coreGlow' },
            h('stop', { offset: '0%', stopColor: '#ffb25c', stopOpacity: '0.42' }),
            h('stop', { offset: '52%', stopColor: '#ff7f00', stopOpacity: '0.14' }),
            h('stop', { offset: '100%', stopColor: '#ff7f00', stopOpacity: '0' }),
          ),
          props.intro
            ? h(
                'mask',
                { id: introId, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 100, height: 100 },
                h('circle', { className: '__rp_ringIntroMask', cx: center, cy: center, r: 46.5, fill: 'none', stroke: '#fff', strokeWidth: 7, strokeDasharray: '302 302', transform: 'rotate(-90 ' + center + ' ' + center + ')' }),
              )
            : null,
        ),
        h('circle', { className: '__rp_ringCore', cx: center, cy: center, r: 23, fill: 'url(#__rp_coreGlow)' }),
        h(
          'g',
          { mask: props.intro ? 'url(#' + introId + ')' : undefined },
          h('circle', { className: '__rp_ringHair', cx: center, cy: center, r: 48.4, fill: 'none' }),
          h(
            'g',
            { className: '__rp_ringSpin' },
            h('circle', { className: '__rp_ringTickBand', cx: center, cy: center, r: 45.4, fill: 'none' }),
          ),
          h('circle', { className: '__rp_ringTicks', cx: center, cy: center, r: 47, fill: 'none' }),
        ),
        h('line', { className: '__rp_ringMark', x1: center, y1: 1.4, x2: center, y2: 4.6 }),
        h('circle', { className: '__rp_ringInnerHair', cx: center, cy: center, r: 20.5, fill: 'none' }),
        budget && budget.limit
          ? h('circle', {
              className: '__rp_budgetTrackInner',
              cx: center,
              cy: center,
              r: innerRadius,
              fill: 'none',
              strokeWidth: 1.4,
            })
          : null,
        budget && budget.limit
          ? h('circle', {
              className: '__rp_budgetArc',
              'data-warn': budgetPct >= 90 && budgetPct < 100 ? '1' : undefined,
              'data-over': budgetPct >= 100 ? '1' : undefined,
              cx: center,
              cy: center,
              r: innerRadius,
              fill: 'none',
              strokeWidth: 1.4,
              strokeDasharray:
                ((innerCircumference * budgetPct) / 100).toFixed(2) + ' ' + innerCircumference.toFixed(2),
              transform: 'rotate(-90 ' + center + ' ' + center + ')',
              strokeLinecap: 'butt',
            })
          : null,
        // 预算环按战术百分比圆盘画：亮外沿 + 前端白刻度。
        budget && budget.limit && budgetPct > 0
          ? h('circle', {
              className: '__rp_budgetEdge',
              cx: center,
              cy: center,
              r: innerRadius + 1.1,
              fill: 'none',
              strokeDasharray:
                ((2 * Math.PI * (innerRadius + 1.1) * budgetPct) / 100).toFixed(2) + ' ' + (2 * Math.PI * (innerRadius + 1.1)).toFixed(2),
              transform: 'rotate(-90 ' + center + ' ' + center + ')',
            })
          : null,
        budget && budget.limit && budgetPct > 0 && budgetPct < 100
          ? h('line', {
              className: '__rp_budgetTick',
              x1: (center + (innerRadius - 1.6) * Math.cos(budgetAngle)).toFixed(2),
              y1: (center + (innerRadius - 1.6) * Math.sin(budgetAngle)).toFixed(2),
              x2: (center + (innerRadius + 1.8) * Math.cos(budgetAngle)).toFixed(2),
              y2: (center + (innerRadius + 1.8) * Math.sin(budgetAngle)).toFixed(2),
            })
          : null,
        budget && budget.limit && budgetPct >= 100
          ? h('circle', { className: '__rp_overDot', cx: center, cy: center - innerRadius, r: 1.8 })
          : null,
        h(
          'g',
          null,
          h('circle', {
            className: '__rp_ringTrack',
            cx: center,
            cy: center,
            r: radius,
            fill: 'none',
            strokeWidth: stroke,
          }),
          segments,
          h('circle', { className: '__rp_ringFlash', cx: center, cy: center, r: radius, fill: 'none', strokeWidth: stroke }),
          h(
            'g',
            { className: '__rp_ringSweep', 'aria-hidden': 'true' },
            sweepArc(70, 62, '__rp_sweepTail'),
            sweepArc(40, 22, '__rp_sweepMid'),
            sweepArc(22, 0, '__rp_sweepLead'),
            h('line', { className: '__rp_sweepTick', x1: center, y1: center - radius - stroke / 2, x2: center, y2: center - radius + stroke / 2 }),
          ),
        ),
        h('text', { className: '__rp_ringNum', x: center, y: center - 3 }, ringNumber),
        h('text', { className: '__rp_ringCap', x: center, y: center + 7 }, t('ringCalls')),
        budget && budget.limit
          ? h(
              'text',
              { className: '__rp_ringBudget', x: center, y: center + 16 },
              t('budgetPct') + ' ' + Math.min(999, Math.round((budget.chars / budget.limit) * 100)) + '%',
            )
          : null,
      )
    }

    function RingLegend(props) {
      var t = props.t
      var categories = props.categories || []
      var model = props.model
      return h(
        'div',
        { className: '__rp_legend' },
        categories.map(function (cat) {
          return h(
            'div',
            { key: cat.id, className: '__rp_legendRow' },
            h('span', { className: '__rp_legendChip', 'data-cat': cat.id }),
            h('span', { className: '__rp_legendLabel' }, t('cat.' + cat.id)),
            h('span', { className: '__rp_legendValue' }, String(ringValue(cat, model.basis))),
          )
        }),
      )
    }

    /**
     * 鼠标在面板里移动时，圆盘按指针位置轻微倾斜；离开面板回到静止。
     * 直接写 CSS 变量 + rAF，不经过 React state —— 否则每次移动都会重渲染整棵树。
     * 尊重 prefers-reduced-motion 与 MOTION=off。
     */
    function useRingTilt(nodeRef) {
      var version = usePrefs()
      React.useEffect(
        function () {
          var node = nodeRef.current
          var host = panelRootEl
          if (!node || !host || typeof window === 'undefined') return undefined
          var frame = 0
          var last = null
          var target = { rx: 0, ry: 0 }
          var cur = { rx: 0, ry: 0 }
          var vel = { rx: 0, ry: 0 }
          var write = function () {
            node.style.setProperty('--rp-rx', cur.rx.toFixed(2) + 'deg')
            node.style.setProperty('--rp-ry', cur.ry.toFixed(2) + 'deg')
          }
          /* 弹簧：和终末地菜单同一套做法——目标角度变，速度追，停稳就退出 rAF。 */
          var tick = function () {
            var dx = target.rx - cur.rx
            var dy = target.ry - cur.ry
            vel.rx = (vel.rx + dx * 0.11) * 0.82
            vel.ry = (vel.ry + dy * 0.11) * 0.82
            cur.rx += vel.rx
            cur.ry += vel.ry
            var settled =
              Math.abs(dx) < 0.02 && Math.abs(dy) < 0.02 && Math.abs(vel.rx) < 0.02 && Math.abs(vel.ry) < 0.02
            if (settled) {
              cur.rx = target.rx
              cur.ry = target.ry
              vel.rx = 0
              vel.ry = 0
              write()
              frame = 0
              return
            }
            write()
            frame = requestAnimationFrame(tick)
          }
          var aim = function (rx, ry) {
            target.rx = rx
            target.ry = ry
            if (!frame) frame = requestAnimationFrame(tick)
          }
          var reset = function () {
            last = null
            aim(0, 0)
          }
          if (
            !activeEffects().tilt ||
            MOTION === 'off' ||
            (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
          ) {
            cur.rx = 0
            cur.ry = 0
            write()
            return undefined
          }
          var clamp = function (value) {
            return Math.max(-1, Math.min(1, value))
          }
          var move = function (event) {
            last = event
            var rect = node.getBoundingClientRect()
            if (!rect.width || !rect.height) return
            var dx = (last.clientX - rect.left) / rect.width - 0.5
            var dy = (last.clientY - rect.top) / rect.height - 0.5
            aim(-clamp(dy) * 13, clamp(dx) * 17)
          }
          host.addEventListener('pointermove', move)
          host.addEventListener('pointerleave', reset)
          return function () {
            host.removeEventListener('pointermove', move)
            host.removeEventListener('pointerleave', reset)
            if (frame) cancelAnimationFrame(frame)
            frame = 0
          }
        },
        [nodeRef, version],
      )
    }

    /* ── 冷层开关 ────────────────────────────────────────────────────── */

    /**
     * 冷层里的来源库分组：和上面技能区用同一套库名与折叠壳，
     * 这样用户能看出「上古卷轴调试」原本属于哪个库。
     */
    function ColdGroup(props) {
      var t = props.t
      var items = props.items
      var foldId = 'cold:' + props.lib
      var libMenu = useLibMenu(t, 'skill', props.lib)
      var initialOpen = typeof prefs.folds[foldId] === 'boolean' ? prefs.folds[foldId] : false
      var pair = React.useState(initialOpen)
      var open = pair[0]
      var setOpen = pair[1]
      var busyPair = React.useState(false)
      var busy = busyPair[0]
      var setBusy = busyPair[1]
      var failedPair = React.useState(false)
      var failed = failedPair[0]
      var setFailed = failedPair[1]
      var restoreAll = function () {
        if (busy) return
        var names = items.map(function (item) {
          return item.name
        })
        var directoryNames = items.every(function (item) { return Boolean(item.directoryName) })
          ? items.map(function (item) { return item.directoryName })
          : null
        if (!names.length) return
        setBusy(true)
        setFailed(false)
        fetch('/dsh-running-panel/park', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(directoryNames ? { directoryNames: directoryNames, action: 'restore' } : { names: names, action: 'restore' }),
        })
          .then(function (response) {
            if (!response.ok) throw new Error('restore')
            return response.json()
          })
          .then(function (value) {
            if (!value || value.ok !== true) setFailed(true)
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
        { className: '__rp_lib' },
        h(
          'div',
          { className: '__rp_libRow' },
          h(
            'button',
            {
              type: 'button',
              className: '__rp_libToggle',
              'aria-expanded': open ? 'true' : 'false',
              title: libTip(t, props.lib, items.length) || undefined,
              onContextMenu: libMenu[0],
              onClick: function () {
                var next = !open
                setOpen(next)
                setFold(foldId, next)
              },
            },
            h('span', { className: '__rp_caret', 'aria-hidden': 'true' }, open ? '▾' : '▸'),
            h('span', { className: '__rp_libName' }, libLabel(props.lib)),
            h('span', { className: '__rp_libCount' }, fill(t('libCount'), 'n', items.length)),
          ),
          h(
            'button',
            {
              type: 'button',
              className: '__rp_libRestore',
              disabled: busy,
              'data-failed': failed ? '1' : undefined,
              title: failed ? t('restoreLibFailed') : t('restoreLibTip'),
              'aria-label': t('restoreLib'),
              onClick: restoreAll,
            },
            busy ? t('restoringLib') : t('restoreLib'),
          ),
          sourceOf(props.lib)
            ? h(RepoButton, { t: t, href: sourceOf(props.lib) })
            : null,
        ),
        open
          ? h(
              'div',
              { className: '__rp_libBody' },
              items.map(function (item) {
                return h(ColdRow, { key: item.directoryName || item.name, t: t, item: item })
              }),
            )
          : null,
        libMenu[1][0],
        libMenu[1][1],
      )
    }

    /**
     * 冷层的一行：名字 + 中文用途 + 一个「启用」小按钮。
     * 只调 Host 的 /park 接口；快照会自动刷新，不需要手动重拉。
     */
    function ColdRow(props) {
      var t = props.t
      var pair = React.useState(false)
      var busy = pair[0]
      var setBusy = pair[1]
      var failPair = React.useState(false)
      var failed = failPair[0]
      var setFailed = failPair[1]
      return h(
        'div',
        { className: '__rp_row __rp_coldRow', 'data-state': 'idle', 'data-warn': failed ? '1' : undefined },
        h('span', { className: '__rp_name' }, nameOf('skill', props.item.name)),
        h('span', { className: '__rp_nameAlt' }, altNameOf('skill', props.item.name) || props.item.name),
        h(
          'button',
          {
            type: 'button',
            className: '__rp_linkBtn',
            disabled: busy,
            title: props.item.name,
            onClick: function () {
              setBusy(true)
              setFailed(false)
              fetch('/dsh-running-panel/park', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name: props.item.name, directoryName: props.item.directoryName, action: 'restore' }),
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
            },
          },
          busy ? '…' : t('restore'),
        ),
      )
    }

    /**
     * 预算方案弹层：只读一份 dryRun 结果，确认后才动文件。
     * 排版：顶部预算条（保留 vs 停用占比），下面逐条点名 + 理由。
     */
    /** 从面板根节点复制到 body 弹层的主题令牌。 */
    var PANEL_THEME_TOKENS = [
      '--dsw-alias-bg-base',
      '--dsw-alias-label-primary',
      '--dsw-alias-label-secondary',
      '--dsw-alias-label-tertiary',
      '--dsw-alias-border-l1',
      '--dsw-alias-border-l2',
      '--dsw-alias-bg-layer-1',
      '--dsw-alias-bg-layer-2',
      '--dsw-alias-bg-overlay',
      '--dsw-alias-brand-primary',
      '--rp-amber',
      '--rp-teal',
      '--rp-rust',
      '--rp-sand',
      '--rp-slate',
    ]

    function BudgetPlanDialog(props) {
      var t = props.t
      var plan = props.plan
      var busy = props.busy === true
      var applied = props.applied === true
      var failed = props.failed === true
      /* 弹层挂到 body，脱离面板的容器查询/包含块；把面板主题令牌复制过来，
       * 纸白/墨黑都能跟着变，不会出现暗底暗字。 */
      var shellRef = React.useRef(null)
      React.useEffect(function () {
        var el = shellRef.current
        var panel = document.querySelector('.__rp_root')
        if (!el || !panel) return
        var cs = getComputedStyle(panel)
        PANEL_THEME_TOKENS.forEach(function (name) {
          var value = cs.getPropertyValue(name).trim()
          if (value) el.style.setProperty(name, value)
        })
      }, [])
      var park = (plan && plan.park) || []
      var keep = (plan && plan.keep) || []
      var before = (plan && plan.before) || { chars: 0, tokens: 0, skills: 0 }
      var byName = {}
      var order = []
      keep.concat(park).forEach(function (row) {
        if (!byName[row.name]) order.push(row.name)
        byName[row.name] = row
      })
      var selectPair = React.useState(function () {
        var set = {}
        if (applied && Array.isArray(plan.applied)) {
          plan.applied.forEach(function (name) { set[name] = true })
        } else {
          park.forEach(function (row) { set[row.name] = true })
        }
        return set
      })
      var selected = selectPair[0]
      var setSelected = selectPair[1]
      var selectedNames = order.filter(function (name) {
        return selected[name] === true
      })
      var savedChars = selectedNames.reduce(function (sum, name) {
        return sum + (byName[name].chars || 0) - (name.length + 22)
      }, 0)
      var afterChars = Math.max(0, before.chars - savedChars)
      var afterTokens = Math.round(afterChars / 4)
      var total = Math.max(1, before.chars)
      var reason = function (row) {
        // 别的打开着的会话正在用：默认保留；手动挪到停用栏也可以，但标题里写明会影响谁。
        if (row.why === 'inUse') return fill(t('whyInUse'), 'sessions', (row.inUse || []).map(function (s) { return s.title }).join('、'))
        if (row.why === 'pinned') return t('whyPinned')
        if (row.why === 'library') return t('whyLibrary')
        if (row.why === 'recent') return t('whyRecent')
        return row.days >= 0 ? fill(t('whyDays'), 'n', row.days) : t('whyNever')
      }
      var toggle = function (name) {
        var row = byName[name]
        if (!row || row.movable !== true || busy || applied) return
        var next = Object.assign({}, selected)
        if (next[name]) delete next[name]
        else next[name] = true
        setSelected(next)
      }
      var item = function (row, parked) {
        var locked = row.movable !== true
        return h(
          'button',
          {
            key: (parked ? 'p:' : 'k:') + row.name,
            type: 'button',
            className: '__rp_planItem',
            'data-parked': parked ? '1' : undefined,
            'data-locked': locked ? '1' : undefined,
            'aria-pressed': parked ? 'true' : 'false',
            disabled: locked || busy || applied,
            title: row.name + ' · ' + (locked ? t('planLocked') : reason(row)),
            onClick: function () {
              toggle(row.name)
            },
          },
          h('span', { className: '__rp_planItemName' }, nameOf('skill', row.name) || row.name),
          locked ? h('span', { className: '__rp_planLock' }, '🔒') : null,
          !locked && !parked && (row.why === 'pinned' || row.why === 'library')
            ? h('span', { className: '__rp_planPin' }, '★')
            : null,
          h('span', { className: '__rp_planItemMeta' }, locked ? t('planLocked') : reason(row)),
          h('span', { className: '__rp_planItemChars' }, (parked ? '−' : '') + formatChars(row.chars || 0)),
        )
      }
      var column = function (title, rows, parked) {
        return h(
          'div',
          { className: '__rp_planCol' },
          h(
            'div',
            { className: '__rp_planColHead' },
            h('span', { className: '__rp_planColTitle' }, title),
            h('span', { className: '__rp_planColCount' }, fill(t('planCount'), 'n', rows.length)),
          ),
          h(
            'div',
            { className: '__rp_planColList' },
            rows.length
              ? rows.map(function (row) {
                  return item(row, parked)
                })
              : h('div', { className: '__rp_planEmpty' }, parked ? t('planEmptyPark') : t('planEmptyKeep')),
          ),
        )
      }
      var keptRows = order
        .filter(function (name) {
          return !selected[name]
        })
        .map(function (name) {
          return byName[name]
        })
      var parkedRows = selectedNames.map(function (name) {
        return byName[name]
      })
      var body = h(
        'div',
        { className: '__rp_planBody' },
        h(
          'div',
          { className: '__rp_planBar', title: fill(fill(t('planBarTitle'), 'a', formatChars(afterChars)), 'b', formatChars(before.chars)) },
          h('span', { className: '__rp_planBarFill', style: { width: Math.max(2, Math.round((afterChars / total) * 100)) + '%' } }),
          h('span', { className: '__rp_planBarRest' }),
        ),
        h(
          'div',
          { className: '__rp_planBarLabel' },
          h('span', null, fill(t('planKeep'), 'n', keptRows.length)),
          h('span', null, fill(t('planPark'), 'n', parkedRows.length)),
        ),
        h('div', { className: '__rp_planDual' }, column(t('planColKeep'), keptRows, false), column(t('planColPark'), parkedRows, true)),
      )
      var dialog = h(
        'div',
        { className: '__rp_planWrap', ref: shellRef, role: 'dialog', 'aria-modal': 'true', 'aria-label': t('planTitle') },
        h(
          'div',
          { className: '__rp_plan' },
          h(
            'div',
            { className: '__rp_planHead' },
            h('span', { className: '__rp_planTitle' }, t('planTitle')),
            h(
              'button',
              {
                type: 'button',
                className: '__rp_planClose',
                'aria-label': t('planCancel'),
                onClick: props.onClose,
              },
              '✕',
            ),
          ),
          h(
            'div',
            { className: '__rp_planMeta' },
            h('span', null, fill(fill(t('planMeta'), 'a', formatTokens(before.tokens)), 'b', formatTokens(afterTokens))),
            h('span', { className: '__rp_planSaved' }, fill(t('planSaved'), 'c', formatChars(Math.max(0, savedChars)))),
          ),
          body,
          failed ? h('div', { className: '__rp_planError' }, t('planFailed')) : null,
          props.undoFailed ? h('div', { className: '__rp_planError' }, t('planUndoFailed')) : null,
          applied && props.failedNames && props.failedNames.length
            ? h('div', { className: '__rp_planError' }, fill(t('planPartial'), 'n', props.failedNames.length))
            : null,
          applied
            ? h(
                'div',
                { className: '__rp_planDone' },
                h('span', null, fill(t('planApplied'), 'n', props.moved == null ? selectedNames.length : props.moved)),
                h('button', { type: 'button', className: '__rp_linkBtn', disabled: busy, onClick: props.onUndo }, t('planUndo')),
              )
            : h(
                'div',
                { className: '__rp_planFoot' },
                h('button', { type: 'button', className: '__rp_linkBtn', onClick: props.onClose }, t('planCancel')),
                h(
                  'button',
                  {
                    type: 'button',
                    className: '__rp_planApply',
                    disabled: busy || selectedNames.length === 0,
                    onClick: function () {
                      props.onApply(selectedNames)
                    },
                  },
                  busy ? t('planBusy') : fill(t('planApply'), 'n', selectedNames.length),
                ),
              ),
        ),
      )
      return portalToBody(dialog)
    }

    /* ── 面板总入口 ──────────────────────────────────────────────────── */

    function Panel(props) {
      var t = props.t
      var mode = props.mode === 'global' ? 'global' : 'session'
      useCatalogVersion() // 词典到达后重渲染一次，让显示名生效
      usePrefs() // WebGL 开关变化后重渲染
      var stored = useActiveSession()
      var sessionId = mode === 'global' ? '' : props.sessionId || stored
      var url = React.useMemo(
        function () {
          if (mode === 'global') return '/dsh-running-panel/stream?scope=global'
          return '/dsh-running-panel/stream?session=' + encodeURIComponent(sessionId || '')
        },
        [mode, sessionId],
      )
      var pair = useSnapshot(url)
      var snapshot = pair[0]
      var failed = pair[1]
      // 新装技能 / 分组变化 / 外部改了覆盖层：快照里的词典版本变了就重拉一次。
      var catalogVersion = snapshot && snapshot.catalogVersion
      React.useEffect(
        function () {
          if (!catalogVersion || !catalogStore.data || catalogStore.data.stamp === catalogVersion) return
          refreshCatalog()
        },
        [catalogVersion],
      )
      var dockPair = React.useState(false)
      var dockFailed = dockPair[0]
      var setDockFailed = dockPair[1]
      // 每次启动 DSH 第一次在右侧栏打开面板：马赛克显现 + 圆盘入场（只播一次）。
      var reveal = useFirstReveal(mode !== 'global' && Boolean(props.sessionId) && Boolean(snapshot))

      if (!snapshot) {
        // EventSource 会自己重连；这里只给一条“重连中”，不把瞬间断流渲染成红色错误。
        if (failed) {
          return shell([
            h(
              'div',
              { className: '__rp_pending', role: 'status', key: 'pending' },
              h('span', { className: '__rp_pendingDot', 'aria-hidden': 'true' }),
              h('span', null, t('reconnecting')),
            ),
            h('div', { className: '__rp_note', key: 'retry' }, t('retry')),
          ], t)
        }
        return shell([h('div', { className: '__rp_note', key: 'loading' }, t('loading'))], t)
      }

      if (mode === 'global') return h(GlobalBoard, { t: t, snapshot: snapshot })

      var nodes = []
      if (failed) {
        // 已有数据时，断流只降级为一条状态提示，保留上一帧内容。
        nodes.push(
          h(
            'div',
            { className: '__rp_pending', key: 'pending', role: 'status' },
            h('span', { className: '__rp_pendingDot', 'aria-hidden': 'true' }),
            h('span', null, t('reconnecting')),
          ),
        )
      }
      nodes.push(h(SessionBoard, { key: sessionId || 'board', t: t, snapshot: snapshot, reveal: reveal }))
      if (!props.sessionId) {
        nodes.push(
          h(
            'div',
            { className: '__rp_rightHint', key: 'dock' },
            h(
              'button',
              {
                type: 'button',
                className: '__rp_linkBtn',
                onClick: function () {
                  setDockFailed(!openRightDock())
                },
              },
              t('openRight'),
            ),
            t('rightHint'),
            dockFailed ? h('span', { className: '__rp_warnBox' }, t('openFailed')) : null,
          ),
        )
      }
      return shell(nodes, t, { reveal: reveal })
    }

    /**
     * 对话标题栏上的「运行中」按钮：当前会话的工具条里一键停靠右侧栏。
     * 这是右侧栏之外的第二个入口 —— 不依赖它自己的「新标签页」菜单列没列出这种类型。
     */
    function HeaderButton(props) {
      var t = props.t
      var pair = React.useState(false)
      var failed = pair[0]
      var setFailed = pair[1]
      return h(
        'button',
        {
          type: 'button',
          className: '__rp_headerBtn',
          'data-failed': failed ? '1' : undefined,
          title: failed ? t('openFailed') : t('openRight'),
          onClick: function () {
            setFailed(!openRightDock())
          },
        },
        h(PanelIcon, { size: 14, active: false }),
        h('span', null, t('nav')),
      )
    }

    /* ── 对话右上角圆盘：和面板同一个 RingSvg，浮在会话列右上角 ───── */

    /**
     * 不打开右侧栏也能看到本轮调用构成。
     * 位置跟着 `[data-conversation-session]` 的矩形算；数据 4s 轮询，页面隐藏时停。
     */
    function PulseCorner(props) {
      var t = props.t
      var sessionId = useActiveSession()
      usePrefs()
      var size = 128
      var openPair = React.useState(false)
      var panelOpen = openPair[0]
      var setPanelOpen = openPair[1]
      var snapPair = React.useState(null)
      var snapshot = snapPair[0]
      var setSnapshot = snapPair[1]
      var posPair = React.useState(null)
      var pos = posPair[0]
      var setPos = posPair[1]
      React.useEffect(function () {
        if (!sessionId) {
          setSnapshot(null)
          return
        }
        var alive = true
        var load = function () {
          fetch('/dsh-running-panel/snapshot?view=corner&session=' + encodeURIComponent(sessionId))
            .then(function (response) {
              return response.ok ? response.json() : null
            })
            .then(function (value) {
              if (alive && value) setSnapshot(value)
            })
            .catch(function () {})
        }
        load()
        var timer = window.setInterval(function () {
          if (!document.hidden) load()
        }, 4000)
        return function () {
          alive = false
          window.clearInterval(timer)
        }
      }, [sessionId])
      React.useEffect(function () {
        var measure = function () {
          var host = document.querySelector('[data-conversation-session]')
          // 右侧栏收起时面板节点还在 DOM 里，只是宽度为 0；用可见宽度判断。
          var docked = document.querySelector('[data-sidebar-right-session] .__rp_root')
          setPanelOpen(Boolean(docked && docked.getBoundingClientRect().width > 0))
          if (!host) {
            setPos(null)
            return
          }
          var rect = host.getBoundingClientRect()
          var top = Math.round(rect.top + 12)
          var left = Math.round(rect.right - size - 18)
          // 每 1.5s 测一次：位置没变就沿用旧对象，别让整块圆盘白白重渲染。
          setPos(function (previous) {
            return previous && previous.top === top && previous.left === left ? previous : { top: top, left: left }
          })
        }
        measure()
        window.addEventListener('resize', measure)
        var timer = window.setInterval(measure, 1500)
        return function () {
          window.removeEventListener('resize', measure)
          window.clearInterval(timer)
        }
      }, [])
      if (prefs.corner === false || panelOpen || !sessionId || !snapshot || !pos || !snapshot.session || snapshot.session.id !== sessionId) return null
      var categories = snapshot.categories || []
      var budget = snapshot.budget ? Object.assign({}, snapshot.budget, { limit: budgetLimitChars() }) : null
      return h(
        'div',
        { className: '__rp_corner', style: { top: pos.top + 'px', left: pos.left + 'px' } },
        h(
          'button',
          {
            type: 'button',
            className: '__rp_cornerBtn',
            title: t('openRight'),
            'aria-label': t('openRight'),
            onClick: function () {
              setPanelOpen(true)
              if (!openRightDock()) setPanelOpen(false)
            },
          },
          h(RingSvg, {
            t: t,
            categories: categories,
            model: ringModel(categories),
            size: size,
            active: snapshot.session && snapshot.session.phase === 'active',
            budget: budget,
          }),
        ),
      )
    }

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
