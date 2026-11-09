# client/ — 面板客户端源码片段

`client.js` 是一个 `__ModuleLoader__` 工厂闭包，DSH 直接加载它，没有打包步骤。
为了让改动有边界，源码按功能切成这里的 `NN-名字.js`，**按文件名顺序原样拼接**就是 `client.js`：

```bash
node tools/build-client.mjs          # 改完片段后重新生成 client.js
node tools/build-client.mjs --check  # 检查是否同步（tests/build.test.mjs 也会查）
```

规则：
- 只改这里的片段，不要直接改 `client.js`。
- 片段之间共享一个作用域（同一个闭包），不是 ES 模块；顺序有意义，新片段按编号插入。
- `00-header-i18n.js` 打开闭包并放中英词典，`29-plugin.js` 注册插槽并关闭闭包。
