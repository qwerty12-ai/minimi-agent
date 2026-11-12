import Database from "better-sqlite3";
import { DATABASE_SCHEMA } from "./schema.js";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type SQLiteDatabase = Database.Database;

export function initializeDatabase(database: SQLiteDatabase): void {
    database.exec(DATABASE_SCHEMA);
}

export function openDatabase(databasePath: string): SQLiteDatabase {
    if (databasePath.trim().length === 0) {
        throw new Error("Database path must not be empty.")
    }
    if(databasePath !== ":memory:") {
        mkdirSync(dirname(databasePath), {recursive: true})
    }
    const database = new Database(databasePath);
    try {
        database.pragma("foreign_keys = ON");
        database.pragma("busy_timeout = 5000");

        if(databasePath !== ":memory:") {
            database.pragma("journal_mode = WAL");
        }

        initializeDatabase(database);

        return database;
    } catch (error) {
        database.close();
        throw error;
    }
}
