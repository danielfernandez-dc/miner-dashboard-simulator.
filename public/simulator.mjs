export const scenarios = {
  healthy: ['Healthy mining', 'INFO', 'miner', 'All chains operational; accepted share'],
  temperature: ['Overtemperature', 'ERROR', 'miner', 'Chain 1 chip temperature 92 C exceeds limit 85 C; thermal protection activated'],
  fan: ['Fan failure', 'ERROR', 'system', 'Fan 2 speed 0 RPM below minimum 1000 RPM; fan lost, mining stopped'],
  pool: ['Pool disconnected', 'ERROR', 'miner', 'Stratum connection to pool 0 interrupted: connection timed out; reconnecting'],
  chain: ['Missing hashboard', 'ERROR', 'miner', 'Chain 2 ASIC enumeration failed: found 0 of 126 chips; hashboard disabled'],
  psu: ['Power supply fault', 'ERROR', 'system', 'PSU voltage abnormal: 10.2 V; power supply initialization failed'],
};
export function createSimulator() {
  let sequence = 0;
  const state = { scenario: 'healthy', running: true, interval: 2000, automaticErrors: false, started: Date.now(), logs: [] };
  const add = (level, source, message) => {
    state.logs.push({ id: ++sequence, timestamp: new Date().toISOString(), level, source, message });
    if (state.logs.length > 2000) state.logs.splice(0, state.logs.length - 2000);
  };
  const setScenario = name => {
    if (!Object.hasOwn(scenarios, name)) throw new Error('Unknown scenario');
    state.scenario = name;
    const [, level, source, message] = scenarios[name];
    add(level, source, message);
    if (name === 'healthy') add('INFO', 'system', 'Fault conditions cleared; miner resumed normal operation');
  };
  const reset = () => {
    Object.assign(state, { scenario: 'healthy', running: true, interval: 2000, automaticErrors: false, started: Date.now(), logs: [] });
    add('INFO', 'system', 'Linux boot: Antminer S19 Pro simulator / VNISH-style test firmware');
    add('INFO', 'system', 'Network ready: hostname atlas-lab / simulated address 192.168.1.101');
    for (let i = 0; i < 3; i++) add('INFO', 'miner', `Chain ${i}: found 126 ASIC chips; initialization successful`);
    add('INFO', 'autotune', 'Autotune complete: 650 MHz / 13.2 V / target 110 TH/s');
    add('INFO', 'miner', 'Stratum connection established; pool 0 authorized worker atlas.lab');
    for (let i = 0; i < 12; i++) add('INFO', 'miner', `Accepted share #${i + 1} diff 65536; chain ${i % 3}`);
  };
  const tick = () => {
    if (!state.running) return;
    if (state.automaticErrors && Math.random() < 0.16) {
      const keys = Object.keys(scenarios).slice(1);
      setScenario(keys[Math.floor(Math.random() * keys.length)]);
    }
    if (state.scenario !== 'healthy') {
      const [, level, source, message] = scenarios[state.scenario];
      add(level, source, message);
    } else {
      add('INFO', 'miner', `Accepted share #${sequence + 1} diff 65536; chain ${sequence % 3}; ${ (108 + Math.random() * 4).toFixed(2)} TH/s`);
    }
  };
  const snapshot = () => {
    const s = state.scenario;
    const stopped = ['fan', 'temperature', 'psu'].includes(s);
    const hashrate = stopped || s === 'pool' ? 0 : (s === 'chain' ? 73.2 : 110.4);
    return { ...state, uptime: Math.floor((Date.now() - state.started) / 1000), hashrate, temperature: s === 'temperature' ? 92 : 67, power: stopped ? 180 : s === 'chain' ? 2150 : 3250, fans: [5280, s === 'fan' ? 0 : 5340, 5160, 5220], errors: state.logs.filter(l => l.level === 'ERROR').length };
  };
  reset();
  return { state, add, tick, reset, setScenario, snapshot };
}
export const logText = logs => logs.map(l => `[${l.timestamp.replace('T', ' ').replace('Z', '')}] ${l.level.padEnd(5)} ${l.source}: ${l.message}`).join('\n') + '\n';
