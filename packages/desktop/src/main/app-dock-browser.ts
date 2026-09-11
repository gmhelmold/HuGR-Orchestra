const registryKey = "__opencodeDockRefs"

const registryExpr = `(() => {
  const key = ${JSON.stringify(registryKey)}
  if (window[key]) return window[key]
  const refs = new WeakMap()
  const byRef = new Map()
  const registry = {
    refs,
    byRef,
    next: 1,
    refFor(el) {
      const ref = refs.get(el)
      if (ref !== undefined) return ref
      const assigned = registry.next++
      refs.set(el, assigned)
      byRef.set(assigned, el)
      if (byRef.size > 4096) {
        const oldest = byRef.keys().next().value
        byRef.delete(oldest)
      }
      return assigned
    },
    resolve(ref) {
      const el = byRef.get(ref)
      if (!el || !el.isConnected) return null
      return el
    },
  }
  Object.defineProperty(window, key, { value: registry, configurable: false, enumerable: false })
  return registry
})()`

type SnapshotOptions = {
  budget?: number
  maxText?: number
}

export function buildSnapshotScript(options: SnapshotOptions = {}) {
  const budget = Math.max(1, Math.min(Math.round(options.budget ?? 100) || 100, 500))
  const maxText = Math.max(0, Math.min(Math.round(options.maxText ?? 1500) || 1500, 20000))
  return `(() => {
  const registry = ${registryExpr}
  const budget = ${budget}
  const maxText = ${maxText}
  const state = { url: location.href, title: document.title, viewport: { width: innerWidth, height: innerHeight }, items: [], text: "", truncated: false }
  const roleOf = (el) => {
    const explicit = el.getAttribute && el.getAttribute("role")
    if (explicit) return explicit
    const tag = el.tagName
    if (tag === "A") return el.hasAttribute("href") ? "link" : "text"
    if (tag === "BUTTON" || tag === "SUMMARY") return "button"
    if (tag === "SELECT") return "listbox"
    if (tag === "TEXTAREA") return "textbox"
    if (tag === "OPTION") return "option"
    if (tag === "INPUT") {
      switch ((el.type || "text").toLowerCase()) {
        case "checkbox": return "checkbox"
        case "radio": return "radio"
        case "range": return "slider"
        case "color": return "button"
        case "file": return "button"
        case "submit": case "reset": case "button": return "button"
        default: return "textbox"
      }
    }
    if (el.isContentEditable) return "textbox"
    if (el.hasAttribute && (el.hasAttribute("onclick") || el.hasAttribute("tabindex") || el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby"))) return "button"
    return null
  }
  const take = (value) => {
    if (!value) return ""
    const s = String(value).replace(/\\s+/g, " ").trim()
    return s.slice(0, 160)
  }
  const nameOf = (el) => {
    if (el.labels && el.labels.length) {
      const fromLabel = take(el.labels[0].innerText)
      if (fromLabel) return fromLabel
    }
    if (el.getAttribute) {
      const labelled = el.getAttribute("aria-labelledby")
      if (labelled) {
        const owner = document.getElementById(labelled.split(/\\s+/)[0])
        if (owner) { const fromOwner = take(owner.innerText); if (fromOwner) return fromOwner }
      }
      const direct = ["aria-label", "alt", "title", "value", "placeholder"].map((key) => take(el.getAttribute(key))).find(Boolean)
      if (direct) return direct
    }
    if (el.innerText) { const fromText = take(el.innerText); if (fromText) return fromText }
    if (el.textContent) { const fromContent = take(el.textContent); if (fromContent) return fromContent }
    return el.tagName ? el.tagName.toLowerCase() : "unknown"
  }
  const visible = (el) => {
    if (!el.getClientRects || el.getClientRects().length === 0) return false
    const style = getComputedStyle(el)
    if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) === 0) return false
    return true
  }
  const inert = (el) => {
    let node = el
    while (node && node !== document) {
      if (node.getAttribute && (node.getAttribute("aria-hidden") === "true" || node.getAttribute("hidden") !== null)) return true
      if (node.tagName === "FIELDSET" && node.disabled) return true
      node = node.parentElement
    }
    return false
  }
  const stateOf = (el) => {
    const out = {}
    if (el.disabled !== undefined) out.disabled = el.disabled
    if (el.checked !== undefined) out.checked = el.checked
    if (el.selected !== undefined) out.selected = el.selected
    if (el.getAttribute && el.getAttribute("aria-expanded")) out.expanded = el.getAttribute("aria-expanded") === "true"
    if (el.getAttribute && el.getAttribute("aria-selected")) out.selected = el.getAttribute("aria-selected") === "true"
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") out.value = (el.value || "").slice(0, 200)
    if (el.tagName === "SELECT") out.value = (el.options[el.selectedIndex]?.text || "").slice(0, 160)
    return out
  }
  const selector = "a[href], button, input, textarea, select, option, summary, [contenteditable], [role], [onclick], [tabindex], [aria-label], [aria-labelledby]"
  function getAllElements(root, sel) {
    const found = Array.from(root.querySelectorAll(sel))
    for (const el of Array.from(root.querySelectorAll("*"))) {
      if (el.shadowRoot) found.push(...getAllElements(el.shadowRoot, sel))
    }
    return found
  }
  const elements = getAllElements(document, selector)
  const collapsed = (el, accepted) => accepted.some((prior) => prior.contains(el))
  const accepted = []
  for (const el of elements) {
    if (accepted.length >= budget) break
    if (inert(el) || !visible(el)) continue
    if (collapsed(el, accepted)) continue
    accepted.push(el)
  }
  state.truncated = elements.some((el) => !accepted.includes(el))
  state.items = accepted.map((el) => ({
    ref: registry.refFor(el),
    role: roleOf(el),
    name: nameOf(el),
    tag: el.tagName.toLowerCase(),
    ...stateOf(el),
  }))
  if (maxText > 0 && document.body && document.body.innerText) {
    state.text = document.body.innerText.replace(/\\s+/g, " ").trim().slice(0, maxText)
  }
  return state
})()`
}

