package expo.modules.sovelaccess

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Coroutine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext

class SovelAccessModule : Module() {
  private val readers = Semaphore(4)
  override fun definition() = ModuleDefinition {
    Name("SovelAccess")
    AsyncFunction("listDirectory") Coroutine { uri: String ->
      readers.withPermit {
        withContext(Dispatchers.IO) {
          val context = appContext.reactContext ?: error("应用已关闭")
          SovelDirectoryReader.list(context.contentResolver, uri)
        }
      }
    }
  }
}
