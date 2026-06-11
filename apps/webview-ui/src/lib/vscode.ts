import type { VsCodeApi } from './types';

/** Acquire VS Code API (available inside webview) or provide mock for dev mode */
function getVsCodeApi(): VsCodeApi {
  try {
    // @ts-ignore — acquireVsCodeApi is injected by VS Code webview runtime
    return acquireVsCodeApi();
  } catch {
    // Dev mode fallback (when running with `vite dev`)
    console.warn('[Hermes] Running in dev mode — VS Code API not available');
    return {
      postMessage: (msg: unknown) => console.log('[Hermes Mock] postMessage:', msg),
      getState: () => ({}),
      setState: (state: unknown) => console.log('[Hermes Mock] setState:', state),
    };
  }
}

export const vscode = getVsCodeApi();
