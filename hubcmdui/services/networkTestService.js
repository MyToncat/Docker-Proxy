/**
 * 网络诊断服务
 * 提供 ping、traceroute、http、dns、tcp、speed 等结构化网络测试。
 */
const os = require('os');
const dns = require('dns').promises;
const net = require('net');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const axios = require('axios');
const logger = require('../logger');

const PLATFORM = os.platform();

// 简单解析 IPv4 地址
const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;

function isValidDomain(input) {
  return /^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/.test(input);
}

function isValidIp(input) {
  return IPV4_RE.test(input);
}

function sanitizeTarget(input) {
  const t = String(input || '').trim();
  // 防止命令注入：仅允许字母数字、点、横线、冒号（端口）
  if (!/^[a-zA-Z0-9.:-]{1,253}$/.test(t)) {
    throw new Error('无效的目标格式');
  }
  return t;
}

// ---------- Ping ----------
async function runPing(target) {
  const t = sanitizeTarget(target);
  const count = 4;
  const command = PLATFORM === 'win32'
    ? `ping -n ${count} ${t}`
    : `ping -c ${count} -W 2 ${t}`;

  const { stdout, stderr } = await execPromise(command, { timeout: 20000 });
  const output = stdout || stderr || '';

  // 逐行解析每个包的延迟
  const times = [];
  const lines = output.split(/\r?\n/);
  for (const line of lines) {
    // macOS/Linux: time=12.3 ms 或 time=12.3ms
    // Windows: time=12ms 或 time=12ms TTL=...
    const m = line.match(/time[<=]([\d.]+)\s?ms/i);
    if (m) times.push(parseFloat(m[1]));
  }

  // 解析统计行
  let transmitted = count;
  let received = times.length;
  let loss = 0;
  const lossMatch = output.match(/(\d+\.?\d*)%\s*loss/i) || output.match(/丢失\s*=\s*(\d+)/i);
  if (lossMatch) loss = parseFloat(lossMatch[1]);
  else loss = transmitted > 0 ? ((transmitted - received) / transmitted) * 100 : 0;

  // 解析 min/avg/max/stddev
  let min = null, avg = null, max = null, stddev = null;
  const statsMatch = output.match(/([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)/);
  if (statsMatch) {
    min = parseFloat(statsMatch[1]);
    avg = parseFloat(statsMatch[2]);
    max = parseFloat(statsMatch[3]);
    stddev = parseFloat(statsMatch[4]);
  } else if (times.length) {
    min = Math.min(...times);
    max = Math.max(...times);
    avg = times.reduce((a, b) => a + b, 0) / times.length;
  }

  // 解析 IP
  let ip = null;
  const ipMatch = output.match(/PING\s+\S+\s+\(([^)]+)\)/i) || output.match(/来自\s+([\d.]+)/) || output.match(/Reply from ([\d.]+)/i);
  if (ipMatch) ip = ipMatch[1];

  return {
    type: 'ping',
    target: t,
    ip,
    transmitted,
    received,
    loss: +loss.toFixed(1),
    times,
    min: min != null ? +min.toFixed(2) : null,
    avg: avg != null ? +avg.toFixed(2) : null,
    max: max != null ? +max.toFixed(2) : null,
    stddev: stddev != null ? +stddev.toFixed(2) : null,
    raw: output
  };
}

