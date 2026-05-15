# HoopBoard Modular Phase 1

這是第一階段拆檔版：保留原功能，不重寫架構，只把單一 HTML 拆成可維護檔案。

## 檔案結構

```
index.html
style.css
js/helper.js
js/firebase-sync.js
js/main.js
backup/old-single-file.html
```

## 使用方式

1. 將整個資料夾內容上傳到 GitHub repo 根目錄。
2. GitHub Pages 網址會是：`https://ryamhome.github.io/hoopboard/`
3. 本地測試請用 VS Code Live Server 開啟 `index.html`。

## 本版已包含

- 保留 SVG 球場 + Canvas 戰術層
- 保留 Firebase 房間同步
- 保留聊天室與廣播
- 保留 10 套動畫戰術庫
- 加入 `players` 初始化修正，避免新增球員時 `push` 錯誤
- 保留 `lerp` 全域 helper

## 注意

這是「第一階段拆檔」，不是完整重構。下一階段才建議把 `main.js` 再拆成 `state.js`, `render.js`, `input.js`, `animation.js`, `tactics.js`。
