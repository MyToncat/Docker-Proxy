/**
 * 网络流量服务
 *
 * 聚合两类数据，供「网络流量监控」页使用：
 *  1. 实时速率：来自 systemService.getNetworkCounters()（聚合全网卡 rx/tx 字节/秒）
 *  2. 历史吞吐：来自 network_history 表（每 30s 落库一次累计字节，相邻点差分得 B/s）
 *
 * 注意：network_history 存的是「自系统启动以来」的累计字节，跨重启会归零；
 * 因此计算窗口内吞吐时，若相邻点出现负差分（重启导致），按 0 处理。
 */
const { getNetworkCounters } = require('./systemService');
const metricsService = require('./metricsService');
const logger = require('../logger');

// 窗口默认 24 小时；与 metricsService 的保留窗口一致
const DEFAULT_WINDOW_MS = 24 * 3600 * 1000;

/**
 * 当前实时网络状态。
 */
async function getCurrent() {
  const c = await getNetworkCounters();
  return {
    rxSec: c.rxSec,
    txSec: c.txSec,
    rxBytes: c.rxBytes,   // 自本次启动累计（入站）
    txBytes: c.txBytes,   // 自本次启动累计（出站）
    interfaces: c.interfaces,
    activeInterfaces: c.activeInterfaces
  };
}

/**
 * 历史吞吐曲线 + 窗口内总量。
 * @param {number} hours 查询窗口（小时），默认 24
 */
async function getHistory(hours = 24) {
  const windowMs = Math.min(Math.max(hours, 1), 24 * 7) * 3600 * 1000;
  const fromTs = Date.now() - windowMs;
  const rows = await metricsService.getNetworkHistory(fromTs);

  // 差分相邻点得到每秒吞吐（B/s），并累计窗口内总传输量
  const points = [];
  let rxTotal = 0;
  let txTotal = 0;
  let prev = null;
  for (const r of rows) {
    let rxRate = 0;
    let txRate = 0;
    if (prev) {
      const dt = (r.ts - prev.ts) / 1000;
      if (dt > 0) {
        const drx = r.rx_bytes - prev.rx_bytes;
        const dtx = r.tx_bytes - prev.tx_bytes;
        // 累计字节归零（重启）时差分会为负，按 0 处理
        rxRate = drx >= 0 ? drx / dt : 0;
        txRate = dtx >= 0 ? dtx / dt : 0;
        rxTotal += drx >= 0 ? drx : 0;
        txTotal += dtx >= 0 ? dtx : 0;
      }
    }
    points.push({
      ts: r.ts,
      rxRate: +rxRate.toFixed(2),
      txRate: +txRate.toFixed(2)
    });
    prev = r;
  }

  return {
    points,
    window: {
      rxTotal,
      txTotal,
      since: fromTs,
      until: Date.now()
    }
  };
}

module.exports = { getCurrent, getHistory, DEFAULT_WINDOW_MS };