// ---------- Traceroute ----------
async function runTraceroute(target) {
  const t = sanitizeTarget(target);
  const maxHops = 20;
  const command = PLATFORM === 'win32'
    ? `tracert -h ${maxHops} ${t}`
    : PLATFORM === 'darwin'
      ? `traceroute -m ${maxHops} -q 1 -w 2 ${t}`
      : `traceroute -m ${maxHops} -q 1 -w 2 ${t}`;

  const { stdout, stderr } = await execPromise(command, { timeout: 40000 });
  const output = stdout || stderr || '';

  const hops = [];
  const lines = output.split(/\r?\n/);
  for (const line of lines) {
    // 通用匹配：序号 + 主机名/IP + 延迟
    //  1  192.168.1.1 (192.168.1.1)  1.234 ms  1.345 ms  1.456 ms
    //  1     1 ms     1 ms     1 ms  192.168.1.1
    const match = line.match(/^\s*(\d+)\s+(.+)$/);
    if (!match) continue;
    const rest = match[2];

    // Windows 风格
    const winMatch = rest.match(/^(?:(\d+)\s+ms|\*)\s+(?:(\d+)\s+ms|\*)\s+(?:(\d+)\s+ms|\*)\s+(.+)$/);
    if (winMatch) {
      const latencies = [winMatch[1], winMatch[2], winMatch[3]]
        .map(x => x === '*' ? null : parseFloat(x))
        .filter(x => x != null);
      hops.push({
        hop: parseInt(match[1]),
        host: winMatch[4].trim(),
        ip: (winMatch[4].match(/\b([\d.]+)\b/) || [])[1] || null,
        latencies,
        avg: latencies.length ? +(latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2) : null
      });
      continue;
    }

    // Unix 风格
    const unixMatch = rest.match(/(\S+)\s*\(([\d.]+)\)\s*(.+)/);
    if (unixMatch) {
      const latencies = [...unixMatch[3].matchAll(/([\d.]+)\s*ms/g)]
        .map(m => parseFloat(m[1]))
        .filter(x => !isNaN(x));
      hops.push({
        hop: parseInt(match[1]),
        host: unixMatch[1].trim(),
        ip: unixMatch[2].trim(),
        latencies,
        avg: latencies.length ? +(latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2) : null
      });
      continue;
    }

    // 只有 * * * 或无法解析
    if (rest.includes('*')) {
      hops.push({ hop: parseInt(match[1]), host: '*', ip: null, latencies: [], avg: null });
    }
  }

  return { type: 'traceroute', target: t, hops, raw: output };
}

// ---------- HTTP 测试 ----------
async function runHttpTest(target) {
  let url = String(target || '').trim();
  if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
  const t = sanitizeTarget(new URL(url).hostname);

  const start = Date.now();
  const dnsStart = start;
  let dnsTime = null;
  let connectTime = null;
  let ttfb = null;
  let totalTime = null;
  let statusCode = null;
  let headers = {};
  let body = null;
  let error = null;

  try {
    const agent = url.startsWith('https')
      ? new https.Agent({ rejectUnauthorized: false })
      : new http.Agent();

    const response = await axios({
      method: 'GET',
      url,
      timeout: 15000,
      maxRedirects: 5,
      responseType: 'arraybuffer',
      httpAgent: url.startsWith('https') ? undefined : agent,
      httpsAgent: url.startsWith('https') ? agent : undefined,
      // 我们手动计时，但 axios 不暴露阶段时间；用总时间 + 一点点计算
      onDownloadProgress: () => {}
    });

    const end = Date.now();
    totalTime = end - start;
    ttfb = totalTime; // 简化：没有更细粒度时把总时间当 TTFB
    statusCode = response.status;
    headers = response.headers || {};
    body = response.data ? response.data.length : 0;
  } catch (e) {
    error = e.message;
    if (e.response) {
      statusCode = e.response.status;
      headers = e.response.headers || {};
    }
  }

  return {
    type: 'http',
    target: t,
    url,
    statusCode,
    statusText: statusCode ? String(statusCode) : '失败',
    dnsTime,
    connectTime,
    ttfb,
    totalTime,
    headers,
    bodySize: body,
    error
  };
}

// ---------- DNS 测试 ----------
async function runDnsTest(target) {
  const t = sanitizeTarget(target);
  const start = Date.now();
  let records = [];
  let error = null;
  try {
    records = await dns.resolve4(t);
  } catch (e) {
    error = e.message;
    try {
      records = (await dns.resolve6(t)).map(ip => `[${ip}]`);
    } catch (e2) {
      error += ' / ' + e2.message;
    }
  }
  const resolveTime = Date.now() - start;

  return {
    type: 'dns',
    target: t,
    resolveTime,
    records,
    error
  };
}

