// Popup script for WORKWAY Zoom Sync extension
// "Nicely Said" writing style: clear, friendly, human

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
  document.getElementById('saveButton').addEventListener('click', saveUserId);
  document.getElementById('syncButton').addEventListener('click', syncCookies);
  document.getElementById('syncWorkflowButton').addEventListener('click', syncWorkflow);
  document.getElementById('userId').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') saveUserId();
  });
}

// Show message with style
function showMessage(type, title, detail = '') {
  const message = document.getElementById('message');
  message.className = `message visible ${type}`;
  message.innerHTML = detail 
    ? `<div class="message-title">${title}</div><div class="message-detail">${detail}</div>`
    : `<div class="message-title">${title}</div>`;
}

// Hide message
function hideMessage() {
  document.getElementById('message').className = 'message';
}

// Show/hide progress
function showProgress(text) {
  document.getElementById('progress').className = 'progress visible';
  document.getElementById('progressText').textContent = text;
}

function hideProgress() {
  document.getElementById('progress').className = 'progress';
}

// Save userId to storage
async function saveUserId() {
  const userIdInput = document.getElementById('userId');
  const userId = userIdInput.value.trim();

  if (!userId) {
    showMessage('error', 'Please enter your ID first');
    return;
  }

  try {
    await chrome.runtime.sendMessage({ action: 'setUserId', userId });
    showMessage('success', 'Got it!', 'Your ID is saved.');
    updateStatus();
    setTimeout(hideMessage, 3000);
  } catch (error) {
    showMessage('error', 'Couldn\'t save that', error.message);
  }
}

// Sync cookies only (browser → worker)
async function syncCookies() {
  const button = document.getElementById('syncButton');
  const userId = document.getElementById('userId').value.trim();

  if (!userId) {
    showMessage('error', 'Add your ID first', 'We need to know where to save your session.');
    return;
  }

  button.disabled = true;
  hideMessage();
  showProgress('Refreshing your Zoom session...');

  try {
    await chrome.runtime.sendMessage({ action: 'setUserId', userId });
    const result = await chrome.runtime.sendMessage({ action: 'syncNow' });

    hideProgress();

    if (result.success) {
      showMessage('success', 'Session refreshed!', `Connected with ${result.cookieCount} cookies. You're all set.`);
      updateStatus();
    } else {
      showMessage('error', 'Session refresh failed', friendlyError(result.error));
    }
  } catch (error) {
    hideProgress();
    showMessage('error', 'Something went wrong', friendlyError(error.message));
  } finally {
    button.disabled = false;
  }
}

// Sync full workflow (Zoom → Notion)
async function syncWorkflow() {
  const button = document.getElementById('syncWorkflowButton');
  const userId = document.getElementById('userId').value.trim();
  const days = parseInt(document.getElementById('syncDays').value) || 7;

  if (!userId) {
    showMessage('error', 'Add your ID first', 'We need to know where to send your notes.');
    return;
  }

  button.disabled = true;
  hideMessage();
  showProgress('Gathering your meetings and clips...');

  try {
    const response = await fetch(`https://meetings.workway.co/sync/${userId}?days=${days}&writeToNotion=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const result = await response.json();
    hideProgress();

    if (result.success) {
      const clipCount = result.data?.clips?.length || 0;
      const meetingCount = result.data?.meetings?.length || 0;
      const notion = result.data?.notion;
      const total = clipCount + meetingCount;

      if (notion?.status === 'queued') {
        showMessage('success', 
          `Found ${total} items — sending to Notion now`,
          `${clipCount} clips and ${meetingCount} meetings. They'll appear in your database shortly.`
        );
      } else if (total === 0) {
        showMessage('info',
          'Nothing new to sync',
          `No meetings or clips found in the last ${days} day${days > 1 ? 's' : ''}.`
        );
      } else {
        showMessage('success',
          `Synced ${total} items`,
          `${clipCount} clips and ${meetingCount} meetings are ready.`
        );
      }
    } else {
      // Handle specific error cases with friendly messages
      if (result.error?.includes('expired') || result.needsAuth) {
        showMessage('error', 
          'Your Zoom session expired',
          'Click "Refresh Zoom Session" to reconnect, then try again.'
        );
      } else {
        showMessage('error', 'Sync didn\'t complete', friendlyError(result.error || result.message));
      }
    }
  } catch (error) {
    hideProgress();
    if (error.message?.includes('Failed to fetch')) {
      showMessage('error', 
        'Couldn\'t reach the server',
        'Check your internet connection and try again.'
      );
    } else {
      showMessage('error', 'Something went wrong', friendlyError(error.message));
    }
  } finally {
    button.disabled = false;
  }
}

