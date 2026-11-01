# room-climate-monitor 协作规则

> 这是维护者和 AI 编码助手协作时的约定。外部贡献者只需要遵守其中的提交信息规范，见 README 的"参与贡献"。

## 提交（git commit）

- **提交信息里不允许出现 AI 署名或共同作者信息**，包括但不限于：
  - `Co-Authored-By: …` 这类行（任何大小写）
  - `Generated with Claude Code`、`🤖 Generated with …` 这类署名
  - 含 `noreply@anthropic.com` 的内容
- 仓库的 `.githooks/commit-msg` 会拒绝包含上述内容的提交。启用方法：`git config core.hooksPath .githooks`。
- 提交使用 GPG 签名，签名时需要输入密码，所以**由维护者自己执行 `git commit`**；Claude 只负责准备好改动和提交信息。
- **Claude 永远不执行 `git push`**，也不通过 `gh` 等工具向 GitHub 推送、创建 PR 或发布。推送和发布一律由维护者自己操作。
- 只保留 `main` 一个长期分支。

## 工程初始化

- 创建工程骨架、首次安装依赖等初始化命令，由维护者自己执行；Claude 只给出命令，等执行完成后再检查结果。

## 语言

- 回复使用简体中文。
