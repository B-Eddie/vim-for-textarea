(() => {
  const IS_BROWSER = typeof browser !== "undefined";
  const API = IS_BROWSER ? browser : chrome;

  let parser = null;
  let debug = false;
  let useDisplayLines = false;
  let executor = null;
  let mode = "insert";
  let tempNormal = false;
  let replaceMode = false;
  let uiTheme = "vim";
  let indicatorPosition = "bottom";
  let ui = null;
  let vimEnabled = true;
  let currentEditor = null;
  let blacklist = [];
  let siteToggles = {};
  let hostname = "";
  let escapeBlurs = true;
  let tabFocusNext = true;
  const editorModes = new WeakMap();
  const handledKeyEvents = new WeakSet();
  let listenersAttached = false;

  window.__VIM_CURRENT_EDITOR__ = () => currentEditor;

  function log(...args) {
    if (debug) console.log("[VimForTextarea]", ...args);
  }

  function mapCtrlKeyName(key) {
    const value = typeof key === "string" ? key : "";
    const specials = {
      " ": "SPACE",
      ArrowUp: "Up",
      ArrowDown: "Down",
      ArrowLeft: "Left",
      ArrowRight: "Right",
      Escape: "ESC",
      Enter: "CR",
      Backspace: "BS",
      Tab: "TAB",
    };
    if (specials[value]) return specials[value];
    if (value.length === 1) return value.toUpperCase();
    return value;
  }

  function isEscapeEvent(e) {
    return !!e && (
      e.key === "Escape" ||
      e.key === "Esc" ||
      e.code === "Escape" ||
      e.keyCode === 27 ||
      e.which === 27
    );
  }

  function isOtherExtensionActive() {
    try {
      if (document.querySelector(
        '.vimiumHintMarker, .vimiumFindMode, [data-vimium], .cvim_link, .cVim-link-hint'
      )) return true;
    } catch (_) {}
    return false;
  }

  function eventToToken(e) {
    if (!e) return null;

    const key = typeof e.key === "string" ? e.key : "";
    if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && (key === "[" || e.keyCode === 219 || e.which === 219)) {
      return "<C-[>";
    }
    if (isEscapeEvent(e)) return "<ESC>";
    if (e.metaKey) return null;
    if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
      if (!key) return null;
      return `<C-${mapCtrlKeyName(key)}>`;
    }
    if (key.length === 1) return key;
    return ({ Enter: "<CR>", Backspace: "<BS>", Tab: "<TAB>" })[key] || null;
  }

  function isTextEditor(el) {
    if (!el) return false;
    if (el.tagName === "TEXTAREA") return true;
    if (el.tagName === "INPUT") {
      const t = (el.type || "").toLowerCase();
      return t === "text" || t === "" || t === "search" || t === "url" || t === "email" || t === "password" || t === "tel" || t === "number";
    }
    if (el.isContentEditable) return true;
    const role = (el.getAttribute("role") || "").toLowerCase();
    if (role === "textbox" || role === "searchbox") return true;
    return false;
  }

  function findEditor() {
    const el = document.activeElement;
    if (isTextEditor(el)) return el;
    return null;
  }

  function focusEditor(editor) {
    if (!editor || typeof editor.focus !== "function") return;
    currentEditor = editor;
    try {
      editor.focus({ preventScroll: true });
    } catch (_) {
      editor.focus();
    }
  }

  function focusNextElement() {
    const focusable = document.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const arr = Array.from(focusable);
    const idx = arr.indexOf(document.activeElement);
    const next = arr[(idx + 1) % arr.length];
    if (next) {
      next.focus();
      currentEditor = isTextEditor(next) ? next : null;
    }
  }

  function shouldShowIndicator() {
    return shouldActivate();
  }

  function isBlacklisted() {
    const result = blacklist.some((entry) => {
      entry = entry.trim().toLowerCase();
      if (!entry) return false;
      if (entry.startsWith("*.")) {
        const domain = entry.slice(2);
        return hostname === domain || hostname.endsWith("." + domain);
      }
      return hostname === entry || hostname.includes(entry);
    });
    return result;
  }

  function isSiteEnabled() {
    if (siteToggles[hostname] === true) return true;
    if (siteToggles[hostname] === false) return false;
    return true;
  }

  function shouldActivate() {
    if (!vimEnabled) return false;
    if (isBlacklisted()) return false;
    if (!isSiteEnabled()) return false;
    return true;
  }

  function finishParsedCommand(result) {
    const wasNormal = mode === "normal";
    executor.exec(result);
    if (ui) ui.setBufferText("");
    const id = result && result.command && result.command.id;
    if (id && id.startsWith("exit_")) {
      tempNormal = false;
      replaceMode = false;
      if (wasNormal && escapeBlurs && currentEditor) currentEditor.blur();
    } else if (id === "insert_temp_normal") {
      return;
    } else if (tempNormal) {
      tempNormal = false;
      setMode("insert");
    }
  }

  function feedConfiguredToken(token) {
    const result = parser.feed(token);
    if (!result) return true;
    if (result.kind === "invalid") {
      if (ui) ui.setBufferText("");
      return true;
    }
    if (result.kind === "prefix" || result.kind === "await_char") {
      if (ui) ui.setBufferText((result.keys || []).join(""));
      return true;
    }
    if (result.kind === "command") {
      finishParsedCommand(result);
    } else {
      executor.exec(result);
      if (ui) ui.setBufferText("");
      if (tempNormal) {
        tempNormal = false;
        setMode("insert");
      }
    }
    return true;
  }

  function onKeyDown(e) {
    if (!e.isTrusted || handledKeyEvents.has(e)) return;
    handledKeyEvents.add(e);
    if (!shouldActivate() || !parser || !executor) return;

    const token = eventToToken(e);
    if (!token) return;

    if (mode === "insert") {
      const commandMeta = parser.commandMetaForToken(token);
      const commandStart = parser.isCommandBinding(token);
      const commandPending = parser.buffer && parser.buffer.length > 0;
      const isReplaceChar = commandMeta && commandMeta.id === "insert_replace_char";
      if (commandPending || (commandStart && (!isReplaceChar || replaceMode) && !(isEscapeEvent(e) && isOtherExtensionActive()))) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        feedConfiguredToken(token);
      }
      return;
    }

    const editor = findEditor();
    if (!editor) return;
    currentEditor = editor;

    try {
      if (token === "<TAB>" && (!tabFocusNext || !parser.isCommandBinding(token))) return;
      if (e.ctrlKey && !parser.isBinding(token)) return;
      if (!parser.isBinding(token)) return;
      if (isEscapeEvent(e) && isOtherExtensionActive()) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      feedConfiguredToken(token);
    } catch (err) {
      if (debug) console.error("[VimForTextarea] parser error", err);
    }
  }

  function attachKeyListener() {
    if (listenersAttached) return;
    listenersAttached = true;

    // Install the low-level capture handler once, before page handlers.
    window.addEventListener("keydown", onKeyDown, true);

    document.addEventListener(
      "focusin",
      (e) => {
        if (!shouldActivate() || !isTextEditor(e.target)) return;
        if (currentEditor && currentEditor !== e.target) {
          editorModes.set(currentEditor, mode);
        }
        currentEditor = e.target;
        const saved = editorModes.get(e.target);
        if (saved !== undefined) {
          setMode(saved);
        } else {
          setMode("insert");
        }
        if (ui) {
          ui.setFocused(true);
          ui.setCurrentEditor(e.target);
        }
      },
      true
    );

    const updateIndicatorPosition = () => {
      if (!ui) return;
      if (mode === "normal" && !tempNormal && currentEditor) {
        ui._positionBlockCursor();
      }
      ui._updateEditorPosition();
    };

    document.addEventListener("scroll", updateIndicatorPosition, true);
    window.addEventListener("resize", updateIndicatorPosition);

    document.addEventListener(
      "focusout",
      (e) => {
        if (!shouldActivate()) {
          if (ui) {
            ui.setFocused(false);
            ui._removeBlockCursor();
          }
          return;
        }
        if (isTextEditor(e.target)) {
          editorModes.set(e.target, mode);
        }
        if (ui && e.target === currentEditor) {
          ui.setFocused(false);
          ui._removeBlockCursor();
        }
      },
      true
    );
  }

  function migrateConfig(stored, base) {
    const storedVersion = stored.schemaVersion || 1;
    const baseVersion = base.schemaVersion || 1;
    if (storedVersion >= baseVersion) return stored;

    log(`Migrating config from schema v${storedVersion} to v${baseVersion}`);
    const migrated = JSON.parse(JSON.stringify(stored));
    migrated.schemaVersion = baseVersion;
    return migrated;
  }

  function getStorage(area, keys) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (data) => {
        if (!settled) {
          settled = true;
          resolve(data || {});
        }
      };
      try {
        const result = API.storage[area].get(keys, finish);
        if (result && typeof result.then === "function") {
          result.then(finish, () => finish({}));
        }
      } catch (_) {
        finish({});
      }
    });
  }

  async function loadConfig() {
    try {
      const base = await window.loadVimMotionsConfig();
      const settings = await getStorage("sync", [
        "debug", "useDisplayLines", "theme", "enabled", "blacklist",
        "siteToggles", "indicatorPosition", "escapeBlurs", "tabFocusNext"
      ]);
      debug = !!settings.debug;
      useDisplayLines = !!settings.useDisplayLines;
      uiTheme = settings.theme || "vim";
      vimEnabled = settings.enabled !== false;
      blacklist = Array.isArray(settings.blacklist) ? settings.blacklist : [];
      siteToggles = settings.siteToggles && typeof settings.siteToggles === "object" ? settings.siteToggles : {};
      indicatorPosition = settings.indicatorPosition || "bottom";
      escapeBlurs = settings.escapeBlurs !== false;
      tabFocusNext = settings.tabFocusNext !== false;
      try { window.__VIM_DEBUG__ = debug; } catch (_) {}
      try { window.__VIM_USE_DISPLAY_LINES__ = useDisplayLines; } catch (_) {}

      return new Promise((resolve) => {
        try {
          API.storage.local.get(["motionsConfig"], (localData) => {
            const finishWith = (src) => {
              if (!src) { resolve(base); return; }
              try {
                const parsed = typeof src === "string" ? JSON.parse(src) : src;
                const migrated = migrateConfig(parsed, base);
                resolve(migrated);
              } catch (e) {
                console.warn("Invalid motionsConfig in storage, using base file", e);
                resolve(base);
              }
            };
            if (localData && typeof localData.motionsConfig !== "undefined") {
              finishWith(localData.motionsConfig);
            } else {
              try {
                API.storage.sync.get(["motionsConfig"], (syncData) => {
                  if (syncData && typeof syncData.motionsConfig !== "undefined") {
                    finishWith(syncData.motionsConfig);
                  } else {
                    resolve(base);
                  }
                });
              } catch (e) {
                resolve(base);
              }
            }
          });
        } catch (e) {
          resolve(base);
        }
      });
    } catch (e) {
      console.error("Failed to load motions config", e);
      return { motions: [], operators: [], textObjects: [], operatorSelf: [], settings: {} };
    }
  }

  async function init() {
    const cfg = await loadConfig();
    parser = new window.VimMotionParser(cfg);
    log("Initialized with config", cfg);

    try {
      ui = new VimUIV2();
      ui.setTheme(uiTheme);
      ui.setPosition(indicatorPosition);
      ui.setBlacklisted(!shouldShowIndicator());
      const editor = findEditor();
      if (editor) {
        currentEditor = editor;
        ui.setCurrentEditor(editor);
        ui.setFocused(true);
      }
      setMode(mode);
    } catch (_) {}

    // Initialize executor with modeAPI and settingsAPI
    const modeAPI = {
      setMode: (m) => setMode(m),
      getMode: () => mode,
      isVisual: () => mode === "visual" || mode === "visualLine",
      getReplaceMode: () => replaceMode,
      setReplaceMode: (v) => {
        replaceMode = !!v;
        if (ui) ui.setReplaceMode(replaceMode);
      },
      setTempNormal: (v) => { tempNormal = !!v; },
      focusNext: () => focusNextElement(),
    };
    const settingsAPI = {
      getUseDisplayLines: () => useDisplayLines,
    };

    executor = window.createVimExecutor(modeAPI, settingsAPI);

    try {
      API.storage.onChanged.addListener((changes, area) => {
        if (area === "sync") {
          if (changes && changes.debug) {
            debug = !!changes.debug.newValue;
            window.__VIM_DEBUG__ = debug;
          }
          if (changes && changes.useDisplayLines) {
            useDisplayLines = !!changes.useDisplayLines.newValue;
            window.__VIM_USE_DISPLAY_LINES__ = useDisplayLines;
          }
          if (changes && changes.theme) {
            uiTheme = changes.theme.newValue || "vim";
            if (ui) ui.setTheme(uiTheme);
          }
          if (changes && changes.enabled) {
            vimEnabled = !!changes.enabled.newValue;
            if (ui) ui.setBlacklisted(!shouldShowIndicator());
          }
          if (changes && changes.blacklist) {
            blacklist = changes.blacklist.newValue || [];
            if (ui) ui.setBlacklisted(!shouldShowIndicator());
          }
          if (changes && changes.siteToggles) {
            siteToggles = changes.siteToggles.newValue || {};
            if (ui) ui.setBlacklisted(!shouldShowIndicator());
          }
          if (changes && changes.indicatorPosition) {
            indicatorPosition = changes.indicatorPosition.newValue || "bottom";
            if (ui) ui.setPosition(indicatorPosition);
          }
          if (changes && changes.escapeBlurs) {
            escapeBlurs = !!changes.escapeBlurs.newValue;
          }
          if (changes && changes.tabFocusNext) {
            tabFocusNext = !!changes.tabFocusNext.newValue;
          }
        }

        if (changes && changes.motionsConfig) {
          try {
            const nv = changes.motionsConfig.newValue;
            if (typeof nv !== "undefined") {
              const newCfg = typeof nv === "string" ? JSON.parse(nv) : nv;
              parser.setConfig(newCfg);
              parser.reset();
            } else {
              loadConfig().then((baseCfg) => {
                parser.setConfig(baseCfg);
                parser.reset();
              });
            }
          } catch (e) {
            if (debug) console.warn("[VimForTextarea] Failed to apply motionsConfig change", e);
          }
        }
      });
    } catch (_) {}

    try {
      API.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg && msg.action === "reloadMotionsConfig") {
          loadConfig().then((newCfg) => {
            parser.setConfig(newCfg);
            parser.reset();
            sendResponse({ ok: true });
          });
          return true;
        } else if (msg && msg.action === "updateSettings" && msg.settings) {
          try {
            if (typeof msg.settings.debug !== "undefined") {
              debug = !!msg.settings.debug;
              window.__VIM_DEBUG__ = debug;
            }
            if (typeof msg.settings.theme !== "undefined") {
              uiTheme = msg.settings.theme || "vim";
              if (ui) ui.setTheme(uiTheme);
            }
            log("Updated debug setting", debug);
            sendResponse({ ok: true });
          } catch (e) {
            console.warn("Failed to apply settings update", e);
            sendResponse({ ok: false, error: String(e) });
          }
          return true;
        }
        return false;
      });
    } catch (_) {}
  }

  function setMode(newMode) {
    mode = newMode;
    try {
      if (parser && typeof parser.setMode === "function") parser.setMode(newMode);
    } catch (_) {}
    if (debug) console.log("[VimForTextarea] ->", mode, tempNormal ? "(temp)" : "");
    try {
      if (ui) {
        ui.setTempNormal(!!tempNormal);
        ui.setReplaceMode(!!replaceMode);
        ui.setMode(mode);
      }
    } catch (_) {}
  }

    hostname = location.hostname.replace(/^www\./, "");
    attachKeyListener();

    if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();