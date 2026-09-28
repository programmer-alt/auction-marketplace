import type { Request, Response } from "express";
import { register } from "./metrics";

export async function dashboardHandler(_req: Request, res: Response) {
  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Auction Marketplace — Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0f172a; color: #e2e8f0; padding: 24px; }
    h1 { text-align: center; margin-bottom: 24px; color: #38bdf8; font-size: 1.8rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: #1e293b; border-radius: 12px; padding: 20px; border: 1px solid #334155; }
    .card h3 { color: #94a3b8; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
    .card .value { font-size: 2rem; font-weight: 700; color: #38bdf8; }
    .card .sub { font-size: 0.8rem; color: #64748b; margin-top: 4px; }
    .charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 16px; }
    .chart-card { background: #1e293b; border-radius: 12px; padding: 20px; border: 1px solid #334155; }
    .chart-card h3 { color: #94a3b8; font-size: 0.9rem; margin-bottom: 12px; }
    canvas { max-height: 250px; }
    #lastUpdate { text-align: center; color: #475569; font-size: 0.8rem; margin-top: 16px; }
    .error { color: #ef4444; text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <h1>📊 Auction Marketplace Dashboard</h1>
  <div class="grid" id="kpiCards">
    <div class="card"><h3><span class="status ok"></span>HTTP Запросы</h3><div class="value" id="httpTotal">—</div><div class="sub">Всего</div></div>
    <div class="card"><h3><span class="status ok"></span>Ср. время</h3><div class="value" id="httpAvg">—</div><div class="sub">сек</div></div>
    <div class="card"><h3><span class="status ok"></span>WebSocket</h3><div class="value" id="wsConns">—</div><div class="sub">Подкл.</div></div>
    <div class="card"><h3><span class="status ok"></span>Auctions</h3><div class="value" id="auctionsCreated">—</div><div class="sub">Создано</div></div>
    <div class="card"><h3><span class="status ok"></span>Bids</h3><div class="value" id="bidsCreated">—</div><div class="sub">Сделано</div></div>
    <div class="card"><h3><span class="status ok"></span>Payments</h3><div class="value" id="paymentsProcessed">—</div><div class="sub">Обработ.</div></div>
  </div>
  <div class="charts">
    <div class="chart-card"><h3>HTTP Latency</h3><canvas id="latencyChart"></canvas></div>
    <div class="chart-card"><h3>По методам</h3><canvas id="methodsChart"></canvas></div>
    <div class="chart-card"><h3>По статусам</h3><canvas id="statusChart"></canvas></div>
    <div class="chart-card"><h3>Память (MB)</h3><canvas id="memoryChart"></canvas></div>
  </div>
  <div id="lastUpdate"></div>
  <div class="error" id="errorMsg"></div>
  <script>
    const parseMetrics = (text) => {
      const data = {};
      const lines = text.split(/\n/);
      
      for (const line of lines) {
        // Пропускаем комментарии и пустые строки
        if (line.startsWith('#') || line.trim() === '') continue;
        
        // Регулярное выражение для обработки метрик Prometheus
        // Поддерживает форматы: metric_name value или metric_name{label="value",...} value
        const regex = /^([a-zA-Z_][a-zA-Z0-9_:]*)({[^}]*})?\s+([^\s]+)$/;
        const match = line.match(regex);
        
        if (match) {
          const fullName = match[1];
          const labelsStr = match[2];
          const valueStr = match[3];
          
          let value;
          if (valueStr.toLowerCase() === 'nan') {
            value = 0;
          } else if (valueStr.toLowerCase() === 'inf') {
            value = Infinity;
          } else {
            value = parseFloat(valueStr);
          }
          
          // Если значение не число, пропускаем
          if (isNaN(value)) continue;
          
          // Разбор лейблов
          let labels = [];
          if (labelsStr) {
            // Разбираем лейблы, учитывая возможные значения в кавычках
            const labelPairs = labelsStr.split(',');
            for (const pair of labelPairs) {
              const separatorIndex = pair.indexOf('=');
              if (separatorIndex !== -1) {
                const key = pair.substring(0, separatorIndex).trim();
                let val = pair.substring(separatorIndex + 1).trim();
                
                // Удаляем кавычки из значения
                if (val.startsWith('"') && val.endsWith('"')) {
                  val = val.substring(1, val.length - 1);
                }
                
                if (key && val) {
                  labels.push({ key: key, value: val });
                }
              }
            }
          }
          
          // Если это гистограмма или счетчик с суффиксом
          let baseName = fullName;
          let metricType = 'gauge'; // по умолчанию
            
          if (fullName.endsWith('_count')) {
            baseName = fullName.slice(0, -6);
            metricType = 'counter';
          } else if (fullName.endsWith('_sum')) {
            baseName = fullName.slice(0, -4);
            metricType = 'histogram_sum';
          } else if (fullName.includes('_bucket')) {
            baseName = fullName.split('_bucket')[0];
            metricType = 'histogram_bucket';
          }
          
          // Инициализируем структуру для метрики
          if (!data[baseName]) {
            data[baseName] = {
              value: 0,
              labels: [],
              values: [],
              type: metricType,
              count: 0,
              sum: 0,
              buckets: []
            };
          }
          
          // Обновляем данные в зависимости от типа метрики
          if (metricType === 'counter' || metricType === 'gauge') {
            data[baseName].value = value;
          } else if (metricType === 'histogram_sum') {
            data[baseName].sum = value;
          } else if (metricType === 'histogram_bucket') {
            // Для bucket сохраняем информацию о пороге и значении
            const bucketRegex = /le="([^"]+)"/;
            const bucketMatch = labelsStr.match(bucketRegex);
            const leValue = bucketMatch ? bucketMatch[1] : '+Inf';
            data[baseName].buckets.push({ le: leValue, value: value });
          }
          
          // Сохраняем лейблы и значения для метрик с лейблами
          if (labels.length > 0) {
            data[baseName].labels.push(labels);
            data[baseName].values.push(value);
          }
        }
      }
      
      return data;
    };
    let latencyChart, methodsChart, statusChart, memoryChart;
    function initCharts() {
      const common = { responsive: true, plugins: { legend: { labels: { color: '#94a3b8' } } }, scales: { x: { ticks: { color: '#64748b' }, grid: { color: '#334155' } }, y: { ticks: { color: '#64748b' }, grid: { color: '#334155' }, beginAtZero: true } } };
      latencyChart = new Chart(document.getElementById('latencyChart'), { type: 'bar', data: { labels: [], datasets: [{ label: 'Latency', data: [], backgroundColor: '#38bdf8' }] }, options: common });
      methodsChart = new Chart(document.getElementById('methodsChart'), { type: 'doughnut', data: { labels: [], datasets: [{ data: [], backgroundColor: ['#38bdf8','#22c55e','#f59e0b','#ef4444'] }] }, options: { responsive: true, plugins: { legend: { labels: { color: '#94a3b8' } } } } });
      statusChart = new Chart(document.getElementById('statusChart'), { type: 'bar', data: { labels: [], datasets: [{ label: 'Requests', data: [], backgroundColor: '#22c55e' }] }, options: common });
      memoryChart = new Chart(document.getElementById('memoryChart'), { type: 'line', data: { labels: [], datasets: [{ label: 'Used', data: [], borderColor: '#a855f7', backgroundColor: 'rgba(168,85,247,0.1)', fill: true }, { label: 'Total', data: [], borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.1)', fill: true }] }, options: { ...common, animation: { duration: 300 } } });
    }
    async function update() {
      try {
        const res = await fetch('/metrics');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();
        const m = parseMetrics(text);
        document.getElementById('errorMsg').textContent = '';
        const httpTotal = m.http_requests_total?.value || 0;
        const httpSum = m.http_request_duration_seconds_sum?.value || 0;
        const httpCnt = m.http_request_duration_seconds_count?.value || 0;
        document.getElementById('httpTotal').textContent = httpTotal.toLocaleString();
        document.getElementById('httpAvg').textContent = httpCnt > 0 ? (httpSum / httpCnt).toFixed(3) : '—';
        document.getElementById('wsConns').textContent = m.websocket_connections_current?.value || 0;
        document.getElementById('auctionsCreated').textContent = m.auctions_created_total?.value || 0;
        document.getElementById('bidsCreated').textContent = m.bids_created_total?.value || 0;
        document.getElementById('paymentsProcessed').textContent = m.payments_processed_total?.value || 0;
        const lb = m.http_request_duration_seconds_bucket;
        if (lb && lb.values && lb.values.length > 0) {
          latencyChart.data.labels = lb.labels.map(l => l === '+Inf' ? '>5s' : '<' + l + 's');
          latencyChart.data.datasets[0].data = lb.values;
          latencyChart.update();
        }
        const methodData = {};
        const httpC = m.http_requests_total;
        if (httpC && httpC.labels) {
          httpC.labels.forEach((lbl, i) => {
            const method = lbl?.method || 'unknown';
            methodData[method] = (methodData[method] || 0) + (httpC.values?.[i] || 0);
          });
          methodsChart.data.labels = Object.keys(methodData);
          methodsChart.data.datasets[0].data = Object.values(methodData);
          methodsChart.update();
        }
        const statusData = {};
        if (httpC && httpC.labels) {
          httpC.labels.forEach((lbl, i) => {
            const status = lbl?.status_code || 'unknown';
            statusData[status] = (statusData[status] || 0) + (httpC.values?.[i] || 0);
          });
          statusChart.data.labels = Object.keys(statusData);
          statusChart.data.datasets[0].data = Object.values(statusData);
          statusChart.update();
        }
        const heapUsed = m.nodejs_heap_size_used_bytes?.value || 0;
        const heapTotal = m.nodejs_heap_size_total_bytes?.value || 0;
        const now = new Date().toLocaleTimeString();
        memoryChart.data.labels.push(now);
        memoryChart.data.datasets[0].data.push(Math.round(heapUsed / 1048576));
        memoryChart.data.datasets[1].data.push(Math.round(heapTotal / 1048576));
        if (memoryChart.data.labels.length > 30) {
          memoryChart.data.labels.shift();
          memoryChart.data.datasets.forEach(d => d.data.shift());
        }
        memoryChart.update();
        document.getElementById('lastUpdate').textContent = 'Обновлено: ' + now;
      } catch (e) {
        console.error('Error:', e);
        document.getElementById('errorMsg').textContent = 'Ошибка: ' + e.message;
      }
    }
    initCharts();
    update();
    setInterval(update, 5000);
  </script>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}
