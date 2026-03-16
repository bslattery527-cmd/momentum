# Stacked Diff Workflow

This repo ships a small local CLI for creating and inspecting stacked diff branches.

## Commands

Run everything from the repo root:

```bash
./scripts/stack-diff list
./scripts/stack-diff show
./scripts/stack-diff root ui-bugs master
./scripts/stack-diff next edit-profile
./scripts/stack-diff track stack/edit-profile --parent stack/ui-bugs
```

What each command does:

- `list`: shows every local `stack/*` branch grouped by stack, with the commit subject and how many commits it is ahead of its parent.
- `show [branch]`: shows just the stack that contains the current branch, or the branch you pass in.
- `root <name> [base]`: creates `stack/<name>` from `base` and records the base branch in local git config.
- `next <name> [parent]`: creates `stack/<name>` on top of `parent` or the current branch and records the parent branch in local git config.
- `track <branch> (--parent <branch> | --base <branch>)`: repairs stack metadata if ancestry inference is wrong after a rebase or manual branch surgery.

## Output

Example:

```text
Stack from master
  stack/app-dev-scripts (+1 vs master) chore(app): use native run scripts and ignore ios output
  └─ stack/edit-profile (+1 vs stack/app-dev-scripts) fix(app): wire edit profile flow
```

The current branch is marked with `*` when the terminal supports color.

## Notes

- Only local branches under `stack/` are considered part of a stack.
- Parent and base metadata are stored in local git config under `branch.<name>.stackParent` and `branch.<name>.stackBase`.
- If metadata is missing, the CLI falls back to git ancestry to infer the nearest stack parent.
