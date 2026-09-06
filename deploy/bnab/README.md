# BNAB VPS helpers

Scripts for deploying **https://bnab.bogza.ro**. Prefer a **PC production build** on small (1 GB) VPS hosts.

```powershell
cd bnab
npm run build
tar -czf .next-upload.tgz .next
python ../deploy/bnab/ssh_upload_live_next.py
python ../deploy/bnab/ssh_upload_public_brand.py
python ../deploy/bnab/ssh_quick_restart_bnab.py
```

Requires local gitignored `deploy/deploy.secrets`.

Full documentation: [`bnab/docs/deploy.md`](../../bnab/docs/deploy.md).
