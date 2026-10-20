#include "SovelEqualizerDSP.h"
namespace sovel {
Parameters& parameters() { static Parameters state; return state; }
Runtime& runtime() { static Runtime state; return state; }
}
