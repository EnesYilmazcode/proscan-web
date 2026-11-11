/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'true' or 'false'. Unset means: emulator in dev, production in a build. */
  readonly VITE_USE_EMULATOR?: string;
  readonly VITE_AUTH_EMULATOR_PORT?: string;
  readonly VITE_FIRESTORE_EMULATOR_PORT?: string;
  /** Comma-separated unpacked extension ids the connect page may hand off to. */
  readonly VITE_DEV_EXTENSION_IDS?: string;
}

declare const __PROSCAN_BUILD__: {
  sha: string;
  short: string;
  dirty: boolean;
  builtAt: string;
};

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
