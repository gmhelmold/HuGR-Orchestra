import { Context, Effect, Layer, LayerMap } from "effect"
import { LayerNode } from "./effect/layer-node"
import { Node } from "./effect/app-node"
import { Location } from "./location"
import type {
  LocationError,
  LocationServices,
  ReferenceLocationError,
  ReferenceLocationServices,
} from "./location-services"

export class Service extends Context.Service<
  Service,
  LayerMap.LayerMap<Location.Ref, LocationServices, LocationError>
>()("@opencode/example/LocationServiceMap") {
  static get(ref: Location.Ref) {
    return Layer.unwrap(Effect.map(Service, (locations) => locations.get(ref)))
  }
}

export class ReferenceService extends Context.Service<
  ReferenceService,
  LayerMap.LayerMap<Location.Ref, ReferenceLocationServices, ReferenceLocationError>
>()("@opencode/example/ReferenceLocationServiceMap") {
  static get(ref: Location.Ref) {
    return Layer.unwrap(Effect.map(ReferenceService, (locations) => locations.get(ref)))
  }
}

export const node = LayerNode.unbound(Service, Node.tags.values.global)

export const referenceNode = LayerNode.unbound(ReferenceService, Node.tags.values.global)

export namespace ReferenceLocationServiceMap {
  export type Service = ReferenceService
  export const Service = ReferenceService
  export const node = referenceNode
}

export * as LocationServiceMap from "./location-service-map"
