async function loadData(userId) {
  try {
    const res = await fetch(`/api/logs?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) throw new Error('Failed to fetch');
    const data = await res.json();
    return data.logs || [];
  } catch (e) {
    console.error(e);
    return [];
  }
}

function groupByHost(logs) {
  const ignoreHosts = ["localhost", "127.0.0.1", "newtab"];
  const map = {};
  logs.forEach(l => {
    const hostname = l.url || 'unknown';
    if (ignoreHosts.includes(hostname)) return; // skip unwanted hosts
    map[hostname] = (map[hostname] || 0) + (Number(l.duration) || 0);
  });
  return map;
}




function renderChart(map) {
  const labels = Object.keys(map);
  const values = labels.map(l => Math.round(map[l] / 60)); // minutes

  const ctx = document.getElementById('chart').getContext('2d');
  if (window.__myChart) window.__myChart.destroy();
  window.__myChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        label: 'Time (min)',
        data: values
      }]
    },
    options: {
      plugins: { legend: { position: 'right' } }
    }
  });
}

document.getElementById('load').addEventListener('click', async () => {
  const userId = document.getElementById('userId').value || 'default-user-1';
  const logs = await loadData(userId);
  const map = groupByHost(logs);
  renderChart(map);
  document.getElementById('raw').textContent = `Total records: ${logs.length}`;
});
