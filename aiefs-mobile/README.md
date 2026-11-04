# AI Engineering from Scratch — Android reader
This is an unofficial online Android WebView reader of https://aiengineeringfromscratch.com/ (MIT-licensed original by Rohit Ghumare and contributors).

This isolated branch contains a stand-alone Gradle Android app in `aiefs-mobile/`.
The source project does not add full offline lessons or local Python/GPU runtime.
Course progress remains in this app's WebView local storage and is separate from Chrome.
Build: `cd aiefs-mobile && gradle :app:assembleDebug` (Gradle 8.11.1 / JDK 17 / Android SDK 35).
Get APK from Actions > Build AI Engineering Android APK > Artifacts. Install `app-debug.apk` on Android 8.0+.