export function buildClickScript(ref: number) {
  return `(async () => {
  const registry = ${registryExpr}
  const el = registry.resolve(${ref})
  if (!el) return { ok: false, error: "Element ref ${ref} is gone; re-read the page" }
  el.scrollIntoView({ block: "center", inline: "center" })
  const rect = el.getBoundingClientRect()
  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2
  const options = { bubbles: true, cancelable: true, view: window, detail: 1, button: 0, clientX: x, clientY: y, screenX: x, screenY: y }
  el.dispatchEvent(new PointerEvent("pointerdown", options))
  el.dispatchEvent(new MouseEvent("mousedown", options))
  el.focus()
  el.dispatchEvent(new PointerEvent("pointerup", options))
  el.dispatchEvent(new MouseEvent("mouseup", options))
  el.dispatchEvent(new MouseEvent("click", options))
  return { ok: true, tag: el.tagName.toLowerCase(), ref: ${ref} }
})()`
}

export function buildTypeScript(ref: number, text: string) {
  return `(async () => {
  const registry = ${registryExpr}
  const el = registry.resolve(${ref})
  if (!el) return { ok: false, error: "Element ref ${ref} is gone; re-read the page" }
  el.focus()
  const value = ${JSON.stringify(text)}
  if (el.isContentEditable) {
    el.textContent = value
    el.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
    return { ok: true, ref: ${ref} }
  }
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
    const setter = Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value").set
    setter.call(el, value)
    el.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
    return { ok: true, ref: ${ref}, value: el.value }
  }
  return { ok: false, error: "Element ref ${ref} is not editable" }
})()`
}

export function buildScrollScript(direction: "up" | "down" | "top" | "bottom", amount?: number) {
  const pixels = amount ?? (direction === "top" || direction === "bottom" ? 10000 : 300)
  const dir = direction === "up" ? -pixels : direction === "down" ? pixels : direction === "top" ? -10000 : 10000
  return `(window.scrollBy(0, ${dir}), undefined)`
}

export function buildHoverScript(ref: number) {
  return `(async () => {
  const registry = ${registryExpr}
  const el = registry.resolve(${ref})
  if (!el) return { ok: false, error: "Element ref ${ref} is gone" }
  el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
  return { ok: true }
})()`
}

export function buildDragScript(fromRef: number, toRef: number) {
  return `(async () => {
  const registry = ${registryExpr}
  const from = registry.resolve(${fromRef})
  const to = registry.resolve(${toRef})
  if (!from || !to) return { ok: false, error: "Element ref gone" }
  const rect1 = from.getBoundingClientRect()
  const rect2 = to.getBoundingClientRect()
  from.dispatchEvent(new DragEvent("dragstart", { bubbles: true, clientX: rect1.x, clientY: rect1.y }))
  to.dispatchEvent(new DragEvent("dragover", { bubbles: true, clientX: rect2.x, clientY: rect2.y }))
  to.dispatchEvent(new DragEvent("drop", { bubbles: true, clientX: rect2.x, clientY: rect2.y }))
  from.dispatchEvent(new DragEvent("dragend", { bubbles: true }))
  return { ok: true }
})()`
}

export function buildClickAtScript(x: number, y: number) {
  return `(async () => {
  const el = document.elementFromPoint(${x}, ${y})
  if (!el) return { ok: false, error: "No element at coordinates" }
  el.click()
  return { ok: true }
})()`
}

export function buildScrollToScript(x: number, y: number) {
  return `(window.scrollTo(${x}, ${y}), undefined)`
}