# KotlinApp (NDrive Android)

Android client for NDrive/CloudVault built with Kotlin, Jetpack Compose, Hilt, Room, and Supabase.

## Quick Start

1. Install Android Studio (latest stable) with Android SDK 35.
2. Use JDK 17+ (Android Studio embedded JDK is recommended).
3. Create or update `local.properties` in this folder:

```properties
sdk.dir=C\\:\\Users\\<your-user>\\AppData\\Local\\Android\\Sdk
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
TDLIB_SERVICE_URL=http://10.0.2.2:3001
TDLIB_SERVICE_API_KEY=your-tdlib-key
```

4. Build from this folder:

```bash
./gradlew :app:assembleDebug
```

On Windows PowerShell:

```powershell
.\gradlew.bat :app:assembleDebug
```

## Folder Hierarchy

Keep source of truth in these folders:

- `app/src/main/java/com/ndrive/cloudvault/` - app source code
- `app/src/main/res/` - resources (drawables, strings, themes)
- `app/src/test/` and `app/src/androidTest/` - tests
- `gradle/` - version catalog and wrapper config
- `build.gradle.kts`, `settings.gradle.kts` - project build setup
- `app/build.gradle.kts` - app module build setup

Generated folders/files (do not edit/commit):

- `.gradle/`, `.idea/`, `.kotlin/`
- `build/`, `app/build/`
- `hs_err_pid*`, `replay_pid*`, `temp_import.txt`

## Useful Commands

```bash
./gradlew clean
./gradlew :app:assembleDebug
./gradlew :app:testDebugUnitTest
```

## Notes

- Build config reads secrets from `local.properties` first, then environment variables.
- If Gradle sync is heavy, run `./gradlew clean` once and re-sync.
