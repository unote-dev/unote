# unote 领域语言

unote 是一个轻量、Git 优先的个人文档应用。真实目录和文件是内容真相，应用负责编辑、导航与安全同步。

## 内容

**文档（Document）**：文件夹中的真实内容文件，以仓库相对路径作为唯一持久身份。
_避免使用_：笔记、页面、记录

**Markdown 文档（Markdown Document）**：扩展名为 `.md`、内容遵循 CommonMark/GFM 的文档。

**画布文档（Canvas Document）**：扩展名为 `.excalidraw`、内容遵循 Excalidraw JSON 格式的文档。

**脑图文档（Mind Map Document）**：扩展名为 `.mindmap`、内容表达严格有根树的文档。

**文件夹（Folder）**：笔记库中的真实目录，可任意嵌套并包含文件夹或文档。
_避免使用_：笔记本、分类

**资源（Asset）**：位于 `.assets/`、可由文档引用的仓库级真实附件文件。

## 存储与同步

**笔记库（Library）**：一个认证用户在一个认证提供方上的完整 unote 内容集合，由专用 Git 仓库承载。
_避免使用_：工作区、Vault

**专用仓库（Managed Repository）**：unote 为用户管理的唯一远端仓库，名称为 `<username>.<auth-provider>.unote`。

**本地保存（Local Save）**：把内存中的文档变化写入本机真实文件，不创建 Git 提交，也不访问网络。

**同步（Sync）**：通过 Git 协调本机笔记库和远端专用仓库的过程。

**同步冲突（Sync Conflict）**：多台设备分别修改相同内容，且不能直接协调的状态。

**回收站（Trash）**：由仓库根目录 `.trash/` 表达的已删除内容集合。

**本地索引（Local Index）**：从真实目录树和内容派生、可删除重建且不进入 Git 的设备缓存。

## 系统与安全

**认证提供方（Auth Provider）**：提供用户身份认证和 Git 仓库托管的外部系统，例如 Gitee、GitHub 或 GitLab。

**系统文件（System File）**：由 unote 管理且不作为普通内容展示的点前缀路径，例如 `.unote/`、`.assets/` 和 `.trash/`。

**安全名称（Safe Name）**：可在所有支持平台直接用作文件或目录名，且不占用点前缀系统名称空间的用户名称。

**外部变化（External Change）**：用户或其他工具在 unote 之外对笔记库真实目录或文件所作的变化。

**登录凭据（Login Credential）**：访问认证提供方所需且必须由操作系统安全存储保护的秘密。
