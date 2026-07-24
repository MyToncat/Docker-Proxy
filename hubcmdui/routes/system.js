/**
 * 系统相关路由 - 使用SQLite数据库
 */
const express = require('express');
const router = express.Router();
const os = require('os'); // 确保导入 os 模块
const util = require('util'); // 导入 util 模块
const { exec } = require('child_process');
const execPromise = util.promisify(exec); // 只在这里定义一次
const logger = require('../logger');
const { requireLogin } = require('../middleware/auth');
const configServiceDB = require('../services/configServiceDB');
const { execCommand, getSystemInfo } = require('../server-utils');
const dockerService = require('../services/dockerService');
const systemService = require('../services/systemService');
const networkTestService = require('../services/networkTestService');
const trafficService = require('../services/trafficService');
const path = require('path');
const fs = require('fs').promises;

// 获取系统状态
async function getSystemStats(req, res) {
  try {
    let dockerAvailable = false;
    let containerCount = '0';
    let memoryUsage = '0%';
    let cpuLoad = '0%';
    let diskSpace = '0%';
    let recentActivities = [];

    // 尝试获取系统信息
    try {
      const systemInfo = await getSystemInfo();
      memoryUsage = `${systemInfo.memory.percent}%`;
      cpuLoad = systemInfo.cpu.load1;
      diskSpace = systemInfo.disk.percent;
    } catch (sysError) {
      logger.error('获取系统信息失败:', sysError);
    }

    // 尝试从Docker获取状态信息
    try {
      const docker = await dockerService.getDockerConnection();
      if (docker) {
        dockerAvailable = true;
        
        // 获取容器统计
        const containers = await docker.listContainers({ all: true });
        containerCount = containers.length.toString();
        
        // 获取最近的容器活动
        const runningContainers = containers.filter(c => c.State === 'running');
        for (let i = 0; i < Math.min(3, runningContainers.length); i++) {
          recentActivities.push({
            time: new Date(runningContainers[i].Created * 1000).toLocaleString(),
            action: '运行中',
            container: runningContainers[i].Names[0].replace(/^\//, ''),
            status: '正常'
          });
        }

        // 获取最近的Docker事件
        const events = await dockerService.getRecentEvents();
        if (events && events.length > 0) {
          recentActivities = [...events.map(event => ({
            time: new Date(event.time * 1000).toLocaleString(),
            action: event.Action,
            container: event.Actor?.Attributes?.name || '未知容器',
            status: event.status || '完成'
          })), ...recentActivities].slice(0, 10);
        }
      }
    } catch (containerError) {
      logger.error('获取容器信息失败:', containerError);
    }

    // 如果没有活动记录，添加一个默认记录
    if (recentActivities.length === 0) {
      recentActivities.push({
        time: new Date().toLocaleString(),
        action: '系统检查',
        container: '监控服务',
        status: dockerAvailable ? '正常' : 'Docker服务不可用'
      });
    }

    // 返回收集到的所有数据，即使部分数据可能不完整
    res.json({
      dockerAvailable,
      containerCount,
      memoryUsage,
      cpuLoad,
      diskSpace,
      recentActivities
    });
  } catch (error) {
    logger.error('获取系统统计数据失败:', error);
    
    // 即使出错，仍然尝试返回一些基本数据
    res.status(200).json({
      dockerAvailable: false,
      containerCount: '0',
      memoryUsage: '未知',
      cpuLoad: '未知',
      diskSpace: '未知',
      recentActivities: [{
        time: new Date().toLocaleString(),
        action: '系统错误',
        container: '监控服务',
        status: '数据获取失败'
      }],
      error: '获取系统统计数据失败',
      errorDetails: error.message
    });
  }
}

// 获取系统配置 - 修改版本，避免与其他路由冲突
router.get('/system-config', async (req, res) => {
  try {
    const config = await configServiceDB.getConfig();
    res.json(config);
  } catch (error) {
    logger.error('读取配置失败:', error);
    res.status(500).json({ 
      error: '读取配置失败', 
      details: error.message 
    });
  }
});

// 保存系统配置 - 修改版本，避免与其他路由冲突
router.post('/system-config', requireLogin, async (req, res) => {
  try {
    const currentConfig = await configServiceDB.getConfig();
    const newConfig = { ...currentConfig, ...req.body };
    await configServiceDB.saveConfigs(newConfig);
    logger.info('系统配置已更新');
    res.json({ success: true });
  } catch (error) {
    logger.error('保存配置失败:', error);
    res.status(500).json({ 
      error: '保存配置失败', 
      details: error.message 
    });
  }
});

// 获取系统状态
router.get('/stats', requireLogin, async (req, res) => {
  return await getSystemStats(req, res);
});

// 获取磁盘空间信息
router.get('/disk-space', requireLogin, async (req, res) => {
  try {
    const systemInfo = await getSystemInfo();
    res.json({
      diskSpace: `${systemInfo.disk.used}/${systemInfo.disk.size}`,
      usagePercent: parseInt(systemInfo.disk.percent)
    });
  } catch (error) {
    logger.error('获取磁盘空间信息失败:', error);
    res.status(500).json({ error: '获取磁盘空间信息失败', details: error.message });
  }
});

// 网络测试（专业诊断：ping / traceroute / http / dns / tcp / speed）
router.post('/network-test', requireLogin, async (req, res) => {
  const { type, target, port, url, duration } = req.body;

  if (!type || !target) {
    return res.status(400).json({ error: '缺少 type 或 target 参数' });
  }

  const supported = ['ping', 'traceroute', 'http', 'dns', 'tcp', 'speed'];
  if (!supported.includes(type)) {
    return res.status(400).json({ error: `不支持的测试类型，仅支持 ${supported.join('/')}` });
  }

  try {
    const result = await networkTestService.runTest({ type, target, port, url, duration });
    res.json(result);
  } catch (error) {
    if (error.killed || error.message.includes('超时')) {
      return res.status(408).json({ error: '测试超时' });
    }
    logger.error(`网络测试 [${type}] 失败:`, error);
    res.status(500).json({ error: '测试执行失败', details: error.message });
  }
});

// 获取用户统计信息
router.get('/user-stats', requireLogin, async (req, res) => {
  try {
    const userService = require('../services/userService');
    const username = req.session.user.username;
    const userStats = await userService.getUserStats(username);
    
    res.json(userStats);
  } catch (error) {
    logger.error('获取用户统计信息失败:', error);
    res.status(500).json({
      loginCount: '0',
      lastLogin: '未知',
      accountAge: '0'
    });
  }
});

// 获取系统状态信息 (旧版，可能与 getSystemStats 重复，可以考虑移除)
router.get('/system-status', requireLogin, async (req, res) => {
    logger.warn('Accessing potentially deprecated /api/system-status route.');
    try {
        // 检查 Docker 可用性
        let dockerAvailable = true;
        let containerCount = 0;
        try {
            // 避免直接执行命令计算，依赖 dockerService
            const docker = await dockerService.getDockerConnection();
            if (docker) {
                 const containers = await docker.listContainers({ all: true });
                 containerCount = containers.length;
            } else {
                 dockerAvailable = false;
            }
        } catch (dockerError) {
            dockerAvailable = false;
            containerCount = 0;
            logger.warn('Docker可能未运行或无法访问 (in /system-status):', dockerError.message);
        }
        
        // 获取内存使用信息
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memoryUsage = `${Math.round(usedMem / totalMem * 100)}%`;
        
        // 获取CPU负载
        const [load1] = os.loadavg();
        const cpuCount = os.cpus().length || 1; // 避免除以0
        const cpuLoad = `${(load1 / cpuCount * 100).toFixed(1)}%`;
        
        // 获取磁盘空间 - 简单版
        let diskSpace = '未知';
        try {
            if (os.platform() === 'darwin' || os.platform() === 'linux') {
                 const { stdout } = await execPromise('df -h / | tail -n 1'); // 使用 -n 1
                 const parts = stdout.trim().split(/\s+/);
                 if (parts.length >= 5) diskSpace = parts[4];
            } else if (os.platform() === 'win32') {
                 const { stdout } = await execPromise('wmic logicaldisk get size,freespace,caption | findstr /B /L /V "Caption" ');
                 const lines = stdout.trim().split(/\r?\n/);
                 if (lines.length > 0) {
                      const parts = lines[0].trim().split(/\s+/);
                      if (parts.length >= 2) {
                           const free = parseInt(parts[0], 10);
                           const total = parseInt(parts[1], 10);
                           if (!isNaN(total) && !isNaN(free) && total > 0) {
                                diskSpace = `${Math.round(((total - free) / total) * 100)}%`;
                           }
                      }
                 }
            }
        } catch (diskError) {
            logger.warn('获取磁盘空间失败 (in /system-status):', diskError.message);
            diskSpace = '未知';
        }

        // 格式化系统运行时间
        const uptime = formatUptime(os.uptime());

        res.json({
            dockerAvailable,
            containerCount,
            memoryUsage,
            cpuLoad,
            diskSpace,
            systemUptime: uptime
        });
    } catch (error) {
        logger.error('获取系统状态失败 (in /system-status):', error);
        res.status(500).json({ 
            error: '获取系统状态失败', 
            message: error.message
        });
    }
});

// 系统资源（CPU / 内存 / 磁盘 / 网络 / 温度），基于 systeminformation，数值准确
router.get('/system-resources', requireLogin, async (req, res) => {
  try {
    const r = await systemService.getSystemResources();
    const responseData = {
      cpu: r.cpu,
      memory: r.memory,
      diskSpace: r.disk,
      network: r.network,
      system: r.system
    };
    res.status(200).json(responseData);
  } catch (e) {
    logger.error('获取系统资源失败 (/api/system-resources):', e);
    res.status(500).json({ error: '获取系统资源失败', details: e.message });
  }
});

// 格式化系统运行时间
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    seconds %= 86400;
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);
    
    let result = '';
    if (days > 0) result += `${days}天 `;
    if (hours > 0 || days > 0) result += `${hours}小时 `;
    if (minutes > 0 || hours > 0 || days > 0) result += `${minutes}分钟 `;
    result += `${seconds}秒`;
    
    return result;
}

