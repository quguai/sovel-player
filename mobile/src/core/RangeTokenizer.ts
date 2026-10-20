import {
  AbstractTokenizer,
  EndOfStreamError,
  type IReadChunkOptions,
} from "strtok3/core";
export interface RandomReader {
  size: number;
  read(position: number, length: number): Promise<Uint8Array>;
  close(): void;
}
// Read only requested ranges: DSF tags can be at the end of multi-gigabyte files.
export class RangeTokenizer extends AbstractTokenizer {
  fileInfo: { size: number; path: string };
  constructor(
    private reader: RandomReader,
    path: string,
  ) {
    super({ maxBufferSize: 16 * 1024 * 1024 });
    this.fileInfo = { size: reader.size, path };
  }
  supportsRandomAccess() {
    return true;
  }
  setPosition(position: number) {
    this.validateLength(position, "position");
    this.position = position;
  }
  async peekBuffer(buffer: Uint8Array, options?: IReadChunkOptions) {
    const o = this.normalizeOptions(buffer, options);
    this.validateBufferSize(o.length);
    const count = Math.max(
      0,
      Math.min(o.length, this.fileInfo.size - o.position),
    );
    if (!o.mayBeLess && count < o.length) throw new EndOfStreamError();
    const bytes = await this.reader.read(o.position, count);
    if (!o.mayBeLess && bytes.length < count) throw new EndOfStreamError();
    buffer.set(bytes);
    return bytes.length;
  }
  async readBuffer(buffer: Uint8Array, options?: IReadChunkOptions) {
    const position = options?.position ?? this.position;
    const count = await this.peekBuffer(buffer, options);
    this.position = position + count;
    return count;
  }
  async close() {
    this.reader.close();
    await super.close();
  }
}
