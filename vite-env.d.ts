/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_CHAT_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
