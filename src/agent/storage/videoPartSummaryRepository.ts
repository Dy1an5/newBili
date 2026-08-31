import {
    openDatabaseAsync,
    type SQLiteDatabase,
} from 'expo-sqlite';

import type {
    VideoPartSummary,
    VideoPartSummaryTarget,
} from '../domain/videoSummary';
import { parseVideoPartSummary } from '../prompt/videoPartSummaryPrompt';

const DATABASE_NAME = 'newbili.db';
const TABLE_NAME = 'video_part_summaries';

type SummaryRow = {
    bvid: string;
    cid: string;
    video_title: string;
    part_title: string;
    part_number: number;
    duration_ms: number;
    provider_id: string;
    model_id: string;
    prompt_id: string;
    prompt_version: number;
    subtitle_name: string;
    source_hash: string;
    summary_json: string;
    created_at: number;
    updated_at: number;
};

export type StoredVideoPartSummary = {
    target: VideoPartSummaryTarget;
    summary: VideoPartSummary;
    providerId: string;
    modelId: string;
    promptId: string;
    promptVersion: number;
    subtitleName: string;
    sourceHash: string;
    createdAt: number;
    updatedAt: number;
};

export type SaveVideoPartSummaryInput = {
    target: VideoPartSummaryTarget;
    summary: VideoPartSummary;
    providerId: string;
    modelId: string;
    promptId: string;
    promptVersion: number;
    subtitleName: string;
    sourceHash: string;
};

export class VideoPartSummaryStorageError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'VideoPartSummaryStorageError';
    }
}

function getNativeErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
        return error.message.trim();
    }

    return '未知SQLite错误';
}

let databasePromise: Promise<SQLiteDatabase> | null = null;

async function initializeDatabase(): Promise<SQLiteDatabase> {
    try {
        const database = await openDatabaseAsync(DATABASE_NAME);

        await database.execAsync('PRAGMA journal_mode = WAL;');
        await database.execAsync(`
            CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
                bvid TEXT NOT NULL,
                cid TEXT NOT NULL,
                video_title TEXT NOT NULL,
                part_title TEXT NOT NULL,
                part_number INTEGER NOT NULL,
                duration_ms INTEGER NOT NULL,
                provider_id TEXT NOT NULL,
                model_id TEXT NOT NULL,
                prompt_id TEXT NOT NULL,
                prompt_version INTEGER NOT NULL,
                subtitle_name TEXT NOT NULL,
                source_hash TEXT NOT NULL,
                summary_json TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (bvid, cid)
            );
        `);

        return database;
    } catch (error) {
        throw new VideoPartSummaryStorageError(
            `初始化本地总结数据库失败:${getNativeErrorMessage(error)}`,
        );
    }
}

async function getDatabase(): Promise<SQLiteDatabase> {
    if (!databasePromise) {
        databasePromise = initializeDatabase().catch((error) => {
            databasePromise = null;
            throw error;
        });
    }

    return databasePromise;
}

function parseStoredSummary(row: SummaryRow): StoredVideoPartSummary {
    let rawSummary: unknown;

    try {
        rawSummary = JSON.parse(row.summary_json);
    } catch {
        throw new VideoPartSummaryStorageError('本地总结JSON无法解析');
    }

    const durationMs = Number.isInteger(row.duration_ms) && row.duration_ms >= 0
        ? row.duration_ms
        : 0;
    const summary = parseVideoPartSummary(rawSummary, durationMs);

    return {
        target: {
            identity: {
                bvid: row.bvid,
                cid: row.cid,
            },
            videoTitle: row.video_title,
            partTitle: row.part_title,
            partNumber: row.part_number,
            durationMs,
        },
        summary,
        providerId: row.provider_id,
        modelId: row.model_id,
        promptId: row.prompt_id,
        promptVersion: row.prompt_version,
        subtitleName: row.subtitle_name,
        sourceHash: row.source_hash,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export async function getStoredVideoPartSummary(
    target: VideoPartSummaryTarget,
): Promise<StoredVideoPartSummary | null> {
    let database: SQLiteDatabase;
    let row: SummaryRow | null;

    try {
        database = await getDatabase();
        row = await database.getFirstAsync<SummaryRow>(
            `SELECT * FROM ${TABLE_NAME} WHERE bvid = ? AND cid = ? LIMIT 1`,
            target.identity.bvid,
            target.identity.cid,
        );
    } catch (error) {
        if (error instanceof VideoPartSummaryStorageError) {
            throw error;
        }

        throw new VideoPartSummaryStorageError(
            `查询本地总结失败:${getNativeErrorMessage(error)}`,
        );
    }

    if (!row) {
        return null;
    }

    try {
        const storedSummary = parseStoredSummary(row);

        return {
            ...storedSummary,
            target: {
                ...storedSummary.target,
                videoTitle: target.videoTitle,
                authorName: target.authorName,
                partTitle: target.partTitle,
                partNumber: target.partNumber,
                durationMs: target.durationMs,
            },
        };
    } catch (error) {
        await database.runAsync(
            `DELETE FROM ${TABLE_NAME} WHERE bvid = ? AND cid = ?`,
            target.identity.bvid,
            target.identity.cid,
        );

        if (error instanceof VideoPartSummaryStorageError) {
            return null;
        }

        return null;
    }
}

export async function saveVideoPartSummary(
    input: SaveVideoPartSummaryInput,
): Promise<void> {
    try {
        const database = await getDatabase();
        const now = Date.now();

        await database.runAsync(
            `
            INSERT INTO ${TABLE_NAME} (
                bvid,
                cid,
                video_title,
                part_title,
                part_number,
                duration_ms,
                provider_id,
                model_id,
                prompt_id,
                prompt_version,
                subtitle_name,
                source_hash,
                summary_json,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(bvid, cid) DO UPDATE SET
                video_title = excluded.video_title,
                part_title = excluded.part_title,
                part_number = excluded.part_number,
                duration_ms = excluded.duration_ms,
                provider_id = excluded.provider_id,
                model_id = excluded.model_id,
                prompt_id = excluded.prompt_id,
                prompt_version = excluded.prompt_version,
                subtitle_name = excluded.subtitle_name,
                source_hash = excluded.source_hash,
                summary_json = excluded.summary_json,
                updated_at = excluded.updated_at
            `,
            input.target.identity.bvid,
            input.target.identity.cid,
            input.target.videoTitle,
            input.target.partTitle,
            input.target.partNumber,
            input.target.durationMs,
            input.providerId,
            input.modelId,
            input.promptId,
            input.promptVersion,
            input.subtitleName,
            input.sourceHash,
            JSON.stringify(input.summary),
            now,
            now,
        );
    } catch (error) {
        if (error instanceof VideoPartSummaryStorageError) {
            throw error;
        }

        throw new VideoPartSummaryStorageError(
            `保存本地总结失败:${getNativeErrorMessage(error)}`,
        );
    }
}
