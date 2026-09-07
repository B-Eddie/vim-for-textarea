(function() {
  'use strict';

  // Simplified line numbers module for generic textarea support
  // The original Google Docs-specific line numbers relied on .kix-* selectors
  // and Docs-specific DOM structure. This stub provides the API surface
  // but does not render line numbers on generic websites.

  let enabled = false;

  function updateLineMarkers() {
    // No-op: relative line numbers for generic textareas require
    // a textarea overlay approach which is complex and fragile.
  }

  function clearMarkers() {
    const markers = document.querySelectorAll('.vim-line-number-marker');
    markers.forEach(m => m.remove());
  }

  function toggleLineNumbers(show) {
    enabled = show;
    if (!enabled) clearMarkers();
    return enabled;
  }

  function init() {}

  window.relativeLineNumbers = {
    update: updateLineMarkers,
    toggle: toggleLineNumbers,
    clear: clearMarkers
  };
})();
