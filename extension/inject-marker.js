// inject-marker.js
// This content script runs on the JobApply dashboard (localhost / Render)
// and silently injects a hidden <div> that the website checks to confirm
// the extension is installed and active.

(function () {
  if (document.getElementById('jobapply-ext-installed')) return; // already injected

  const marker = document.createElement('div');
  marker.id = 'jobapply-ext-installed';
  marker.setAttribute('data-version', '1.0.0');
  marker.style.cssText = 'display:none !important; position:absolute; pointer-events:none;';
  document.documentElement.appendChild(marker);
})();
