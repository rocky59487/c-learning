# AI Engineering from Scratch — 繁體中文 Android 版

非官方的 Android 課程閱讀器，預設使用 `zh-TW`。

## 語言與專業術語
- 官方網站的繁體中文 UI 翻譯由上游提供。
- 原專案目前沒有 `i18n/zh-TW/phases` 的課程正文。此 App 僅針對正式課程 Markdown 請求（`zh-TW`）讀取上游 `translations/i18n/zh/phases` 中文譯文，透過 opencc4j 轉換為臺灣繁體；找不到中文時照官方邏輯回退英文。
- 保留程式碼區塊、英文縮寫、CLI 指令、API、檔名、URLs 和數學語法；於部分專業術語第一次出現時顯示英文標準名稱。原社群中文翻譯並非逐課人工審核，術語不能保證 100% 正確。
- 仍可用官方語言選擇器，以及 App 選單「閱讀英文原文」「切換繁體中文」「英文術語對照」。
- translated markdown cached on the device per lesson. Official site UI and exercises otherwise unchanged.
- Android 8.0+。線上閱讀，需要網路，非完整離線資料庫或手機本地 AI 推論平台。

## Build
在儲存庫根目錄：`cd aiefs-mobile && gradle :app:assembleDebug`，使用 Java 17、Gradle 8.11.1、Android SDK 35。
GitHub Actions 可直接下載編譯的 APK artifact。

Source: https://github.com/rohitg00/ai-engineering-from-scratch (MIT)
Chinese conversion: opencc4j (Apache-2.0)

## v1.2 修正課程無法開啟問題
- `api/lesson.js` 不接受 `lang=zh-TW` 參數，先前 APK 自動追加 `lang=zh-TW` 導致導向循環。本版不會追加語言查詢參數。
- 使用 WebView localStorage 和原站 AIFS_onLangChange 實現繁體中文課程，仍保留原始專業英文術語。
- 載入失敗時可顯示錯誤資訊或在 Chrome 開啟。
- 使用新 package ID 避免與先前一次性 Debug APK 不同簽章導致更新安裝失敗。可先並存測試，確認正常後卸載舊版。
