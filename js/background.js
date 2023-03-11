
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
function getTabWindow(tabId, callback) {
    chrome.tabs.get(tabId, function (tab) {
        if (!callback)
            return;
        chrome.windows.get(tab.windowId, { populate: true }, function (win) {
            for (var i = 0; i < win.tabs.length; ++i)
                if (win.tabs[i].id == tab.id)
                    return callback(win);
            callback(null);
        });
    });
}
// 判断标签是否已经关闭
function currentTabIsClose(tabId, closeFun, noCloseFun) {
    chrome.tabs.query({}, function(tabs) {
        for (var i = 0; i < tabs.length; i++) {
            var tab = tabs[i];
            if(tab.id === tabId) {
                // 存活着
                if (noCloseFun != null) noCloseFun();
                return;
            }
        }
        // 到这里说明找不到存活的对象
        if (closeFun != null) closeFun();
    });

}
function tabScript() {
    // TODO
}
// 标签监听器
function listener(tabId, changeInfo, tab) {
    // 只有加载完成再执行下面方法
    if (changeInfo.status !== 'complete') return;
    // tabId, changeInfo,
    // let tabId = tab.id; // 根据tab获取tabId
    // let changeInfo = tab.status; // 根据status获取changeInfo
    // 模拟tab内部
    chrome.tabs.executeScript(tabId, { file: 'js/tabScript.js' });
    // 设置tab标题函数
    function setTabTitle(newTitle) {
        chrome.tabs.executeScript(tabId, {
            code: `document.title = "${newTitle}";`
        });
    }
    // 添加定时器关闭tab
    let timer = null;
    function delayerClose() {
        // 在开启新的定时任务时，清理上一次的
        closeTimer();
        let waitTime = 30 * 1000;
        let oneWait = 1000;
        // 标签标题
        var title = tab.title;
        timer = setInterval(function () {
            currentTabIsClose(tabId,function () {
                // 判断标签是否已经关闭，如果关闭，不再执行
                closeTimer(); // 关闭定时器
            });
            setTabTitle(`${waitTime / 1000} | ${title}`);
            waitTime -= oneWait;
            // 关闭标签的定时器
            if (waitTime <= 0) chrome.tabs.remove(tabId);
        }, oneWait)

    }
    // 取消定时器
    function closeTimer() {
        // 恢复title
        var titleArr = tab.title.split("|");
        if (titleArr.length > 1) {
            titleArr.splice(0, 1); // 删除第一个
            let title = titleArr.join().trim();
            chrome.tabs.executeScript(tabId, {
                code: `document.title = "${title}";`
            });
        }
        // 关闭定时器
        if (timer != null) clearInterval(timer);
        timer = null;

    }

    // 读取数据，第一个参数是指定要读取的key以及设置默认值
    chrome.storage.sync.get('tc_config', (res) => {
        // 获取配置成功
        let config = res.tc_config == null ? null : JSON.parse(res.tc_config);
        let tabTitleBack = null;
        // 初始化原始标题函数
        function initTile() {
            // 从tab标签来赋值变量
            tabTitleBack = tab.title;
        }
        initTile();
        // 如果之前没有初始化配置-初始化配置
        if (config == null) {
            // 赋于默认值
            config = {
                retentionRules: [
                    "www.baidu.com"
                ]
            };
            // 保存
            chrome.storage.sync.set({ "tc_config": JSON.stringify(config) });
        }
        // 开始匹配
        for (let rule of config.retentionRules) {
            // 判断能否关闭, 如果当前规则匹配不了，跳过
            if (! tab.url.includes(rule)) continue;
            // 初始化一次 tabTitleBack
            initTile();
            // 可以关闭，但如果tab活跃中不要关闭，而是给一个事件，当不活跃时，指定时间后再关闭
            tabNoActiveCheck(tabId, function () {
                // 正在活跃，添加事件
                // 获取标签页的详细信息
                if (tab == null) return;
                // 添加一个不活跃事件
                chrome.tabs.onActivated.addListener(function (activeInfo) {
                    if (activeInfo.tabId !== tabId && timer == null) {
                        // 如果关闭的不是自己，且没有定时时，需要确保存在定时器把自己关闭
                        delayerClose();
                    }
                    if (activeInfo.tabId == tabId) {
                        // 当关闭的是自己, 添加活跃事件，当活跃时，关闭close定时器
                        closeTimer();
                        setTabTitle(tabTitleBack);
                    }
                });

            }, function () {
                delayerClose();
            })
            // 到这里，说明匹配成功并执行了，应该跳出循环
            break;

        }


    });


}
chrome.tabs.onUpdated.addListener(listener);


