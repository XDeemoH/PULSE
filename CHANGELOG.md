# Changelog

## 1.1.3 — 2026-11-11

Security: refuse every request when the host's authentication service is missing.

- **No more loopback fallback.** When the host has no `connection` service (including early in DSH startup, before it is ready), or the service supports neither `admit()` nor `requestRejection()`, every `/dsh-running-panel/*` route now answers `503` with `{ ok: false, error: 'DSH authentication service unavailable' }` and the handler never runs. 1.1.2 still let a loopback peer with a loopback Host header through in that case, so the search route could return private conversation excerpts without a login.
- **The panel reconnects by itself.** Browsers close an `EventSource` after a 401/503 and never retry, so the live stream now reopens with backoff (2 s, doubling up to 30 s) instead of staying dead until the panel is reopened.
- Reported in polang233/dsh-plugin-index#395 (second review). `tests/admission.test.mjs` covers the missing and unsupported service cases on every registered route, search included. Tests: 284.

## 1.1.2 — 2026-11-10

Security: host authentication for every PULSE route.

- **All `/dsh-running-panel/*` routes now go through the host's `ctx.connection.admit()`**, the same trust and login check DSH's own `/api` uses (trusted origin, plus browser login or API credential). Only the owner Peer is admitted, matching DSH's rule for exact routes. Before this, the routes were exact registrations on the web server that skipped the host's check, so a client that could reach the DSH web port without logging in could read conversation content (snapshot, ECHO, search) or change data (goals, ideas, loadouts, parking).
- Unauthenticated requests get `401`; untrusted origins and non-owner Peers get `403`. The handler never runs, and if the check itself throws, the request is refused.
- Hosts without `admit()` fall back to the host's `requestRejection()`. Hosts without the `connection` service accept loopback only: the peer address and the Host header must both be loopback.
- Reported in polang233/dsh-plugin-index#395. `tests/admission.test.mjs` covers every registered route.

## 1.1.1 — 2026-11-10

Publishing preparation.

- **Package renamed `@local/dsh-running-panel` → `@xdeemoh/dsh-pulse`** (also the plugin id in `cordis.patch.yml` and the client). Saved data is unaffected (it lives in `running-panel/`); the right-sidebar tab is re-registered under the new id. Existing manual installs: change the dependency key and the bundle entry in your profile's `package.json` to `@xdeemoh/dsh-pulse`, run `dsh plugin --profile <name> install`, restart DSH.
- **One-command install** documented and verified in a clean profile: `dsh plugin --profile desktop add github:XDeemoH/PULSE` (registers the bundle automatically).
- `package.json`: author, repository, homepage, bugs; no longer `private`, so it can be published to npm later. `screenshots.json` for plugin listings.

## 1.1.0 — 2026-11-09

First public release. The code is 1.0.27; the 1.0.x entries below are the development history before publishing.

