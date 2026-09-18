# Runtime audit — canonical Own namespace

Audited product: `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`.
Active issue: [#85](https://github.com/gmhelmold/HuGR-Orchestra/issues/85).

## Question

Does the host prove that a requested static `own_*` skill came from the canonical Own artifact path, or does it trust the generic skill name?

## Source trace

`packages/opencode/src/skill/index.ts` discovers multiple generic skill sources. `add()` warns on duplicate names but still assigns `state.skills[name]`; `loadSkills()` loads matches concurrently. `Skill.require()` returns the resulting name entry.

`packages/opencode/src/tool/skill.ts` serves that entry through the normal SkillTool. It performs no Own-specific canonical-path, receipt, coverage or freshness check.

The proposed Static Own protocol instead defines canonical ownership artifacts under `.opencode/skills/own/<base64url(unit)>/SKILL.md` and says missing, stale, ambiguous or held ownership must HOLD rather than fall back to generic retrieval.

## Executed evidence

Two independent runs used the original Skill service and fresh temporary Git fixtures. In both runs:
- a canonical-only `own_c3Jj` loads from `.opencode/skills/own/c3Jj/SKILL.md`;
- an impostor-only `.claude/skills/own-shadow/SKILL.md` declaring `name: own_c3Jj` is accepted under that ownership name;
- a canonical + external duplicate does not return HOLD; one entry wins.

A second probe crossed the ToolRegistry boundary. With **only** the external impostor present, the real SkillTool returned:
`Loaded skill: own_c3Jj`
and delivered `EXTERNAL IMPOSTOR`.

See [results](evidence/results.txt) and the two runnable probes in [probes](probes/).

## Double-check and counterevidence

The collision run selected the canonical artifact twice. Therefore this audit does **not** claim the external file always wins a collision. The stronger and sufficient observation is that:
1. the namespace is not authenticated;
2. an external skill can occupy an `own_*` identity when canonical Own is missing;
3. duplicate ownership identity is warning/selection, not structured ambiguity/HOLD.

Original `test/tool/skill.test.ts` passed 2/2 in the same clone. A broader skill suite hit unrelated timeout behavior and is not cited as clean baseline.

## Boundary

Static Own is still a proposed Maestro context protocol, and public governed approval presentation remains blocked. This is not a demonstrated unauthorized governed Task. It is a prerequisite identity defect for treating Own as authority.

It is independent from #36 (stale canonical Own consumption), #29 (coverage authority), and #83 (literal transformation after verification).
