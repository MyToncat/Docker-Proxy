/**
 * 资源指标采集服务
 *
 * 用于把系统资源使用率（CPU / 内存 / 磁盘百分比）按固定间隔落库到 SQLite，
 * 使「资源使用趋势」历史能在后端统一保存，跨设备、跨会话、跨浏览器共享，
 * 而不再依赖各浏览器的 localStorage（localStorage 仅作为前端兜底）。
 *
 * 采集口径与 /api/system-resources 保持一致（看板实时值与历史值同源），保证曲线连续。
 */
const si = require('systeminformation');
// 预热：currentLoad 首次调用返回自启动以来的平均值，先空打一次以获得采样间隔内的真实占用率
si.currentLoad().catch(() => {});
const database = require('../database/database');
const logger = require('../logger');
const { getNetworkCounters } = require('./systemService');

// 单次采集间隔（毫秒）：30 秒。24h 约为 2880 行，SQLite 完全可承受。
const DEFAULT_INTERVAL = 30 * 1000;
// 历史保留窗口（毫秒）：保留 24 小时（多留 1 小时缓冲，避免边界处曲线断点）。
const RETENTION = 25 * 3600 * 1000;

let timer = null;

/**
 * 采集一次系统资源百分比快照，口径与 /api/system-resources 一致。
 * @returns {Promise<{cpu:number, memory:number, disk:number}>}
 */
async function collectSnapshot() {
  // 与 /api/system-resources 同源：全部基于 systeminformation，保证实时值与历史曲线一致
  const [cpuLoad, mem, fsSize] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize()
  ]);
  // CPU：真实占用率（currentLoad 已在模块加载时空打一次做预热）
  const cpu = (typeof cpuLoad.currentLoad === 'number')
    ? Math.max(0, Math.min(100, +cpuLoad.currentLoad.toFixed(2)))
    : 0;
  // 内存：已用 / 总量
  const memory = mem.total > 0
    ? Math.max(0, Math.min(100, +((mem.used / mem.total) * 100).toFixed(2)))
    : 0;
  // 磁盘：选取挂载在 / 的主盘（Windows 取 C:）
  const mainDisk = (Array.isArray(fsSize) ? fsSize : [])
    .find(d => (process.platform === 'win32'
      ? (d.fs && d.fs.startsWith('C:'))
      : d.mount === '/'))
    || (fsSize && fsSize[0]) || null;
  const disk = (mainDisk && typeof mainDisk.use === 'number')
    ? Math.max(0, Math.min(100, +mainDisk.use.toFixed(2)))
    : 0;
  return { cpu, memory, disk };
}

/**
 * 采集并写入一条记录（同时顺带清理过期数据）。
 */
async function recordSnapshot() {
  try {
    const snap = await collectSnapshot();
    const ts = Date.now();
    await database.run(
      'INSERT INTO metric_history (ts, cpu, memory, disk) VALUES (?, ?, ?, ?)',
      [ts, snap.cpu, snap.memory, snap.disk]
    );
    // 清理 25 小时前的旧数据，控制表体积
    const cut = ts - RETENTION;
    const res = await database.run('DELETE FROM metric_history WHERE ts < ?', [cut]);
    if (res && res.changes > 0) {
      logger.debug(`已清理 ${res.changes} 条过期指标记录`);
    }
  } catch (e) {
    logger.error('写入指标快照失败:', e.message);
  }
}

/**
 * 采集并写入一条网络累计字节记录（用于历史吞吐曲线）。
 */
async function recordNetwork() {
  try {
    const c = await getNetworkCounters();
    const ts = Date.now();
    await database.run(
      'INSERT INTO network_history (ts, rx_bytes, tx_bytes) VALUES (?, ?, ?)',
      [ts, Math.round(c.rxBytes), Math.round(c.txBytes)]
    );
    // 控制表体积：与 metric_history 同样的 25h 保留窗口
    const cut = ts - RETENTION;
    await database.run('DELETE FROM network_history WHERE ts < ?', [cut]);
  } catch (e) {
    logger.error('写入网络快照失败:', e.message);
  }
}

/**
 * 按时间窗查询历史指标点。
 * @param {number} fromTs 起始时间戳（毫秒）
 * @returns {Promise<Array<{ts:number, cpu:number, memory:number, disk:number}>>}
 */
async function getHistory(fromTs) {
  const rows = await database.all(
    'SELECT ts, cpu, memory, disk FROM metric_history WHERE ts >= ? ORDER BY ts ASC',
    [fromTs]
  );
  return (rows || []).map(r => ({
    ts: r.ts,
    cpu: r.cpu,
    memory: r.memory,
    disk: r.disk
  }));
}

/**
 * 按时间窗查询网络累计字节历史点（相邻点差分即得到每秒吞吐）。
 * @param {number} fromTs 起始时间戳（毫秒）
 * @returns {Promise<Array<{ts:number, rx_bytes:number, tx_bytes:number}>>}
 */
async function getNetworkHistory(fromTs) {
  const rows = await database.all(
    'SELECT ts, rx_bytes, tx_bytes FROM network_history WHERE ts >= ? ORDER BY ts ASC',
    [fromTs]
  );
  return (rows || []).map(r => ({
    ts: r.ts,
    rx_bytes: Number(r.rx_bytes) || 0,
    tx_bytes: Number(r.tx_bytes) || 0
  }));
}

/**
 * 启动采集定时器（单例，重复调用不会叠加）。
 * @param {number} intervalMs 采集间隔，默认 30s
 */
function startCollector(intervalMs = DEFAULT_INTERVAL) {
  if (timer) return; // 已启动，避免重复
  // 启动时立即采集一次，避免首屏要等一个间隔
  recordSnapshot();
  recordNetwork();
  timer = setInterval(() => {
    recordSnapshot();
    recordNetwork();
  }, intervalMs);
  // 不阻止进程退出
  if (timer.unref) timer.unref();
  logger.info(`资源指标采集器已启动（间隔 ${intervalMs / 1000}s）`);
}

/**
 * 停止采集定时器（用于优雅关闭）。
 */
function stopCollector() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    logger.info('资源指标采集器已停止');
  }
}

module.exports = {
  collectSnapshot,
  recordSnapshot,
  recordNetwork,
  getHistory,
  getNetworkHistory,
  startCollector,
  stopCollector,
  RETENTION
};
