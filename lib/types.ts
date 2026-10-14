export type ChatTurn = { role: "user" | "assistant"; content: string };
export type AnswerStyle = "brief" | "detailed" | "decision";
export type Chunk = {
  id: string;
  file: string;
  page: number | null;
  section: string;
  text: string;
  embedding: number[];
};
export type DocumentRecord = {
  name: string;
  hash: string;
  chunks: number;
  bytes: number;
  pages: number;
  indexedAt: string;
};
export type Index = {
  version: number;
  fingerprint: string;
  embeddingModel: string;
  updatedAt: string;
  documents: DocumentRecord[];
  chunks: Chunk[];
  investigation?: import("./investigation").InvestigationSnapshot;
};
export type Source = Omit<Chunk, "embedding"> & {
  citation: number;
  similarity: number;
  keyword: number;
  score: number;
};
export type Step = {
  name: string;
  status: "running" | "done";
  ms?: number;
  detail?: string;
};
export type RagEvent =
  | { type: "step"; step: Step }
  | {
      type: "sources";
      sources: Source[];
      confidence: "high" | "medium" | "low";
      query: string;
      model: string;
      evidenceMs?: number;
    }
  | { type: "token"; text: string }
  | { type: "replace"; text: string }
  | {
      type: "done";
      ms: number;
      grounded: boolean;
      cached?: boolean;
      firstTokenMs?: number;
      method?: "extractive" | "generated";
    }
  | { type: "error"; message: string };
export type IngestEvent =
  | {
      type: "progress";
      file: string;
      current: number;
      total: number;
      message: string;
    }
  | {
      type: "complete";
      documents: number;
      chunks: number;
      cached: number;
      warnings: string[];
      uploadedFiles?: string[];
    }
  | { type: "error"; message: string };
