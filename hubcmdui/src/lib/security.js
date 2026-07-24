/**
 * 前端账户安全策略（ESM）
 * 读取与后端共用的 config/security-policy.json（单一数据源），
 * 提供给 UserCenter.vue 在提交前预判系统默认凭据 / 弱口令 / 常见用户名。
 *
 * 后端对应实现见 ../../lib/security.js（CommonJS）。字典只存在于 JSON，前后端均不得各自硬编码。
 */
import policy from '../../config/security-policy.json'

const DEFAULT_USERNAME = policy.defaultUsername
const DEFAULT_PASSWORD = policy.defaultPassword
const WEAK_PASSWORDS = new Set(policy.weakPasswords)
const COMMON_USERNAMES = new Set(policy.commonUsernames)
const RESERVED_USERNAMES = new Set(policy.reservedUsernames || [])

function norm(s) {
  return String(s == null ? '' : s).trim().toLowerCase()
}

export function isDefaultUsername(username) {
  return norm(username) === DEFAULT_USERNAME
}

export function isDefaultPassword(password) {
  return String(password == null ? '' : password) === DEFAULT_PASSWORD
}

export function isWeakPassword(password) {
  return WEAK_PASSWORDS.has(norm(password))
}

export function isCommonUsername(username) {
  return COMMON_USERNAMES.has(norm(username))
}

export function isReservedUsername(username) {
  return RESERVED_USERNAMES.has(norm(username))
}
