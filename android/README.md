# Hobby Warehouse (Android)

Open this `android/` folder in **Android Studio**. On first sync, the IDE downloads Gradle if the wrapper JAR is not present; if sync fails, install [Android Studio](https://developer.android.com/studio) and use **File → Sync Project with Gradle Files**.

## Connecting to the dev server

- **Emulator:** default base URL is `http://10.0.2.2:3000` (maps to the host machine’s localhost).
- **Physical device:** set the base URL to `http://<your-LAN-IP>:3000` and ensure the phone can reach the PC (same Wi‑Fi, firewall allows port 3000).

Sign in via the embedded web view (Google OAuth), then use **Check session** to confirm cookies are shared with the API.

## Backend routes used

- `GET /api/mobile/session`
- `GET /api/mobile/parts/by-number?partNumber=…`
- `GET /api/mobile/parts/{id}`
- `PATCH /api/mobile/parts/{id}` with `{ "quantityOnHand": number }`
- `POST /api/mobile/parts/{id}/images` (multipart field `files`)