// ---------- TCP 端口测试 ----------
async function runTcpTest(target, port = 80) {
  const t = sanitizeTarget(target);
  const p = parseInt(port, 10) || 80;
  if (p < 1 || p > 65535) throw new Error('端口范围 1-65535');

  const start = Date.now();
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;

    function finish(result) {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve(result);
    }

    socket.setTimeout(10000);
    socket.once('connect', () => {
      finish({
        type: 'tcp',
        target: t,
        port: p,
        connected: true,
        latency: Date.now() - start,
        error: null
      });
    });
    socket.once('error', (err) => {
      finish({
        type: 'tcp',
        target: t,
        port: p,
        connected: false,
        latency: Date.now() - start,
        error: err.message
      });
    });
    socket.once('timeout', () => {
      finish({
        type: 'tcp',
        target: t,
        port: p,
        connected: false,
        latency: Date.now() - start,
        error: '连接超时'
      });
    });

    socket.connect(p, t);
  });
}

// 公共测速节点（作为 fallback 池）
const SPEED_PRESETS = [
  'https://speed.cloudflare.com/__down?bytes=10000000',
  'https://cachefly.cachefly.net/10mb.test',
  'https://speedtest.tele2.net/10MB.zip',
  'https://speed.cloudflare.com/__down?bytes=25000000'
];

// 用单一 URL 执行一次测速
function runSingleSpeedTest(targetUrl, durationMs = 8000) {
  const start = Date.now();
  let totalBytes = 0;

  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (e) {
      return reject(new Error('测速地址格式无效'));
    }

    const isHttps = parsed.protocol === 'https:';
    const client = isHttps ? https : http;
    const agent = isHttps
      ? new https.Agent({ rejectUnauthorized: false, servername: parsed.hostname })
      : new http.Agent();

    const req = client.get(targetUrl, {
      timeout: 15000,
      agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'identity'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return runSingleSpeedTest(res.headers.location, durationMs).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      res.on('data', (chunk) => {
        totalBytes += chunk.length;
        if (Date.now() - start >= durationMs) {
          req.destroy();
        }
      });

      res.on('end', () => {
        const elapsed = (Date.now() - start) / 1000;
        const speedBps = elapsed > 0 ? totalBytes / elapsed : 0;
        resolve({
          type: 'speed',
          target: parsed.hostname,
          url: targetUrl,
          duration: +elapsed.toFixed(2),
          bytes: totalBytes,
          speedBps: Math.round(speedBps),
          speedMbps: +(speedBps * 8 / 1000 / 1000).toFixed(2)
        });
      });

      res.on('error', (err) => reject(err));
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('测速请求超时'));
    });
  });
}

// ---------- 下载测速（带多节点回退） ----------
async function runSpeedTest(url = SPEED_PRESETS[0], durationMs = 8000) {
  const primaryUrl = String(url || '').trim();
  const candidates = [primaryUrl, ...SPEED_PRESETS.filter(u => u !== primaryUrl)];
  const errors = [];

  for (const u of candidates) {
    try {
      const result = await runSingleSpeedTest(u, durationMs);
      if (candidates.length > 1 && u !== primaryUrl) {
        result.fallback = true;
        result.note = `主节点测速失败，已自动切换至备用节点 ${result.target}`;
      }
      return result;
    } catch (e) {
      const msg = e.message || String(e);
      errors.push(`${new URL(u).hostname}: ${msg}`);
      // 仅连接类/ TLS 类错误继续回退；HTTP 4xx/5xx 也继续，因为可能是节点不可用
      if (/invalid url|range error|type error/i.test(msg)) {
        break;
      }
    }
  }

  const error = new Error('所有测速节点均不可用');
  error.details = errors.join('；');
  throw error;
}

async function runTest({ type, target, port, url, duration }) {
  switch (type) {
    case 'ping': return runPing(target);
    case 'traceroute': return runTraceroute(target);
    case 'http': return runHttpTest(target);
    case 'dns': return runDnsTest(target);
    case 'tcp': return runTcpTest(target, port);
    case 'speed': return runSpeedTest(url, duration ? parseInt(duration, 10) : undefined);
    default: throw new Error('不支持的测试类型');
  }
}

module.exports = {
  runTest,
  runPing,
  runTraceroute,
  runHttpTest,
  runDnsTest,
  runTcpTest,
  runSpeedTest
};
