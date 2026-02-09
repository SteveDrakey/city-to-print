/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MIN_ZOOM_FOR_GENERATE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
