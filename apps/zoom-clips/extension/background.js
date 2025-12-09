// Background service worker for WORKWAY Zoom Sync
// Uses chrome.cookies API to capture ALL cookies including httpOnly

const WORKER_URL = 'https://meetings.workway.co';
const SYNC_ALARM = 'workway-zoom-sync';
const UPLOAD_SECRET = 'zoom-cookie-secret-2024';

// Auto-sync every 6 hours to keep session alive
chrome.alarms.create(SYNC_ALARM, { periodInMinutes: 6 * 60 });

// Listen for alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM) {
    syncCookies(true); // Auto-sync
  }
});

// Listen for extension install
chrome.runtime.onInstalled.addListener(() => {
  console.log('WORKWAY Zoom Sync installed');
});

// Get userId from storage (set via popup)
async function getUserId() {
  const result = await chrome.storage.local.get(['userId']);
  return result.userId || null;
}

// Sync cookies function
async function syncCookies(isAuto = false) {
  try {
    const userId = await getUserId();
    if (!userId) {
      if (!isAuto) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon48.png',
          title: 'WORKWAY - Zoom Sync',
          message: 'Please set your User ID in the extension popup first.'
        });
      }
      return { success: false, error: 'No userId configured' };
    }

    // Get all Zoom cookies (including httpOnly!)
    const cookies = await chrome.cookies.getAll({
      domain: '.zoom.us'
    });

    if (cookies.length === 0) {
      if (!isAuto) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon48.png',
          title: 'WORKWAY - Zoom Sync',
          message: 'No Zoom cookies found. Please login to Zoom first.'
        });
      }
      return { success: false, error: 'No cookies found' };
    }

    // Upload to worker
    const response = await fetch(`${WORKER_URL}/upload-cookies/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${UPLOAD_SECRET}`
      },
      body: JSON.stringify({ cookies })
    });

    const result = await response.json();

    if (result.success) {
      // Save last sync time
      await chrome.storage.local.set({
        lastSync: new Date().toISOString(),
        cookieCount: result.cookieCount || cookies.length
      });

      // Show notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'WORKWAY - Zoom Sync',
        message: `Connected! ${result.cookieCount || cookies.length} cookies synced.`
      });

      return result;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Sync failed:', error);

    if (!isAuto) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'WORKWAY - Zoom Sync',
        message: `Sync failed: ${error.message}`
      });
    }

    return { success: false, error: error.message };
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'syncNow') {
    syncCookies(false).then(sendResponse);
    return true; // Keep channel open for async response
  }

  if (request.action === 'getStatus') {
    chrome.storage.local.get(['lastSync', 'cookieCount', 'userId']).then(sendResponse);
    return true;
  }

  if (request.action === 'setUserId') {
    chrome.storage.local.set({ userId: request.userId }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});
