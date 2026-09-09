import { randomUUID } from "node:crypto"
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeSync } from "node:fs"
import { dirname, join } from "node:path"

import type { ProfileStorage } from "./app-dock"

type ProfileStatus = "active" | "deleting" | "deleted"
type Profile = Readonly<{ storageKey: string; status: ProfileStatus }>
type Registry = { version: 1; revision: number; profiles: Record<string, Profile> }

const profileID = (value: string) => {
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(value)) throw new Error("Invalid App Dock profile ID")
  return value
}

const registryError = () => new Error("Invalid App Dock profile registry")

const parseRegistry = (value: unknown): Registry => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw registryError()
  const registry = value as Record<string, unknown>
  if (
    Object.keys(registry).length !== 3 ||
    registry.version !== 1 ||
    !Number.isSafeInteger(registry.revision) ||
    (registry.revision as number) < 0 ||
    !registry.profiles ||
    typeof registry.profiles !== "object" ||
    Array.isArray(registry.profiles)
  ) {
    throw registryError()
  }
  const profiles = Object.fromEntries(
    Object.entries(registry.profiles as Record<string, unknown>).map(([id, value]) => {
      profileID(id)
      if (!value || typeof value !== "object" || Array.isArray(value)) throw registryError()
      const profile = value as Record<string, unknown>
      if (
        Object.keys(profile).length !== 2 ||
        typeof profile.storageKey !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(profile.storageKey) ||
        (profile.status !== "active" && profile.status !== "deleting" && profile.status !== "deleted")
      ) {
        throw registryError()
      }
      return [id, Object.freeze({ storageKey: profile.storageKey, status: profile.status })]
    }),
  )
  return { version: 1, revision: registry.revision as number, profiles }
}

export class AppDockProfileRegistry {
  #registry: Registry

  private constructor(
    private readonly path: string,
    registry: Registry,
  ) {
    this.#registry = registry
  }

  static load(userData: string) {
    const path = join(userData, "app-dock-profile-registry.json")
    try {
      return new AppDockProfileRegistry(path, parseRegistry(JSON.parse(readFileSync(path, "utf8"))))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return new AppDockProfileRegistry(path, { version: 1, revision: 0, profiles: {} })
      if (error instanceof Error && error.message === "Invalid App Dock profile ID") throw registryError()
      if (error instanceof Error && error.message === "Invalid App Dock profile registry") throw error
      throw registryError()
    }
  }

  ensureActive(id: string): ProfileStorage {
    const profile = this.#registry.profiles[profileID(id)]
    if (profile?.status === "active") return Object.freeze({ storageKey: profile.storageKey })
    if (profile) throw new Error("App Dock profile is not active")
    const storageKey = randomUUID()
    this.write({ ...this.#registry.profiles, [id]: Object.freeze({ storageKey, status: "active" }) })
    return Object.freeze({ storageKey })
  }

  markDeleting(id: string): ProfileStorage {
    const profile = this.#registry.profiles[profileID(id)]
    if (!profile) throw new Error("Unknown App Dock profile")
    if (profile.status === "deleted") throw new Error("App Dock profile is not active")
    if (profile.status === "active") this.write({ ...this.#registry.profiles, [id]: { ...profile, status: "deleting" } })
    return Object.freeze({ storageKey: profile.storageKey })
  }

  markDeleted(id: string) {
    const profile = this.#registry.profiles[profileID(id)]
    if (!profile || profile.status !== "deleting") throw new Error("App Dock profile is not deleting")
    this.write({ ...this.#registry.profiles, [id]: { ...profile, status: "deleted" } })
  }

  private write(profiles: Registry["profiles"]) {
    const registry = { version: 1 as const, revision: this.#registry.revision + 1, profiles }
    const directory = dirname(this.path)
    const temporary = `${this.path}.${randomUUID()}.tmp`
    mkdirSync(directory, { recursive: true, mode: 0o700 })
    let descriptor: number | undefined
    try {
      descriptor = openSync(temporary, "wx", 0o600)
      writeSync(descriptor, JSON.stringify(registry))
      fsyncSync(descriptor)
      closeSync(descriptor)
      descriptor = undefined
      renameSync(temporary, this.path)
    } catch (error) {
      if (descriptor !== undefined) closeSync(descriptor)
      try {
        unlinkSync(temporary)
      } catch {}
      throw error
    }
    this.#registry = registry
  }
}
