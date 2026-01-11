#include <jni.h>
#include "AixOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::aix::initialize(vm);
}
