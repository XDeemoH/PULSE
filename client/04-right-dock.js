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

