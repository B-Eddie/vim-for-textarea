document.addEventListener("DOMContentLoaded", async function () {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('browser-api.js');
  document.head.appendChild(script);
  await new Promise(resolve => { script.onload = resolve; });

  const debugSwitch = document.getElementById('debugSwitch');
  const useDisplayLinesSwitch = document.getElementById('useDisplayLinesSwitch');
  const escapeBlursSwitch = document.getElementById('escapeBlursSwitch');
  const tabFocusNextSwitch = document.getElementById('tabFocusNextSwitch');

  try {
    const data = await window.browserAPI.storage.get(["debug", "useDisplayLines", "escapeBlurs", "tabFocusNext"]);
    debugSwitch.checked = data.debug ?? false;
    useDisplayLinesSwitch.checked = data.useDisplayLines ?? false;
    escapeBlursSwitch.checked = data.escapeBlurs ?? true;
    tabFocusNextSwitch.checked = data.tabFocusNext ?? true;
  } catch (e) {
    console.error('Failed to read storage', e);
  }

  async function save() {
    const settings = { 
      debug: debugSwitch.checked,
      useDisplayLines: useDisplayLinesSwitch.checked,
      escapeBlurs: escapeBlursSwitch.checked,
      tabFocusNext: tabFocusNextSwitch.checked,
    };
    try {
      await window.browserAPI.storage.set(settings);
    } catch (e) {
      console.error('Failed to save settings:', e.message || e);
    }
  }

  debugSwitch.addEventListener('change', save);
  useDisplayLinesSwitch.addEventListener('change', save);
  escapeBlursSwitch.addEventListener('change', save);
  tabFocusNextSwitch.addEventListener('change', save);
});
