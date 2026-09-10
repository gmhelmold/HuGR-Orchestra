import { mkdir, mkdtemp, rm, writeFile, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AppDockProfileRegistry } from "./app-dock-profile-registry"

type Case = { id: string; status: "pass"; detail: string }
const required = [
  "P01", "P02", "P03", "P04", "P05", "P06", "P07", "P08", "P09", "P10",
  "P11", "P12", "P13", "P14", "P15", "P16", "P17", "P18", "P19", "P20",
]
const cases: Case[] = []

const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}
const pass = (id: string, detail: string) => cases.push({ id, status: "pass", detail })

async function freshDir() {
  return mkdtemp(join(tmpdir(), "app-dock-profile-test-"))
}

async function run() {
  try {
    // P01: Registry loads empty when no files exist
    const ud1 = await freshDir()
    const reg1 = AppDockProfileRegistry.load(ud1)
    check(reg1.manifest().profiles.length === 0, "empty registry should have no profiles")
    pass("P01", "empty registry loads with zero profiles")

    // P02: ensureActive creates profile with UUID storageKey
    const ud2 = await freshDir()
    const reg2 = AppDockProfileRegistry.load(ud2)
    const storage1 = reg2.ensureActive("profile-a")
    check(typeof storage1.storageKey === "string" && storage1.storageKey.length > 0, "storageKey missing")
    check(reg2.manifest().profiles.length === 1, "profile not added to manifest")
    pass("P02", "ensureActive creates profile with UUID storageKey")

    // P03: ensureActive on existing profile returns same storageKey
    const storage1b = reg2.ensureActive("profile-a")
    check(storage1b.storageKey === storage1.storageKey, "storageKey changed on re-ensure")
    pass("P03", "ensureActive returns same storageKey for existing profile")

    // P04: markDeleting transitions active->deleting
    const ud4 = await freshDir()
    const reg4 = AppDockProfileRegistry.load(ud4)
    const storage4 = reg4.ensureActive("profile-a")
    const delStorage = reg4.markDeleting("profile-a")
    check(delStorage.storageKey === storage4.storageKey, "markDeleting returns wrong storageKey")
    check(reg4.manifest().profiles.length === 1, "manifest profile count changed on delete")
    pass("P04", "markDeleting transitions active to deleting")

    // P05: markDeleted transitions deleting->deleted and removes from manifest
    const ud5 = await freshDir()
    const reg5 = AppDockProfileRegistry.load(ud5)
    reg5.ensureActive("profile-a")
    reg5.markDeleting("profile-a")
    reg5.markDeleted("profile-a")
    check(reg5.manifest().profiles.length === 0, "profile not removed from manifest")
    pass("P05", "markDeleted removes profile from manifest")

    // P06: Profile ID validation rejects invalid IDs
    const ud6 = await freshDir()
    const reg6 = AppDockProfileRegistry.load(ud6)
    try {
      reg6.ensureActive("INVALID_ID")
      throw new Error("should have thrown")
    } catch (e) {
      check(String(e).includes("Invalid App Dock profile ID"), "wrong error for invalid ID")
    }
    pass("P06", "Profile ID validation rejects invalid IDs")

    // P07: Profile limit enforced (32 profiles)
    const ud7 = await freshDir()
    const reg7 = AppDockProfileRegistry.load(ud7)
    for (let i = 0; i < 32; i++) {
      reg7.ensureActive(`profile-${i}`)
    }
    try {
      reg7.ensureActive("profile-33")
      throw new Error("should have thrown")
    } catch (e) {
      check(String(e).includes("profile limit reached"), "wrong error for limit")
    }
    pass("P07", "Profile limit (32) enforced on ensureActive")

    // P08: markDeleting on deleted profile throws
    const ud8 = await freshDir()
    const reg8 = AppDockProfileRegistry.load(ud8)
    reg8.ensureActive("p1")
    reg8.markDeleting("p1")
    reg8.markDeleted("p1")
    try {
      reg8.markDeleting("p1")
      throw new Error("should have thrown")
    } catch (e) {
      check(String(e).includes("not active"), "wrong error for markDeleting deleted")
    }
    pass("P08", "markDeleting on deleted profile throws")

    // P09: markDeleted on non-deleting throws
    const ud9 = await freshDir()
    const reg9 = AppDockProfileRegistry.load(ud9)
    reg9.ensureActive("p2")
    try {
      reg9.markDeleted("p2")
      throw new Error("should have thrown")
    } catch (e) {
      check(String(e).includes("not deleting"), "wrong error for markDeleted non-deleting")
    }
    pass("P09", "markDeleted on non-deleting profile throws")

    // P10: replaceManifest with correct revision succeeds
    const ud10 = await freshDir()
    const reg10 = AppDockProfileRegistry.load(ud10)
    reg10.ensureActive("p3")
    const manifest10 = reg10.manifest()
    // replaceManifest expects manifest with same revision as expectedRevision;
    // revision is incremented internally after validation
    const result = reg10.replaceManifest(manifest10.revision, manifest10)
    check(result.status === "updated", "replaceManifest should succeed with correct revision")
    check(reg10.manifest().revision === manifest10.revision + 1, "revision should be incremented")
    pass("P10", "replaceManifest with correct revision succeeds")

    // P11: replaceManifest with stale revision returns conflict
    const ud11 = await freshDir()
    const reg11 = AppDockProfileRegistry.load(ud11)
    reg11.ensureActive("p4")
    const manifest11 = reg11.manifest()
    // First bump revision with a valid replaceManifest
    reg11.replaceManifest(manifest11.revision, manifest11)
    const manifest11b = reg11.manifest()
    const staleRevision = manifest11b.revision - 1
    const staleManifest = { ...manifest11b, revision: staleRevision }
    const conflictResult = reg11.replaceManifest(staleRevision, staleManifest)
    check(conflictResult.status === "conflict", "replaceManifest should conflict on stale revision")
    pass("P11", "replaceManifest with stale revision returns conflict")

    // P12: replaceManifest validates profile set matches active profiles
    const ud12 = await freshDir()
    const reg12 = AppDockProfileRegistry.load(ud12)
    reg12.ensureActive("p5")
    const manifest12 = reg12.manifest()
    const badManifest = { ...manifest12, profiles: [{ id: "other", name: "other" }], revision: manifest12.revision + 1 }
    try {
      reg12.replaceManifest(manifest12.revision, badManifest)
      throw new Error("should have thrown")
    } catch (e) {
      check(String(e).includes("Invalid App Dock manifest"), "wrong error for mismatched profiles")
    }
    pass("P12", "replaceManifest rejects manifest with mismatched active profiles")

    // P13: ensureActive adds profile to manifest with default name
    const ud13 = await freshDir()
    const reg13 = AppDockProfileRegistry.load(ud13)
    reg13.ensureActive("new-profile")
    const manifest13 = reg13.manifest()
    const newProfile = manifest13.profiles.find(p => p.id === "new-profile")
    check(newProfile && newProfile.name === "new-profile", "default name not set correctly")
    pass("P13", "ensureActive sets default name equal to ID")

    // P14: maxTabs limit enforced in manifest validation
    const ud14 = await freshDir()
    const reg14 = AppDockProfileRegistry.load(ud14)
    reg14.ensureActive("tab-profile")
    const manifest14 = reg14.manifest()
    const tooManyTabs = { ...manifest14, tabs: { "tab-profile": new Array(51).fill({ url: "https://example.com", pinned: false }) }, revision: manifest14.revision + 1 }
    try {
      reg14.replaceManifest(manifest14.revision, tooManyTabs)
      throw new Error("should have thrown")
    } catch (e) {
      check(String(e).includes("Invalid App Dock manifest"), "wrong error for too many tabs")
    }
    pass("P14", "maxTabs (50) limit enforced in manifest")

    // P15: maxBookmarks limit enforced
    const ud15 = await freshDir()
    const reg15 = AppDockProfileRegistry.load(ud15)
    reg15.ensureActive("bm-profile")
    const manifest15 = reg15.manifest()
    const tooManyBookmarks = { ...manifest15, bookmarks: new Array(201).fill("https://example.com"), revision: manifest15.revision + 1 }
    try {
      reg15.replaceManifest(manifest15.revision, tooManyBookmarks)
      throw new Error("should have thrown")
    } catch (e) {
      check(String(e).includes("Invalid App Dock manifest"), "wrong error for too many bookmarks")
    }
    pass("P15", "maxBookmarks (200) limit enforced")

    // P16: maxHistory limit enforced
    const ud16 = await freshDir()
    const reg16 = AppDockProfileRegistry.load(ud16)
    reg16.ensureActive("hist-profile")
    const manifest16 = reg16.manifest()
    const tooMuchHistory = { ...manifest16, history: new Array(1001).fill("https://example.com"), revision: manifest16.revision + 1 }
    try {
      reg16.replaceManifest(manifest16.revision, tooMuchHistory)
      throw new Error("should have thrown")
    } catch (e) {
      check(String(e).includes("Invalid App Dock manifest"), "wrong error for too much history")
    }
    pass("P16", "maxHistory (1000) limit enforced")

    // P17: maxURLLength enforced
    const ud17 = await freshDir()
    const reg17 = AppDockProfileRegistry.load(ud17)
    reg17.ensureActive("url-profile")
    const manifest17 = reg17.manifest()
    const longUrl = "https://example.com/" + "x".repeat(2049)
    const longUrlManifest = { ...manifest17, bookmarks: [longUrl], revision: manifest17.revision + 1 }
    try {
      reg17.replaceManifest(manifest17.revision, longUrlManifest)
      throw new Error("should have thrown")
    } catch (e) {
      check(String(e).includes("Invalid App Dock manifest"), "wrong error for too long URL")
    }
    pass("P17", "maxURLLength (2048) enforced")

    // P18: maxNameLength enforced
    const ud18 = await freshDir()
    const reg18 = AppDockProfileRegistry.load(ud18)
    reg18.ensureActive("name-profile")
    const manifest18 = reg18.manifest()
    const longNameManifest = { ...manifest18, profiles: [{ id: "name-profile", name: "x".repeat(129) }], revision: manifest18.revision + 1 }
    try {
      reg18.replaceManifest(manifest18.revision, longNameManifest)
      throw new Error("should have thrown")
    } catch (e) {
      check(String(e).includes("Invalid App Dock manifest"), "wrong error for too long name")
    }
    pass("P18", "maxNameLength (128) enforced")

    // P19: corrupt registry file fails closed
    const ud19 = await freshDir()
    const reg19 = AppDockProfileRegistry.load(ud19)
    const registryPath = join(ud19, "app-dock-profile-registry.json")
    await writeFile(registryPath, "{corrupt")
    try {
      AppDockProfileRegistry.load(ud19)
      throw new Error("should have thrown")
    } catch (e) {
      check(String(e).includes("Invalid App Dock profile registry"), "wrong error for corrupt registry")
    }
    pass("P19", "corrupt registry fails closed")

    // P20: corrupt manifest file falls back to registry-derived manifest
    const ud20 = await freshDir()
    console.log("P20 ud20:", ud20)
    try {
      const reg20 = AppDockProfileRegistry.load(ud20)
      console.log("P20 load succeeded")
      reg20.ensureActive("p1")
      const manifestPath = join(ud20, "app-dock-manifest.json")
      await writeFile(manifestPath, "{corrupt")
      const reg20b = AppDockProfileRegistry.load(ud20)
      check(reg20b.manifest().profiles.length > 0, "fallback manifest should have profiles")
      pass("P20", "corrupt manifest falls back to registry-derived manifest")
    } catch (e) {
      console.error("P20 error:", e.message, e.stack)
      throw e
    }

  } finally {
    // cleanup is handled by OS temp dir cleanup
  }

  const report = { version: 1, cases }
  console.log(JSON.stringify(report, null, 2))
}

run().catch((error) => {
  console.error(JSON.stringify({ phase: "profile-registry-test-failure", error: String(error), stack: error instanceof Error ? error.stack : undefined }))
  process.exit(1)
})