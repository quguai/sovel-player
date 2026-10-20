import { requireOptionalNativeModule } from "expo";
import { playbackSupport } from "../core/types";
import type { DsdSettings } from "../core/dsd";

const native = requireOptionalNativeModule<{
  getSovelDsfSupport?: () => boolean;
  configureSovelDsf?: (pcmRate: number) => void;
}>("ExpoAudio");
export const supportsDsf = (() => {
  try {
    return (
      native?.getSovelDsfSupport?.() === true && !!native.configureSovelDsf
    );
  } catch {
    return false;
  }
})();
export const canPlay = playbackSupport(supportsDsf);
export function configureDsd(settings: DsdSettings) {
  if (!supportsDsf) throw new Error("当前安装包不支持 DSF 软件解码");
  native!.configureSovelDsf!(settings.pcmRate);
}
