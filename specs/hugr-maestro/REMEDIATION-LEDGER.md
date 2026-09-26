# Atlas/Own Remediation Ledger

Snapshot: 2026-09-25. Parent: [#107](https://github.com/gmhelmold/HuGR-Orchestra/issues/107). Product baseline cited by child bodies: `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7` unless a child body names another evidence commit.

## Reading Rules

- Child issue bodies are acceptance and evidence sources. Each row links its native issue; audit SHAs and limitations remain in that body.
- All 57 children were read on this snapshot. All were `OPEN`; GitHub declared no assignee for any row. `Unassigned` is therefore recorded, not inferred.
- No row claims closure, supersession, remediation, or applicability resolution. Release disposition describes what remains required before a release gate can claim the relevant contract.
- Dependency positions use the five groups declared by #107. Group order is the release dependency order; order inside each group preserves #107 declaration order. This is an inventory ordering, not a new issue contract.
- P1 means declared P1. For #21 and #27, priority comes from each body because title omits it. P2 likewise follows title/body declaration.

## Disposition Vocabulary

| Disposition | Meaning |
| --- | --- |
| Context blocker | Must be resolved or explicitly gated before trusted Atlas/Own context can be claimed. |
| Release gate | Must be resolved or explicitly classified before current-base integration gate #111. |
| Required prerequisite | Must be addressed before the dependent capability can claim its contract; no closure inferred. |
| Capability backlog | Open contract/capability work; not closure evidence for current delivery. |

## Ledger

| Pos. | Native child issue | Category | Priority | State | Owner | Release disposition | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-01 | [#15](https://github.com/gmhelmold/HuGR-Orchestra/issues/15) Unrelated upserts discard negation abstention ledger | Evidence, freshness, CAS, authority | P1 | Open | Unassigned | Context blocker | Native body; audit evidence commit `14e74743d02a97bc577e1dffb6cb04d213c57569`. |
| E-02 | [#16](https://github.com/gmhelmold/HuGR-Orchestra/issues/16) Facts dropped from query output earn delivery hits and become governing | Evidence, freshness, CAS, authority | P1 | Open | Unassigned | Context blocker | Native body; audited product SHA `b0c33d2f`. |
| E-03 | [#17](https://github.com/gmhelmold/HuGR-Orchestra/issues/17) Preserve per-claim grounding when advisory updates span revisions | Evidence, freshness, CAS, authority | P1 | Open | Unassigned | Context blocker | Native body; audited product SHA `b0c33d2f`. |
| E-04 | [#18](https://github.com/gmhelmold/HuGR-Orchestra/issues/18) Long-lived runtime certifies stale grounding with new HEAD watermark | Evidence, freshness, CAS, authority | P1 | Open | Unassigned | Context blocker | Native body; audited product SHA `b0c33d2f`. |
| E-05 | [#19](https://github.com/gmhelmold/HuGR-Orchestra/issues/19) Reject or repair corrupt existing CAS blobs before acknowledging emit | Evidence, freshness, CAS, authority | P1 | Open | Unassigned | Context blocker | Native body; audited product SHA `b0c33d2f`. |
| E-06 | [#20](https://github.com/gmhelmold/HuGR-Orchestra/issues/20) Draft advertises full ratification but drops required provenance | Evidence, freshness, CAS, authority | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| E-07 | [#21](https://github.com/gmhelmold/HuGR-Orchestra/issues/21) Successful re-grounding fails to persist newly verified evidence | Evidence, freshness, CAS, authority | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| E-08 | [#22](https://github.com/gmhelmold/HuGR-Orchestra/issues/22) Gotchas retain stored FRESH after grounded source changes | Evidence, freshness, CAS, authority | P1 | Open | Unassigned | Context blocker | Native body; audited product SHA `b0c33d2f`. |
| E-09 | [#27](https://github.com/gmhelmold/HuGR-Orchestra/issues/27) Bind negation admission and freshness to SCIP source snapshot | Evidence, freshness, CAS, authority | P1 | Open | Unassigned | Context blocker | Native body; audited product SHA `b0c33d2f`. |
| E-10 | [#32](https://github.com/gmhelmold/HuGR-Orchestra/issues/32) Memory emit acknowledges record unreadable after unterminated log tail | Evidence, freshness, CAS, authority | P1 | Open | Unassigned | Context blocker | Native body; audited product SHA `b0c33d2f`. |
| E-11 | [#35](https://github.com/gmhelmold/HuGR-Orchestra/issues/35) Failed materializer rollback can overwrite another writer's publication | Evidence, freshness, CAS, authority | P1 | Open | Unassigned | Context blocker | Native body; audited product SHA `b0c33d2f`. |
| E-12 | [#39](https://github.com/gmhelmold/HuGR-Orchestra/issues/39) Concurrent governed writers violate one-logbook-entry-per-PR invariant | Evidence, freshness, CAS, authority | P1 | Open | Unassigned | Context blocker | Native body; audited product SHA `b0c33d2f`. |
| E-13 | [#55](https://github.com/gmhelmold/HuGR-Orchestra/issues/55) Reconcile returns clean merge gate when cited source is deleted | Evidence, freshness, CAS, authority | P1 | Open | Unassigned | Context blocker | Native body; audited product SHA `b0c33d2f`. |
| E-14 | [#61](https://github.com/gmhelmold/HuGR-Orchestra/issues/61) Doctor CAS integrity reports sound with wrong-shard referenced blobs | Evidence, freshness, CAS, authority | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| E-15 | [#79](https://github.com/gmhelmold/HuGR-Orchestra/issues/79) GROUND-11 transitive interface freshness not wired into driftDetect | Evidence, freshness, CAS, authority | P1 | Open | Unassigned | Context blocker | Native body; audited product SHA `b0c33d2f`. |
| E-16 | [#82](https://github.com/gmhelmold/HuGR-Orchestra/issues/82) composeIndex.drift can certify changed code FRESH on dependency axis | Evidence, freshness, CAS, authority | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| O-01 | [#23](https://github.com/gmhelmold/HuGR-Orchestra/issues/23) Snapshot verifier and materializer accept dangling drill targets | Static Own correctness and consumption | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| O-02 | [#24](https://github.com/gmhelmold/HuGR-Orchestra/issues/24) Malformed predicate checks render undefined and pass static snapshot gate | Static Own correctness and consumption | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| O-03 | [#28](https://github.com/gmhelmold/HuGR-Orchestra/issues/28) Final ownership payload exceeds reported selection budget | Static Own correctness and consumption | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| O-04 | [#29](https://github.com/gmhelmold/HuGR-Orchestra/issues/29) Define and carry graph-coverage authority instead of literal COMPLETE | Static Own correctness and consumption | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| O-05 | [#31](https://github.com/gmhelmold/HuGR-Orchestra/issues/31) Symlinked materializer exits successfully without doing work | Static Own correctness and consumption | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| O-06 | [#36](https://github.com/gmhelmold/HuGR-Orchestra/issues/36) Host serves stale static Own artifacts despite freshness HOLD | Static Own correctness and consumption | P2 | Open | Unassigned | Context blocker | Native body; audited product SHA `b0c33d2f`. |
| O-07 | [#47](https://github.com/gmhelmold/HuGR-Orchestra/issues/47) OwnImpact omits resolved dependents while returning COMPLETE | Static Own correctness and consumption | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| O-08 | [#50](https://github.com/gmhelmold/HuGR-Orchestra/issues/50) Ownership briefing ignores anchor-to-scope policy and can name wrong owner | Static Own correctness and consumption | P2 | Open | Unassigned | Context blocker | Native body; audited product SHA `b0c33d2f`. |
| O-09 | [#51](https://github.com/gmhelmold/HuGR-Orchestra/issues/51) Preserve freshness and provenance projecting definition into Role | Static Own correctness and consumption | P2 | Open | Unassigned | Context blocker | Native body; audited product SHA `b0c33d2f`. |
| O-10 | [#83](https://github.com/gmhelmold/HuGR-Orchestra/issues/83) Slash-command expansion rewrites verified ownership literals | Static Own correctness and consumption | P2 | Open | Unassigned | Context blocker | Native body; audit evidence commit `a360219b7f3b8d317c6bf24712f6ac88103f27e1`. |
| O-11 | [#85](https://github.com/gmhelmold/HuGR-Orchestra/issues/85) Noncanonical external skills impersonate canonical own_* context | Static Own correctness and consumption | P2 | Open | Unassigned | Context blocker | Native body; audit evidence commit `fbdd9809f0cce1c54de28e8db80d77665114d52e`. |
| R-01 | [#26](https://github.com/gmhelmold/HuGR-Orchestra/issues/26) Check reports wouldEmit for deterministic closed-slot refusal | Runtime, persistence, and recovery | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| R-02 | [#30](https://github.com/gmhelmold/HuGR-Orchestra/issues/30) Reconcile contested=false with incumbent-conflict policy | Runtime, persistence, and recovery | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| R-03 | [#33](https://github.com/gmhelmold/HuGR-Orchestra/issues/33) Project-memory cap counts retries and archived versions | Runtime, persistence, and recovery | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| R-04 | [#34](https://github.com/gmhelmold/HuGR-Orchestra/issues/34) Governed memory emit persists rejected logbook sections | Runtime, persistence, and recovery | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| R-05 | [#37](https://github.com/gmhelmold/HuGR-Orchestra/issues/37) Orientation event identity cannot represent return to earlier state label | Runtime, persistence, and recovery | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| R-06 | [#40](https://github.com/gmhelmold/HuGR-Orchestra/issues/40) Public memory reads erase durable-log corruption diagnostics | Runtime, persistence, and recovery | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| R-07 | [#41](https://github.com/gmhelmold/HuGR-Orchestra/issues/41) Resume projection selects oldest retained task checkpoint | Runtime, persistence, and recovery | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| R-08 | [#45](https://github.com/gmhelmold/HuGR-Orchestra/issues/45) Dependency queries require knowledge fact on queried source | Runtime, persistence, and recovery | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| R-09 | [#46](https://github.com/gmhelmold/HuGR-Orchestra/issues/46) File dependency lookup drops escaped or sub-file anchors | Runtime, persistence, and recovery | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| R-10 | [#48](https://github.com/gmhelmold/HuGR-Orchestra/issues/48) Preserve dependency incompleteness metadata through context assembly | Runtime, persistence, and recovery | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| R-11 | [#56](https://github.com/gmhelmold/HuGR-Orchestra/issues/56) Awareness memo ignores changed secondary constitution anchors | Runtime, persistence, and recovery | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| R-12 | [#57](https://github.com/gmhelmold/HuGR-Orchestra/issues/57) accept-reground reports repairs without publishing repair | Runtime, persistence, and recovery | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| R-13 | [#58](https://github.com/gmhelmold/HuGR-Orchestra/issues/58) Injection ceiling double-subtracts repeated kinds | Runtime, persistence, and recovery | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| R-14 | [#59](https://github.com/gmhelmold/HuGR-Orchestra/issues/59) Doctor semantic-retirement plan rejected by governed write path | Runtime, persistence, and recovery | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| R-15 | [#60](https://github.com/gmhelmold/HuGR-Orchestra/issues/60) Reverify mixes captured fact rows with live dangling rows | Runtime, persistence, and recovery | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| R-16 | [#70](https://github.com/gmhelmold/HuGR-Orchestra/issues/70) RevIndex caches moving Git refs as immutable identities | Runtime, persistence, and recovery | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| R-17 | [#74](https://github.com/gmhelmold/HuGR-Orchestra/issues/74) Mutable aliases break CAS addresses and EventLog snapshots | Runtime, persistence, and recovery | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| R-18 | [#75](https://github.com/gmhelmold/HuGR-Orchestra/issues/75) Merge safety is not installed and Git fallback is not lossless JSONL union | Runtime, persistence, and recovery | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| R-19 | [#76](https://github.com/gmhelmold/HuGR-Orchestra/issues/76) parseJsonl and lineMerge violate totality on malformed or torn lines | Runtime, persistence, and recovery | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| R-20 | [#77](https://github.com/gmhelmold/HuGR-Orchestra/issues/77) TranscriptRef is process-local with no durable backend | Runtime, persistence, and recovery | P2 | Open | Unassigned | Capability backlog | Native body; audited product SHA `b0c33d2f`. |
| R-21 | [#78](https://github.com/gmhelmold/HuGR-Orchestra/issues/78) configurePushRefspec is in-memory only; Git never pushes notes | Runtime, persistence, and recovery | P2 | Open | Unassigned | Capability backlog | Native body; audited product SHA `b0c33d2f`. |
| G-01 | [#65](https://github.com/gmhelmold/HuGR-Orchestra/issues/65) Default mining workers ignore selected arm and misattribute provenance | Genesis, index, and evaluation | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| G-02 | [#66](https://github.com/gmhelmold/HuGR-Orchestra/issues/66) Proposer pool cannot observe worker death while blocked in Atomics.wait | Genesis, index, and evaluation | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| G-03 | [#67](https://github.com/gmhelmold/HuGR-Orchestra/issues/67) Mid-run staging failure erases completed progress and call accounting | Genesis, index, and evaluation | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| G-04 | [#68](https://github.com/gmhelmold/HuGR-Orchestra/issues/68) Git reverts collapse transition history into content cycle with no current head | Genesis, index, and evaluation | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| G-05 | [#69](https://github.com/gmhelmold/HuGR-Orchestra/issues/69) Same-name tests collapse identity and depend on suite order | Genesis, index, and evaluation | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| G-06 | [#71](https://github.com/gmhelmold/HuGR-Orchestra/issues/71) Test-vacuity CLI hides parser failures and incomplete-scan evidence | Genesis, index, and evaluation | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| G-07 | [#80](https://github.com/gmhelmold/HuGR-Orchestra/issues/80) GROUND-12 policy-artifact anchors are unimplemented | Genesis, index, and evaluation | P2 | Open | Unassigned | Capability backlog | Native body; audited product SHA `b0c33d2f`. |
| G-08 | [#81](https://github.com/gmhelmold/HuGR-Orchestra/issues/81) INDEX-12 dependency rState does not fold forward closure | Genesis, index, and evaluation | P2 | Open | Unassigned | Required prerequisite | Native body; audited product SHA `b0c33d2f`. |
| C-01 | [#94](https://github.com/gmhelmold/HuGR-Orchestra/issues/94) Reference-model ledger drift keeps host Atlas guard red | Current guard reconciliation | P2 | Open | Unassigned | Release gate | Native body; audit evidence names PR #89 and measured 39/142/4. |

## Coverage Check

| #107 declared group | Expected | Ledger rows |
| --- | ---: | ---: |
| Evidence, freshness, CAS, authority | 16 | 16 |
| Static Own correctness and consumption | 11 | 11 |
| Runtime, persistence, and recovery | 21 | 21 |
| Genesis, index, and evaluation | 8 | 8 |
| Current guard reconciliation | 1 | 1 |
| **Total** | **57** | **57** |

Unclassified children: none. Unassigned owners: 57. Open children: 57. Closed or superseded children: none observed; no closure inferred.

## Release Reading

This ledger satisfies #107's inventory shape only. It does not satisfy any child definition of done, close #107, make Atlas/Own evidence trusted, or authorize Maestro context injection. Roadmap ordering remains authoritative for the current-base gate: #107 ledger first, then the declared #112/#114/#109/#108/#106/#110/#113 dependencies, then #111.
