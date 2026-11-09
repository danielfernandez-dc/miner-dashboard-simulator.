const session = new URLSearchParams(location.search).get('session');
if (session && typeof BroadcastChannel !== 'undefined') {
  const channel = new BroadcastChannel(`miner-logs-${session}`);
  let received = 0;
  channel.onmessage = event => {
    if (typeof event.data?.text !== 'string') return;
    received = Date.now();
    document.querySelector('#raw-log').textContent = event.data.text || 'Log is empty.';
    document.querySelector('#status').textContent = event.data.running ? 'Live log · simulated data' : 'Stream paused · simulated data';
  };
  channel.postMessage('request');
  setInterval(() => {
    channel.postMessage('request');
    if (received && Date.now() - received > 6000) document.querySelector('#status').textContent = 'Dashboard inactive or closed · last received logs';
  }, 2000);
}
