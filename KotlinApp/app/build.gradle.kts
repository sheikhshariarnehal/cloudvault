import java.util.Properties

plugins {
    alias(libs.plugins.androidApplication)
    alias(libs.plugins.jetbrainsKotlinAndroid)
    alias(libs.plugins.daggerHilt)
    alias(libs.plugins.ksp)
    alias(libs.plugins.kotlinSerialization)
}

val localProperties = Properties().apply {
    val localPropertiesFile = rootProject.file("local.properties")
    if (localPropertiesFile.exists()) {
        localPropertiesFile.inputStream().use(::load)
    }
}

fun String.escapeForBuildConfig(): String =
    replace("\\", "\\\\").replace("\"", "\\\"")

val supabaseUrl =
    localProperties.getProperty("SUPABASE_URL")
        ?: System.getenv("SUPABASE_URL")
        ?: "https://zcigqsiovqqldlsnwiqd.supabase.co"

val supabaseAnonKey =
    localProperties.getProperty("SUPABASE_ANON_KEY")
        ?: System.getenv("SUPABASE_ANON_KEY")
        ?: ""

val tdlibServiceUrl =
    localProperties.getProperty("TDLIB_SERVICE_URL")
        ?: System.getenv("TDLIB_SERVICE_URL")
        ?: "http://10.0.2.2:3001"

val tdlibServiceApiKey =
    localProperties.getProperty("TDLIB_SERVICE_API_KEY")
        ?: System.getenv("TDLIB_SERVICE_API_KEY")
        ?: ""

android {
    namespace = "com.ndrive.cloudvault"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.ndrive.cloudvault"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"

        buildConfigField(
            "String",
            "SUPABASE_URL",
            "\"${supabaseUrl.escapeForBuildConfig()}\""
        )
        buildConfigField(
            "String",
            "SUPABASE_ANON_KEY",
            "\"${supabaseAnonKey.escapeForBuildConfig()}\""
        )
        buildConfigField(
            "String",
            "TDLIB_SERVICE_URL",
            "\"${tdlibServiceUrl.escapeForBuildConfig()}\""
        )
        buildConfigField(
            "String",
            "TDLIB_SERVICE_API_KEY",
            "\"${tdlibServiceApiKey.escapeForBuildConfig()}\""
        )

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.8"
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.navigation.compose)

    // Hilt
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)

    // Retrofit
    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.gson)
    implementation(libs.okhttp.logging)

    // Room
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)

    // Supabase
    implementation(libs.supabase.gotrue)
    implementation(libs.supabase.compose.auth)
    implementation(libs.supabase.postgrest)
    implementation(libs.ktor.client.android)

    // Background
    implementation(libs.work.runtime.ktx)

    // Coil
    implementation(libs.coil.compose)

    // DataStore
    implementation(libs.datastore.preferences)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.androidx.material.icons.extended)

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.ui.test.junit4)
    debugImplementation(libs.androidx.ui.tooling)
    debugImplementation(libs.androidx.ui.test.manifest)
}
