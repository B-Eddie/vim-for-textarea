document.addEventListener("DOMContentLoaded", async function () {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('browser-api.js');
  document.head.appendChild(script);

  const enableCheckbox = document.getElementById("switch1");
  const themeDropdown = document.getElementById("themeDropdown");
  const indicatorDropdown = document.getElementById("indicatorDropdown");
  const siteToggle = document.getElementById("siteToggle");
  const siteDot = document.getElementById("siteDot");
  const siteName = document.getElementById("siteName");
  const blacklistTags = document.getElementById("blacklistTags");
  const blockCurrentSiteBtn = document.getElementById("blockCurrentSite");
  const motionsBtn = document.getElementById('openMotionsEditor');

  if (motionsBtn) {
    motionsBtn.addEventListener('click', () => {
      window.open(chrome.runtime.getURL('ui/motions.html'), '_blank');
    });
  }

  await new Promise(resolve => { script.onload = resolve; });

  let blacklist = [];
  let siteToggles = {};
  let currentHostname = "";

  function stripToBaseDomain(urlOrHost) {
    let s = urlOrHost.trim().toLowerCase();
    s = s.replace(/^https?:\/\//, '');
    s = s.replace(/\/.*$/, '');
    s = s.replace(/^www\./, '');
    return s;
  }

  function renderBlacklist() {
    blacklistTags.innerHTML = '';
    if (blacklist.length === 0) {
      blacklistTags.innerHTML = '<span style="font-size:12px;color:#999;">No sites blocked</span>';
      return;
    }
    blacklist.forEach((entry, i) => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = entry;
      const btn = document.createElement('button');
      btn.textContent = '\u00d7';
      btn.title = 'Remove';
      btn.addEventListener('click', async () => {
        blacklist.splice(i, 1);
        await window.browserAPI.storage.set({ blacklist });
        renderBlacklist();
        updateBlockButton();
      });
      tag.appendChild(btn);
      blacklistTags.appendChild(tag);
    });
  }

  function updateBlockButton() {
    if (!currentHostname) {
      blockCurrentSiteBtn.style.display = 'none';
      return;
    }
    blockCurrentSiteBtn.style.display = '';
    const isBlocked = blacklist.some(e => e === currentHostname);
    if (isBlocked) {
      blockCurrentSiteBtn.textContent = 'Unblock this site';
      blockCurrentSiteBtn.classList.remove('primary');
    } else {
      blockCurrentSiteBtn.textContent = 'Block this site';
      blockCurrentSiteBtn.classList.add('primary');
    }
  }

  try {
    const data = await window.browserAPI.storage.get(["enabled", "theme", "indicatorPosition", "blacklist", "siteToggles"]);
    enableCheckbox.checked = data.enabled ?? true;
    themeDropdown.value = data.theme ?? "vim";
    indicatorDropdown.value = data.indicatorPosition ?? "bottom";
    blacklist = data.blacklist || [];
    siteToggles = data.siteToggles || {};
    renderBlacklist();
  } catch (e) {
    console.error("Error loading settings:", e);
  }

  try {
    const tabs = await window.browserAPI.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0] && tabs[0].url) {
      const url = new URL(tabs[0].url);
      currentHostname = url.hostname.replace(/^www\./, '');
      siteName.textContent = currentHostname || 'New Tab';
      const isDisabled = siteToggles[currentHostname] === false;
      siteToggle.checked = !isDisabled;
      siteDot.className = 'dot ' + (isDisabled ? 'off' : 'on');
      updateBlockButton();

      siteToggle.addEventListener('change', async () => {
        const enabled = siteToggle.checked;
        siteToggles[currentHostname] = enabled;
        siteDot.className = 'dot ' + (enabled ? 'on' : 'off');
        await window.browserAPI.storage.set({ siteToggles });
      });
    } else {
      document.getElementById('siteSection').style.display = 'none';
      blockCurrentSiteBtn.style.display = 'none';
    }
  } catch (e) {
    document.getElementById('siteSection').style.display = 'none';
    blockCurrentSiteBtn.style.display = 'none';
  }

  blockCurrentSiteBtn.addEventListener('click', async () => {
    if (!currentHostname) return;
    const idx = blacklist.indexOf(currentHostname);
    if (idx >= 0) {
      blacklist.splice(idx, 1);
    } else {
      blacklist.push(currentHostname);
    }
    await window.browserAPI.storage.set({ blacklist });
    renderBlacklist();
    updateBlockButton();
  });

  async function saveSettings() {
    try {
      await window.browserAPI.storage.set({
        enabled: enableCheckbox.checked,
        theme: themeDropdown.value,
        indicatorPosition: indicatorDropdown.value,
      });
    } catch (e) {
      console.error("Error saving settings:", e);
    }
  }

  enableCheckbox.addEventListener("change", saveSettings);
  themeDropdown.addEventListener("change", saveSettings);
  indicatorDropdown.addEventListener("change", saveSettings);
});
