import { requireOptionalNativeModule } from "expo";
import type { SmbTransport } from "../core/externalSources";
import { mergeDiscovery, type DiscoveryReply } from "../core/networkDiscovery";
const native = requireOptionalNativeModule<{
  nonce(): string;
  discover(): Promise<DiscoveryReply[]>;
  cancelDiscovery(): void;
  smbConnect: SmbTransport["connect"];
  smbList: SmbTransport["list"];
  smbRead(
    id: string,
    path: string,
    offset: number,
    length: number,
  ): Promise<string>;
  httpRead(
    url: string,
    headers: Record<string, string>,
    offset: number,
    length: number,
  ): Promise<string>;
  smbClose(id: string): Promise<void>;
}>("SovelNetwork");
export function networkModule() {
  if (!native) throw new Error("请更新原生安装包以使用局域网发现和 SMB");
  return native;
}
export async function discoverServers() {
  return mergeDiscovery(await networkModule().discover());
}
export const cancelDiscovery = () => native?.cancelDiscovery();
