# Server Preflight Report

Status: template and local pre-connection output format only. No production server has been logged into in this task.

Network reachability from the local workstation on 2026-06-26:

```text
target                      89.208.252.84
tcp_22                      reachable
ssh_login                   not attempted; credentials still required
```

Run this on the target server from the repository root:

```bash
deploy/bootstrap-server.sh --check-only
```

Expected output format:

```text
PRECHECK fbkp self-hosted deployment
timestamp_utc               2026-06-26T00:00:00Z
project_root                /opt/fbkp/_fbkp_publish
docker                      ok (Docker version 28.x.x, build ...)
docker_compose              ok (v2.x.x)
compose_file                present
caddyfile                   present
env_file                    present
host_port_80                available
secret_values               not printed
overall                     PASS
```

Failure output keeps the same shape:

```text
PRECHECK fbkp self-hosted deployment
timestamp_utc               2026-06-26T00:00:00Z
project_root                /opt/fbkp/_fbkp_publish
docker                      missing
docker_compose              missing
compose_file                present
caddyfile                   present
env_file                    missing (copy .env.production.example)
host_port_80                unknown
secret_values               not printed
overall                     FAIL
```

Notes:

- The preflight check confirms local runtime prerequisites and file presence only.
- It does not print or validate real secret values.
- It does not open public firewall rules or mutate remote infrastructure.
- It does not run aggressive Docker prune commands.
