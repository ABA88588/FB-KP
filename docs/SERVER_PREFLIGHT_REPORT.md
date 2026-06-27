# Server Preflight Report

Date: 2026-06-27
Host: 89.208.252.84
User used for preflight/deploy: root
Report status: completed on the target server

## Current Deployment State

- Deployment directory: `/opt/adflow`.
- Application base path: `/ads`.
- Public entrypoint: `http://89.208.252.84/ads/login`.
- Root path `/` redirects to `/ads/login`.
- Legacy paths `/login`, `/overview`, `/campaigns`, `/reports`, `/sync-center`, `/creatives`, and `/settings` redirect to their `/ads/*` equivalents.
- Health checks use `/ads/api/health/live`.

## Read-Only Preflight

Commands executed before making server changes:

```bash
uname -a
cat /etc/os-release
whoami
uptime
free -h
df -h
ss -lntup
docker --version || true
docker compose version || true
systemctl status nginx --no-pager || true
systemctl status caddy --no-pager || true
ufw status || true
ls -la /opt || true
```

## Findings

- OS: Ubuntu 26.04 LTS.
- User: root.
- Disk: root filesystem had about 16 GB available on a 19 GB volume.
- Memory: about 1 GiB RAM was available before deployment.
- Docker: not installed during preflight.
- Docker Compose plugin: not installed during preflight.
- UFW: not installed.
- Caddy: not installed as a system service.
- Nginx: installed and serving the default Ubuntu page on port 80.
- `/opt`: present and initially did not contain the application deployment.
- Existing non-application service: UDP port 58798 was already in use by `hysteria`. This service is not part of AdFlow and must not be modified by deployment scripts.

## Risk Decisions

- Port 80 was occupied by the default Nginx site, not an identified production site. Nginx was stopped and disabled only after this was confirmed, so the Docker reverse proxy could bind port 80.
- No unknown application data under `/opt` was removed.
- No destructive Docker prune was executed.
- A 3 GiB swap file was added at `/swapfile-adflow` after the first image build exhausted the 1 GiB RAM host. Future on-host builds should keep `COMPOSE_PARALLEL_LIMIT=1`.

## Current Network State

- Public port 80: open and served by Docker reverse proxy.
- Public port 3000: not exposed.
- Public port 5432: not exposed.
- Public port 6379: not exposed.
- SSH port 22: open.
- Existing UDP `hysteria` listener remains present and was not modified.

## Secrets

- SSH password was not written to this report.
- `.env.production` values were generated on the server and were not printed.
- No Meta token or app secret was available or configured.
