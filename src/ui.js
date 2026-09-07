(function () {
  const THEMES = {
    vim: { bg: '#1a1a2e', text: '#e0e0e0', accent: '#00d4ff' },
    dark: { bg: '#1e1e1e', text: '#d4d4d4', accent: '#569cd6' },
    light: { bg: '#f8f9fa', text: '#212529', accent: '#0d6efd' },
    dracula: { bg: '#282a36', text: '#f8f8f2', accent: '#bd93f9' },
    monokai: { bg: '#272822', text: '#f8f8f2', accent: '#a6e22e' },
    solarized: { bg: '#002b36', text: '#839496', accent: '#b58900' },
  };

  class VimUIV2Internal {
    constructor() {
      this.theme = 'vim';
      this.position = 'bottom';
      this.modeText = '';
      this.bufferText = '';
      this.replaceMode = false;
      this.tempNormal = false;
      this.currentEditor = null;
      this.focused = false;
      this.blacklisted = false;
      this.editorResizeObserver = typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => this._updateEditorPosition())
        : null;
      this.ensureElements();
      this.render();
    }

    ensureElements() {
      this.ind = document.createElement('div');
      this.ind.id = 'vim-for-textarea-indicator';
      document.body.appendChild(this.ind);

      this.blockCursor = document.createElement('div');
      this.blockCursor.id = 'vim-for-textarea-block-cursor';
      Object.assign(this.blockCursor.style, {
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: '2147483646',
        display: 'none',
      });
      document.body.appendChild(this.blockCursor);

      const style = document.createElement('style');
      style.textContent = [
        'textarea.vim-hide-caret, input.vim-hide-caret { caret-color: transparent !important; }',
        '[contenteditable].vim-hide-caret { caret-color: transparent !important; }',
      ].join(' ');
      document.head.appendChild(style);
    }

    setTheme(theme) { this.theme = theme || 'vim'; this.render(); }
    setPosition(position) { this.position = position || 'bottom'; this.render(); }
    setMode(mode) { this.modeText = mode || ''; this.render(); }
    setReplaceMode(value) { this.replaceMode = !!value; this.render(); }
    setTempNormal(value) { this.tempNormal = !!value; this.render(); }
    setBufferText(value) { this.bufferText = value || ''; this.render(); }
    setBlacklisted(value) { this.blacklisted = !!value; this.render(); }
    setFocused(value) { this.focused = !!value; this.render(); }

    setCurrentEditor(editor) {
      if (this.currentEditor && this.currentEditor !== editor) {
        this.currentEditor.classList.remove('vim-hide-caret');
      }
      this.currentEditor = editor;
      if (this.editorResizeObserver) {
        this.editorResizeObserver.disconnect();
        if (editor) this.editorResizeObserver.observe(editor);
      }
      this.render();
    }

    _removeBlockCursor() {
      if (this.currentEditor) this.currentEditor.classList.remove('vim-hide-caret');
      this.blockCursor.style.display = 'none';
    }

    _applyBlockCursor() {
      if (!this.currentEditor || this.position === 'hidden' || this.blacklisted) return;
      this.currentEditor.classList.add('vim-hide-caret');
      this._positionBlockCursor();
    }

    _textBeforeCaret(editor) {
      if (editor.tagName === 'INPUT' || editor.tagName === 'TEXTAREA') {
        return editor.value.slice(0, editor.selectionStart);
      }
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return null;
      const range = selection.getRangeAt(0);
      const before = document.createRange();
      before.selectNodeContents(editor);
      before.setEnd(range.startContainer, range.startOffset);
      return before.toString();
    }

    _positionBlockCursor() {
      const editor = this.currentEditor;
      if (!editor) return;

      try {
        const before = this._textBeforeCaret(editor);
        if (before == null) return;

        const editorRect = editor.getBoundingClientRect();
        const computed = getComputedStyle(editor);
        const isSingleLine = editor.tagName === 'INPUT';
        const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.2;
        const paddingTop = parseFloat(computed.paddingTop) || 0;
        const paddingLeft = parseFloat(computed.paddingLeft) || 0;
        const borderLeft = parseFloat(computed.borderLeftWidth) || 0;
        const borderTop = parseFloat(computed.borderTopWidth) || 0;
        const theme = THEMES[this.theme] || THEMES.vim;
        const fontSize = parseFloat(computed.fontSize) || 16;

        if (isSingleLine) {
          // Canvas-based measurement for single-line inputs — immune to
          // CSS layout differences across sites.
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const canvasFont = `${computed.fontStyle} ${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`;
          ctx.font = canvasFont;
          const textWidth = ctx.measureText(before).width;
          const letterSpacing = parseFloat(computed.letterSpacing) || 0;
          const adjustedWidth = textWidth + (letterSpacing > 0 ? letterSpacing * before.length : 0);

          const x = editorRect.left + paddingLeft + borderLeft + adjustedWidth - (editor.scrollLeft || 0);
          const y = editorRect.top + borderTop + paddingTop - (editor.scrollTop || 0);

          Object.assign(this.blockCursor.style, {
            display: 'block',
            top: `${y}px`,
            left: `${x}px`,
            width: `${fontSize * 0.55}px`,
            height: `${lineHeight}px`,
            backgroundColor: theme.accent,
            borderRadius: '1px',
          });
          return;
        }

        // Multi-line textarea: use the mirror-div technique.
        // We build the mirror as a detached element, measure, then discard.
        const mirror = document.createElement('div');
        // Always use border-box so width/height from getBoundingClientRect()
        // match the editor's total rendered dimensions exactly.
        Object.assign(mirror.style, {
          position: 'fixed',
          boxSizing: 'border-box',
          left: `${editorRect.left}px`,
          top: `${editorRect.top}px`,
          width: `${editorRect.width}px`,
          height: `${editorRect.height}px`,
          visibility: 'hidden',
          overflow: 'hidden',
          margin: '0',
        });
        // Copy text-layout properties.  We intentionally skip boxSizing
        // (forced to border-box above).  Padding and border are copied so
        // the mirror's content area matches the editor's content area.
        const copied = [
          'font', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
          'letterSpacing', 'wordSpacing', 'textIndent', 'lineHeight',
          'textAlign', 'textTransform', 'wordBreak', 'overflowWrap',
          'padding', 'border', 'whiteSpace', 'direction',
          'tabSize', 'MozTabSize',
        ];
        copied.forEach(property => { mirror.style[property] = computed[property]; });
        if (fontSize < 1) mirror.style.fontSize = '16px';
        mirror.style.color = 'black';
        mirror.style.caretColor = 'auto';

        mirror.appendChild(document.createTextNode(before));
        const marker = document.createElement('span');
        marker.textContent = '\u200b';
        mirror.appendChild(marker);
        document.body.appendChild(mirror);
        mirror.scrollTop = editor.scrollTop || 0;
        mirror.scrollLeft = editor.scrollLeft || 0;

        const markerRect = marker.getBoundingClientRect();
        Object.assign(this.blockCursor.style, {
          display: 'block',
          top: `${markerRect.top}px`,
          left: `${markerRect.left}px`,
          width: `${fontSize * 0.55}px`,
          height: `${lineHeight}px`,
          backgroundColor: theme.accent,
          borderRadius: '1px',
        });
        mirror.remove();
      } catch (_) {
        this.blockCursor.style.display = 'none';
      }
    }

    _renderIndicator() {
      this.ind.innerHTML = '';
      if (this.position === 'hidden' || this.blacklisted || !this.focused) {
        this.ind.style.display = 'none';
        return;
      }

      const theme = THEMES[this.theme] || THEMES.vim;
      const isReplace = this.replaceMode && this.modeText === 'insert';
      const isTemporary = this.modeText === 'normal' && this.tempNormal;
      const mode = this.modeText === 'visualLine' ? 'V-LINE' :
        this.modeText === 'visual' ? 'VISUAL' :
        isReplace ? 'REPLACE' : (this.modeText || '').toUpperCase();
      const label = isTemporary
        ? (this.replaceMode ? '(Replace)' : '(Insert)')
        : mode;
      const compactLabel = isTemporary
        ? (this.replaceMode ? 'R*' : 'I*')
        : mode === 'V-LINE' ? 'V-L' :
          mode === 'VISUAL' ? 'V' :
          mode === 'NORMAL' ? 'N' :
          mode === 'INSERT' ? 'I' :
          mode === 'REPLACE' ? 'R' : mode;

      Object.assign(this.ind.style, {
        zIndex: '2147483647',
        fontFamily: 'monospace',
        pointerEvents: 'none',
        userSelect: 'none',
        color: theme.text,
        backgroundColor: theme.bg,
      });

      if (this.position === 'editor') {
        Object.assign(this.ind.style, {
          position: 'fixed',
          top: 'auto',
          right: 'auto',
          bottom: 'auto',
          left: '0',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 'max-content',
          maxWidth: 'none',
          boxSizing: 'border-box',
          minHeight: '0',
          padding: '1px 4px',
          border: `1px solid ${theme.accent}`,
          borderRadius: '2px',
          opacity: '0.82',
          boxShadow: 'none',
          whiteSpace: 'nowrap',
          overflow: 'visible',
          fontSize: '10px',
          lineHeight: '1.2',
          fontWeight: '700',
        });
        const modeElement = document.createElement('span');
        modeElement.style.color = theme.accent;
        modeElement.textContent = compactLabel;
        this.ind.appendChild(modeElement);
        this._updateEditorPosition();
        return;
      }

      Object.assign(this.ind.style, this.theme === 'vim' ? {
        position: 'fixed', top: 'auto', right: 'auto',
        bottom: '0', left: '0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        width: 'auto', maxWidth: 'none', minHeight: '0',
        border: 'none', borderRadius: '0', boxShadow: 'none',
        opacity: '1', overflow: 'visible', whiteSpace: 'normal',
        padding: '3px 10px', fontSize: '13px', boxSizing: 'border-box',
      } : {
        position: 'fixed', top: 'auto', left: 'auto',
        bottom: '20px', right: '20px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        width: 'auto', maxWidth: 'none', minHeight: '0',
        border: 'none',
        opacity: '1', overflow: 'visible', whiteSpace: 'normal',
        minWidth: '80px', padding: '8px 16px', borderRadius: '6px',
        fontSize: '13px', fontWeight: '600',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      });

      const modeElement = document.createElement('span');
      modeElement.textContent = this.theme === 'vim' ? `-- ${label} --` : label;
      const bufferElement = document.createElement('span');
      bufferElement.style.opacity = '0.7';
      bufferElement.style.fontSize = '11px';
      bufferElement.textContent = this.bufferText;
      this.ind.append(modeElement, bufferElement);
    }

    _updateEditorPosition() {
      if (this.position !== 'editor' || !this.currentEditor || this.ind.style.display === 'none') return;
      const rect = this.currentEditor.getBoundingClientRect();
      const top = rect.top - this.ind.offsetHeight;
      const left = rect.right - this.ind.offsetWidth;

      this.ind.style.top = `${top}px`;
      this.ind.style.left = `${left}px`;
      this.ind.style.right = 'auto';
    }

    render() {
      if (this.modeText === 'normal' && !this.tempNormal && this.focused && !this.blacklisted) {
        this._removeBlockCursor();
        this._applyBlockCursor();
      } else {
        this._removeBlockCursor();
      }
      this._renderIndicator();
    }
  }

  window.VimUIV2 = VimUIV2Internal;
})();