Highlights: live skill / tool panel with the skill-catalog budget (budget line follows the model's context window, adjustable), skill loadout window grouped by library with dry run and undo, skill profiles, cross-conversation guard for parking, goals and ideas, ECHO saved excerpts with scene rebuild and formatted box-select copy, auto-translation of skill names, motion and synthesized sound. Background model calls only after you allow them.

## 1.0.27 — 2026-11-09

- **Budget line you can read and tune.** The auto rule (context window × share, clamped to floor–cap) is now adjustable in Settings → Budget: share 0.25 %–3 %, floor, cap (a cap below the floor is lifted to it). The panel shows the live formula ("1048.6k × 1% = 10.5k, clamped to 3.0k–20.0k → 10.5k tok") and the result for 128k / 512k / 1M / 2M windows.
- **Remembered context window.** The last context size a conversation reported is stored; when no conversation is reporting one (e.g. nothing open), the line still follows it instead of dropping to the fixed 3000. Only when no window was ever seen does the fallback apply, and the settings say so.
- **Wording.** "公告预算" → "目录预算" / "Catalog budget". The budget section states that it is a soft target that never parks anything, and that only Auto loadout and Loadout move skill folders (dry run, confirm, undo). In auto mode the fixed field is labelled as the fallback.
- **Menu motion settings.** Settings → Visuals → Menus: fade duration (0–600 ms, 0 = instant, default 140) and backdrop blur (0–24 px, default 10) for the settings and loadout windows. Closing now fades out too (Esc, ✕, clicking outside). Reset to defaults restores the budget rule and menu motion.
- Tests: 276 (was 274).

## 1.0.26 — 2026-11-09

- **ECHO: box-select bubbles and copy with formatting.** In an Echo's conversation view, dragging with the left button outside the bubbles draws a selection box; every bubble it touches is selected (it auto-scrolls at the edges). Ctrl / Shift adds to the selection, Ctrl+click toggles one bubble, Ctrl+A selects all, Esc clears (a second Esc closes). Ctrl+C or the "copy" button writes the selected messages whole: plain text is the original Markdown with **User** / **Assistant** headers, and an HTML rendering (headings, lists, quotes, tables, code blocks; escaped, http(s) links only) goes along so Word or Notion keep the formatting. A normal text selection inside one bubble still copies just that text; one that spans two or more bubbles copies those messages whole. Key and release events are caught in the capture phase because the host intercepts them.
- **Faster overlay blur.** The settings and loadout windows no longer animate the blur radius (re-blurring the whole DSH page every frame); the blur is applied at once and only opacity fades in, in 0.14 s. Blur radius 12 → 10 px.
- **Settings window in PULSE's own style** instead of mirroring a game's settings menu: "PULSE //" heading, underline tabs, a left amber bar on the selected category, hairline-separated rows, switch toggles, round slider knobs, plain key hints; ← / → switch tabs (was Q / E).
- Game names removed from code comments and change notes; the README keeps an "inspired by" acknowledgement with a non-affiliation note.
- Tests: 274 (was 271). `tests/echo-copy.test.mjs`.

## 1.0.25 — 2026-11-09

Fixes and polish after trying 1.0.24 in the real app.

- **Loadout skills grouped by library.** The skill area is a list of libraries (collapsed by default, remembered for the page); each header shows equipped / total, equipped tokens and a stripe of the equipped skills' categories, with an "equip all / remove all" button (skills another conversation uses stay equipped and the bar says how many). Opening a library shows its tiles; tiles that are off carry a category-colored edge.
- **Loadout layout.** Wider panel (up to 1280px), larger tiles, stats and bar. Only the skill / detail area scrolls — before, the panel's rows shrank and the skill list spilled under the footer buttons when scrolled. Wheel scrolling no longer reaches the chat behind the blur; the detail column stays pinned while scrolling.
- **Skill sizes match the side bar.** The loadout sized skills from the SKILL.md description while the side bar's budget uses what the model catalog actually carries; both now use the catalog (SKILL.md only for parked skills).
- **Side bar budget in tokens.** It showed characters (e.g. 8.0k / 41.9k) next to a loadout and settings that speak tokens; now 2.0k / 10.5k.
- **Hidden folders are not skills.** `.third-party-licenses` and similar dot-folders in `~/.agents/skills` no longer appear in the loadout or get parked by profile switches.
- **Settings window redone** in a tactical settings-menu layout: blurred backdrop, large title, Options / About tabs (← / →), a category list on the left (General, Visuals, Model, Sound, Background, Budget, Pricing; ↑ / ↓), the category's rows on the right with label left and value right — switches as Yes / No, sliders as a value plus a thin line — and key hints at the bottom (Esc back, R restore defaults). The About tab shows client and host versions. The model sub-switches dim while background model calls are not allowed.
- Tests: 271 (was 269).

## 1.0.24 — 2026-11-09

- **Skill loadout window.** Replaces the profiles button in the side bar. Full-screen, backdrop blurred; a large ring outside the panel on the left, tilted in perspective, shows the loadout's split across visual / code / thinking / ops plus budget use. The panel has four stat cards, a budget bar (one segment per equipped skill, width = tokens; built-ins as one locked hatched block; the budget line marked), category tabs and uniform tiles, and a detail column (share before / after, uses, recent conversations, frequent companions, in-use warning). Click or drag to equip / remove; F fills by usage within the budget, Ctrl+S saves as a profile, Enter previews and applies, Esc closes. Skills another conversation is using stay equipped. Applying goes through the same dry run / journal / undo path as profile switches.
- **Budget line relative to the model.** New default `budgetMode: "auto"`: 1% of the context window reported by the host, clamped to 3k–20k; `fixed` keeps the old setting. Skill sizes stay absolute.
- "Budget plan" renamed "Auto loadout".
- Host: `/dsh-running-panel/loadout` (skills with size, category, usage, recent sessions, co-use, in-use; built-in total; context window), `profiles` accepts `previewSkills` (ad-hoc loadout dry run) and `skills` when saving. `loadoutPlan` in `profile-core.js`. Client fragment `client/12-loadout.js`.
- Tests: 269 (was 264). `tests/loadout.test.mjs`.

## 1.0.23 — 2026-11-09

- **Cross-conversation guard for parking.** Parking moves the skill folder, so another open conversation that is using the skill can no longer call it next turn, and the scripts / templates / docs the skill ships disappear from under the instructions it already read. A skill counts as in use when it is still in that conversation's "running" set (called within the last four rounds) or was called in the last two hours.
  - The budget plan keeps such skills (`why: "inUse"`, with the conversation titles shown).
  - A manual park (row ⊘ or menu) is refused with `409 in-use` and the conversations; the panel asks "park anyway?" and only then sends `force`. Parking from the conversation that uses the skill is allowed.
  - "Park whole library" skips in-use skills and lists them.
- **Skill profiles.** Save "which installed skills are enabled" per kind of work (with pinned libraries), then switch: a dry run lists what would be parked, restored, kept as newly installed (in no profile), kept because another conversation uses it, or is missing; files move only after confirming. Parking goes through the same journaled, identity-checked path as budget plans; the restored half is remembered so "undo this switch" re-parks it and restores the parked half from the journal. Rename, overwrite with current, delete. Stored in `running-panel/skill-profiles.json`.
- Fix found while testing: a profile switch's journal entry must carry the full plan shape (`keep`, `before`, …) — otherwise the undo journal would fail validation on the next read and block every later park / restore. Covered by a test that checks `undoError` after a switch.
- New `profile-core.js`, `/dsh-running-panel/profiles`, client fragment `client/12-profiles.js`. The test host can now emit host events (`PULSE_TEST_EMIT`).
- Tests: 264 (was 255). `tests/in-use.test.mjs`, `tests/profiles.test.mjs`.

## 1.0.22 — 2026-11-09

Open-source preparation.

- **Removed a third-party stock image.** The contour studio embedded a watermarked stock photo as a "shape reference"; the image, its button and dialog are gone (`studio.html` 929 KB → 46 KB). Everything the studio draws is generated.
- **Background model calls need consent.** Auto-translation, goal suggestion and idea collection send content to the user's default model and use tokens. None of them runs automatically until the user chooses "Enable" on a one-time card at the top of the panel (or the new master switch in settings); each keeps its own switch. Buttons the user presses (translate now, check what got done, collect from past sessions) are explicit and still work. Existing installs see the card once.
- **README rewritten** (Chinese `README.md`, English `README.en.md`): all features through 1.0.21, an accurate privacy section (what is stored where, what is sent to the model and when), install, limitations, development, localization, acknowledgements.
- Internal development notes (handoffs, reviews, repair notes) moved out of the repository; personal names removed from code comments.
- Repository text files normalized to LF with `.gitattributes`.
- Tests: 255 (was 253). `tests/consent.test.mjs`.

## 1.0.21 — 2026-11-09

- **Ideas & branches.** The directions that pile up on the way to a goal — the assistant's "next you could…" lists, your own "later / not now / note this" — are collected per workspace into the goal drawer instead of staying buried in old turns.
  - *Collecting:* after each turn the panel asks the host to scan that session's unscanned finished turns (at most five). A keyword prefilter (a "next step / could also / still left …" cue in the last 45 % of the answer followed by at least two list lines, or a "later / not now" from you) decides whether one model call (`purpose: "pulse-ideas"`) extracts them; on the owner's 237 logged turns it fires on 18 %. Existing ideas go into the prompt so only new ones come back; text-normalized duplicates are dropped, including against done ones. Each idea keeps its session and message so "↗" jumps back to the conversation.
  - *Status:* open / in progress (made into the goal) / done / dismissed. "Make goal" opens a goal from the idea; when that goal is completed the idea is completed, and if the goal is superseded or removed the idea returns to the list. Ideas done along the way are flagged "maybe done" by a model check against recent turns (on demand, and automatically when a goal is completed) and only count once you confirm.
  - *Reminders:* the goal bar shows "灵感 N"; with no current goal the newest open idea becomes the proposal (before any model inference), and accepting it makes it the goal.
  - *History:* "collect from past sessions" first estimates (sessions, turns with direction lists, model calls), then backfills from the workspace's disk logs and marks them scanned.
  - Stored in `running-panel/ideas.json` (500 cap, atomic writes). Settings: "collect ideas after each turn" (default on).
- New `idea-core.js`, `/dsh-running-panel/idea` (GET view / estimate; POST capture / check / backfill / text / goalFrom; PATCH status), client fragment `client/12-ideas.js`. Goal mutations re-sync linked ideas.
- Tests: 253 (was 241). `tests/ideas.test.mjs`.

## 1.0.20 — 2026-11-09

- **Auto-translation now covers plugin skills and tools.** It only scanned `~/.agents/skills` and the parked folder, so a DSH plugin's skills (installed through the profile, e.g. `@xiaoso/dsh-workflow-lite`'s `workflow-authoring` / `workflow-board` / `workflow-run-state`) and its tools (`workflow_lite`) never got Chinese names. Candidates now also come from DSH's `skills` registry and `tools.schemas()`; tools are written as `tool:<name>`; curated `catalog.js` tools are never given a machine description.
- Ring: the inner ring is one continuous ring again (the three-sector gaps are gone); the sweep still runs around it.
- First-open reveal slowed to about 2 s so it reads as an opening: a 0.25 s blank-glass pause, then the pixel grid steps 20 → 2 px over eight 150 ms steps, sections resolve one by one 90 ms apart over 1.5 s each, the ring's outer band draws over 1.6 s and its number decodes over ~1.1 s.
- Tests: 241 (was 239).

