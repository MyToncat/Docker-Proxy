/**
 * 验证码工具
 * 生成随机、不易被自动识别的验证码（字母 + 数字混合，排除易混淆字符）。
 * 相比「算术题」验证码，随机字符更难被脚本直接计算，安全性更高。
 *
 * 设计要点：
 * - 使用 crypto.randomBytes 保证随机性（非 Math.random）。
 * - 字母表排除 0/O/1/l/I 等易混淆字符，提升用户可读性。
 * - 会话中只保存「标准答案」（统一大写），校验时大小写不敏感。
 */
const crypto = require('crypto');

// 安全字母表：排除 0/O/1/l/I 等易混淆字符（纯大写字母 + 数字）
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * 生成随机验证码
 * @param {number} length 验证码长度，默认 4
 * @returns {string} 大写验证码
 */
function generateCaptchaCode(length = 4) {
    const len = Math.max(1, parseInt(length, 10) || 4);
    const bytes = crypto.randomBytes(len);
    let code = '';
    for (let i = 0; i < len; i++) {
        code += ALPHABET[bytes[i] % ALPHABET.length];
    }
    return code;
}

/**
 * 校验用户输入的验证码是否正确（大小写不敏感，自动去除首尾空格）
 * @param {string} expected 会话中保存的标准答案
 * @param {string} input 用户输入
 * @returns {boolean}
 */
function verifyCaptcha(expected, input) {
    if (!expected || typeof input !== 'string') return false;
    const a = String(expected).trim().toUpperCase();
    const b = input.trim().toUpperCase();
    return a.length > 0 && a === b;
}

/**
 * 服务端验证码存储（与 session 解耦）
 * ----------------------------------------------------------------
 * 旧实现把验证码明文存在 req.session.captcha 里，登录页加载时会并发
 * 发起「取验证码」和「check-session」两个未登录请求，二者各自新建
 * 一个 session 并下发 Set-Cookie。浏览器最终保留的 cookie 往往指向
 * check-session 新建的那个空 session，导致登录请求带着的 cookie 对应的
 * session 里根本没有 captcha —— 表现为「验证码正确却提示错误、刷新一次
 * 就好」。这是 express-session 的经典竞态。
 *
 * 这里改存到独立的 Map，以服务端生成的 captchaId 为键；前端取码时拿到
 * captchaId，登录/重置时回传 captchaId + captcha，校验完全不依赖 session
 * cookie，竞态被彻底消除。
 */
const captchaStore = new Map();
const CAPTCHA_TTL = 5 * 60 * 1000; // 验证码有效期 5 分钟

/**
 * 存入一个验证码，返回对应的 captchaId
 * @param {string} code 标准答案（大写）
 * @returns {string} captchaId
 */
function storeCaptcha(code, ttl = CAPTCHA_TTL) {
    const id = crypto.randomBytes(16).toString('hex');
    captchaStore.set(id, { code, expires: Date.now() + ttl });
    return id;
}

/**
 * 消费（一次性校验）一个验证码
 * @param {string} id 取码时拿到的 captchaId
 * @returns {string|null} 该 captchaId 对应的标准答案；不存在或已过期返回 null
 */
function consumeCaptcha(id) {
    if (!id || typeof id !== 'string') return null;
    const entry = captchaStore.get(id);
    if (!entry) return null;
    captchaStore.delete(id); // 一次性使用，防止重放
    if (entry.expires < Date.now()) return null;
    return entry.code;
}

// 惰性清理过期项，避免 Map 无限增长；不阻止进程退出
function pruneCaptchaStore() {
    const now = Date.now();
    for (const [k, v] of captchaStore) {
        if (v.expires < now) captchaStore.delete(k);
    }
}
const _pruneTimer = setInterval(pruneCaptchaStore, 5 * 60 * 1000);
if (_pruneTimer && typeof _pruneTimer.unref === 'function') _pruneTimer.unref();

module.exports = { ALPHABET, generateCaptchaCode, verifyCaptcha, storeCaptcha, consumeCaptcha };
