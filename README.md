# 预算日历

一款面向 iPhone 的本地优先记账 PWA。每个预算周期从实际发薪日开始，到下次发薪日前一天结束；日预算会随结余、超支和发薪延期自动重算。

## 功能

- 自定义发薪周期和周期可花预算
- 今日可用、每日结余滚存、超支后剩余天数重分配
- 预算消费与固定支出分开统计
- 自定义项目和多个快捷金额，例如地铁 ¥2.70 / ¥3.60
- 日历、每日明细、周期盈余或超支历史
- 5 秒撤销、完整 JSON 备份与恢复
- IndexedDB 本机保存、离线启动、iPhone 主屏幕安装

## 本地运行

需要 Node.js 20 或更高版本。

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

## 数据与隐私

账目保存在当前浏览器的 IndexedDB 中，不会随代码一起上传到服务器。清除 Safari 网站数据、删除浏览器数据或更换手机可能丢失记录，请定期在“设置 → 备份与恢复”导出到 iCloud Drive。

## 发布状态

- 验证提交：待最终验收后填写
- 稳定网址：尚未部署

参见 [iPhone 安装说明](docs/iphone-installation.md) 和 [发布检查清单](docs/release-checklist.md)。
