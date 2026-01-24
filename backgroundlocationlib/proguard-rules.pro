# Background Location Library ProGuard Rules

# Keep all public API classes and methods
-keep public class com.griyamart.backgroundlocation.BackgroundLocationManager {
    public *;
}

-keep public class com.griyamart.backgroundlocation.config.** {
    public *;
}

-keep public class com.griyamart.backgroundlocation.model.** {
    public *;
}

-keep interface com.griyamart.backgroundlocation.BackgroundLocationManager$* {
    *;
}

# Keep Parcelable implementations
-keepclassmembers class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator CREATOR;
}

# Keep service classes
-keep class com.griyamart.backgroundlocation.service.** {
    public *;
}

# Keep receiver classes
-keep class com.griyamart.backgroundlocation.receiver.** {
    public *;
}

# Keep activity classes
-keep class com.griyamart.backgroundlocation.ui.** {
    public *;
}

# Gson serialization rules
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn sun.misc.**

# Keep Gson model classes
-keep class com.griyamart.backgroundlocation.model.** { <fields>; }

# Retrofit rules
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }
-keepattributes RuntimeVisibleAnnotations
-keepattributes RuntimeInvisibleAnnotations
-keepattributes RuntimeVisibleParameterAnnotations
-keepattributes RuntimeInvisibleParameterAnnotations

# OkHttp rules
-dontwarn okhttp3.**
-keep class okhttp3.** { *; }
-dontwarn okio.**

# Firebase rules
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# Google Play Services
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# Keep location services
-keep class com.google.android.gms.location.** { *; }

# Coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembernames class kotlinx.** {
    volatile <fields>;
}

# Keep generic signatures for Kotlin
-keepattributes Signature
