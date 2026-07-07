/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_IMAGE_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
