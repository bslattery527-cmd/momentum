# Repository Workflow Notes

## Preferred GitHub Workflow

Use stacked diffs as the default workflow for changes that will be reviewed and landed on GitHub.

Rules:
- Keep each commit focused on one fix or change.
- For multi-part work, create a root branch from `master` and then create each follow-up branch on top of the previous branch.
- Use local branch names under `stack/` for product and feature work that belongs to a stack.
- Use `./scripts/stack-diff` to create, inspect, and repair stack metadata.
- Keep tooling-only or repo-wide changes that should not depend on an in-flight stack on their own branch from `master`.
