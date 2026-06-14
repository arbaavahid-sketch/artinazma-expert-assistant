# Capacitor Android/iOS Packaging

This frontend is configured as a Capacitor shell for publishing the Artin app to
Google Play, Cafe Bazaar, and later the Apple App Store.

## Production URL

The native shell loads the hosted web app:

```text
https://app.artinazma.net
```

Change this in `capacitor.config.ts` if the final domain is different, or set:

```powershell
$env:CAPACITOR_SERVER_URL="https://your-domain.example"
npm run cap:sync
```

The domain must use HTTPS for camera/microphone, PWA, cookies, and store review.

## Android Test Build

Requirements:

- Android Studio
- Android SDK Platform matching `compileSdkVersion` in `android/variables.gradle`
- JDK supported by Android Studio/Gradle
- Internet access to Google Maven and Maven Central

Commands:

```powershell
cd frontend
npm install
npm run cap:sync
npm run cap:open:android
```

In Android Studio:

- Let Gradle sync finish.
- Select a device or emulator.
- Run the `app` configuration.

CLI debug build:

```powershell
cd frontend/android
.\gradlew.bat assembleDebug
```

Debug APK output:

```text
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

## Store Builds

Google Play prefers an Android App Bundle:

```powershell
cd frontend/android
.\gradlew.bat bundleRelease
```

Output:

```text
frontend/android/app/build/outputs/bundle/release/app-release.aab
```

Cafe Bazaar commonly accepts Android APK/AAB depending on the current developer
panel options. For APK:

```powershell
cd frontend/android
.\gradlew.bat assembleRelease
```

Output:

```text
frontend/android/app/build/outputs/apk/release/app-release-unsigned.apk
```

Release builds must be signed before upload.

## iOS

iOS requires macOS, Xcode, and an Apple Developer account:

```powershell
cd frontend
npm install @capacitor/ios
npx cap add ios
npm run cap:sync
npx cap open ios
```

Use Xcode and TestFlight for iPhone testing and App Store submission.

## Notes

- Android package id: `net.artinazma.expertassistant`
- App display name: `Artin`
- The native Android shell has microphone and Android notification permissions.
- Native splash and launcher icons are generated from `public/icons`.
- The app currently uses a hosted web app model. Do not publish until
  `https://app.artinazma.net` is live and tested.
