# GitHub Actions Workflows

This directory contains automated workflows for FlowShader.

## Available Workflows

### 1. CI (`ci.yml`)
**Triggers:** Push to `main` or `develop`, Pull Requests

**Jobs:**
- **Test & Lint**
  - Runs ESLint to check code quality
  - Executes all 230 tests
  - Generates test coverage report
  - Uploads coverage to Codecov

- **Build**
  - Builds the production bundle
  - Uploads build artifacts (retained for 7 days)

### 2. Deploy (`deploy.yml`)
**Triggers:** Push to `main`, Manual workflow dispatch

**What it does:**
- Builds the application for production
- Deploys to GitHub Pages
- Makes FlowShader accessible at: `https://sulphux.github.io/FlowShader/`

**Setup Required:**
1. Go to repository Settings → Pages
2. Set Source to "GitHub Actions"
3. The workflow will automatically deploy on every push to main

### 3. Test PR (`test-pr.yml`)
**Triggers:** Pull request events (open, sync, reopen)

**What it does:**
- Runs linter and tests on PR changes
- Posts a comment with test results
- Provides quick feedback for contributors

## Running Workflows Manually

Some workflows support manual triggering:

1. Go to the "Actions" tab in GitHub
2. Select the workflow (e.g., "Deploy to GitHub Pages")
3. Click "Run workflow"
4. Select the branch and confirm

## Status Badges

Add these to README.md to show workflow status:

```markdown
![CI](https://github.com/sulphux/FlowShader/workflows/CI/badge.svg)
![Deploy](https://github.com/sulphux/FlowShader/workflows/Deploy%20to%20GitHub%20Pages/badge.svg)
```

## Local Testing

Before pushing, run these commands locally to catch issues:

```bash
npm run lint         # Check linting
npm test             # Run all tests
npm run build        # Verify build works
```

## Troubleshooting

### Build Fails
- Check that all dependencies are in `package.json`
- Verify TypeScript compilation with `npm run build` locally

### Tests Fail
- Run tests locally: `npm test`
- Check test output in the Actions tab

### Deployment Fails
- Ensure GitHub Pages is enabled in repository settings
- Check that the workflow has write permissions
- Verify the base path in `vite.config.ts` matches your repository name

## Notes

- All workflows use Node.js 18
- Dependencies are cached for faster builds
- Build artifacts are retained for 7 days
- Coverage reports are optional and won't fail the build
