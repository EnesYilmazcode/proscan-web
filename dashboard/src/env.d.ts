/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'true' or 'false'. Unset means: emulator in dev, production in a build. */
  readonly VITE_USE_EMULATOR?: string;
  readonly VITE_AUTH_EMULATOR_PORT?: string;
  readonly VITE_FIRESTORE_EMULATOR_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
