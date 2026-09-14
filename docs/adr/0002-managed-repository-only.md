# 只管理认证用户的专用仓库

unote 不开放任意本地 Git 仓库入口；用户必须通过认证提供方登录，应用只创建或打开 `<username>.<auth-provider>.unote` 私有仓库。这个限制牺牲通用 Git 客户端能力，换取可预测的协议、低用户心智负担和安全自动同步；Gitee 是首个 adapter，GitHub 与 GitLab 可后续增加。
