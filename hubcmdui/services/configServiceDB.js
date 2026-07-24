/**
 * 基于SQLite的配置服务模块
 */
const logger = require('../logger');
const database = require('../database/database');
const { encrypt, decrypt } = require('../lib/cryptoUtil');

// 锁定（不可更改）站点信息的配置键前缀，接口层禁止写入
const LOCK_PREFIX = '_lock_';
// 锁定的 GitHub 仓库地址默认值
const DEFAULT_GITHUB_URL = 'https://github.com/dqzboy/Docker-Proxy';

class ConfigServiceDB {
  /**
   * 获取配置项
   */
  async getConfig(key = null) {
    try {
      if (key) {
        const config = await database.get('SELECT * FROM configs WHERE key = ?', [key]);
        if (config) {
          return JSON.parse(config.value);
        }
        return null;
      } else {
        // 获取所有配置
        const configs = await database.all('SELECT * FROM configs');
        const result = {};
        for (const config of configs) {
          result[config.key] = JSON.parse(config.value);
        }
        return result;
      }
    } catch (error) {
      logger.error('获取配置失败:', error);
      throw error;
    }
  }

  /**
   * 保存配置项
   */
  async saveConfig(key, value, description = null) {
    try {
      // 锁定前缀的配置键（_lock_*）禁止通过接口写入/覆盖，保证「不可更改」
      if (typeof key === 'string' && key.startsWith(LOCK_PREFIX)) {
        logger.warn(`拒绝写入锁定配置项 ${key}（不可更改）`);
        return;
      }
      const valueString = JSON.stringify(value);
      const valueType = typeof value;
      
      const existingConfig = await database.get('SELECT id FROM configs WHERE key = ?', [key]);
      
      if (existingConfig) {
        // 更新现有配置
        await database.run(
          'UPDATE configs SET value = ?, type = ?, description = ?, updated_at = ? WHERE key = ?',
          [valueString, valueType, description, new Date().toISOString(), key]
        );
      } else {
        // 创建新配置
        await database.run(
          'INSERT INTO configs (key, value, type, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          [key, valueString, valueType, description, new Date().toISOString(), new Date().toISOString()]
        );
      }
      
      // 移除详细的配置保存日志，减少日志噪音
    } catch (error) {
      logger.error('保存配置失败:', error);
      throw error;
    }
  }

  /**
   * 批量保存配置
   */
  async saveConfigs(configs) {
    try {
      const configCount = Object.keys(configs).length;
      for (const [key, value] of Object.entries(configs)) {
        await this.saveConfig(key, value);
      }
      logger.info(`批量保存配置完成，共 ${configCount} 项配置`);
    } catch (error) {
      logger.error('批量保存配置失败:', error);
      throw error;
    }
  }

