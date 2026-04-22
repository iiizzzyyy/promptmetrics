# Contributing to PromptMetrics

Thank you for your interest in contributing!

## Getting Started

1. Fork the repository.
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/promptmetrics.git
   cd promptmetrics
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a `.env` file (copy from `.env.example`).
5. Run tests:
   ```bash
   npm test
   ```

## Development Workflow

- Create a feature branch: `git checkout -b feature/my-feature`
- Make your changes.
- Ensure tests pass: `npm test`
- Ensure lint passes: `npm run lint`
- Ensure build succeeds: `npm run build`
- Commit and push.
- Open a pull request.

## Code Style

- TypeScript with strict mode enabled.
- Use `async/await` over raw promises.
- Write tests for new features.
- Keep functions small and focused.

## Testing

- Unit tests: `npm run test:unit`
- Integration tests: `npm run test:integration`
- E2E tests: `npm run test:e2e`
- All tests: `npm test`

## Pull Request Guidelines

- Describe what changed and why.
- Reference related issues.
- Keep changes focused — one concern per PR.
- Ensure CI passes before requesting review.

## Questions?

Open a discussion or issue on GitHub.
