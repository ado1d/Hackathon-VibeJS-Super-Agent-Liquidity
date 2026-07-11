# Demo VM Deployment

Target Ubuntu 22.04 or 24.04 with Docker Engine, Compose v2, 2 GB RAM, and 20 GB disk.

1. Create a non-root deploy user and install Docker from Docker's official Ubuntu repository.
2. Clone the repository, copy `.env.example` to `.env`, and replace `POSTGRES_PASSWORD` and `JWT_SECRET`.
3. Run `docker compose up -d --build` and confirm all three services are healthy.
4. Install `infra/systemd/super-agent.service` as `/etc/systemd/system/super-agent.service`, replace the working directory, then enable it.
5. With a domain, point DNS at the VM and use Certbot's Nginx HTTP-01 flow on the host or a documented certificate volume. For an IP-only short demo, expose HTTP and clearly mark it as demo-only.
6. Open only SSH, 80, and 443 in the VM firewall/security group. PostgreSQL and port 8000 must not be public.

Smoke checks:

```bash
curl -fsS http://localhost/api/v1/health
curl -fsS http://localhost/api/v1/ready
docker compose ps
```

