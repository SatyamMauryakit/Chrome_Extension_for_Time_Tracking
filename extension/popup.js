function renderList(logs) {
  const timeList = document.getElementById("timeList");
  timeList.innerHTML = "";
  const sorted = Object.entries(logs).sort((a,b) => b[1]-a[1]);
  sorted.forEach(([url, seconds]) => {
    const minutes = Math.round(seconds / 60);
    const li = document.createElement("li");
    li.textContent = `${url} — ${minutes} min`;
    timeList.appendChild(li);
  });
}

function refresh() {
  chrome.storage.local.get(["timeLogs"], (result) => {
    const logs = result.timeLogs || {};
    renderList(logs);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  refresh();
  document.getElementById("refresh").addEventListener("click", refresh);
  document.getElementById("viewAnalytics").addEventListener("click", () => {
    chrome.tabs.create({ url: "http://localhost:3000/dashboard" });
  });
});
