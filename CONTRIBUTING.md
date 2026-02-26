# Contributing to Luthier

Thanks for contributing.

## Before You Start

- Read [README.md](./README.md) for setup and project structure.
- Check [context.md](./context.md) (Portuguese) for product rules and architecture.
- Check [debito.md](./debito.md) for known gaps and priorities.

## Development Workflow

1. Create a branch for your change.
2. Keep changes focused (one concern per PR when possible).
3. Run quality checks before opening a PR:
   ```bash
   ./scripts/check-quality.sh
   ```
4. If your change affects only one area, run the targeted script as well.

## Coding Expectations

- Preserve payload/schema compatibility unless the change explicitly includes migration work.
- Prefer explicit validation and clear failure messages.
- Avoid silent fallbacks when they hide runtime differences.
- Update docs when behavior or workflows change.

## Pull Requests

A good PR should include:
- what changed
- why it changed
- how it was validated (commands/tests)
- any known limitations or follow-up work

## Notes

- The product brand is **Luthier**.
- `orchestrator` is the internal technical name of the generated runtime binary.
