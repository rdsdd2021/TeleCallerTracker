# Android Mobile Client Developer Guide

This guide covers the mobile client architecture, telephony permissions, background synchronization engine, and the process for building and testing the Android APK.

---

## 1. Mobile Technology Stack

* **Core Framework:** React Native 0.74+ / 0.80+
* **Language:** TypeScript & Kotlin
* **Background Tasks:** `react-native-background-fetch` + Android `HeadlessJsTaskService`
* **Local Storage:** `@react-native-async-storage/async-storage`
* **Design & Icons:** Custom design system, Lucide icons, Vector icons
* **Network & Database Client:** `@supabase/supabase-js` with URL polyfill

---

## 2. Android Permissions & Telephony Integration

The Android application operates as an internal telecaller tracking companion and requires telephony permissions declared in [`android/app/src/main/AndroidManifest.xml`](../android/app/src/main/AndroidManifest.xml):

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.READ_CALL_LOG" />
<uses-permission android:name="android.permission.READ_PHONE_STATE" />
<uses-permission android:name="android.permission.READ_CONTACTS" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
```

### Critical Permission Explanations
* `READ_CALL_LOG` & `READ_PHONE_STATE`: Allows the `callLogService.ts` to inspect the device's ContentResolver to extract call durations, timestamps, and caller directions.
* `FOREGROUND_SERVICE_DATA_SYNC`: Required for Android 14 (API 34+) to run background data synchronization without system throttling.
* `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`: Prompts the telecaller to exempt the app from aggressive OEM battery killers (MIUI, OneUI, ColorOS) to keep real-time syncing alive.

---

## 3. Background Sync & Boot Persistence

### Background Task Lifecycle
1. **Headless JS Entry (`index.js`):**
   ```javascript
   import BackgroundFetch from 'react-native-background-fetch';
   import { runSync } from './src/services/syncService';

   const BackgroundFetchHeadlessTask = async (event) => {
     await runSync();
     BackgroundFetch.finish(event.taskId);
   };

   BackgroundFetch.registerHeadlessTask(BackgroundFetchHeadlessTask);
   AppRegistry.registerHeadlessTask('SyncTask', () => runSync);
   ```
2. **Reboot Recovery (`BootReceiver.kt`):**
   Catches the `android.intent.action.BOOT_COMPLETED` broadcast intent and initializes the foreground synchronization job without requiring the telecaller to manually open the app.

---

## 4. Building the Android APK

### Prerequisites
* JDK 17 (Java Development Kit)
* Android Studio with Android SDK Build Tools (API 34)
* Node.js 18+ and npm

### Local Run (Debug)
```bash
# In the root repository directory:
npm install

# Start Metro bundler
npm start

# In a separate terminal, deploy to connected phone / emulator
npm run android
```

### Compiling Standalone Debug APK
To generate a standalone APK that can be transferred and installed on Android phones via WhatsApp, Google Drive, or USB:

```bash
cd android
./gradlew assembleDebug
```
The compiled APK will be located at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Compiling Production Release APK
1. Generate an upload keystore:
   ```bash
   keytool -genkey -v -keystore my-upload-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Place `my-upload-key.keystore` into `android/app/`.
3. Configure `android/gradle.properties`:
   ```properties
   MYAPP_UPLOAD_STORE_FILE=my-upload-key.keystore
   MYAPP_UPLOAD_KEY_ALIAS=my-key-alias
   MYAPP_UPLOAD_STORE_PASSWORD=*****
   MYAPP_UPLOAD_KEY_PASSWORD=*****
   ```
4. Build release bundle:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```
   Output: `android/app/build/outputs/apk/release/app-release.apk`
