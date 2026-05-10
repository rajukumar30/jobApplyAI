document.addEventListener('DOMContentLoaded', () => {
  const extractBtn = document.getElementById('extractBtn');
  const statusBox = document.getElementById('statusBox');
  const statusText = document.getElementById('statusText');
  const spinner = document.getElementById('spinner');
  const syncKeyInput = document.getElementById('syncKeyInput');

  // Load saved Sync Key
  chrome.storage.local.get(['jobApplySyncKey'], (result) => {
    if (result.jobApplySyncKey) {
      syncKeyInput.value = result.jobApplySyncKey;
    }
  });

  // Listen to progress updates from content script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PROGRESS') {
      statusText.innerText = message.payload;
    }
  });

  extractBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('linkedin.com/mynetwork/invite-connect/connections')) {
        alert('Please open the LinkedIn Connections page first.');
        chrome.tabs.create({ url: 'https://www.linkedin.com/mynetwork/invite-connect/connections/' });
        return;
      }

      const extractBtn = document.getElementById('extractBtn');
      const limitSelect = document.getElementById('limitSelect');
      const syncKey = syncKeyInput.value.trim();

      if (!syncKey) {
        alert('Please enter your JobApply Sync Key from the Dashboard.');
        return;
      }

      // Save it for next time
      chrome.storage.local.set({ jobApplySyncKey: syncKey });
      
      // UI State
      extractBtn.disabled = true;
      extractBtn.innerText = 'Extracting...';
      limitSelect.disabled = true;
      syncKeyInput.disabled = true;
      statusBox.classList.remove('hidden');
      spinner.classList.remove('hidden');
      statusText.innerText = 'Starting extraction loop...';
      
      const userLimit = parseInt(limitSelect.value, 10);

      // Inject the dynamic limit variable first
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (limit) => { window.JOBAPPLY_EXTRACT_LIMIT = limit; },
        args: [userLimit]
      });

      // Inject and execute content script
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });

      if (result && result.error) {
        statusText.innerText = result.error;
        spinner.classList.add('hidden');
        extractBtn.disabled = false;
        limitSelect.disabled = false;
        extractBtn.innerText = 'Extract Connections';
        return;
      }

      if (result && result.success) {
        statusText.innerText = '📤 Pushing data to JobApply AI...';
        
        const connections = result.data;
        const BATCH_SIZE = 100;
        let totalSent = 0;
        let totalHRSaved = 0;

        // Sequence Batches
        for (let i = 0; i < connections.length; i += BATCH_SIZE) {
          const batch = connections.slice(i, i + BATCH_SIZE);
          
          try {
            const res = await fetch('http://localhost:5000/api/dm/import-connections', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ connectionsBatch: batch, syncKey })
            });

            if (!res.ok) throw new Error('API request failed');
            const json = await res.json();
            totalSent += batch.length;
            totalHRSaved += (json.parsedHRCount || 0);
            statusText.innerText = `📡 Sent ${totalSent} / ${connections.length} connections... (${totalHRSaved} HR found)`;
          } catch (apiErr) {
            console.error('API Error:', apiErr);
            statusText.innerText = '❌ Error syncing with backend. Is the server running?';
            break;
          }
        }

        spinner.classList.add('hidden');
        statusText.innerText = `✅ Done! Extracted ${connections.length} connections. ${totalHRSaved} HR contacts saved to your Dashboard.`;
        extractBtn.innerText = 'Extract Again';
        extractBtn.disabled = false;
        limitSelect.disabled = false;
        syncKeyInput.disabled = false;
      }

    } catch (err) {
      console.error(err);
      statusText.innerText = 'An error occurred during extraction.';
      spinner.classList.add('hidden');
      extractBtn.disabled = false;
      limitSelect.disabled = false;
      syncKeyInput.disabled = false;
      extractBtn.innerText = 'Extract Connections';
    }
  });
});
