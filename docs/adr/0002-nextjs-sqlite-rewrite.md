# 用 Next.js 和 SQLite 重做今日一页，不搬演示页 HTML

界面布局和交互对齐现有 8774 今日一页，但在本仓库用 TypeScript、Next.js 重做，数据存在 SQLite，通过服务端读写。不把 pm-demo-8774 的静态 HTML 搬过来改。选 SQLite 是为了本地和云端都能直接跑，以后若要再迁 Postgres。
