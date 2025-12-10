# Contributing to Family Chores

Thank you for your interest in contributing to Family Chores! This guide will help you get started.

## Getting Started

1. **Fork the repository** (if contributing externally)
2. **Clone your fork** (or the main repo if you have access)
3. **Install dependencies**: `npm install`
4. **Run the development server**: `npm run dev`
5. **Run tests**: `npm test`

## Branch Naming

All work should be done in feature branches following this convention:

```
work/<short-task-name>
```

Examples:
- `work/typed-taskmodal`
- `work/timed-tasks-tests`
- `work/ui-visual-overhaul`
- `work/action-log-export`

## Development Workflow

1. **Pick a task** from the backlog in `README.md`
2. **Create a branch** using the naming convention above
3. **Make your changes** following the code style and patterns
4. **Write tests** for new functionality (if applicable)
5. **Run tests** to ensure everything passes
6. **Update documentation** if needed
7. **Create a Pull Request** against `master`

## Code Style

- **TypeScript**: Use strict typing, avoid `any` types
- **React**: Use functional components with hooks
- **Formatting**: Follow existing code style
- **Naming**: Use descriptive names, camelCase for variables/functions, PascalCase for components

## Commit Messages

Write clear, descriptive commit messages:

```
feat: Add export functionality to action log
fix: Resolve task deletion not working
test: Add tests for timed task reducer
docs: Update onboarding documentation
refactor: Clean up legacy migration code
```

## Pull Request Process

1. **Link to backlog items**: Reference the backlog item(s) you're implementing
2. **Describe changes**: Explain what you changed and why
3. **Dependencies**: Call out any dependencies on other tasks
4. **Testing**: Describe how you tested your changes
5. **Screenshots**: Include screenshots for UI changes

### PR Description Template

```markdown
## Description
Implements [Backlog Item #X: Task Name]

## Changes
- Added export functionality to ActionLogModal
- Updated tests for timed task reducer
- Fixed task deletion bug

## Testing
- [ ] All tests pass
- [ ] Manual testing completed
- [ ] Browser testing completed

## Dependencies
- Depends on: [Item #Y] (if applicable)
```

## Testing

- **Unit tests**: Write tests for reducer logic and utilities
- **Integration tests**: Test component interactions
- **Manual testing**: Test in browser, verify UI/UX
- **Run tests**: `npm test` before submitting PR

## File Structure

- `components/` - React components
- `types/` - TypeScript type definitions
- `utils/` - Utility functions
- `tests/` - Test files
- `docs/` - Documentation
- `styles/` - CSS styles

## Key Files

- **Global state**: `components/ChoresAppContext.tsx`
- **Task UI**: `components/TaskItem.tsx`, `components/modals/TaskModal.tsx`
- **Approver UI**: `components/modals/SettingsModal.tsx`, `components/modals/PinModal.tsx`
- **Timer UI**: `components/TimedCountdown.tsx`, `components/hooks/useTimer.tsx`
- **Utilities**: `utils/pinUtils.ts`, `utils/choreScheduling.ts`, `utils/taskAssignment.ts`

## Architecture Notes

- **State Management**: Uses `useReducer` with context (`ChoresAppContext`)
- **Persistence**: `localStorage` for client-side storage
- **Task System**: Unified `Task` type with optional properties (`timed?`, `recurring?`, `oneOff?`)
- **Template/Instance**: Tasks are templates, `TaskInstance` represents specific occurrences
- **Approvers**: Named approvers with salted/hashed PINs (no plaintext storage)

## Questions?

- Check the `README.md` for detailed backlog items and acceptance criteria
- Review existing code for patterns and conventions
- Open an issue for questions or discussions

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Follow the project's coding standards

Thank you for contributing! 🎉
