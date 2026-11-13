# Skills

Reusable, self-checking agent playbooks shipped with AI Pulse. Each skill is a
self-contained directory with a `SKILL.md` entry point, references, scripts and
examples. Scripts are zero-dependency Node.js 20+ ESM.

## Value and Boundaries: one-sentence-project

**Value**

- Turns a one-sentence request ("track X public information and publish a public
  site") into a deployable static project, not just a document to read.
- Ships executable guardrails: `scaffold.mjs` generates a working, valid skeleton
  in one command; `check-project.mjs --self` / `--skeleton` verifies the package
  and generated projects and is CI-ready.
- Encodes a method proven on the AI Pulse project (v1.0.0 shipped): contract-first
  data model, POC gate before UI, dual-mode data sources with snapshot fallback,
  static-first GitHub Pages hosting, BYOK assistant with offline fallback, daily
  GitHub Actions refresh, evidence-based acceptance report.
- Portable to any continuously tracked public-information domain: AI models,
  open-source ecosystems, papers, policy, competitors, release feeds.

**Boundaries**

- Not a general web framework: no backend, accounts, database, SSR or payments.
- Not real-time: freshness is bounded by the scheduled refresh (daily-ish).
- Requires Node.js 20+, a GitHub repository, and public/legally usable sources.
- AI assistant is BYOK and needs a CORS-enabled endpoint; offline fallback only.
- Aesthetics and curated content still need human review; a multi-agent team is
  an optional enhancement - a single agent can follow the same phases.
- The scaffold is a starting point (empty seed data, minimal pages); release
  gates are passed by real work, not by generating files.

### 中文摘要（供根 README 的「Skill：一句话交付」章节直接采用）

> **价值**：把用户一句话需求（"持续追踪某领域公开信息并发布公网站点"）沉淀为可复用 Agent Skill，产出可实际运行的项目骨架与 CI 校验脚本；方法论已在 AI Pulse 真实项目（v1.0.0 已上线）跑通——合约先行、POC 门禁、双模式数据源 + 快照降级、纯静态 GitHub Pages、BYOK 助手 + 离线降级、Actions 每日刷新、证据化验收报告；可迁移到任意"持续追踪公开信息"领域（大模型 / 开源生态 / 论文 / 政策 / 竞品）。
>
> **边界**：不是通用 Web 框架；无后端 / 账号 / 数据库 / 实时高频；依赖 Node.js 20+、GitHub 与公开合规数据源；AI 助手需用户自备 key 且 endpoint 支持 CORS；审美与内容仍需人工复核；多智能体团队为可选增强，单 Agent 也可循同一流程；脚手架只是起点（空数据 + 最小页面），质量门需真实工作通过。

## Index

| Skill | Use it when | Entry point |
| --- | --- | --- |
| `one-sentence-project` | The user gives a one-sentence brief for a public site tracking information that changes over time (updates, rankings, resources, projects) with auto-refresh and a publish target. | [SKILL.md](one-sentence-project/SKILL.md) |

Planned direction: split future playbooks by reusable concern (data-source
probing, static-site quality gates) only when they are useful outside this one
method; do not create a skill per file.

## Repository Skills Index (v1.2)

Since v1.2 the repository also publishes a public **skill index** outside this
package: [`data/skills.json`](../data/skills.json) feeds the
[`Skills` page](../site/skills.html), which lists `one-sentence-project` as the
`mine` entry alongside verified official and community Agent Skills. New entries
are submitted through the
[GitHub Issue form](../.github/ISSUE_TEMPLATE/skill-submission.yml) or a pull
request; the data rules, review criteria and bilingual copy live in
[docs/SKILLS.md](../docs/SKILLS.md) and
[DATA-CONTRACT §6.1](../docs/DATA-CONTRACT.md).

Scope split: this directory hosts the **skill package itself** (`SKILL.md`,
`references/`, `scripts/`, `examples/`). The site index is curated metadata only
(`data/skills.json`, `schemaVersion: 1`) and is validated by
`node scripts/validate.mjs`; third-party skills are indexed, never hosted.

## Install

This repository ships the skill in two places:

- `skills/one-sentence-project/` — the publishable package (documented by
  `docs/SKILLS.md` and indexed by `data/skills.json`); this is the source of truth.
- `.workbuddy/skills/one-sentence-project/` — a project-level copy so WorkBuddy
  loads the playbook automatically when this workspace is open. Keep both in sync
  when editing `SKILL.md`, `references/`, `scripts/` or `examples/`.

1. Copy the `one-sentence-project/` directory into your agent's skills directory.
   The directory name must equal the frontmatter `name` value
   (`one-sentence-project`), otherwise the agent will not load it.
   For WorkBuddy, the project-level target is `.workbuddy/skills/`.
2. No dependencies: `node --version` must be >= 20 (scripts use ESM and built-in
   modules only).
3. If your agent does not support a skills directory, point it at
   `one-sentence-project/SKILL.md` directly and follow the workflow.

The package stays runnable from inside this repository without copying anything:

```bash
node skills/one-sentence-project/scripts/check-project.mjs --self
node skills/one-sentence-project/scripts/scaffold.mjs _tmp/skill-demo --name demo --domain "LLM tracking" --force
node skills/one-sentence-project/scripts/check-project.mjs --skeleton _tmp/skill-demo
```

## Usage

Scaffold a project from a one-sentence brief:

```bash
node skills/one-sentence-project/scripts/scaffold.mjs <targetDir> \
  --name <repo-slug> --domain "<what the site tracks and for whom>"
```

Options: `--display-name` (human name), `--owner` (GitHub user/org),
`--force` (overwrite scaffold files in a non-empty directory), `--help`.
The generator is idempotent and only rewrites files it owns; exit codes are
`0` success, `1` write/render error, `2` usage error.

Check the package or a generated skeleton (both are CI-friendly, exit non-zero
on failure):

```bash
node skills/one-sentence-project/scripts/check-project.mjs --self
node skills/one-sentence-project/scripts/check-project.mjs --skeleton <targetDir>
```

What `--self` asserts: `SKILL.md` frontmatter parses and matches the directory
name; required files exist; references use only known scaffold placeholders and
are English-only; the design token template contains an extractable CSS block;
both scripts print usage and are English-only; the examples cover five domains;
README sections and relative links are valid; the mapping table points at files
that exist in this repository (skipped gracefully when the package is used
standalone, outside this repo).

What `--skeleton` asserts: all required files exist; no unresolved template
placeholders; `package.json` is zero-dependency with Node.js 20+; the six data
contract files parse with `schemaVersion: 1` and the expected shapes; docs are
filled and not stubs; the site links its theme tokens and fetches `/data/`;
both workflows are wired; `.gitignore` covers generated artifacts; the generated
scripts pass `node --check`; and the generated validator exits 0 on the seed
data. When child processes are unavailable in the environment, the execution
checks report `SKIP` instead of failing.

Then follow the generated project's `AGENTS.md` and `docs/ACCEPTANCE.md`:
Intake -> Contract -> Split (optional) -> POC gate -> MVP -> Release -> Report.

## Maintenance

- **The source of truth stays in the repository docs.** The reference templates
  are distilled from the documents listed in the mapping table below. When a
  root document changes materially, update the matching reference template in
  the same change; otherwise the scaffold slowly drifts from the method.
- **Keep generated content regenerable.** Do not hand-edit generated project
  docs in a way that cannot be reproduced from `references/`; either update the
  template or record the deviation.
- **Run the checks before committing** (or add them to CI):
  `check-project.mjs --self`, then the scaffold smoke test above. Both are fast
  and dependency-free.
- **Keep scripts English-only and dependency-free.** The self-check enforces
  English scripts and known placeholders; adding an npm dependency would break
  the zero-dependency promise and the CI step.
- **Version the skill with the method.** The current package is `1.0.0`,
  distilled from AI Pulse v1.1. If a future project teaches a reusable lesson,
  add it to the relevant reference and bump this version note; do not fork a
  second skill for the same method. The site-level skill index
  (`data/skills.json`, v1.2) is curated separately - see
  [docs/SKILLS.md](../docs/SKILLS.md) before adding or editing entries.
- **Content language.** Skill documentation, code comments and repository-facing
  docs are English. `examples/prompts.md` is intentionally bilingual (the prompts
  are meant to be pasted verbatim); the Chinese summary above is a ready-to-merge
  snippet for the Chinese root README.

## Mapping: References to Source Repository

Each skill artifact is distilled from a real document in this repository, so the
method can be audited against what actually shipped:

| Skill artifact | Source of truth in this repository |
| --- | --- |
| [SKILL.md](one-sentence-project/SKILL.md) workflow, gates, value and boundaries | [docs/V1.1-CONTRACT.md](../docs/V1.1-CONTRACT.md) section 5, [docs/SPEC.md](../docs/SPEC.md) sections 8-10, [docs/ACCEPTANCE.md](../docs/ACCEPTANCE.md) sections 0-3 |
| [references/requirements-template.md](one-sentence-project/references/requirements-template.md) | [docs/SPEC.md](../docs/SPEC.md) sections 1-4 and 9-11 |
| [references/data-contract-template.md](one-sentence-project/references/data-contract-template.md) | [docs/DATA-CONTRACT.md](../docs/DATA-CONTRACT.md) sections 0-9, generalized to domain-neutral layers |
| [references/acceptance-checklist.md](one-sentence-project/references/acceptance-checklist.md) | [docs/ACCEPTANCE.md](../docs/ACCEPTANCE.md), [docs/SPEC.md](../docs/SPEC.md) section 10, [docs/V1.1-CONTRACT.md](../docs/V1.1-CONTRACT.md) section 7 |
| [references/data-source-strategy.md](one-sentence-project/references/data-source-strategy.md) | [docs/POC-REPORT.md](../docs/POC-REPORT.md) sections 2, 3, 6, 9 and [docs/SPEC.md](../docs/SPEC.md) sections 2.2 and 3.7 |
| [references/design-tokens.md](one-sentence-project/references/design-tokens.md) | [docs/V1.1-CONTRACT.md](../docs/V1.1-CONTRACT.md) section 2, [docs/SPEC.md](../docs/SPEC.md) section 4.2, [site/assets/css/theme.css](../site/assets/css/theme.css) |
| [examples/prompts.md](one-sentence-project/examples/prompts.md) | [docs/SPEC.md](../docs/SPEC.md) section 1.1 and the project's POC/MVP history |
| [scripts/scaffold.mjs](one-sentence-project/scripts/scaffold.mjs), [scripts/check-project.mjs](one-sentence-project/scripts/check-project.mjs) | New automation written for this skill; mirrors the shape of [scripts/serve.mjs](../scripts/serve.mjs), [scripts/validate.mjs](../scripts/validate.mjs) and [.github/workflows/ci.yml](../.github/workflows/ci.yml) |

Additional repository context worth reading alongside the skill:
[docs/AI-SHARE.md](../docs/AI-SHARE.md) (assistant and sharing design),
[site/index.html](../site/index.html) (reference page structure),
[.github/workflows/deploy.yml](../.github/workflows/deploy.yml) (scheduled
refresh + Pages deployment), and the root [README.md](../README.md) (what the
reference implementation actually ships).

## CI Integration

Add the skill checks after the Node setup step in the repository CI:

```yaml
- name: Skill self-check
  run: node skills/one-sentence-project/scripts/check-project.mjs --self

- name: Skill scaffold smoke test
  run: |
    node skills/one-sentence-project/scripts/scaffold.mjs _tmp/skill-demo --name demo --domain "LLM tracking" --force
    node skills/one-sentence-project/scripts/check-project.mjs --skeleton _tmp/skill-demo
```

`_tmp/` is already git-ignored. The two steps are deterministic, offline and
complete in about a second.

## License

MIT, matching the repository. The skill package may be copied into other
repositories; keep the attribution link to this repository in `SKILL.md`.
