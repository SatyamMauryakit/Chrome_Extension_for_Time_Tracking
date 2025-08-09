let activeTabId = null;
let startTime = null;
let isTracking = false;

const BATCH_INTERVAL_MS = (10/2) * 1000; // send to backend every 10s
const ACTIVE_LOG_INTERVAL_MS = (60/2) * 1000; // log active tab every 1 min
const BACKEND_URL = "http://localhost:3000/api/logs";
const USER_ID = "default-user-1";

let pendingLogs = [];

// Blocklist
const blocklist = [
  "localhost",
  "127.0.0.1",
  "newtab",
  "chrome://",
  "file://"
];

// URL validator
function isValidUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      /^https?:/.test(url) &&
      !blocklist.some(blocked =>
        parsed.hostname.includes(blocked) || url.startsWith(blocked)
      )
    );
  } catch {
    return false;
  }
}

const persistPending = () => chrome.storage.local.set({ pendingLogs });

const queueLog = (log) => {
  pendingLogs.push(log);
  persistPending();
};

const sendPending = async () => {
  if (!pendingLogs.length) return;
  const toSend = pendingLogs.splice(0, pendingLogs.length);
  persistPending();

  try {
    const resp = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: USER_ID, logs: toSend })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  } catch (err) {
    console.error("Send failed, restoring logs", err);
    pendingLogs = toSend.concat(pendingLogs);
    persistPending();
  }
};

const updateLocalLogs = (hostname, seconds) => {
  chrome.storage.local.get(["timeLogs"], (result) => {
    const logs = result.timeLogs || {};
    logs[hostname] = (logs[hostname] || 0) + seconds;
    chrome.storage.local.set({ timeLogs: logs });
  });
};

const logPreviousTabDuration = async (now) => {
  if (!activeTabId || !startTime || !isTracking) return;
  try {
    const prevTab = await chrome.tabs.get(activeTabId);
    if (!prevTab.url || !isValidUrl(prevTab.url)) return;

    const hostname = new URL(prevTab.url).hostname;
    const seconds = Math.max(0, Math.round((now - startTime) / 1000));

    if (seconds > 8 * 3600) return; // skip unrealistic
    if (seconds === 0) return; // skip empty logs

    updateLocalLogs(hostname, seconds);
    queueLog({ url: hostname, duration: seconds, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("Error logging previous tab:", err);
  }
};

// Tab activated
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const now = Date.now();
  await logPreviousTabDuration(now);

  const currentTab = await chrome.tabs.get(activeInfo.tabId);
  if (isValidUrl(currentTab.url)) {
    activeTabId = activeInfo.tabId;
    startTime = now;
    isTracking = true;
  } else {
    isTracking = false;
    activeTabId = null;
    startTime = null;
  }
});

// Tab updated
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId === activeTabId && changeInfo.url && isValidUrl(changeInfo.url)) {
    const now = Date.now();
    await logPreviousTabDuration(now);
    activeTabId = tabId;
    startTime = now;
    isTracking = true;
  }
});

// Window focus changed
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  const now = Date.now();
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await logPreviousTabDuration(now);
    isTracking = false;
    activeTabId = null;
    startTime = null;
  } else {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab && isValidUrl(tab.url)) {
      activeTabId = tab.id;
      startTime = now;
      isTracking = true;
    }
  }
});

// Tab closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (tabId === activeTabId) {
    const now = Date.now();
    await logPreviousTabDuration(now);
    activeTabId = null;
    startTime = null;
    isTracking = false;
  }
});

// Track even without tab change
setInterval(async () => {
  if (isTracking && activeTabId && startTime) {
    const now = Date.now();
    await logPreviousTabDuration(now);
    startTime = now; // reset timer
  }
}, ACTIVE_LOG_INTERVAL_MS);

// Init tracking
const initTracking = async () => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab && isValidUrl(tab.url)) {
    activeTabId = tab.id;
    startTime = Date.now();
    isTracking = true;
    console.log("Tracking started on:", tab.url);
  }
};

chrome.runtime.onStartup.addListener(initTracking);
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ timeLogs: {}, pendingLogs: [] });
  initTracking();
  chrome.storage.local.get(["pendingLogs"], (result) => {
    pendingLogs = result.pendingLogs || [];
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(["pendingLogs"], (result) => {
    pendingLogs = result.pendingLogs || [];
  });
});

// Send batch periodically
setInterval(sendPending, BATCH_INTERVAL_MS);