  /**
   * 删除配置项
   */
  async deleteConfig(key) {
    try {
      await database.run('DELETE FROM configs WHERE key = ?', [key]);
      // 删除配置时仍保留日志，因为这是重要操作
      logger.info(`配置 ${key} 已删除`);
    } catch (error) {
      logger.error('删除配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取系统默认配置
   */
  getDefaultConfig() {
    return {
      theme: 'light',
      language: 'zh_CN',
      notifications: true,
      autoRefresh: true,
      refreshInterval: 30000,
      dockerHost: 'localhost',
      dockerPort: 2375,
      useHttps: false,
      proxyDomain: 'registry-1.docker.io',
      logo: '',
      menuItems: [
        {
          text: "首页",
          link: "/",
          newTab: false,
          icon: "fa-solid fa-house"
        },
        {
          text: "介绍",
          link: "https://docker-proxy-desc.vercel.app/",
          newTab: true,
          icon: "fa-solid fa-book-open"
        },
        {
          text: "推广",
          link: "https://dqzboy.github.io/proxyui/zanzhu",
          newTab: false,
          icon: "fa-solid fa-bullhorn"
        },
        {
          text: "GitHub",
          link: "https://github.com/dqzboy/hubcmdui",
          newTab: true,
          icon: "fa-brands fa-github"
        }
      ],
      monitoringConfig: {
        notificationType: 'wechat',
        webhookUrl: '',
        telegramToken: '',
        telegramChatId: '',
        monitorInterval: 60,
        isEnabled: false,
        // 网络流量告警（默认关闭，阈值留空表示不限制）
        enableTrafficAlert: false,
        rxRateThreshold: 100,    // MB/s
        txRateThreshold: 100,    // MB/s
        dailyTrafficThreshold: 500, // GB/天
        singleIpDailyThreshold: 100 // GB/天/客户端IP
      }
    };
  }

  /**
   * 初始化默认配置
   */
  async initializeDefaultConfig() {
    try {
      const defaultConfig = this.getDefaultConfig();
      let newConfigCount = 0;
      
      for (const [key, value] of Object.entries(defaultConfig)) {
        const existingConfig = await database.get('SELECT id FROM configs WHERE key = ?', [key]);
        if (!existingConfig) {
          await this.saveConfig(key, value, `默认${key}配置`);
          newConfigCount++;
        }
      }
    } catch (error) {
      logger.error('初始化默认配置失败:', error);
      throw error;
    }
  }

  /**
   * 初始化锁定（不可更改）的站点信息
   * 仅在数据库中没有该记录时写入一次，绝不在后续调用中覆盖，保证「不可更改」。
   * @param {string} [githubUrl] 可选，默认使用项目官方仓库地址
   */
  async initLockedSiteInfo(githubUrl = DEFAULT_GITHUB_URL) {
    try {
      const existing = await database.get("SELECT id FROM configs WHERE key = ?", ['_lock_github_url']);
      if (!existing) {
        // 以 AES 加密后存为 JSON 对象 { d: 'iv:data' }，避免破坏 getConfig 的 JSON.parse
        const payload = JSON.stringify({ d: encrypt(githubUrl) });
        await database.run(
          'INSERT INTO configs (key, value, type, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          ['_lock_github_url', payload, 'locked', '锁定不可更改的 GitHub 仓库地址（AES 加密存储）', new Date().toISOString(), new Date().toISOString()]
        );
        logger.info('已落地锁定 GitHub 地址（加密存储）');
      }
    } catch (error) {
      logger.error('初始化锁定站点信息失败:', error);
    }
  }

  /**
   * 读取锁定（不可更改）的 GitHub 仓库地址（解密）
   * @returns {Promise<string>} 解密后的地址，失败或未配置返回空串
   */
  async getLockedGithubUrl() {
    try {
      const row = await database.get("SELECT value FROM configs WHERE key = ?", ['_lock_github_url']);
      if (!row) return '';
      const parsed = JSON.parse(row.value);
      return decrypt(parsed && parsed.d);
    } catch (error) {
      logger.error('读取锁定 GitHub 地址失败:', error);
      return '';
    }
  }

  /**
   * 获取监控配置
   * 与默认值合并：旧数据库中可能缺少后续新增字段（如流量告警），避免返回 undefined。
   */
  async getMonitoringConfig() {
    try {
      const saved = await this.getConfig('monitoringConfig') || {};
      return { ...this.getDefaultConfig().monitoringConfig, ...saved };
    } catch (error) {
      logger.error('获取监控配置失败:', error);
      return this.getDefaultConfig().monitoringConfig;
    }
  }

  /**
   * 保存监控配置
   */
  async saveMonitoringConfig(config) {
    try {
      await this.saveConfig('monitoringConfig', config, '监控系统配置');
    } catch (error) {
      logger.error('保存监控配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取菜单项配置
   * 返回字段：text / link / newTab / icon
   *   - icon 为后端存储的图标 key（kebab-case），前端用 iconMap 渲染
   *   - 若老库未迁移导致 icon 缺失，本方法会回退按 link 识别（GitHub 链接 → 'github'）
   */
  async getMenuItems() {
    try {
      const menuItems = await database.all(
        'SELECT text, link, icon, new_tab, sort_order, enabled FROM menu_items WHERE enabled = 1 ORDER BY sort_order'
      );

      return menuItems.map(item => {
        const text = item.text || '';
        const link = item.link || '';
        const lowerLink = String(link).toLowerCase();
        const lowerText = String(text).trim().toLowerCase();
        // icon 字段：优先用存储值，缺失时按链接/文本兜底识别（仅对 GitHub 做强识别，避免误判）
        let icon = item.icon || '';
        if (!icon) {
          if (lowerText === 'github' || lowerLink.includes('github.com')) {
            icon = 'github';
          }
        }
        return {
          text,
          link,
          icon,
          newTab: Boolean(item.new_tab)
        };
      });
    } catch (error) {
      logger.error('获取菜单项失败:', error);
      return [];
    }
  }

  /**
   * 保存菜单项配置
   * 接收 items[i] = { text, link, newTab, icon }
   * 校验：text 必填；link 必填且仅接受 http(s):// 绝对 URL 或 / 开头站内路径；
   *       拒绝危险协议（javascript: / data: / vbscript: / file:）
   */
  async saveMenuItems(menuItems) {
    try {
      // 链接格式校验：与前端 Menu.vue isValidLink 逻辑一致
      const isValidLink = (link) => {
        if (!link || typeof link !== 'string') return false
        const v = link.trim()
        if (!v) return false
        if (/^\s*(javascript|data|vbscript|file):/i.test(v)) return false
        if (v.startsWith('/') && !v.startsWith('//')) return true
        if (/^https?:\/\//i.test(v)) return true
        return false
      }

      for (let i = 0; i < menuItems.length; i++) {
        const item = menuItems[i]
        if (!item.text || !String(item.text).trim()) {
          throw new Error(`第 ${i + 1} 项菜单文本不能为空`)
        }
        if (!isValidLink(item.link)) {
          throw new Error(`第 ${i + 1} 项链接地址无效：需以 http://、https:// 开头，或以 / 开头的站内路径`)
        }
      }

      // 校验通过：先清空现有菜单项
      await database.run('DELETE FROM menu_items');

      // 插入新的菜单项
      for (let i = 0; i < menuItems.length; i++) {
        const item = menuItems[i];
        await database.run(
          'INSERT INTO menu_items (text, link, icon, new_tab, sort_order, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            item.text,
            item.link,
            (item.icon || '').toString(),
            item.newTab ? 1 : 0,
            i + 1,
            1,
            new Date().toISOString(),
            new Date().toISOString()
          ]
        );
      }

      logger.info('菜单项配置保存成功');
    } catch (error) {
      logger.error('保存菜单项失败:', error);
      throw error;
    }
  }

  /**
   * 获取默认 Registry 配置
   */
  getDefaultRegistryConfigs() {
    return [
      {
        registry_id: 'docker-hub',
        name: 'Docker Hub',
        icon: 'fab fa-docker',
        color: '#2496ED',
        prefix: '',
        description: 'Docker 官方镜像仓库',
        proxy_url: 'registry-1.docker.io',
        enabled: true,
        sort_order: 1
      },
      {
        registry_id: 'ghcr',
        name: 'GitHub Container Registry',
        icon: 'fab fa-github',
        color: '#333333',
        prefix: 'ghcr.io',
        description: 'GitHub 容器镜像仓库',
        proxy_url: '',
        enabled: false,
        sort_order: 2
      },
      {
        registry_id: 'quay',
        name: 'Quay.io',
        icon: 'fas fa-cube',
        color: '#40B4E5',
        prefix: 'quay.io',
        description: 'Red Hat Quay 容器镜像仓库',
        proxy_url: '',
        enabled: false,
        sort_order: 3
      },
      {
        registry_id: 'gcr',
        name: 'Google Container Registry',
        icon: 'fab fa-google',
        color: '#4285F4',
        prefix: 'gcr.io',
        description: 'Google 容器镜像仓库',
        proxy_url: '',
        enabled: false,
        sort_order: 4
      },
      {
        registry_id: 'k8s',
        name: 'Kubernetes Registry',
        icon: 'fas fa-dharmachakra',
        color: '#326CE5',
        prefix: 'registry.k8s.io',
        description: 'Kubernetes 官方镜像仓库',
        proxy_url: '',
        enabled: false,
        sort_order: 5
      },
      {
        registry_id: 'mcr',
        name: 'Microsoft Container Registry',
        icon: 'fab fa-microsoft',
        color: '#00A4EF',
        prefix: 'mcr.microsoft.com',
        description: 'Microsoft 容器镜像仓库',
        proxy_url: '',
        enabled: false,
        sort_order: 6
      },
      {
        registry_id: 'elastic',
        name: 'Elastic Container Registry',
        icon: 'fas fa-bolt',
        color: '#FEC514',
        prefix: 'docker.elastic.co',
        description: 'Elastic 官方镜像仓库',
        proxy_url: '',
        enabled: false,
        sort_order: 7
      },
      {
        registry_id: 'nvcr',
        name: 'NVIDIA Container Registry',
        icon: 'fas fa-microchip',
        color: '#76B900',
        prefix: 'nvcr.io',
        description: 'NVIDIA GPU 容器镜像仓库',
        proxy_url: '',
        enabled: false,
        sort_order: 8
      }
    ];
  }

  /**
   * 初始化 Registry 配置
   */
  async initializeRegistryConfigs() {
    try {
      const defaultConfigs = this.getDefaultRegistryConfigs();
      
      for (const config of defaultConfigs) {
        const existing = await database.get(
          'SELECT id FROM registry_configs WHERE registry_id = ?',
          [config.registry_id]
        );
        
        if (!existing) {
          await database.run(
            `INSERT INTO registry_configs 
             (registry_id, name, icon, color, prefix, description, proxy_url, enabled, sort_order, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              config.registry_id,
              config.name,
              config.icon,
              config.color,
              config.prefix,
              config.description,
              config.proxy_url,
              config.enabled ? 1 : 0,
              config.sort_order,
              new Date().toISOString(),
              new Date().toISOString()
            ]
          );
        }
      }
      
      logger.info('Registry 配置初始化完成');
    } catch (error) {
      logger.error('初始化 Registry 配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有 Registry 配置
   */
  async getRegistryConfigs() {
    try {
      const configs = await database.all(
        'SELECT * FROM registry_configs ORDER BY sort_order'
      );
      
      // 如果表不存在或为空，返回默认配置
      if (!configs || configs.length === 0) {
        return this.getDefaultRegistryConfigs().map(config => ({
          registryId: config.registry_id,
          name: config.name,
          icon: config.icon,
          color: config.color,
          prefix: config.prefix,
          description: config.description,
          proxyUrl: config.proxy_url,
          enabled: config.enabled,
          sortOrder: config.sort_order
        }));
      }
      
      return configs.map(config => ({
        registryId: config.registry_id,
        name: config.name,
        icon: config.icon,
        color: config.color,
        prefix: config.prefix,
        description: config.description,
        proxyUrl: config.proxy_url,
        enabled: Boolean(config.enabled),
        sortOrder: config.sort_order
      }));
    } catch (error) {
      logger.error('获取 Registry 配置失败:', error);
      // 返回默认配置
      return this.getDefaultRegistryConfigs().map(config => ({
        registryId: config.registry_id,
        name: config.name,
        icon: config.icon,
        color: config.color,
        prefix: config.prefix,
        description: config.description,
        proxyUrl: config.proxy_url,
        enabled: config.enabled,
        sortOrder: config.sort_order
      }));
    }
  }

  /**
   * 获取启用的 Registry 配置
   */
  async getEnabledRegistryConfigs() {
    try {
      const configs = await database.all(
        'SELECT * FROM registry_configs WHERE enabled = 1 ORDER BY sort_order'
      );
      
      // 如果没有启用的配置，返回默认的 Docker Hub
      if (!configs || configs.length === 0) {
        return [{
          registryId: 'docker-hub',
          name: 'Docker Hub',
          icon: 'fab fa-docker',
          color: '#2496ED',
          prefix: '',
          description: 'Docker 官方镜像仓库',
          proxyUrl: '',
          enabled: true,
          sortOrder: 1
        }];
      }
      
      return configs.map(config => ({
        registryId: config.registry_id,
        name: config.name,
        icon: config.icon,
        color: config.color,
        prefix: config.prefix,
        description: config.description,
        proxyUrl: config.proxy_url,
        enabled: true,
        sortOrder: config.sort_order
      }));
    } catch (error) {
      logger.error('获取启用的 Registry 配置失败:', error);
      // 返回默认的 Docker Hub 配置
      return [{
        registryId: 'docker-hub',
        name: 'Docker Hub',
        icon: 'fab fa-docker',
        color: '#2496ED',
        prefix: '',
        description: 'Docker 官方镜像仓库',
        proxyUrl: '',
        enabled: true,
        sortOrder: 1
      }];
    }
  }

  /**
   * 更新单个 Registry 配置
   */
  async updateRegistryConfig(registryId, config) {
    try {
      await database.run(
        `UPDATE registry_configs 
         SET proxy_url = ?, enabled = ?, updated_at = ?
         WHERE registry_id = ?`,
        [
          config.proxyUrl || '',
          config.enabled ? 1 : 0,
          new Date().toISOString(),
          registryId
        ]
      );
      
      logger.info(`Registry 配置 ${registryId} 更新成功`);
    } catch (error) {
      logger.error('更新 Registry 配置失败:', error);
      throw error;
    }
  }

  /**
   * 批量更新 Registry 配置
   */
  async updateRegistryConfigs(configs) {
    try {
      for (const config of configs) {
        await this.updateRegistryConfig(config.registryId, config);
      }
      logger.info('批量更新 Registry 配置成功');
    } catch (error) {
      logger.error('批量更新 Registry 配置失败:', error);
      throw error;
    }
  }
}

module.exports = new ConfigServiceDB();
