# AI ROI Dashboard

A dependency-free proof-of-concept dashboard for tracking AI usage and estimating return on
investment for internal AI use cases.

## What is included

- Browser-based dashboard that runs from static files (`index.html`, `styles.css`, `app.js`).
- Regular users see a clean executive dashboard; setup is tucked behind **Admin settings**.
- Can be hosted from a SharePoint document library.
- Optional SharePoint Lists backing store for shared dashboard data.
- API connector configuration for Open WebUI, Google Gemini, or a custom compatible endpoint.
- Local token usage ledger with manual entries and JSON import/export.
- Use case catalog with add/edit/delete support.
- Filterable categories and tags.
- ROI estimates based on time saved, task volume, labor rate, AI/tooling cost, implementation
  cost, and confidence level.
- No external fonts, icons, analytics, scripts, stylesheets, or CDN assets.

## Running locally

Open `index.html` in a browser, or serve the folder with any local static web server:

```bash
python3 -m http.server 8080
```

Then browse to `http://localhost:8080`.

## Hosting in SharePoint

The dashboard can be uploaded as static files to a SharePoint document library:

1. Create a document library or folder for the dashboard.
2. Upload `index.html`, `styles.css`, and `app.js` together.
3. Open `index.html` from SharePoint.
4. Open **Admin settings** and choose **SharePoint Lists**.
5. Enter the SharePoint site URL, for example `https://tenant.sharepoint.com/sites/ai-roi`.
6. Enter the list names and select **Save storage settings**.
7. Use **Load from SharePoint** to read existing list rows or **Save all to SharePoint** to seed
   the lists from the current local data.

The app uses the signed-in user's SharePoint cookies and the SharePoint REST API. It does not use
Microsoft Graph, SPFx, npm packages, or hosted scripts.

### SharePoint list schema

Create three custom lists, using these default names or matching the names you enter in the app:

- `AI ROI Connectors`
- `AI ROI Usage Records`
- `AI ROI Use Cases`

Each list needs the built-in `Title` column plus these custom columns:

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `DashboardId` | Single line of text | Yes | Stores the app-generated stable record id. |
| `Payload` | Multiple lines of text, plain text | Yes | Stores the full JSON record used by the POC. |

This compact schema keeps the POC flexible while you validate the fields and workflow. If the
dashboard graduates beyond POC, the JSON payloads can be normalized into typed SharePoint columns
for reporting, views, retention, and governance.

## Air-gapped use

The app is intentionally static and does not contact any external resource unless you configure and
sync an API connector. All dashboard data is stored in the browser's local storage and can be
exported/imported as JSON for backup or transfer.

For fully air-gapped deployments:

1. Copy these repository files into the isolated environment.
2. Serve them from an internal static web server or open `index.html` directly.
3. Configure connectors only with internal URLs, such as an on-prem Open WebUI API or an internal
   proxy/export endpoint for Gemini usage data.

## Connector notes

Connectors accept:

- Base API URL, for example `https://openwebui.example.internal`. The Gemini demo connector is
  intentionally blank by default; enter Google's API URL only in connected environments, or use an
  internal proxy/export URL in air-gapped environments.
- Usage endpoint path, for example `/api/v1/chats/all` or an internal normalized usage endpoint.
- Authentication mode:
  - `Authorization: Bearer token`
  - `x-goog-api-key`
  - `key` query parameter
  - no auth
- Optional input/output token pricing per 1 million tokens.

The POC parser recognizes common usage fields such as:

- `usageMetadata.promptTokenCount`
- `usageMetadata.candidatesTokenCount`
- `usage.prompt_tokens`
- `usage.completion_tokens`
- `inputTokens`
- `outputTokens`
- `totalTokens`
- `cost`

Open WebUI and Gemini deployments vary in the usage and audit endpoints they expose. If your
environment does not provide a direct usage summary endpoint, point the connector at an internal
adapter that returns a JSON array or object containing the fields above.

Because this POC is static and calls APIs directly from the browser, the target API must allow the
dashboard origin with CORS. In stricter environments, host the dashboard behind the same internal
origin as a small API adapter/proxy and point connectors at that local adapter.