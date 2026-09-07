# Vim-For-Textarea

Vim-For-Textarea is a browser extension that brings Vim-like navigation and editing to **any textarea, input field, or contenteditable element on any website**. Whether you're writing a GitHub issue, filling out a form, or editing code in a web-based IDE - Vim motions work everywhere.

## Features

- **Universal**: Works on textareas, input fields, and contenteditable elements across all websites
- **Vim Motions**: Full support for h/j/k/l navigation, word motions (w/b/e), line motions (0/^/$), search (f/t/;), and more
- **Operators**: Delete (d), Change (c), Yank (y), with text objects (iw, aw, i", a", etc.)
- **Visual Mode**: Character and line visual selection with operators
- **Customizable**: Edit key bindings through the built-in Motions Editor
- **Themes**: 6 beautiful themes - Vim, Dark, Light, Dracula, Monokai, Solarized
- **Website Blacklist**: Ignore specific websites where vim motions aren't wanted
- **Per-Site Toggle**: Enable or disable vim on a per-site basis from the popup
- **Minimal Permissions**: Only needs `storage` permission

## Installation

### Chrome
1. Download or clone this repository
2. Open `chrome://extensions/` in Chrome
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `src/` folder

### Firefox
1. Download or clone this repository
2. Open `about:debugging#/runtime/this-firefox` in Firefox
3. Click "Load Temporary Add-on" and select any file in the `src/` folder

## Usage

1. Click on any textarea, input field, or contenteditable element on any website
2. Press **Esc** to enter Normal mode
3. Use Vim motions to navigate and edit
4. Press **i** to return to Insert mode

### Key Bindings (Default)

| Mode | Key | Action |
|------|-----|--------|
| Normal | h/j/k/l | Move left/down/up/right |
| Normal | w/b/e | Word forward/back/end |
| Normal | 0/^/$ | Line start/first non-blank/end |
| Normal | gg/G | First/last line |
| Normal | f{char}/F{char} | Find character forward/backward |
| Normal | d{motion} | Delete |
| Normal | c{motion} | Change |
| Normal | y{motion} | Yank (copy) |
| Normal | p/P | Paste after/before |
| Normal | u | Undo |
| Normal | Ctrl+r | Redo |
| Normal | v/V | Visual/Visual line mode |
| Normal | i/a/o | Insert before/after/open line |
| Normal | x | Delete character |
| Normal | ~ | Toggle case |
| Insert | Esc | Return to Normal mode |
| Insert | Ctrl+o | One Normal mode command |

## Configuration

### Popup Settings
- **Vim enabled**: Toggle vim on/off globally
- **Theme**: Choose from 6 themes (Vim, Dark, Light, Dracula, Monokai, Solarized)
- **Current site toggle**: Enable/disable vim for the current website
- **Ignored websites**: Add websites where vim should never activate (supports wildcards like `*.google.com`)

### Advanced Settings
- **Debug logging**: Enable console logging for debugging
- **j/k use display lines**: Makes j/k move by visual lines instead of newline characters

### Motions Editor
Click "Motions Editor" in the popup to customize all key bindings, operators, text objects, and commands. Changes are validated in real-time and applied instantly.

## How It Works

Vim-For-Textarea intercepts key events when a text input element is focused and maps them to Vim-like motions. The extension:

1. Detects when a textarea, input[type=text], or contenteditable element receives focus
2. Intercepts keydown events in the capture phase
3. Parses multi-key sequences using a trie-based parser
4. Executes motions and commands by directly manipulating the element's value and selection

## Contributing

Contributions, issues, and feature requests are welcome! Feel free to check [Issues](https://github.com/greenstorm5417/Vim-For-Textarea/issues) or submit a pull request.

## Inspired By

Vim-For-Textarea is based on [Vim-For-Docs](https://github.com/greenstorm5417/Vim-For-Docs), extended to work on any website.

*Vim-For-Textarea – Vim motions for any text input!*
