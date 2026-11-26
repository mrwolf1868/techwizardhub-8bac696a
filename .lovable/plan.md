# GitHub Pages Deployment Readiness

## What will change

1. Synchronize the dependency lockfiles with `package.json` without changing the app’s declared packages or upgrading versions. The existing GitHub Actions workflow uses `npm ci`, and the current npm lockfile is missing declared dependencies.
2. Review and, if needed, tighten the GitHub Pages workflow so pushes to `main` reliably install dependencies, create the production `dist` output, and deploy it to Pages. Preserve the current automatic trigger and manual run option.
3. Verify the deployment path with a clean npm install and production build, and confirm the output and workflow settings are consistent.

## Technical details

- Keep the change limited to dependency lockfiles and GitHub Actions deployment configuration; do not alter application screens, design, or behavior.
- Preserve existing package versions, the custom-domain file, and the user-owned `wrangler.jsonc` exactly as they are.
- A successful local build confirms the artifact can be produced; the actual GitHub Pages run can only be confirmed after GitHub Actions runs on the repository.