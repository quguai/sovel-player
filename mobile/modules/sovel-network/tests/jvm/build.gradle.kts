plugins { kotlin("jvm") version "2.2.21" }
repositories { mavenCentral() }
dependencies {
 implementation("com.hierynomus:smbj:0.13.0")
 implementation("org.nanohttpd:nanohttpd:2.3.1")
 testImplementation("junit:junit:4.13.2")
}
kotlin {
 compilerOptions.jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
 sourceSets.main { kotlin.srcDirs("../../android/src/main/java"); kotlin.exclude("**/SovelNetworkModule.kt") }
}
java { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
tasks.test { testLogging { events("passed","failed"); exceptionFormat=org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL } }
