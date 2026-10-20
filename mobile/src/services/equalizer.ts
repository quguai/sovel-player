import { requireOptionalNativeModule } from "expo";
import type { EqualizerSettings } from "../core/equalizer";
export type EqStatus = {
  available: boolean;
  supported: boolean;
  processing: boolean;
  frames: number;
  sampleRate: number;
  channels: number;
  format: number;
  activeBands: number;
  effectivePreamp: number;
  clipped: number;
};
type EqModule = {
  configureSovelEqualizer?: (
    enabled: boolean,
    gains: number[],
    preamp: number,
    headroom: boolean,
  ) => void;
  getSovelEqualizerStatus?: () => EqStatus;
};
const native = requireOptionalNativeModule<EqModule>("ExpoAudio");
export const unavailableEq: EqStatus = {
  available: false,
  supported: false,
  processing: false,
  frames: 0,
  sampleRate: 0,
  channels: 0,
  format: 0,
  activeBands: 0,
  effectivePreamp: 0,
  clipped: 0,
};
export function readEqStatus(): EqStatus {
  try {
    return { ...unavailableEq, ...native?.getSovelEqualizerStatus?.() };
  } catch {
    return unavailableEq;
  }
}
export function configureEqualizer(settings: EqualizerSettings) {
  if (!native?.configureSovelEqualizer || !readEqStatus().available)
    throw new Error("当前安装包尚未包含均衡器模块，请安装新版应用");
  native.configureSovelEqualizer(
    settings.enabled,
    settings.gains,
    settings.preamp,
    settings.headroom,
  );
}
