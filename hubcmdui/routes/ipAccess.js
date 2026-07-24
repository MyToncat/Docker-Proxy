/**
 * IP 访问控制路由（代理层 go-proxy 的 access_control）
 * 提供前端「IP 黑白名单」页面所需的后端接口，所有写操作需登录。
 * 真正的校验与拦截发生在 go-proxy 代理层；这里负责读写配置并做服务端校验。
 */

const express = require('express');
const router = express.Router();
const net = require('net');
const logger = require('../logger');
const { requireLogin } = require('../middleware/auth');
const { goProxyService, upstreamError } = require('../services/goProxyService');

const MODES = ['off', 'whitelist', 'blacklist'];

// 校验单个 IP / CIDR（支持 IPv4/IPv6，含可选 # 行内注释）
function isValidIPOrCIDR(raw) {
  if (typeof raw !== 'string') return false;
  let s = raw.trim();
  if (!s) return false;
  const h = s.indexOf('#');
  if (h >= 0) s = s.slice(0, h).trim();
  if (!s) return true; // 纯注释
  if (s.includes('/')) {
    const [ip, prefix] = s.split('/');
    const fam = net.isIP(ip);
    if (fam === 0) return false;
    if (!/^\d+$/.test(prefix || '')) return false;
    const bits = parseInt(prefix, 10);
    const max = fam === 4 ? 32 : 128;
    return bits >= 0 && bits <= max;
  }
  return net.isIP(s) !== 0;
}

// 获取当前 IP 访问控制（缺省返回关闭态）
router.get('/', async (req, res) => {
  try {
    const cfg = await goProxyService.getConfig();
    const ac = cfg.access_control || {};
    res.json({
      mode: ac.mode || 'off',
      whitelist: Array.isArray(ac.whitelist) ? ac.whitelist : [],
      blacklist: Array.isArray(ac.blacklist) ? ac.blacklist : []
    });
  } catch (e) {
    logger.error('获取 IP 访问控制失败:', e.message);
    const err = upstreamError(e);
    res.status(err.status || 502).json(err.body);
  }
});

// 保存 IP 访问控制（写回 go-proxy 配置并热重载）
router.put('/', requireLogin, async (req, res) => {
  try {
    const body = req.body || {};
    const mode = body.mode || 'off';
    if (!MODES.includes(mode)) {
      return res.status(400).json({ error: 'access_control.mode 非法，应为 off / whitelist / blacklist' });
    }

    const whitelist = Array.isArray(body.whitelist)
      ? body.whitelist.map(x => String(x).trim()).filter(Boolean)
      : [];
    const blacklist = Array.isArray(body.blacklist)
      ? body.blacklist.map(x => String(x).trim()).filter(Boolean)
      : [];

    const invalid = [];
    whitelist.forEach(ip => { if (!isValidIPOrCIDR(ip)) invalid.push(ip); });
    blacklist.forEach(ip => { if (!isValidIPOrCIDR(ip)) invalid.push(ip); });
    if (invalid.length) {
      return res.status(400).json({
        error: '存在非法的 IP/CIDR: ' + invalid.join(', '),
        invalid
      });
    }
    if (mode === 'whitelist' && whitelist.length === 0) {
      return res.status(400).json({ error: '白名单模式至少需要配置一个 IP/CIDR，否则将拒绝所有访问' });
    }

    // 拉取完整配置，仅替换 access_control 后整体回写（go-proxy 据此热重载）。
    // 密码在 Go 端以 ******** 脱敏，回写时会被识别并保留原值，不会丢失。
    const cfg = await goProxyService.getConfig();
    cfg.access_control = { mode, whitelist, blacklist };
    await goProxyService.putConfig(cfg);

    logger.info('IP 访问控制已更新 (mode=%s, wl=%d, bl=%d)', mode, whitelist.length, blacklist.length);
    res.json({ success: true, access_control: { mode, whitelist, blacklist } });
  } catch (e) {
    logger.error('保存 IP 访问控制失败:', e.message);
    const err = upstreamError(e);
    res.status(err.status || 502).json(err.body);
  }
});

module.exports = router;
