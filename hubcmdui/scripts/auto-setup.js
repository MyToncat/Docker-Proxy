#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { isDatabaseReady, getDatabaseStats } = require('../utils/database-checker');

// 检查是否需要安装依赖
function needsInstall() {
    const nodeModulesPath = path.join(process.cwd(), 'node_modules');
    const packageLockPath = path.join(process.cwd(), 'package-lock.json');
    
    if (!fs.existsSync(nodeModulesPath)) {
        return true;
    }
    
    // 检查package.json是否比package-lock.json新
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath) && fs.existsSync(packageLockPath)) {
        const packageStat = fs.statSync(packageJsonPath);
        const lockStat = fs.statSync(packageLockPath);
        if (packageStat.mtime > lockStat.mtime) {
            return true;
        }
    }
    
    return false;
}

// 检查是否需要初始化数据库
async function needsInit() {
    const dataDir = path.join(process.cwd(), 'data');
    
    // 如果data目录不存在，需要初始化
    if (!fs.existsSync(dataDir)) {
        return true;
    }
    
    // 使用专门的数据库检查器
    const isReady = await isDatabaseReady();
    return !isReady;
}

// 执行命令并显示输出
function runCommand(command, description) {
    console.log(`\n🔄 ${description}...`);
    try {
        execSync(command, { stdio: 'inherit', cwd: process.cwd() });
        console.log(`✅ ${description}完成`);
        return true;
    } catch (error) {
        console.error(`❌ ${description}失败:`, error.message);
        return false;
    }
}

async function autoSetup() {
    console.log('🚀 HubCmdUI 自动设置检查...\n');
    
    let needsSetup = false;
    
    // 检查是否需要安装依赖
    if (needsInstall()) {
        console.log('📦 检测到需要安装依赖包');
        needsSetup = true;
        
        if (!runCommand('npm install', '安装依赖包')) {
            process.exit(1);
        }
    } else {
        console.log('✅ 依赖包已安装');
    }
    
    // 检查是否需要初始化
    const needsInitialization = await needsInit();
    if (needsInitialization) {
        console.log('🗄️ 检测到需要初始化数据库');
        needsSetup = true;
        
        if (!runCommand('node scripts/init-complete.js', '初始化SQLite数据库')) {
            process.exit(1);
        }
    } else {
        console.log('✅ 数据库已初始化');
    }
    
    if (needsSetup) {
        console.log('\n🎉 系统设置完成！正在启动服务...\n');
    } else {
        console.log('\n🎯 系统已就绪，正在启动服务...\n');
    }
    
    // 启动服务器
    console.log('🌐 启动 HubCmdUI 服务器...');
    console.log('📍 访问地址: http://localhost:3000');
    console.log('🔧 管理面板: http://localhost:3000/admin');
    console.log('👤 默认账户: root（请尽快修改默认密码）\n');
    
    // 启动主服务器
    try {
        require('../server.js');
    } catch (error) {
        console.error('❌ 服务器启动失败:', error.message);
        console.error('💡 尝试运行: npm run init 重新初始化');
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    autoSetup().catch(error => {
        console.error('❌ 自动设置失败:', error.message);
        process.exit(1);
    });
}

module.exports = { autoSetup, needsInstall, needsInit };
