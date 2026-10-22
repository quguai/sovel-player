export interface Database {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: any[]): Promise<unknown>;
  getAllAsync<T>(sql: string, ...params: any[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: any[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
  withExclusiveTransactionAsync?(
    task: (transaction: Database) => Promise<void>,
  ): Promise<void>;
}
/** Expo's ordinary async transaction also absorbs unrelated writes on its
 * connection. Scope import writes to an exclusive transaction when available,
 * so cancelling an import cannot roll back a concurrent favorite/checkpoint. */
export async function atomic(
  db: Database,
  task: (transaction: Database) => Promise<void>,
) {
  if (db.withExclusiveTransactionAsync)
    await db.withExclusiveTransactionAsync(task);
  else await db.withTransactionAsync(() => task(db));
}
