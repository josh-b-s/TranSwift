/** The part of SQLiteDatabase that query modules depend on, so they don't import the concrete class. */
export interface QueryableDb {
    getAllAsync<T>(sql: string, params?: any[]): Promise<T[]>;

    execAsync(sql: string): Promise<void>;

    runAsync(sql: string, params?: any[]): Promise<{ lastInsertRowId: number; changes: number }>;
}
