import type { VideoPartIdentity } from './videoIdentity';

export type VideoPartSummaryTarget = {
    identity: VideoPartIdentity;
    videoTitle: string;
    authorName?: string;
    partTitle: string;
    partNumber: number;
    durationMs: number;
};

export type SubtitleCue = {
    startMs: number;
    endMs: number;
    text: string;
};

export type TranscriptSource =
    | 'bilibili-human'
    | 'bilibili-ai';

export type VideoPartKnowledgeDocument = {
    identity: VideoPartIdentity;
    videoTitle: string;
    videoDescription?: string;
    authorName?: string;
    categoryName?: string;
    tags: readonly string[];
    partTitle: string;
    partNumber: number;
    durationMs: number;
    transcriptLanguage?: string;
    transcriptSource: TranscriptSource;
    cues: readonly SubtitleCue[];
    sourceHash: string;
};

export type VideoPartSummaryInput = {
    document: VideoPartKnowledgeDocument;
    additionalInstructions?: string;
};

export type SummaryEvidence = {
    startMs: number;
    endMs: number;
};

export type VideoSummaryKeyPoint = {
    text: string;
    evidence: readonly SummaryEvidence[];
};

export type VideoSummaryChapter = {
    startMs: number;
    endMs: number;
    title: string;
    summary: string;
};

export type VideoPartSummary = {
    schemaVersion: 1;
    overview: string;
    keyPoints: readonly VideoSummaryKeyPoint[];
    chapters: readonly VideoSummaryChapter[];
    limitations: readonly string[];
};
