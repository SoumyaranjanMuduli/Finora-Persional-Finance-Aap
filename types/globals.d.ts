// Ambient declarations for runtime globals attached via `window.X = ...`
// in plain JS (js/*.js). These aren't real modules, so TypeScript's
// checkJs pass has no declaration for them without this file.
// See scripts/typecheck.js, which includes this file in its tsconfig.

interface Window {
  MFP: any;
  MFP_CONFIG: any;
  mfpSupabase: any;
  MFPRateLimit: any;
  MFPNotifications: any;
  MFPSettings: any;
  supabase: any;
  Chart: any;
  toggleTheme: (() => void) | undefined;
}

declare const MFP: any;
declare const mfpSupabase: any;
declare const MFP_CONFIG: any;
