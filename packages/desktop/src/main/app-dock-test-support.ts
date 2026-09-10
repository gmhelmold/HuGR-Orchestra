import type { BrowserWindow } from "electron"

let dockWindow: BrowserWindow | undefined

/**
 * Test-only seam for pinning the App Dock window.
 * Not used in production; only imported by test harnesses.
 */
export function registerAppDockWindow(win: BrowserWindow) {
  dockWindow = win
}

/**
 * Test-only resolver for the App Dock window.
 * Returns the pinned test window or falls back to the production
 * getLastFocusedWindow() behavior.
 */
export function dockWindowFor(getLastFocusedWindow: () => BrowserWindow | null): BrowserWindow | undefined {
  return dockWindow ?? getLastFocusedWindow() ?? undefined
}