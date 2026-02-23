export const CHAT_MODEL = "deepseek/deepseek-chat-v3-0324";
export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSIONS = 384;

export const CHUNK_SIZE = 1000;
export const CHUNK_OVERLAP = 200;

export const SIMILARITY_THRESHOLD = 0.5;
export const MAX_CONTEXT_CHUNKS = 5;

export const SUPPORTED_FILE_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "text/plain": [".txt"],
  "text/markdown": [".md"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/csv": [".csv"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
};

export const ALL_EXTENSIONS = Object.values(SUPPORTED_FILE_TYPES).flat();

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
