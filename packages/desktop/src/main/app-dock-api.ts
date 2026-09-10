import type { BrowserWindow } from "electron"
import type { AppDockEvent, AppDockState, AppDockTab, AppDockFindResult, DockBounds, ProfileStorage, AppDockDownload } from "./app-dock"

export interface AppDockAPI {
  open(senderID: number, win: BrowserWindow, address: string, bounds: DockBounds, notify: (event: AppDockEvent) => void, profileStorage: ProfileStorage, replacement?: Readonly<{ tabID: string; selected: boolean }>): Promise<AppDockTab>
  resize(senderID: number, bounds: DockBounds): void
  hide(senderID: number, win: BrowserWindow): void
  select(senderID: number, win: BrowserWindow, tabID: string, bounds: DockBounds): void
  navigate(senderID: number, tabID: string, address: string): Promise<void>
  execute(senderID: number, tabID: string, script: string): Promise<unknown>
  close(senderID: number, win: BrowserWindow, tabID?: string): void
  closeTabs(senderID: number, tabID: string, scope: "others" | "right", order?: string[]): void
  list(senderID: number): AppDockState[]
  deleteStorage(storageKey: string, win?: BrowserWindow): Promise<void>
  command(senderID: number, tabID: string, command: "back" | "forward" | "reload"): void
  find(senderID: number, tabID: string, text: string, forward: boolean, notify: (result: AppDockFindResult) => void): number
  stopFind(senderID: number, tabID: string): void
  zoom(senderID: number, tabID: string, factor?: number): number
  fullscreen(senderID: number, win: BrowserWindow, tabID: string, enabled: boolean): void
  cancelDownload(senderID: number, id: string): void
  openDownload(senderID: number, id: string): Promise<string>
  openDevTools(senderID: number, tabID: string): void
  recover(senderID: number, tabID: string): Promise<AppDockTab>
}