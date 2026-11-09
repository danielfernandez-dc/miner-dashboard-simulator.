import { createSimulator, logText } from './simulator.mjs';
const $ = selector => document.querySelector(selector);
const simulator = createSimulator();
let state, source = 'all', lastLogKey = '', lastTick = performance.now();
const sessionId = crypto.randomUUID();
const logChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`miner-logs-${sessionId}`) : null;
$('#raw-log').href = `/raw-log.html?session=${sessionId}`;
logChannel?.addEventListener('message', event => { if (event.data === 'request') publishLogs(); });
function publishLogs() { logChannel?.postMessage({ text: logText(simulator.state.logs), running: simulator.state.running }); }
const escapeHTML = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clock = seconds => [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':');
function control(type, value) {
  if (type === 'scenario') simulator.setScenario(value);
  else if (type === 'clear') simulator.state.logs = [];
  else if (type === 'reset') { simulator.reset(); lastTick = performance.now(); }
  else simulator.state[type] = value;
  state = simulator.snapshot();
  render(); publishLogs();
}
function renderLogs() {
  if (!state) return;
  const search = $('#search').value.toLowerCase(), level = $('#level').value;
  const logs = state.logs.filter(l => (source === 'all' || l.source === source) && (level === 'all' || l.level === level) && `${l.timestamp} ${l.level} ${l.source} ${l.message}`.toLowerCase().includes(search));
  const key = `${logs.map(l => l.id).join(',')}|${source}|${level}|${search}`;
  if (key !== lastLogKey) {
    lastLogKey = key;
    $('#log-output').innerHTML = logs.length ? logs.map(l => `<div class="log-row ${l.level === 'ERROR' ? 'error-line' : ''}"><span class="time">[${escapeHTML(l.timestamp.replace('T', ' ').replace('Z', ''))}]</span> <span class="${l.level.toLowerCase()}">${l.level.padEnd(5)}</span> ${escapeHTML(l.source)}: ${escapeHTML(l.message)}</div>`).join('') : 'No log entries match your filters.';
    if ($('#follow').checked) $('.terminal').scrollTop = $('.terminal').scrollHeight;
  }
  $('#line-count').textContent = `${logs.length} lines`;
  $('#retained-count').textContent = state.logs.length.toLocaleString();
}
function render() {
  const fault = state.scenario !== 'healthy';
  $('#notice').hidden = !fault;
  if (fault) $('#notice').textContent = `Simulated fault active: ${$('#scenario').querySelector(`option[value="${state.scenario}"]`).textContent}. Select Healthy mining to recover.`;
  $('#scenario').value = state.scenario; $('#interval').value = state.interval; $('#auto-errors').checked = state.automaticErrors;
  $('#status').textContent = fault ? 'Fault detected' : 'Mining'; $('#status').classList.toggle('fault', fault);
  $('#hashrate').innerHTML = `${state.hashrate.toFixed(2)} <small>TH/s</small>`;
  $('#temperature').innerHTML = `${state.temperature} <small>°C</small>`;
  $('#power').innerHTML = `${state.power.toLocaleString()} <small>W</small>`;
  $('#efficiency').textContent = state.hashrate ? `${(state.power / state.hashrate).toFixed(1)} J/TH` : 'Standby';
  $('#temp-meter').style.width = `${state.temperature}%`; $('#temp-meter').style.background = state.temperature > 85 ? '#e78269' : '#e5b668';
  $('#uptime').textContent = clock(state.uptime); $('#error-count').textContent = `${state.errors} errors`;
  $('#hash-note').textContent = fault ? '● Fault active' : '● Hashing normally'; $('#hash-note').className = fault ? 'bad' : 'green';
  $('#stream-status').textContent = state.running ? '● Stream live' : 'Ⅱ Stream paused';
  $('#terminal-status').textContent = state.running ? 'Receiving logs' : 'Stream paused';
  $('#pause').textContent = state.running ? 'Ⅱ Pause stream' : '▷ Resume stream';
  $('#chains').innerHTML = [0, 1, 2].map(i => { const missing = state.scenario === 'chain' && i === 2; return `<tr><td>Chain ${i}</td><td>${missing ? 0 : 126} / 126</td><td>${(missing ? 0 : state.hashrate / (state.scenario === 'chain' ? 2 : 3)).toFixed(2)} TH/s</td><td>${state.temperature - (i === 1 ? 0 : 2)} °C</td><td class="${missing || !state.hashrate ? 'bad' : 'ok'}">● ${missing ? 'Missing' : !state.hashrate ? 'Idle' : 'Normal'}</td></tr>`; }).join('');
  $('#fans').innerHTML = state.fans.map((rpm, i) => `<div class="fan"><span class="fan-icon">✣</span><div><small>FAN ${i + 1}</small><strong style="${rpm ? '' : 'color:#cb624c'}">${rpm.toLocaleString()}<span>RPM</span></strong></div></div>`).join('');
  $('#pool-status').textContent = state.scenario === 'pool' ? 'Disconnected' : 'Connected'; $('#pool-status').classList.toggle('fault', state.scenario === 'pool');
  renderLogs();
}
$('#scenario').onchange = event => control('scenario', event.target.value);
$('#interval').onchange = event => control('interval', Number(event.target.value));
$('#auto-errors').onchange = event => control('automaticErrors', event.target.checked);
$('#pause').onclick = () => state && control('running', !state.running);
$('#reset').onclick = () => control('reset'); $('#clear').onclick = () => control('clear');
$('#search').oninput = renderLogs; $('#level').onchange = renderLogs;
$('#follow').onchange = () => { if ($('#follow').checked) $('.terminal').scrollTop = $('.terminal').scrollHeight; };
document.querySelectorAll('[data-source]').forEach(button => button.onclick = () => { source = button.dataset.source; document.querySelectorAll('[data-source]').forEach(tab => { tab.classList.toggle('selected', tab === button); tab.setAttribute('aria-selected', String(tab === button)); }); renderLogs(); });
$('#download').onclick = () => {
  const url = URL.createObjectURL(new Blob([logText(simulator.state.logs)], { type: 'text/plain' }));
  const link = document.createElement('a'); link.href = url; link.download = 'miner.log'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
function update() {
  if (performance.now() - lastTick >= simulator.state.interval) { simulator.tick(); lastTick = performance.now(); publishLogs(); }
  state = simulator.snapshot(); render();
}
update(); setInterval(update, 200);
