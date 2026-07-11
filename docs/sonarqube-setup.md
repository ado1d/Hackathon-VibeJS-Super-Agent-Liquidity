# SonarCloud Setup

This document walks through wiring up [SonarCloud](https://sonarcloud.io) so every push and every pull request is analysed for bugs, vulnerabilities, code smells, duplications, and coverage.

The repo already contains everything SonarCloud needs:

- `sonar-project.properties` — project identity + coverage paths
- `.github/workflows/sonar.yml` — CI job that runs on every commit and PR
- `backend/pyproject.toml` — pytest emits `backend/coverage.xml`
- `frontend/vitest.config.ts` — vitest emits `frontend/coverage/lcov.info`

You only need to do the one-time account + secret setup below.

---

## Why SonarCloud (not self-hosted SonarQube)

| | SonarCloud | SonarQube self-hosted |
|---|---|---|
| Setup | 5 min, no infra | 1–2 hours (Docker + PostgreSQL + reverse proxy) |
| Public repo | Free forever | Free (Community Edition) but you host it |
| PR decoration | Native GitHub App | Needs ALM binding + PAT |
| Backups | None needed | DB + volumes |
| Recommended for this repo | ✅ | Only if you need on-prem |

If you really want self-hosted, see the **Self-hosted fallback** section at the bottom.

---

## One-time setup (5 minutes)

### Step 1 — Sign in to SonarCloud

1. Go to <https://sonarcloud.io>
2. Click **Log in with GitHub**
3. Authorise the SonarCloud GitHub App — grant access to your account and to the `ado1d/Hackathon-VibeJS-Super-Agent-Liquidity` repository specifically.

### Step 2 — Import the repository

1. In SonarCloud, click the **+** (top-right) → **Analyze new project**
2. Choose the GitHub organisation `ado1d`
3. Find `Hackathon-VibeJS-Super-Agent-Liquidity` in the list and tick it
4. Click **Set Up**
5. SonarCloud will detect the existing `sonar-project.properties` file. Confirm the suggested project key — it should be `ado1d_Hackathon-VibeJS-Super-Agent-Liquidity`.
6. Set the **Analysis method** to **GitHub Actions** (not the automatic analysis — you already have a workflow that gives SonarCloud coverage data, which the automatic mode does not).

If the project key SonarCloud suggests does not match the one in `sonar-project.properties`, update `sonar-project.properties` to match.

### Step 3 — Generate a SONAR_TOKEN

1. In SonarCloud, click your avatar (top-right) → **My Account** → **Security**
2. Under **Generate Tokens**, type `github-actions-sonar` in the name field
3. Choose type **Global Analysis Token** (or **Project Analysis Token** scoped to this repo if you prefer)
4. Click **Generate**
5. **Copy the token now** — you will not be able to see it again.

### Step 4 — Add the token to GitHub

1. Go to your repo on GitHub: <https://github.com/ado1d/Hackathon-VibeJS-Super-Agent-Liquidity>
2. **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
3. Name: `SONAR_TOKEN`
4. Secret: paste the token from step 3
5. Click **Add secret**

> `GITHUB_TOKEN` (used by the workflow to post PR comments) is provided automatically by GitHub Actions — you do not need to create it.

### Step 5 — Push a commit

```bash
git add sonar-project.properties .github/workflows/sonar.yml \
        backend/pyproject.toml frontend/vitest.config.ts \
        frontend/package.json docs/sonarqube-setup.md
git commit -m "ci: add SonarCloud analysis on every commit and PR"
git push
```

Watch the **Actions** tab — the **SonarCloud** workflow will run, then the analysis will appear at <https://sonarcloud.io/dashboard?id=ado1d_Hackathon-VibeJS-Super-Agent-Liquidity>.

---

## What gets analysed on every commit

| Metric | Source | Where it shows up |
|---|---|---|
| Bugs | SonarCloud's static rules for Python + TypeScript | Dashboard, PR comment |
| Vulnerabilities | Static rules (e.g. hardcoded secrets, weak crypto) | Dashboard, PR comment |
| Code smells | Maintainability rules (complexity, naming, duplication) | Dashboard |
| Coverage | `backend/coverage.xml` + `frontend/coverage/lcov.info` | Dashboard, PR comment |
| Duplications | SonarCloud's CPD algorithm | Dashboard |
| Quality Gate | Pass/fail composite of the above | PR check (blocks merge if red) |

---

## How PR decoration works

When you open a pull request, the SonarCloud workflow:

1. Runs analysis on the PR branch.
2. Computes "new code" issues (only files changed in the PR).
3. Posts inline comments on the PR for each new issue.
4. Adds a status check (`SonarCloud Code Analysis`) that shows the Quality Gate status.
5. Updates the PR comment with the overall summary.

To make the Quality Gate a required check before merging:

1. GitHub repo → **Settings** → **Branches** → **Branch protection rules**
2. Edit the `main` rule (or create one)
3. Under **Require status checks to pass before merging**, add `SonarCloud Code Analysis`
4. Save.

---

## Quality Gate tuning

SonarCloud ships a default **Sonar way** Quality Gate:

- Coverage on new code < 80% → fail
- Duplications on new code > 3% → fail
- Any new blocker / critical issue → fail

For a hackathon repo, the defaults are fine. To customise:

1. SonarCloud → your project → **Quality Gate** (top menu)
2. **Copy & Edit** the Sonar way gate
3. Adjust thresholds (e.g. relax coverage to 70% for new code)
4. **Activate** your custom gate for the project

---

## Local dry-run (optional)

You can run the same analysis locally before pushing:

```bash
# Install the SonarScanner (one-time)
brew install sonar-scanner          # macOS
# or Linux: download from https://docs.sonarcloud.io/advanced-setup/ci-based-analysis/sonarscanner-cli/

# Generate coverage
cd backend && python -m pytest --cov=app --cov-report=xml && cd ..
cd frontend && npm ci && npm test -- --run --coverage && cd ..

# Run the scan (uses sonar-project.properties in repo root)
sonar-scanner \
  -Dsonar.login=$SONAR_TOKEN \
  -Dsonar.host.url=https://sonarcloud.io
```

This is useful when you want to verify the project properties are correct without waiting for CI.

---

## Troubleshooting

### "No coverage report found"

Check that `backend/coverage.xml` and `frontend/coverage/lcov.info` are actually created by the CI step *before* the `SonarCloud scan` step. The workflow runs them in order. If lint or tests fail, coverage is not produced and SonarCloud runs without coverage — that's the expected behaviour.

### "Project key mismatch"

If SonarCloud suggests a different project key than what's in `sonar-project.properties`, either rename the project in SonarCloud or update `sonar-project.properties`. They must match exactly.

### " Organisation not found"

Make sure `sonar.organization` in `sonar-project.properties` matches the organisation key shown in SonarCloud (top-right under your avatar → **My Organizations**). For personal accounts it's usually your GitHub username lowercase.

### PR comments not appearing

The workflow needs `pull-requests: write` permission (GitHub Actions grants this by default for `GITHUB_TOKEN`). If you have a restrictive permissions block in another workflow file, add this to `sonar.yml`:

```yaml
permissions:
  contents: read
  pull-requests: write
```

### Quality Gate check times out

The `sonarqube-quality-gate-action` waits up to 5 minutes for SonarCloud to compute the gate. On busy days this can exceed. Bump `timeout-minutes: 10` in the workflow.

---

## Self-hosted SonarQube fallback

If you need to run SonarQube on your own infrastructure (e.g. for a private mirror of the repo):

### 1. Run SonarQube Community Edition

```bash
# docker-compose.sonar.yml
version: "3"
services:
  sonarqube:
    image: sonarqube:community
    depends_on:
      - db
    environment:
      SONAR_JDBC_URL: jdbc:postgresql://db:5432/sonar
      SONAR_JDBC_USERNAME: sonar
      SONAR_JDBC_PASSWORD: sonar
    ports:
      - "9000:9000"
    volumes:
      - sonarqube_data:/opt/sonarqube/data
      - sonarqube_extensions:/opt/sonarqube/extensions
      - sonarqube_logs:/opt/sonarqube/logs
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: sonar
      POSTGRES_PASSWORD: sonar
      POSTGRES_DB: sonar
    volumes:
      - postgresql:/var/lib/postgresql
      - postgresql_data:/var/lib/postgresql/data

volumes:
  sonarqube_data:
  sonarqube_extensions:
  sonarqube_logs:
  postgresql:
  postgresql_data:
```

```bash
docker compose -f docker-compose.sonar.yml up -d
# Wait ~2 min for first boot, then open http://localhost:9000
# Default login: admin / admin — change on first login
```

### 2. Create a project token

In SonarQube UI: **My Account** → **Security** → generate a token. Add it as a GitHub repo secret called `SONAR_TOKEN`.

### 3. Update `sonar-project.properties`

Replace the SonarCloud-specific lines:

```properties
# Remove these (SonarCloud-only):
# sonar.organization=ado1d
# sonar.links.homepage=...

# Add this for self-hosted:
sonar.host.url=http://localhost:9000
```

### 4. Use the right GitHub Action

Replace the `SonarSource/sonarcloud-scan-action` step in `.github/workflows/sonar.yml` with:

```yaml
- name: SonarQube scan
  uses: SonarSource/sonarqube-scan-action@v2.2.0
  env:
    SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
    SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
```

Add a second repo secret `SONAR_HOST_URL` with your server's URL.

### 5. PR decoration

Self-hosted SonarQube needs the [GitHub ALM binding](https://docs.sonarsource.com/sonarqube/latest/alm-integration/github-alm-integration/) configured in **Administration** → **ALM Integrations** → **GitHub**, plus a PAT with `repo` scope stored as a secret in SonarQube (not GitHub).

---

## Cost

For this repo (public, ~5k LOC): **SonarCloud is free forever**. The 5-minute setup above is all you need.

If you ever go private: SonarCloud's paid plan starts at $9/month for 250k LOC — well under this repo's size.
