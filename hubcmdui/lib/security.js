/**
 * 账户安全策略库
 * - 系统默认凭据：硬拒绝（不允许把用户名/密码修改成这些值）
 * - 弱口令 / 常见用户名：软警告（允许修改，但会弹窗提醒用户）
 *
 * 策略数据集中在 config/security-policy.json（前后端共用，单一数据源），
 * 修改字典只需改该 JSON，无需改动此处与前端模块。
 *
 * 注意：本文件为后端（Node/CommonJS）使用；前端通过 src/lib/security.js（ESM）
 * 读取同一份 JSON，请勿在此写入任何 Node 专有模块依赖。
 */

const policy = require('../config/security-policy.json')

const DEFAULT_USERNAME = policy.defaultUsername
const DEFAULT_PASSWORD = policy.defaultPassword
const WEAK_PASSWORDS = new Set(policy.weakPasswords)
const COMMON_USERNAMES = new Set(policy.commonUsernames)
const RESERVED_USERNAMES = new Set(policy.reservedUsernames || [])

function norm(s) {
  return String(s == null ? '' : s).trim().toLowerCase()
}

// 是否为系统保留的默认用户名（如 root），不允许改回
function isDefaultUsername(username) {
  return norm(username) === DEFAULT_USERNAME
}

// 是否为系统默认密码（如 admin@123），不允许改回
function isDefaultPassword(password) {
  return String(password == null ? '' : password) === DEFAULT_PASSWORD
}

// 是否为弱口令
function isWeakPassword(password) {
  return WEAK_PASSWORDS.has(norm(password))
}

// 是否为常见用户名
function isCommonUsername(username) {
  return COMMON_USERNAMES.has(norm(username))
}

// 是否为系统保留用户名（如 admin）：不允许注册/修改为这些值，给出明确提示
function isReservedUsername(username) {
  return RESERVED_USERNAMES.has(norm(username))
}

module.exports = {
  DEFAULT_USERNAME,
  DEFAULT_PASSWORD,
  WEAK_PASSWORDS,
  COMMON_USERNAMES,
  RESERVED_USERNAMES,
  isDefaultUsername,
  isDefaultPassword,
  isWeakPassword,
  isCommonUsername,
  isReservedUsername
}
