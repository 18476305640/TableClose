
// -------------------数据状态区------------------------------
// 存储着tabId与{tab,...}的映射信息存储
let tabIdTabObj = {
    // tabId: {
    //     tab: {}
    // }
}
// 插件活跃/不活跃事件
let ActiveListen = {
    currentActiveTabId: null,
    onActivated: {},
    onNoActivated: {}
}

// ------------------函数工具区-------------------------------
function tabNoActiveCheck(tabId, fun1, fun2) {
    chrome.tabs.get(tabId, function (tab) {
        if (chrome.runtime.lastError) {
            // 处理获取标签页信息失败的情况
            console.log('获取标签页信息失败：', chrome.runtime.lastError);
            return;
        }
        if (tab.active) {
            // 当前标签页为活跃标签页
            fun1();
        } else {
            // 当前标签页不是活跃标签页
            fun2();
        }
    });

}
// 判断标签是否已经关闭
function currentTabIsClose(tabId, tab, closeFun, noCloseFun) {
    let currentTab = tabIdToTab(tabId);
    if (currentTab != null && currentTab == tab) {
        // 还没有关闭或覆盖
        if (noCloseFun != null) noCloseFun();
    } else {
        // 到这里说明找不到存活的对象
        if (closeFun != null) closeFun();
    }
}
function currentIsActive(tabId) {
    return tabId == ActiveListen.currentActiveTabId;
}
// 使用规则匹配
function matchUrl(url, matchSuccessFun) {
    chrome.storage.sync.get('tc_config', (res) => {
        // 获取配置成功
        let config = res.tc_config == null ? null : JSON.parse(res.tc_config);
        // 开始匹配
        for (let rule of config.retentionRules) {
            // 判断能否关闭, 如果当前规则匹配不了，跳过
            if (!url.includes(rule)) continue;
            // 到这里，说明匹配成功并执行了，应该跳出循环
            matchSuccessFun();
            return;
        }
        // 匹配失败

    });

}
// 判断tabId对应的tab的url是否满足规则
function matchUrlByTabId(tabId, matchSuccessFun) {
    chrome.tabs.get(tabId, function (tab) {
        matchUrl(tab.url, matchSuccessFun);
    });
}
// 根据tabId获取当前标题
// function getTitleByTabId(tabId) {
//     let tabObj = tabIdTabObj[tabId];
//     if (!(tabObj != null && tabObj.tab != null)) return null;
//     return tabObj.tab.title;
// }
// // 根据tabId获取原始标题
// function getInitTitleByTabId(tabId) {
//     // 判断是否有更新，如果更新也随着更新，判断依据是是否有“ | ”
//     let tab = tabIdToTab(tabId);
//     // 如果条件满足，说明已经更新了，直接返回最新的
//     // if( ! /^\d+ \| .*/.test( tab.title ) ) return tab.title;
//     let tabObj = tabIdTabObj[tabId];
//     if (!(tabObj != null && tabObj.tab != null)) return null;
//     return tabObj.title;
// }
// tabId转tab
function tabIdToTab(tabId) {
    if (tabIdTabObj[tabId] == null) return null;
    return tabIdTabObj[tabId].tab;
}
// tabId转tabObj
function tabIdToTabObj(tabId) {
    if (tabIdTabObj[tabId] == null) return null;
    return tabIdTabObj[tabId];
}
// ----------------------核心逻辑区---------------------------
// 标签监听器
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {

    // 只有加载完成再执行下面方法
    if (changeInfo.status !== 'complete') return;
    // 判断是否已经存在
    if (tabIdToTab(tabId) == tab) return;
    // 加入全局,这里需要存储原始title
    tabIdTabObj[tabId] = { tab:tab, title: changeInfo.title, activeListens: [] };

    // 模拟tab内部
    chrome.tabs.executeScript(tabId, { file: 'js/tabScript.js' });
    // // 设置tab标题函数
    // function setTabTitle(newTitle) {
    //     chrome.tabs.executeScript(tabId, {
    //         code: `document.title = "${newTitle}";`
    //     });
    // }
    // 添加定时器关闭tab
    let timer = null;
    function delayerClose() {
        // 在延时关闭前，再做一次url匹配
        matchUrlByTabId(tabId, function () {
            // 在开启新的定时任务时，清理上一次的。但不恢复标题
            closeTimer();
            let waitTime = 30 * 1000;
            let oneWait = 1000;
            timer = setInterval(function () {
                // 如果已经关闭了，关闭，防止报错
                currentTabIsClose(tabId, tab, function () {
                    // 判断标签是否已经关闭，如果关闭，不再执行
                    closeTimer(); // 关闭定时器
                    return;
                });
                // 如果活跃也关闭
                if (currentIsActive(tabId)) {
                    closeTimer();
                    return;
                }
                chrome.tabs.executeScript(tabId, {
                    code: `document.title = "${waitTime / 1000} | "+document.title.replace(/^\\d+ \\| /,"");`
                });
                waitTime -= oneWait;
                // 关闭标签的定时器
                if (waitTime <= 0) chrome.tabs.remove(tabId);
            }, oneWait)
        })

    }
    // 取消定时器
    function closeTimer() {
        // 关闭定时器
        if (timer != null) clearInterval(timer);
        timer = null;
        // 恢复title
        chrome.tabs.executeScript(tabId, {
            code: `document.title = document.title.replace(/^\\d+ \\| /,"");`
        });
        // if(isRestoreTitle) setTabTitle(getInitTitleByTabId(tabId));

    }

    // 读取数据，第一个参数是指定要读取的key以及设置默认值
    chrome.storage.sync.get('tc_config', (res) => {
        // 获取配置成功
        let config = res.tc_config == null ? null : JSON.parse(res.tc_config);
        // 如果之前没有初始化配置-初始化配置
        if (config == null) {
            // 赋于默认值
            config = {
                retentionRules: rule
            };
            // 保存
            chrome.storage.sync.set({ "tc_config": JSON.stringify(config) });
        }
        // 开始匹配
        matchUrl(tab.url, function () {
            // 匹配成功
            // 可以关闭，但如果tab活跃中不要关闭，而是给一个事件，当不活跃时，指定时间后再关闭
            tabNoActiveCheck(tabId, function () { }, function () {
                // setTabTitle("不活跃")
                delayerClose();
            })
            if (tab == null) return;
            // 添加一个不活跃事件
            ActiveListen.onNoActivated[tabId] = function () {
                // setTabTitle("不活跃")
                if (timer == null) {
                    // 如果当前自己不活跃了，且没有定时，需要确保存在定时器把自己关闭
                    delayerClose();
                }
            }
            // 添加一个活跃监听
            ActiveListen.onActivated[tabId] = function () {
                // 当活跃的是自己, 添加活跃事件，关闭close定时器
                closeTimer();
                // setTabTitle("活跃")
            }
        })


    });
});
// ------------------服务代码区----------------------
// 监听标签关闭
chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
    let tabObj = tabIdTabObj[tabId];
    // 从全局对象中移除
    if (tabObj != null) {
        delete tabIdTabObj[tabId];
    }
    // 移除活跃与不活跃的监听
    delete ActiveListen.onNoActivated[tabId];
    delete ActiveListen.onActivated[tabId];

});

// 维护一个当前活跃标签
chrome.tabs.onActivated.addListener(function (activeInfo) {
    ActiveListen.currentActiveTabId = activeInfo.tabId;
    // 触发活跃
    if (ActiveListen.onActivated[ActiveListen.currentActiveTabId] != null) ActiveListen.onActivated[ActiveListen.currentActiveTabId]();
});
chrome.tabs.onActivated.addListener(function (activeInfo) {
    // 触发监听自己不活跃的
    for (let tabId in ActiveListen.onNoActivated) {
        if (activeInfo.tabId == tabId) continue;
        ActiveListen.onNoActivated[tabId]();
    }
});
