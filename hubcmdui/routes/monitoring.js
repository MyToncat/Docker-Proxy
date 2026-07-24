/**
 * 监控配置路由
 *
 * 监控配置统一由 configServiceDB 持久化（SQLite），与 services/monitoringService.js
 * 读取的监控配置同源，避免之前 monitoring.json 与 SQLite 两份配置不一致的问题。
 */
const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const logger = require('../logger');
const configServiceDB = require('../services/configServiceDB');

// 获取监控配置
router.get('/monitoring-config', requireLogin, async (req, res) => {
    try {
        const config = await configServiceDB.getMonitoringConfig();
        res.json(config);
    } catch (err) {
        logger.error('获取监控配置失败:', err);
        res.status(500).json({ error: '获取监控配置失败' });
    }
});

// 保存监控配置
router.post('/monitoring-config', requireLogin, async (req, res) => {
    try {
        const {
            notificationType,
            webhookUrl,
            telegramToken,
            telegramChatId,
            monitorInterval,
            isEnabled,
            enableTrafficAlert,
            rxRateThreshold,
            txRateThreshold,
            dailyTrafficThreshold,
            singleIpDailyThreshold
        } = req.body;

        // 简单验证
        if (notificationType === 'wechat' && !webhookUrl) {
            return res.status(400).json({ error: '企业微信通知需要设置 webhook URL' });
        }

        if (notificationType === 'telegram' && (!telegramToken || !telegramChatId)) {
            return res.status(400).json({ error: 'Telegram 通知需要设置 Token 和 Chat ID' });
        }

        const currentConfig = await configServiceDB.getMonitoringConfig();

        // 更新配置
        const updatedConfig = {
            ...currentConfig,
            notificationType,
            webhookUrl: webhookUrl || '',
            telegramToken: telegramToken || '',
            telegramChatId: telegramChatId || '',
            monitorInterval: parseInt(monitorInterval, 10) || 60,
            isEnabled: isEnabled !== undefined ? !!isEnabled : currentConfig.isEnabled,
            enableTrafficAlert: enableTrafficAlert !== undefined ? !!enableTrafficAlert : currentConfig.enableTrafficAlert,
            rxRateThreshold: parseFloat(rxRateThreshold) || 0,
            txRateThreshold: parseFloat(txRateThreshold) || 0,
            dailyTrafficThreshold: parseFloat(dailyTrafficThreshold) || 0,
            singleIpDailyThreshold: parseFloat(singleIpDailyThreshold) || 0
        };

        await configServiceDB.saveMonitoringConfig(updatedConfig);

        res.json({ success: true, message: '监控配置已保存' });

        // 通知监控服务重新加载配置
        if (global.monitoringService && typeof global.monitoringService.reload === 'function') {
            global.monitoringService.reload();
        }
    } catch (err) {
        logger.error('保存监控配置失败:', err);
        res.status(500).json({ error: '保存监控配置失败' });
    }
});

// 切换监控状态
router.post('/toggle-monitoring', requireLogin, async (req, res) => {
    try {
        const { isEnabled } = req.body;
        const config = await configServiceDB.getMonitoringConfig();
        config.isEnabled = !!isEnabled;
        await configServiceDB.saveMonitoringConfig(config);

        res.json({
            success: true,
            message: `监控已${isEnabled ? '启用' : '禁用'}`
        });

        // 通知监控服务重新加载配置
        if (global.monitoringService && typeof global.monitoringService.reload === 'function') {
            global.monitoringService.reload();
        }
    } catch (err) {
        logger.error('切换监控状态失败:', err);
        res.status(500).json({ error: '切换监控状态失败' });
    }
});

// 测试通知
router.post('/test-notification', requireLogin, async (req, res) => {
    try {
        const {
            notificationType,
            webhookUrl,
            telegramToken,
            telegramChatId
        } = req.body;

        // 简单验证
        if (notificationType === 'wechat' && !webhookUrl) {
            return res.status(400).json({ error: '企业微信通知需要设置 webhook URL' });
        }

        if (notificationType === 'telegram' && (!telegramToken || !telegramChatId)) {
            return res.status(400).json({ error: 'Telegram 通知需要设置 Token 和 Chat ID' });
        }

        // 发送测试通知
        const notifier = require('../services/notificationService');
        const testMessage = {
            title: '测试通知',
            content: '这是一条测试通知，如果您收到这条消息，说明您的通知配置工作正常。',
            time: new Date().toLocaleString()
        };

        await notifier.sendNotification(testMessage, {
            type: notificationType,
            webhookUrl,
            telegramToken,
            telegramChatId
        });

        res.json({ success: true, message: '测试通知已发送' });
    } catch (err) {
        logger.error('发送测试通知失败:', err);
        res.status(500).json({ error: '发送测试通知失败: ' + err.message });
    }
});

// 获取已停止的容器
router.get('/stopped-containers', async (req, res) => {
    try {
        const dockerService = require('../services/dockerService');
        const containers = await dockerService.getStoppedContainers();

        res.json(containers);
    } catch (err) {
        logger.error('获取已停止容器失败:', err);
        res.status(500).json({ error: '获取已停止容器失败', details: err.message });
    }
});

logger.success('✓ 监控配置路由已加载');

// 导出路由
module.exports = router;
