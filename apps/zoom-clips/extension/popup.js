// Popup script for WORKWAY Zoom Sync extension

// Initialize on popup open
document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadUserId();
  await updateStatus();
  setupEventListeners();
}

// Load saved userId
async function loadUserId() {
  try {
    const result = await chrome.storage.local.get(['userId']);
    if (result.userId) {
      document.getElementById('userId').value = result.userId;
    }
  } catch (error) {
    console.error('Failed to load userId:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Save User ID button
  document.getElementById('saveButton').addEventListener('click', saveUserId);

  // Sync Cookies button
  document.getElementById('syncButton').addEventListener('click', syncCookies);

  // Sync Workflow button (new - triggers full Zoom → Notion sync)
  document.getElementById('syncWorkflowButton').addEventListener('click', syncWorkflow);

  // Save on Enter key in userId field
  document.getElementById('userId').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') saveUserId();
  });
}

// Save userId to storage
async function saveUserId() {
  const userIdInput = document.getElementById('userId');
  const message = document.getElementById('message');
  const userId = userIdInput.value.trim();

  if (!userId) {
    message.innerHTML = '<span style="color: #f59e0b;">Please enter a User ID</span>';
    return;
  }

  try {
    await chrome.runtime.sendMessage({ action: 'setUserId', userId });
    message.innerHTML = '<span style="color: #10b981;">User ID saved</span>';
    updateStatus();

    // Clear message after 2 seconds
    setTimeout(() => {
      message.textContent = '';
    }, 2000);
  } catch (error) {
    message.innerHTML = `<span style="color: #ef4444;">${error.message}</span>`;
  }
}

// Sync cookies only (browser → worker)
async function syncCookies() {
  const button = document.getElementById('syncButton');
  const message = document.getElementById('message');
  const userId = document.getElementById('userId').value.trim();

  if (!userId) {
    message.innerHTML = '<span style="color: #f59e0b;">Please set User ID first</span>';
    return;
  }

  // Disable button and show loading
  button.disabled = true;
  button.textContent = 'Syncing...';
  message.textContent = '';

  try {
    // Ensure userId is saved before syncing
    await chrome.runtime.sendMessage({ action: 'setUserId', userId });

    // Send message to background script
    const result = await chrome.runtime.sendMessage({ action: 'syncNow' });

    if (result.success) {
      message.innerHTML = `<span style="color: #10b981;">Synced ${result.cookieCount} cookies</span>`;
      updateStatus();
    } else {
      message.innerHTML = `<span style="color: #ef4444;">${result.error}</span>`;
    }
  } catch (error) {
    message.innerHTML = `<span style="color: #ef4444;">${error.message}</span>`;
  } finally {
    button.disabled = false;
    button.textContent = 'Sync Cookies Only';
  }
}

// Sync full workflow (Zoom → Notion)
async function syncWorkflow() {
  const button = document.getElementById('syncWorkflowButton');
  const message = document.getElementById('message');
  const userId = document.getElementById('userId').value.trim();
  const days = parseInt(document.getElementById('syncDays').value) || 1;

  if (!userId) {
    message.innerHTML = '<span style="color: #f59e0b;">Please set User ID first</span>';
    return;
  }

  // Disable button and show loading
  button.disabled = true;
  button.textContent = 'Syncing...';
  message.textContent = '';

  try {
    // Call the workflow sync endpoint with Notion write enabled
    const response = await fetch(`https://meetings.workway.co/sync/${userId}?days=${days}&writeToNotion=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (result.success) {
      const clipCount = result.data?.clips?.length || 0;
      const meetingCount = result.data?.meetings?.length || 0;
      const notionWritten = result.data?.notion?.written || 0;

      // Show enhanced message if Notion write succeeded
      if (notionWritten > 0) {
        message.innerHTML = `<span style="color: #10b981;">✓ Synced ${clipCount} clips, ${meetingCount} meetings → ${notionWritten} written to Notion</span>`;
      } else {
        message.innerHTML = `<span style="color: #10b981;">✓ Synced ${clipCount} clips, ${meetingCount} meetings</span>`;
      }
    } else {
      message.innerHTML = `<span style="color: #ef4444;">${result.message || 'Sync failed'}</span>`;
    }
  } catch (error) {
    message.innerHTML = `<span style="color: #ef4444;">${error.message}</span>`;
  } finally {
    button.disabled = false;
    button.textContent = 'Sync Meetings & Clips';
  }
}

// Update status display
async function updateStatus() {
  try {
    const status = await chrome.runtime.sendMessage({ action: 'getStatus' });
    const statusText = document.getElementById('statusText');
    const lastSyncEl = document.getElementById('lastSync');
    const cookieCountEl = document.getElementById('cookieCount');

    // Update userId field if not already set
    if (status.userId && !document.getElementById('userId').value) {
      document.getElementById('userId').value = status.userId;
    }

    // Update status indicator
    if (status.userId) {
      if (status.lastSync) {
        statusText.textContent = 'Connected';
        statusText.style.color = '#10b981';
      } else {
        statusText.textContent = 'Ready to sync';
        statusText.style.color = '#f59e0b';
      }
    } else {
      statusText.textContent = 'Not configured';
      statusText.style.color = '#6b7280';
    }

    // Update last sync time
    if (status.lastSync) {
      const lastSyncDate = new Date(status.lastSync);
      const now = new Date();
      const diffMs = now - lastSyncDate;
      const diffMins = Math.floor(diffMs / 60000);

      let timeAgo;
      if (diffMins < 1) {
        timeAgo = 'Just now';
      } else if (diffMins < 60) {
        timeAgo = `${diffMins}m ago`;
      } else {
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) {
          timeAgo = `${diffHours}h ago`;
        } else {
          const diffDays = Math.floor(diffHours / 24);
          timeAgo = `${diffDays}d ago`;
        }
      }

      lastSyncEl.textContent = timeAgo;

      // Warn if sync is old (>20 hours)
      if (diffMs > 20 * 60 * 60 * 1000) {
        lastSyncEl.style.color = '#f59e0b';
      } else {
        lastSyncEl.style.color = '#fff';
      }
    } else {
      lastSyncEl.textContent = 'Never';
    }

    // Update cookie count
    cookieCountEl.textContent = status.cookieCount || '—';

  } catch (error) {
    console.error('Failed to get status:', error);
  }
}
