# Background Location Library Consumer ProGuard Rules
# These rules are automatically applied to apps that use this library

# Keep public API classes
-keep public class com.griyamart.backgroundlocation.BackgroundLocationManager {
    public *;
}

-keep public class com.griyamart.backgroundlocation.config.** {
    *;
}

-keep public class com.griyamart.backgroundlocation.model.** {
    *;
}

# Keep listener interfaces
-keep interface com.griyamart.backgroundlocation.BackgroundLocationManager$* {
    *;
}