## 1.0.19 — 2026-11-09

- **Fix: the ring number could stay a decode glyph ("/", "#").** The first-open digit decode ran on a timer tied to the 0.9 s intro; when the intro ended before the decode finished (resizing the sidebar delays timers), the timer was cleared mid-way and the scrambled glyph stayed. The number now shows decode glyphs only while the intro is on and always returns to the real value afterwards.
- The first-open reveal is also remembered in `sessionStorage`, so remounting the sidebar or reloading the page in the same DSH session does not replay it (a new DSH launch still does).
- Goal bar: a model-inferred goal that is not confirmed yet reads "待确认 ◇" (hollow) instead of "追踪中 ◆ [?]"; confirming turns it into "追踪中 ◆".
- Tests: 239 (was 236).

## 1.0.18 — 2026-11-09

Motion and sound modeled on four reference recordings (loading ring, map open, menu open, tab switch) analysed frame by frame.

- **Ring states.** Idle: a double-beat heartbeat on the inner hairline every 2.4 s and a small mark at 12 o'clock; nothing else moves. Working: the category ring is cut into three sectors (gaps at 60° / 180° / 300°, as on the loading ring) and a bright arc with a fading trail and a white leading tick sweeps it once every 1.2 s; the outer tick band keeps its one-turn-a-minute. Idle → working "ignites" (a 0.7 s flash of the ring and core). Working → done fades the sweep out over 1.5 s instead of cutting it. The budget arc gains a bright outer edge and a white tick at its leading end, like the loading percentage ring.
- **First open after DSH starts.** The first time the right-side panel opens in a DSH session, the sections appear as low-resolution blocks that resolve into place (an SVG pixelate filter stepping 14 → 2 px over ~0.4 s, plus an overexposed flash per section staggered 40 ms top to bottom, ~0.7 s total), the ring's outer band draws clockwise and its number decodes digit by digit. Plays once per launch; skipped with the "entrance" effect off, in performance mode settings, or with reduced motion.
- **Sound effects** (default off; settings: toggle, volume, preview buttons). Synthesized live with Web Audio, no audio files and no game audio: click, expand / collapse (rising / falling two-note), panel open (filtered noise sweep + chirp), done (goal completed, Echo saved), ignite (low swell when the ring starts working; main ring only, never the corner ring). Button clicks are voiced by one delegate on the panel root; self-voiced interactions mark the event so nothing doubles.
- New client fragment `client/12-motion.js`. Tests: 236 (was 229). `tests/motion.test.mjs` (fake AudioContext).

