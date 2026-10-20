import org.gradle.api.artifacts.transform.*
import org.gradle.api.attributes.Attribute
import org.gradle.api.attributes.AttributeCompatibilityRule
import org.gradle.api.attributes.CompatibilityCheckDetails
import org.gradle.api.attributes.LibraryElements
import org.gradle.api.file.FileSystemLocation
import org.gradle.api.provider.Provider
import java.util.zip.ZipFile

plugins { kotlin("jvm") version "2.2.21" }
repositories {
  mavenCentral()
  google { content { includeGroupByRegex("androidx\\..*") } }
}

// Media3 ships AARs. JVM tests use their actual classes with Robolectric, not mocks
// of the extractor APIs; the Android app still builds through its own Gradle tree.
abstract class AarClasses : TransformAction<TransformParameters.None> {
  @get:InputArtifact abstract val input: Provider<FileSystemLocation>
  override fun transform(outputs: TransformOutputs) {
    ZipFile(input.get().asFile).use { zip ->
      zip.getInputStream(zip.getEntry("classes.jar")).use { source ->
        outputs.file("classes.jar").outputStream().use { source.copyTo(it) }
      }
    }
  }
}
val artifactType = Attribute.of("artifactType", String::class.java)
abstract class AarCompatible : AttributeCompatibilityRule<LibraryElements> {
  override fun execute(details: CompatibilityCheckDetails<LibraryElements>) {
    if (details.producerValue?.name == "aar") details.compatible()
  }
}
dependencies {
  attributesSchema.attribute(LibraryElements.LIBRARY_ELEMENTS_ATTRIBUTE) {
    compatibilityRules.add(AarCompatible::class.java)
  }
  registerTransform(AarClasses::class) {
    from.attribute(artifactType, "aar")
    to.attribute(artifactType, "jar")
  }
  implementation("androidx.media3:media3-extractor:1.9.1")
  testImplementation("junit:junit:4.13.2")
  testImplementation("org.robolectric:robolectric:4.16.1")
  compileOnly("org.robolectric:android-all:15-robolectric-12650502")
  testRuntimeOnly("org.robolectric:android-all:15-robolectric-12650502")
}
configurations.all { attributes.attribute(artifactType, "jar") }
kotlin {
  compilerOptions.jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
  sourceSets.main { kotlin.srcDirs("../../android") }
}
java {
  sourceCompatibility = JavaVersion.VERSION_17
  targetCompatibility = JavaVersion.VERSION_17
}
tasks.test {
  maxHeapSize = "1g"
  systemProperty("java.library.path", layout.buildDirectory.dir("native").get().asFile.absolutePath)
  systemProperty("sovel.repo", rootDir.resolve("../../../../../").canonicalPath)
  systemProperty("maven.repo.local", layout.buildDirectory.dir("robolectric-repo").get().asFile.absolutePath)
  systemProperty("robolectric.dependency.repo.url", "https://repo.maven.apache.org/maven2")
  testLogging { events("passed", "failed"); exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL }
}
