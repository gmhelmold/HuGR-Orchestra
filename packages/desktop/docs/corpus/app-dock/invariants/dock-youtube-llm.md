# Invariant: `dock-youtube-llm` - Dock YouTube LLM Drive

> Clauses: 2 | Unwanted: 1 | Witnesses: app-dock-youtube.test.ts (opt-in: APP_DOCK_YOUTUBE=1, OPENCODE_AUTH_CONTENT, APP_DOCK_YOUTUBE_MODEL; skipped otherwise)

## Clauses
- dock session drives dock_open, dock_read and dock_click against YouTube results via live model call *(measured: app-dock-youtube.test.ts (opt-in: APP_DOCK_YOUTUBE=1, OPENCODE_AUTH_CONTENT, APP_DOCK_YOUTUBE_MODEL; skipped otherwise))*
- live model turn produces final text answering with a video title *(measured: app-dock-youtube.test.ts (opt-in: APP_DOCK_YOUTUBE=1, OPENCODE_AUTH_CONTENT, APP_DOCK_YOUTUBE_MODEL; skipped otherwise))*

## Unwanted
- dock session completes without invoking any dock_* tool *(measured: app-dock-youtube.test.ts (opt-in: APP_DOCK_YOUTUBE=1, OPENCODE_AUTH_CONTENT, APP_DOCK_YOUTUBE_MODEL; skipped otherwise))*