## 1.0.17 — 2026-11-09

- **Says when the host is stale.** The client reloads with every page refresh, but the host half only loads when the DSH process starts, so installing a new package and refreshing leaves the two halves on different versions (the owner's desktop DSH was serving a 1.0.14+ panel from a 1.0.10 host, and "reconstruct scene" failed with a bare `session required`). The build now stamps `package.json`'s version into the client (`__PULSE_CLIENT_VERSION__` → `CLIENT_VERSION`); when a snapshot reports a different `pluginVersion`, every view shows a banner naming both versions and saying to quit DSH from the tray and reopen it. Scene reconstruction, goal writes and the translation status show the same short hint instead of `session required` / `HTTP 404` / "waiting for data".
- Release note: bump `package.json` before `node tools/build-client.mjs`; `tests/build.test.mjs` fails if the client was built with another version.
- Tests: 229 (was 226). `tests/version.test.mjs`.

## 1.0.16 — 2026-11-09

- **The model suggests a goal.** With no DSH `/goal` and no workspace goal, the goal bar asks the host to infer one: the last few turns of the session (≤ 3000 characters, newest first) go to the default model through DSH's `llm` service (`purpose: "pulse-goal"`), which answers one Chinese sentence or `NONE`. The answer replaces the session title as the `?` proposal; it is still only a proposal until you click "use as goal". Requested only after a turn ends (never while the agent runs), at most once per session round from the panel and once per three rounds on the host (`force` re-runs), no automatic retry after a failure. Results live in memory and ride the snapshot as `goalProposal`. Settings: "suggest a goal with the model" (default on).
- **Tactical map mode.** A tactical grid behind the panel (24 px cells, an amber line every fourth, fading out from the centre; new "tactical grid" effect, off in performance mode). The goal bar becomes a mission tracker: clipped corner, "TRACKED" / "PROPOSED" tag, diamond marker, and a running DSH `/goal` draws its rounds as up to 24 progress segments (rust when blocked). The proposal tag hides below 380 px so the goal text keeps its room.
- Background model calls (translation, goal inference) share one `callModel` helper.
- Fix: inferred titles wrapped as `「…」。` kept the closing bracket.
- Tests: 226 (was 218). `tests/goal-infer.test.mjs`.

## 1.0.15 — 2026-11-09

- **Suggested favorites.** A "Worth saving?" strip above the Echo library proposes up to three finished turns of the open session, each with its reasons: you praised the result (quoting your reply), you accepted it, it delivered files, it recovered from tool errors, or it was a big turn (≥ 20 tools or ≥ 3 min). A turn followed by pushback ("不对", "还是不行", "报错"…) is never suggested; interrupted or unfinished turns neither. Nothing is saved until you click Save (the same POST as the bookmark button); Dismiss is remembered per session. No suggestions, no strip. No model call.
- Calibrated on the owner's 31 session logs: 249 finished turns → 20 suggestions (8%).
- DSH records the user message that starts a turn after `turn/start`; feedback for a turn is the first real user message after it ends, in either log order.
- New `suggest-core.js`, `GET /dsh-running-panel/echo?suggest=<sessionId>` (cached by event count and saved anchors), client fragment `client/12-echo-suggest.js`.
- Tests: 218 (was 212). `tests/suggest.test.mjs`.

## 1.0.14 — 2026-11-09

- **ECHO scene reconstruction.** The Echo detail dialog has an "ECHO //" strip: on demand it replays the saved turn from the session's event log — the prompt that started it, turn number, duration, steps, tool count, model and reasoning effort, input/output tokens, the skills loaded in that turn, a time track with one tick per tool call (position = start, width = duration, failures red, skill loads gold), and the slowest tools. Only names, times and counts; tool arguments and results are never copied. Open sessions read their in-memory events; closed ones read the on-disk log (parsed logs cached by mtime/size, 16 files).
- **Fix: archive search never saw closed sessions.** DSH appends one zstd frame per write and Node's `zstdDecompress` stops after the first frame, so every on-disk log decoded to its one-line `session` header. On the owner's machine: 31 logs, 0 searchable messages before, 5520 after. `decodeSessionLog` splits on frame magic, merges a split that turns out to be inside compressed data, and drops a half-written tail.
- New `scene-core.js`, `GET /dsh-running-panel/echo?scene=<id>`, client fragment `client/12-echo-scene.js`.
- Tests: 212 (was 205). `tests/scene.test.mjs` covers multi-frame decoding, the scene builder, the route against a two-frame log on disk, and the panel.

## 1.0.13 — 2026-11-09

- **New skills are translated automatically.** When an installed skill (live or parked) has no Chinese name, or a skill outside `catalog.js` has no Chinese description, the panel asks the host to translate it. The host calls DSH's own `llm` service (the same entry DSH uses for compaction and session titles) with the model from `agentDefaultModel`, 20 skills per call, `purpose: "pulse-translate"`, and writes the result through `updateCatalogOverlay`. It only fills gaps: Chinese names or descriptions that already exist, including manual renames, are never touched, and curated `catalog.js` skills never get a machine description over their curated one. Each written entry is recorded in the overlay's new `autoTranslated` section.
- Settings: "auto-translate new skills" (default on), a status line (pending / running with model / done / why it failed) and a "translate now" button. Auto-trigger fires once per new batch, never while running, and never retries after a failure on its own.
- Fails closed: no `llm` service, no default model, a timeout (120 s) or an unparseable reply writes nothing and says why.
- New `translate-core.js` and `/dsh-running-panel/translate` (GET status, POST start; same CSRF and body limits). Client fragment `client/12-translate.js`.
- Tests: 205 (was 197). `tests/translate.test.mjs` drives the route against a fake DSH `llm` service in a child host.

## 1.0.12 — 2026-11-09

- **Goal bar.** One row above the ring answers "what am I doing here". A running DSH `/goal` (session projection `goal`) takes the bar, read-only, with its phase and rounds; when it completes it is recorded once in history. Otherwise the bar shows the workspace's PULSE goal, stored in the Echo store as `kind: 'goal'` (shared 200 capacity, never shown as an Echo card) and scoped by session `cwd`. With neither, the session title is offered as a `?` proposal that writes nothing until accepted. Click opens a drawer: confirm / done / edit / new / remove, history (done and superseded, last 10) with reopen. Only the owner marks a PULSE goal done; a replaced goal is "superseded", not done.
- **Focus mode** (settings and drawer, default off): skill and tool rows not called since the current goal started drop to 40% opacity; hover restores them. A collapsed install group dims too when none of its items qualify. No goal, no dimming.
- The settings sheet shows the running plugin version (`PULSE v1.0.12`, from the snapshot's `pluginVersion`) in its bottom-right corner.
- New `goal-core.js` (pure model) and `/dsh-running-panel/goal` route (GET / POST / PATCH / DELETE, same CSRF and body limits as the other write routes). Client fragment `client/12-goal.js`.
- Tests: 197 (was 183). `tests/goal.test.mjs` covers the model, the routes in a child host (with fake live sessions), and the bar / input / focus helpers rendered with a shallow fake React.

## 1.0.11 — 2026-11-09

- **Skills grouped by install.** The host scans `~/.agents/skills` and `skills-parked` and works out which install each skill came from: `.skill-lock.json` source, git origin, `.claude-plugin/plugin.json`, `package.json` repository, installer marker files (`.mattpocock`), or else directories created in the same 2-minute window (joined to the batch's majority catalog library when there is one). Groups default to `author/repo`; hovering shows install date, description and repository; right-click renames (overlay `names["lib:<id>"]`), copies, opens the repo or pins. Applies to the skills list, cold layer, search results and history.
- **History shows its numbers.** A CSS rule hid every row's meta unless the panel was narrower than 380 px, so counts and work share never showed. Rows now read `×count · work p%`, grouped by install, parked skills included, top 40.
- **Running section reads top-down.** Items called this round float to the top (latest first); others sink by idle rounds and fade gradually instead of keeping entry order.
- The panel refetches the catalog when the snapshot's `catalogVersion` changes (new skills, regrouping, external overlay edits).
- Performance: the undo-journal snapshot is cached (invalidated on every move, 10 s fallback) instead of taking the SQLite lock on every push; the conversation corner polls a light `view=corner` snapshot; sessions idle for 6 h are folded into lifetime totals and dropped from memory; archive search keeps 2,000 chars per message.
- Echo delete uses an in-panel confirm dialog instead of `window.confirm`; the drag quote label is localized.
- `client.js` is now generated from `client/NN-*.js` by `tools/build-client.mjs` (plain concatenation, same runtime). `tests/build.test.mjs` fails if they drift.
- Tests: 183.

## 1.0.10 — 2026-11-09

Code review and fixes on top of 1.0.9. No UI, theme or feature removed.

- **Security:** write routes (`park`, `name`, `reveal`, `optimize`, Echo POST/PATCH/DELETE) refuse cross-site browser requests (`Sec-Fetch-Site: cross-site`, foreign `Origin`). Any web page could previously park skills or edit the overlay with a no-preflight `text/plain` POST. Request bodies are capped at 256 KB (413), malformed JSON is 400 instead of 500.
- **Crash:** `reveal` spawned `explorer.exe` with no `error` listener; on macOS/Linux the ENOENT became an uncaught exception that took the Host down. Now platform-aware (`explorer` / `open -R` / `xdg-open`), errors swallowed, and `/select,"path"` quoted the way Explorer expects.
- **Broken button:** "Open skills folder" posted an empty body that 1.0.9's reveal route rejected with 400. It now sends `{ kind: "root" }`; GET no longer has side effects (405).
- Rename / edit description write the current UI language column (`en` in the English UI). Previously everything landed in `zh`, so English renames reverted on reload. Local overrides are dropped once the refreshed catalog resolves the new value (handoff weak point 4).
- Park, reveal and repo link resolve a skill's frontmatter `name` to its directory; they used to assume both are the same.
- A rejected park (`missing`, `bad name`, `destination-conflict`…) no longer turns into a permanent red "undo store error" banner.
- Global view no longer lists up to 40 empty "untitled session" rows recreated from `usage.json` history.
- Session liveness probe: one directory index per TTL instead of O(workspaces) stats per Echo, ids validated as a single path segment, negative answers cached ≤ 5 s and re-checked against a rebuilt index.
- Archive search decompresses asynchronously (the sync zstd call froze the Host event loop) and caches parsed logs by mtime/size.
- `package.json` `files` was missing `session-store.js`, which `index.js` imports.
- Rename dialog: IME candidate Enter no longer submits; Esc closes; length limits shown before the request; save errors shown in the dialog (they used to fail silently with the dialog stuck open); Ctrl/⌘+Enter saves descriptions.
- Portal dialogs and the row menu stop React synthetic events from bubbling to the row (right-click inside the dialog reopened the menu) and carry design tokens on a shared `.__rp_portal` shell (handoff weak point 6). Row menu: readable in the light scheme, hover visible, measured viewport clamping (weak point 8), arrow-key navigation, disabled items for built-in skills.
- Clipboard copy falls back to `execCommand` when the async API rejects; Echo detail shows an error instead of "Loading…" forever; drag quotes clip by code point; `zh-CN` locales fall back to the `zh` name instead of English; duplicate dictionary keys removed.
- Tests: 179 (was 169). New `tests/hardening.test.mjs` exercises the routes in a child host, the probe, the undo store and the editor / portal / locale helpers behaviourally.

## 1.0.9 — 2026-11-09

- Trim the announcement-budget side column down to percentage plus used/limit. The token line, skill count, cost total and cold-layer line all restated the same figure inside a 360 px column.
- Call the saved-message library "Echo" in the Chinese UI (title, group header, save action) instead of 回声/回声库; prose still explains it once.
- Drag an Echo card straight into the composer. The drag payload carries a `text/plain` quote block (title, floor, question trimmed to 240 chars, answer to 600) plus `application/x-pulse-echo` for future drop targets.
- Echo detail renders as bubbles with selectable text, and copy now writes `text/plain` plus a paragraph-split `text/html`, so a paste keeps its line structure instead of collapsing into one block.
- Stop reporting live sessions as deleted. `sessionAlive` now falls back to the on-disk session store (`sessions/<workspace>/<id>/session.v4.jsonl.zstd`), tries both `session-<uuid>` and bare ids, and caches the answer for 30 s.
- Right-click menu on capability rows: insert into composer, rename, edit description, reveal the skill folder, open `SKILL.md`, copy name, copy id, pin/unpin, park.
- Rename and description edits write the user overlay (`names` / `descs`) through the existing locked atomic writer, then apply locally before the catalog refetch so the row updates immediately.
- Fix an invisible primary button in body-level dialogs: `--rp-amber` is not defined outside the panel root, so `background: var(--rp-amber)` dropped out and left dark text on a dark surface. Dialogs now carry their own tokens plus fallbacks.
- `EntryEditor` replaces `window.prompt`, which is a no-op in Electron and made renaming fail silently.

## 1.0.8 — 2026-11-07

- Preserve invalid/unreadable catalog overlays instead of treating them as empty. Share the `DSH_HOME` path between host and sync tool, merge existing translations, and use locked, flushed atomic replacement with external-edit detection.
- Retain the host's last valid translations during a bad external edit and expose an actionable catalog storage warning.
- Stop silently evicting old Echo entries at 200. Refuse a new anchor with an explicit, retryable capacity message; keep existing-anchor updates and oversized legacy libraries intact.
- Return to the exact Echo message through DSH's session history and chat-node identity, reveal collapsed content and verify visibility before reporting success. Bound history loading and cancel superseded navigation; report missing or unavailable anchors.
- Show live `pluginVersion` independently of schema versions, document portable/local identities, remove placeholder repository links, and add Windows/Ubuntu CI with Node 22.23.4 and 24.
- Preserve the existing layout and effects; reuse current warning styling for storage/capacity/navigation feedback.

## 1.0.7 — 2026-11-07

- The sun/moon button in the header now switches the panel itself, not just the contour studio palette: it locks the panel to paper or ink, so it works with the contour background turned off.
- Add a “Panel theme” choice in settings — Follow DSH / paper / ink. Locking a scheme wins over the host theme until you switch back to Follow DSH.
- The contour palette keeps its own control in the Contour settings section.

## 1.0.6 — 2026-11-07

- The theme finally follows a live switch. DSH marks its dark theme with `body[data-ds-dark-theme]`, so watching `<html>` alone missed every toggle: the watcher now observes `body` too, and reads `--dsw-alias-bg-base` from `body` before `html`.
- Fallback marks (`data-theme`, class names) are collected from `body` as well as `<html>`.
- Regression tests cover the body attribute, the token path and the system fallback.

## 1.0.5 — 2026-11-07

- Follow the host theme. When DSH runs on a light background the panel remaps to a paper palette instead of staying dark: text at ≥4.5:1, accents at ≥3:1, and the active-row cards become a warm tint instead of the host's white surface.
- Detect the theme from the host's `--dsw-alias-bg-base` token (body first, then `html`), then `data-theme` / `data-color-scheme` marks, then the system preference; watch `<html>` so a live theme switch is picked up.
- Dialogs that hardcoded a dark surface (confirm, settings sheet) follow the same palette.
- Add placement-free contrast regression tests for the paper palette.

## 1.0.4 — 2026-11-07

- Stop reporting DSH's own tools as “possibly stuck”: a tool that the catalog already knows (pwsh, web_fetch, read…) no longer raises the repeat-call warning; consecutive failures still do.
- Add a catalog overlay (`~/.dsh/running-panel/catalog-overlay.json`) merged by the host into `/catalog`: new skills and tools can carry a Chinese name and a one-line description without touching the code, and the file is re-read when it changes.
- Add `tools/catalog-sync.mjs` to list skills that have no catalog entry and to seed the English side of the overlay.
- Hover descriptions now prefer the overlay, then the built-in dictionaries, then the host text.

## 1.0.3 — 2026-11-07

- Move the 0.5 s hover description into a body-level fixed layer: it now paints above the panel and is no longer clipped by scroll containers or group cards.
- Localize that description: Chinese UI uses the built-in one-line dictionary for every cataloged tool (including MCP tools) and for known skills; English UI keeps the host-provided description.
- Place the layer inside the viewport, flipping above the row when the bottom edge is close.
- Add placement, dictionary coverage and zh/en key-parity regression tests.

## 1.0.2 — 2026-11-07

- Persist undo records with write-ahead intents and directory identity checks across host restarts.
- Retain conflicts and unresolved items for retry; protect malformed journals and reject unsafe moves.
- Restore access to pending undo through the existing budget dialog and styling.
- Add restart and failure-boundary regression coverage.

## 1.0.1 — 2026-11-07

- Preserve untouched session history across restart/save and retain newly active sessions at the history cap; protect unreadable stores from overwrite.
- Serialize Echo persistence and mutations, report save failures, and roll back failed favorites/edits/deletes.
- Separate budget previews from applied undo records; preserve unresolved conflicts and serialize directory moves.
- Retain cold-layer directory identity separately from display names, including duplicate display names.
- Mark static-only catalog entries accurately; ignore stale Echo and cross-session stream responses.
- Estimate model catalog costs from full descriptions and report actual token-meter/fallback sources; honor empty user-skill filters.
- Add host/client regression coverage while retaining the existing layout, colors, typography and effects.

## 1.0.0 — 2026-11-07

First public release, extracted from a working desktop setup (DSH 0.2.1-rc.5).

- Session HUD: category ring, budget line, skills/tools/cold-layer groups, search, history, echoes.
- Two-phase budget plan: dry run → confirm → apply → undo; pinned skills and libraries.
- Skill rows: call / repo / park / star on hover, 0.5 s description, real slash-menu reference chips.
- Corner ring in the conversation header; hides while the panel is open; can be disabled.
- Dark and paper themes; reduced-motion and effect toggles respected.
- Local-only: Host routes under `/dsh-running-panel/*`, no network calls.
- Removed the local auth-bypass route before publishing.
