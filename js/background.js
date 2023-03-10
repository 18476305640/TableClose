
function tabNoActiveCheck(tabId,fun1,fun2) {
    chrome.tabs.get(tabId, function(tab) {
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
        chrome.windows.get(tab.windowId, {populate: true}, function (win) {
            for (var i = 0; i < win.tabs.length; ++i)
                if (win.tabs[i].id == tab.id)
                    return callback(win);
            callback(null);
        });
    });
}
function tabScript() {
    // TODO
}
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    // 模拟tab内部
    // getTabWindow(tabId,function(tabWindow) {
    //     let bindFun = tabScript.bind(tabWindow);
    //     bindFun();
    // });
    // 设置tab标题函数
    function setTabTitle(newTitle) {
        chrome.tabs.executeScript(tabId, {
            code: `document.title = "${newTitle}";`
        });
    }

    // 添加定时器关闭tab
    let timer = null;
    function delayerClose () {
        // 在开启新的定时任务时，清理上一次的
        closeTimer();
        let waitTime = 30*1000;
        let oneWait = 1000;
        chrome.tabs.get(tabId, function(tab) {
            // 标签标题
            var title = tab.title;
            timer = setInterval(function() {
                setTabTitle(`${waitTime/1000} | ${title}`);
                waitTime -= oneWait;
                // 关闭标签的定时器
                if(waitTime <= 0) chrome.tabs.remove(tabId);
            },oneWait)
        });
        
    }
    // 取消定时器
    function closeTimer() {
        // 恢复title
        chrome.tabs.get(tabId, function(tab) {
            debugger
            var titleArr = tab.title.split("|");
            if(titleArr.length > 1) {
                titleArr.splice(0,1); // 删除第一个
                let title = titleArr.join().trim();
                chrome.tabs.executeScript(tabId, {
                    code: `document.title = "${title}";`
                });
            }
        });
        // 关闭定时器
        if(timer != null ) clearInterval(timer);
        timer = null;
        
    }
    

    // 读取数据，第一个参数是指定要读取的key以及设置默认值
    chrome.storage.sync.get('tc_config', (res) => {
        // 获取配置成功
        let config = res.tc_config==null?null:JSON.parse(res.tc_config);
        let tabTitleBack = null;
        // 赋值标题
        function initTile() {
            chrome.tabs.get(tabId, function(tab) {
                // 标签标题
                tabTitleBack = tab.title;
            });
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
            // 判断能否关闭
            if (changeInfo.status === 'complete' && tab.url.includes(rule)) {
                // 初始化一次 tabTitleBack
                initTile();
                // 可以关闭，但如果tab活跃中不要关闭，而是给一个事件，当不活跃时，指定时间后再关闭
                tabNoActiveCheck(tabId,function() {
                    // 正在活跃，添加事件
                    chrome.tabs.get(tabId, function(tab) {
                        // 获取标签页的详细信息
                        if (tab == null) return;
                        // 添加一个不活跃事件
                        chrome.tabs.onActivated.addListener(function(activeInfo) {
                            if (activeInfo.tabId !== tabId && timer == null ) {
                                delayerClose();
                            }
                        });
                    });
                    // 添加活跃事件，当活跃时，关闭close定时器
                    chrome.tabs.onActivated.addListener(function(activeInfo) {
                        if (activeInfo.tabId == tabId) {
                            closeTimer();
                            setTabTitle(tabTitleBack);
                        }
                    });
                },function() {
                    delayerClose();
                })
                
            }

        }


    });


});