// 获取系统资源详情
router.get('/system-resource-details', requireLogin, async (req, res) => {
    try {
        const { type } = req.query;
        
        let data = {};
        
        switch (type) {
            case 'memory':
                const totalMem = os.totalmem();
                const freeMem = os.freemem();
                const usedMem = totalMem - freeMem;
                
                data = {
                    totalMemory: formatBytes(totalMem),
                    usedMemory: formatBytes(usedMem),
                    freeMemory: formatBytes(freeMem),
                    memoryUsage: `${Math.round(usedMem / totalMem * 100)}%`
                };
                break;
                
            case 'cpu':
                const cpuInfo = os.cpus();
                const [load1, load5, load15] = os.loadavg();
                
                data = {
                    cpuCores: cpuInfo.length,
                    cpuModel: cpuInfo[0].model,
                    cpuSpeed: `${cpuInfo[0].speed} MHz`,
                    loadAvg1: load1.toFixed(2),
                    loadAvg5: load5.toFixed(2),
                    loadAvg15: load15.toFixed(2),
                    cpuLoad: `${(load1 / cpuInfo.length * 100).toFixed(1)}%`
                };
                break;
                
            case 'disk':
                try {
                    const { stdout: dfOutput } = await execPromise('df -h / | tail -n 1');
                    const parts = dfOutput.trim().split(/\s+/);
                    
                    if (parts.length >= 5) {
                        data = {
                            totalSpace: parts[1],
                            usedSpace: parts[2],
                            freeSpace: parts[3],
                            diskUsage: parts[4]
                        };
                    } else {
                        throw new Error('解析磁盘信息失败');
                    }
                } catch (diskError) {
                    logger.warn('获取磁盘信息失败:', diskError.message);
                    data = {
                        error: '获取磁盘信息失败',
                        message: diskError.message
                    };
                }
                break;
                
            default:
                return res.status(400).json({ error: '无效的资源类型' });
        }
        
        res.json(data);
    } catch (error) {
        logger.error('获取系统资源详情失败:', error);
        res.status(500).json({ error: '获取系统资源详情失败', message: error.message });
    }
});

// 格式化字节数为可读格式
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// 网络流量监控：当前实时速率 + 历史吞吐曲线 + 窗口内总量
router.get('/network-traffic', requireLogin, async (req, res) => {
  try {
    const hours = Math.min(Math.max(parseInt(req.query.hours) || 24, 1), 24 * 7);
    const [current, history] = await Promise.all([
      trafficService.getCurrent(),
      trafficService.getHistory(hours)
    ]);
    res.json({ current, history });
  } catch (error) {
    logger.error('获取网络流量失败:', error);
    res.status(500).json({ error: '获取网络流量失败', message: error.message });
  }
});

module.exports = router; // 只导出 router
