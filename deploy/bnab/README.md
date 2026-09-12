# BNAB VPS helpers

Zero-downtime blue/green for **https://bnab.bogza.ro**. Prefer a **PC production build** on small (1 GB) VPS hosts.

```powershell
python deploy/bnab/bnab_deploy.py all
```

Agent playbook: [`AGENT_DEPLOY.md`](./AGENT_DEPLOY.md)  
Full docs: [`bnab/docs/deploy.md`](../../bnab/docs/deploy.md)

Requires local gitignored `deploy/deploy.secrets`.
