# rpa-ai-guidance-hub-ui

[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_rpa-ai-guidance-hub-ui&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=DEFRA_rpa-ai-guidance-hub-ui)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_rpa-ai-guidance-hub-ui&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DEFRA_rpa-ai-guidance-hub-ui)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_rpa-ai-guidance-hub-ui&metric=coverage)](https://sonarcloud.io/summary/new_code?id=DEFRA_rpa-ai-guidance-hub-ui)

Frontend service for the RPA Guidance Hub, built on the Core Delivery Platform.

- [Requirements](#requirements)
  - [Node.js](#nodejs)
- [Quick Start](#quick-start)
  - [Local Development](#local-development-quick-start)
  - [Production Setup with Entra ID](#production-setup-with-entra-id)
- [Authentication](#authentication)
  - [Entra ID (default)](#entra-id-default)
  - [Local Development](#local-development-auth)
- [Environment Variables Reference](#environment-variables-reference)
- [Server-side Caching](#server-side-caching)
- [Redis](#redis)
- [Local Development](#local-development)
  - [Setup](#setup)
  - [Development](#development)
  - [Production](#production)
  - [Npm scripts](#npm-scripts)
  - [Update dependencies](#update-dependencies)
  - [Formatting](#formatting)
    - [Windows prettier issue](#windows-prettier-issue)
- [Docker](#docker)
  - [Development image](#development-image)
  - [Production image](#production-image)
  - [Docker Compose](#docker-compose)
  - [Dependabot](#dependabot)
  - [SonarCloud](#sonarcloud)
- [Licence](#licence)
  - [About the licence](#about-the-licence)

## Requirements

### Node.js

This project requires Node.js >=24.

Please install Node Version Manager [nvm](https://github.com/creationix/nvm)

To use the correct version of Node.js for this application, via nvm:

```bash
cd rpa-ai-guidance-hub-ui
nvm use
```

## Quick Start

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. Create .env file for local development
cp .env.example .env

# 3. (Optional) Edit .env to use local auth if needed
# Set: AUTH_PROVIDER=local

# 4. Start the dev server
npm run dev
```

The application will be running on `http://localhost:3000`.

### Production Setup with Entra ID

```bash
# 1. Install dependencies
npm install

# 2. Create .env file
cp .env.example .env

# 3. Configure Entra ID in .env
# Set these required values:
# - ENTRA_TENANT_ID=your-tenant-guid
# - ENTRA_CLIENT_ID=your-client-id
# - ENTRA_CLIENT_SECRET=your-client-secret
# - ENTRA_REDIRECT_HOST=https://your-production-domain.gov.uk
# - AUTH_PROVIDER=entra

# 4. Start in production mode
npm start
```

For detailed configuration information, see [Authentication](#authentication) and [Environment Variables Reference](#environment-variables-reference).

## Authentication

The application supports two authentication providers controlled by the `AUTH_PROVIDER` environment variable:

### Entra ID (default)

**Entra ID** (Microsoft Azure AD) is the default authentication provider and is used for production environments.

Users authenticate through an OpenID Connect (OIDC) flow with Microsoft Entra ID. After initial authentication, sessions are maintained using secure HTTP-only cookies to avoid repeated authentication prompts.

#### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AUTH_PROVIDER` | No | `entra` | Set to `entra` to enable Entra ID authentication |
| `ENTRA_TENANT_ID` | Yes* | - | The GUID of your Azure tenant that issues tokens (e.g., `00000000-0000-0000-0000-000000000000`) |
| `ENTRA_CLIENT_ID` | Yes* | - | The application (client) ID of your app registration in Entra ID |
| `ENTRA_CLIENT_SECRET` | Yes* | - | The client secret generated for your app registration |
| `ENTRA_AUTHORITY_HOST` | No | `https://login.microsoftonline.com` | The Entra authority host used to build authorization endpoints |
| `ENTRA_REDIRECT_HOST` | Yes* | - | The redirect URI for the OIDC flow (e.g., `http://localhost:3000` for development, `https://your-domain.gov.uk` for production) |

**\* Required when using Entra ID in production mode. No errors will be thrown if these variables are missing in local development / test environments, but authentication will fail.**

### Local Development

**Local** authentication is available for development purposes only and should never be used in production.

To use local authentication for development, set:

```bash
AUTH_PROVIDER=local
```

When using local authentication:
- The Entra ID configuration variables (`ENTRA_*`) are optional
- Users can access the application without requiring actual Entra credentials
- Sessions still use the same cookie-based mechanism as Entra authentication

#### When to Use

- Local development without access to Entra ID credentials
- Running tests that don't require external authentication
- CI/CD environments where Entra configuration is not available

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SERVICE_VERSION` | No | `null` | Service version (injected by CDP environments) |
| `AUTH_PROVIDER` | No | `entra` | Authentication provider: `entra` (default) or `local` |
| `ENTRA_TENANT_ID` | Yes* | `null` | Entra ID tenant GUID that issues tokens for this app registration |
| `ENTRA_CLIENT_ID` | Yes* | `null` | Entra ID application (client) ID registered for this portal |
| `ENTRA_CLIENT_SECRET` | Yes* | `null` | Entra ID application client secret |
| `ENTRA_AUTHORITY_HOST` | No | `https://login.microsoftonline.com` | Entra authority host used to build authorization endpoints |
| `ENTRA_REDIRECT_HOST` | Yes* | `null` | Redirect URI for the OIDC flow (e.g., `http://localhost:3000` for dev, `https://your-domain.gov.uk` for prod) |

**\* Required when `AUTH_PROVIDER=entra` and `NODE_ENV=production`. Optional for development/test environments.*

See `.env.example` for a complete list of all configurable variables and their documentation.

## Server-side Caching

We use Catbox for server-side caching. By default the service will use CatboxRedis when deployed and CatboxMemory for
local development.
You can override the default behaviour by setting the `SESSION_CACHE_ENGINE` environment variable to either `redis` or
`memory`.

Please note: CatboxMemory (`memory`) is _not_ suitable for production use! The cache will not be shared between each
instance of the service and it will not persist between restarts.

## Redis

Redis is an in-memory key-value store. Every instance of a service has access to the same Redis key-value store similar
to how services might have a database (or MongoDB). All frontend services are given access to a namespaced prefixed that
matches the service name. e.g. `my-service` will have access to everything in Redis that is prefixed with `my-service`.

If your service does not require a session cache to be shared between instances or if you don't require Redis, you can
disable setting `SESSION_CACHE_ENGINE=false` or changing the default value in `src/config/index.js`.

## Proxy

Proxying is handled at the infrastructure level via the `NODE_USE_ENV_PROXY` environment variable, rather than the
application setting up a global `undici` `ProxyAgent` dispatcher itself. When enabled, Node's built-in `fetch`
(and anything built on `undici`) will automatically pick up the standard `HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY`
environment variables.

`NODE_USE_ENV_PROXY` is set to `true` by default when deployed to the platform.

## Local Development

### Setup

Install application dependencies:

```bash
npm install
```

### Git hooks

Install git hooks (optional)

```bash
npm run git:setup-hooks
```

### Development

To run the frontend:
```bash
npm run dev
```

The frontend runs on `http://localhost:3000`.

### Production

To mimic the application running in `production` mode locally run:

```bash
npm start
```

### Npm scripts

All available Npm scripts can be seen in [package.json](./package.json)
To view them in your command line run:

```bash
npm run
```

### Linting & Formatting

Lint the codebase:

```bash
npm run lint
```

Fix linting issues:

```bash
npm run lint:js:fix
```

### Update dependencies

To update dependencies use [npm-check-updates](https://github.com/raineorshine/npm-check-updates):

> The following script is a good start. Check out all the options on
> the [npm-check-updates](https://github.com/raineorshine/npm-check-updates)

```bash
ncu --interactive --format group
```

## Docker

### Development image

> [!TIP]
> For Apple Silicon users, you may need to add `--platform linux/amd64` to the `docker run` command to ensure
> compatibility fEx: `docker build --platform=linux/arm64 --no-cache --tag rpa-ai-guidance-hub-ui`

Build:

```bash
docker build --target development --no-cache --tag rpa-ai-guidance-hub-ui:development .
```

Run:

```bash
docker run -p 3000:3000 rpa-ai-guidance-hub-ui:development
```

### Production image

Build:

```bash
docker build --no-cache --tag rpa-ai-guidance-hub-ui .
```

Run:

```bash
docker run -p 3000:3000 rpa-ai-guidance-hub-ui
```

### Docker Compose

A local environment with:

- Redis
- MongoDB
- This service.

```bash
docker compose up --build -d
```

### Dependabot

We have added an example dependabot configuration file to the repository. You can enable it by renaming
the [.github/example.dependabot.yml](.github/example.dependabot.yml) to `.github/dependabot.yml`

### SonarCloud

Instructions for setting up SonarCloud can be found in [sonar-project.properties](./sonar-project.properties).

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
