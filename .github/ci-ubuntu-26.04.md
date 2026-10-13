# CI readiness for Ubuntu 26.04

Date: 2026-10-14

## Context

GitHub's `ubuntu-latest` label moves to Ubuntu 26.04 starting 19 Oct 2026 ([announcement](https://github.com/actions/runner-images/issues/14748)).

## Probe

Commit `b3ecc864444daca66bf92cfbff275d971ebbcbc5` set `runs-on: ubuntu-26.04` in `.github/workflows/ci.yml` for the single `test` job.

[Run](https://github.com/AlphaeusNg/CardFitSG/actions/runs/38445227653) · [Job](https://github.com/AlphaeusNg/CardFitSG/actions/runs/38445227653/job/115461740219)

- Runner image: `ubuntu-26.04`, version `20260927.149.1` (image release `ubuntu26/20260927.149`).
- Runner: `2.337.0`.
- Node: 24 via `actions/setup-node@v7`.

| Step | Result |
| --- | --- |
| Set up job | Success |
| actions/checkout@v7 | Success |
| actions/setup-node@v7 | Success |
| Workflow policy | Success |
| Recommendation engine tests | Success |
| Catalog freshness policy tests | Success |
| Catalog review deadline | Success |
| Static site integrity | Success |
| Category planner | Success |
| App startup and rendering | Success |
| JavaScript syntax | Success |
| Post setup-node | Success |
| Post checkout | Success |
| Complete job | Success |

## Revert and outcome

The probe was undone with plain `git revert`; revert commit: `645ed63a6762159a3a006ca8848188fc31f46a36`. `ci.yml` is identical to main and still uses `runs-on: ubuntu-latest`.

**Ready: no fix or pin needed.**

## Next steps

After 19 Oct, watch the first `ubuntu-latest` runs (scheduled daily and PRs) and confirm the Set up job log shows `ubuntu-26.04`. If anything regresses, pin `runs-on: ubuntu-24.04` with a dated comment and open an issue.

Note: `.github/` is not served by GitHub Pages (verified 404).