// Convert technical errors to friendly messages
function friendlyError(error) {
  if (!error) return 'Please try again.';
  
  if (error.includes('No cookies')) {
    return 'Log into Zoom in Chrome first, then click "Refresh Zoom Session".';
  }
  if (error.includes('expired')) {
    return 'Your session timed out. Click "Refresh Zoom Session" to reconnect.';
  }
  if (error.includes('timeout') || error.includes('Timeout')) {
    return 'This is taking longer than usual. Try again in a moment.';
  }
  if (error.includes('Target closed') || error.includes('session')) {
    return 'Lost connection to Zoom. Click "Refresh Zoom Session" to fix this.';
  }
  
  // Truncate long technical errors
  if (error.length > 100) {
    return 'Something unexpected happened. Try refreshing your session.';
  }
  
  return error;
}

// Update status display
async function updateStatus() {
  try {
    const status = await chrome.runtime.sendMessage({ action: 'getStatus' });
    const statusText = document.getElementById('statusText');
    const statusDot = document.getElementById('statusDot');
    const lastSyncEl = document.getElementById('lastSync');
    const cookieCountEl = document.getElementById('cookieCount');

    // Update userId field if not already set
    if (status.userId && !document.getElementById('userId').value) {
      document.getElementById('userId').value = status.userId;
    }

    // Update status indicator with friendly language
    if (status.userId) {
      if (status.lastSync) {
        const lastSyncDate = new Date(status.lastSync);
        const now = new Date();
        const diffMs = now - lastSyncDate;
        const hoursOld = diffMs / (1000 * 60 * 60);

        if (hoursOld > 20) {
          statusText.textContent = 'Session getting stale';
          statusDot.className = 'status-dot yellow';
        } else {
          statusText.textContent = 'Connected';
          statusDot.className = 'status-dot green';
        }
      } else {
        statusText.textContent = 'Ready to connect';
        statusDot.className = 'status-dot yellow';
      }
    } else {
      statusText.textContent = 'Not set up yet';
      statusDot.className = 'status-dot gray';
    }

    // Update last sync time with friendly format
    if (status.lastSync) {
      const lastSyncDate = new Date(status.lastSync);
      const now = new Date();
      const diffMs = now - lastSyncDate;
      const diffMins = Math.floor(diffMs / 60000);

      let timeAgo;
      if (diffMins < 1) {
        timeAgo = 'Just now';
      } else if (diffMins < 60) {
        timeAgo = `${diffMins} min ago`;
      } else {
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) {
          timeAgo = diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
        } else {
          const diffDays = Math.floor(diffHours / 24);
          timeAgo = diffDays === 1 ? 'Yesterday' : `${diffDays} days ago`;
        }
      }

      lastSyncEl.textContent = timeAgo;
      lastSyncEl.style.color = diffMs > 20 * 60 * 60 * 1000 ? '#f59e0b' : '#fff';
    } else {
      lastSyncEl.textContent = 'Not yet';
      lastSyncEl.style.color = 'rgba(255,255,255,0.5)';
    }

    // Update cookie count
    cookieCountEl.textContent = status.cookieCount || '—';

  } catch (error) {
    console.error('Failed to get status:', error);
  }
}
