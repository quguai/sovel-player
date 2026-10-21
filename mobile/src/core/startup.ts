/** A timed-out attempt must never publish late results into a newer startup. */
export class StartupAttempt {
  active = true;
  private cancelWait?: () => void;

  cancel() {
    this.active = false;
    this.cancelWait?.();
  }

  async step<T>(task: () => Promise<T>, timeoutMs = 30000): Promise<T> {
    if (!this.active) throw new Error("启动已取消");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cancelled = new Promise<never>((_, reject) => {
      this.cancelWait = () => reject(new Error("启动已取消"));
      timer = setTimeout(() => {
        reject(
          new Error("此步骤耗时过长，请检查存储设备后重试。原有曲库会保留。"),
        );
      }, timeoutMs);
    });
    try {
      const result = await Promise.race([
        Promise.resolve().then(() => {
          if (!this.active) throw new Error("启动已取消");
          return task();
        }),
        cancelled,
      ]);
      if (!this.active) throw new Error("启动已取消");
      return result;
    } finally {
      clearTimeout(timer);
      this.cancelWait = undefined;
    }
  }
}
