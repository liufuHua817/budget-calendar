# 预算日历

一款面向 iPhone 的本地优先记账 PWA。每个预算周期从实际发薪日开始，到下次发薪日前一天结束；日预算会随结余、超支和发薪延期自动重算。

## 功能

- 自定义发薪周期和周期可花预算
- 今天还能花（已扣除今日消费）、每日结余滚存、超支后剩余天数重分配
- 预算消费与固定支出分开统计
- 自定义项目和多个快捷金额；首页四列展示前 7 项，更多金额可原地展开
- 自然月收支日历：绿色结余、珊瑚色超支，正负金额辅助区分，今天暂计、未来不提前计入结余
- 每日明细、周期历史；进行中的周期明确标注剩余预算
- 5 秒撤销、完整 JSON 备份与恢复
- IndexedDB 本机保存、离线启动、iPhone 主屏幕安装

## 本地运行

建议 Node.js 24.15 或更高的兼容 LTS 版本（包含测试环境要求）。

```bash
npm install
npm run dev
```

完整验证：

```bash
npm test
npm run lint
npm run build
npm run preview -- --host 0.0.0.0
```

生产静态文件生成在 `dist/`。部署时只上传这个目录，并确保网址使用 HTTPS。

GitHub Pages 构建自动使用仓库子路径，页面路由采用 `/#/entry` 等 hash 地址，支持子页面直接刷新。部署工作流在推送后才会运行；本地修改不会自动发布。

## 数据与隐私

账目保存在当前浏览器的 IndexedDB 中，不会随代码一起上传到服务器。清除 Safari 网站数据、删除浏览器数据或更换手机可能丢失记录，请定期在“设置 → 备份与恢复”导出到 iCloud Drive。

## 发布状态

- 部署记录与对应提交：[GitHub Actions](https://github.com/liufuHua817/budget-calendar/actions/workflows/deploy-pages.yml)
- 稳定网址：[预算日历](https://liufuhua817.github.io/budget-calendar/)

参见 [iPhone 安装说明](docs/iphone-installation.md) 和 [发布检查清单](docs/release-checklist.md)。
