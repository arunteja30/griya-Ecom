pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "GriyaMart"
include(":app")
include(":deliveryapp")
include(":sellerapp")
include(":theypo")
include(":theypo-delivery")
include(":dootha-driver")
include(":dootha")
