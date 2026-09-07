/**
 * Vim-For-Textarea - Page Script
 * Injected into the page context to simulate keyboard events on text inputs.
 */
const simulateKeyEvent = function (eventType, el, keyCode, control, alt, shift, meta) {
    if (!el) return;
    try {
        const eventInit = {
            bubbles: true, cancelable: true, view: window,
            ctrlKey: control, altKey: alt, shiftKey: shift, metaKey: meta,
            keyCode: keyCode, which: keyCode,
        };
        try {
            eventInit.key = getKeyFromCode(keyCode);
            eventInit.code = getKeyCodeMap()[keyCode] || '';
        } catch (e) {}
        const event = new KeyboardEvent(eventType, eventInit);
        try {
            Object.defineProperties(event, {
                keyCode: { get: function() { return keyCode; } },
                which: { get: function() { return keyCode; } }
            });
        } catch (e) {}
        el.dispatchEvent(event);
    } catch (e) {
        console.warn("VimForTextarea: key event dispatch failed:", e);
    }
};

const getKeyFromCode = function(keyCode) {
    const specialKeys = {
        8: 'Backspace', 9: 'Tab', 13: 'Enter', 27: 'Escape',
        33: 'PageUp', 34: 'PageDown', 35: 'End', 36: 'Home',
        37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown',
        46: 'Delete'
    };
    if (specialKeys[keyCode]) return specialKeys[keyCode];
    if (keyCode >= 32 && keyCode <= 126) return String.fromCharCode(keyCode);
    return '';
};

const getKeyCodeMap = function() {
    return {
        8: 'Backspace', 9: 'Tab', 13: 'Enter', 27: 'Escape',
        33: 'PageUp', 34: 'PageDown', 35: 'End', 36: 'Home',
        37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown',
        46: 'Delete'
    };
};

window.addEventListener("message", function(event) {
    if (event.source !== window) return;
    if (!event.data || !event.data.action || !event.data.action.startsWith('vim-key-')) return;
    const el = document.activeElement;
    if (!el) return;
    try {
        const data = event.data;
        const keyCode = data.keyCode || 0;
        const ctrl = !!data.ctrl;
        const alt = !!data.alt;
        const shift = !!data.shift;
        const meta = !!data.meta;
        if (data.action === 'vim-key-down') {
            simulateKeyEvent("keydown", el, keyCode, ctrl, alt, shift, meta);
        } else if (data.action === 'vim-key-up') {
            simulateKeyEvent("keyup", el, keyCode, ctrl, alt, shift, meta);
        }
    } catch (e) {
        console.error("VimForTextarea: error processing keyboard event:", e);
    }
});
