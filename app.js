const STORAGE_KEY = "ai-roi-dashboard-state-v2";
const STORAGE_SETTINGS_KEY = "ai-roi-dashboard-storage-settings-v1";

const defaultStorageSettings = {
  mode: "local",
  siteUrl: "",
  connectorListName: "AI ROI Connectors",
  usageListName: "AI ROI Usage Records",
  useCaseListName: "AI ROI Use Cases",
};

const today = new Date().toISOString().slice(0, 10);

const demoState = {
  connectors: [
    {
      id: crypto.randomUUID(),
      name: "Open WebUI",
      provider: "open-webui",
      baseUrl: "",
      usagePath: "/api/v1/chats/all",
      authType: "bearer",
      token: "",
      inputCost: 0,
      outputCost: 0,
      status: "Not configured",
      lastSync: "",
    },
    {
      id: crypto.randomUUID(),
      name: "Google Gemini",
      provider: "gemini",
      baseUrl: "",
      usagePath: "/v1beta/models",
      authType: "x-goog-api-key",
      token: "",
      inputCost: 1.25,
      outputCost: 5,
      status: "Use an audit export or proxy endpoint for usage",
      lastSync: "",
    },
  ],
  usageRecords: [
    {
      id: crypto.randomUUID(),
      provider: "Open WebUI",
      model: "llama3.1:70b",
      inputTokens: 1240000,
      outputTokens: 410000,
      cost: 0,
      date: today,
    },
    {
      id: crypto.randomUUID(),
      provider: "Google Gemini",
      model: "gemini-1.5-pro",
      inputTokens: 680000,
      outputTokens: 220000,
      cost: 92.5,
      date: today,
    },
  ],
  useCases: [
    {
      id: crypto.randomUUID(),
      title: "Knowledge base assistant",
      category: "Support",
      description:
        "Answer internal how-to questions and summarize procedures for service desk staff.",
      tags: ["internal", "support", "retrieval"],
      status: "Pilot",
      currentMinutes: 14,
      aiMinutes: 6,
      monthlyVolume: 3200,
      hourlyRate: 58,
      monthlyAiCost: 450,
      implementationCost: 12000,
      confidence: 0.75,
    },
    {
      id: crypto.randomUUID(),
      title: "Policy drafting copilot",
      category: "Compliance",
      description:
        "Create first drafts, compare policy versions, and flag missing control references.",
      tags: ["documents", "review", "risk"],
      status: "Idea",
      currentMinutes: 90,
      aiMinutes: 45,
      monthlyVolume: 48,
      hourlyRate: 82,
      monthlyAiCost: 250,
      implementationCost: 8000,
      confidence: 0.5,
    },
  ],
};

let state = loadState();
let storageSettings = loadStorageSettings();
const sharePointEntityTypeCache = new Map();
let sharePointDigest = null;
const filters = { search: "", category: "", tag: "" };

const $ = (selector) => document.querySelector(selector);

const els = {
  totalTokens: $("#totalTokens"),
  usageRecordCount: $("#usageRecordCount"),
  totalSpend: $("#totalSpend"),
  annualBenefit: $("#annualBenefit"),
  annualRoi: $("#annualRoi"),
  netBenefit: $("#netBenefit"),
  connectorList: $("#connectorList"),
  usageList: $("#usageList"),
  useCaseList: $("#useCaseList"),
  categoryFilter: $("#categoryFilter"),
  tagFilter: $("#tagFilter"),
  searchFilter: $("#searchFilter"),
  toast: $("#toast"),
  adminDialog: $("#adminDialog"),
  storageForm: $("#storageForm"),
  storageMode: $("#storageMode"),
  sharePointSiteUrl: $("#sharePointSiteUrl"),
  connectorListName: $("#connectorListName"),
  usageListName: $("#usageListName"),
  useCaseListName: $("#useCaseListName"),
  storageStatus: $("#storageStatus"),
  connectorDialog: $("#connectorDialog"),
  connectorForm: $("#connectorForm"),
  usageDialog: $("#usageDialog"),
  usageForm: $("#usageForm"),
  useCaseDialog: $("#useCaseDialog"),
  useCaseForm: $("#useCaseForm"),
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return structuredClone(demoState);

    return {
      connectors: Array.isArray(saved.connectors) ? saved.connectors : [],
      usageRecords: Array.isArray(saved.usageRecords) ? saved.usageRecords : [],
      useCases: Array.isArray(saved.useCases) ? saved.useCases : [],
    };
  } catch (error) {
    console.warn("Unable to load saved state", error);
    return structuredClone(demoState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadStorageSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_SETTINGS_KEY));
    return { ...defaultStorageSettings, ...(saved || {}) };
  } catch (error) {
    console.warn("Unable to load storage settings", error);
    return { ...defaultStorageSettings };
  }
}

function saveStorageSettings() {
  localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(storageSettings));
}

function money(value, digits = 0) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

function number(value) {
  return new Intl.NumberFormat().format(Number.isFinite(value) ? value : 0);
}

function percent(value) {
  return `${Math.round(Number.isFinite(value) ? value : 0)}%`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function roiFor(useCase) {
  const minutesSaved = Math.max(
    Number(useCase.currentMinutes || 0) - Number(useCase.aiMinutes || 0),
    0,
  );
  const monthlyGross =
    (minutesSaved / 60) *
    Number(useCase.monthlyVolume || 0) *
    Number(useCase.hourlyRate || 0) *
    Number(useCase.confidence || 0);
  const annualGross = monthlyGross * 12;
  const annualCost =
    Number(useCase.monthlyAiCost || 0) * 12 + Number(useCase.implementationCost || 0);
  const annualNet = annualGross - annualCost;
  const roi = annualCost > 0 ? (annualNet / annualCost) * 100 : 0;
  const monthlyNet = monthlyGross - Number(useCase.monthlyAiCost || 0);
  const paybackMonths =
    monthlyNet > 0 ? Number(useCase.implementationCost || 0) / monthlyNet : Infinity;

  return { minutesSaved, monthlyGross, annualGross, annualCost, annualNet, roi, paybackMonths };
}

function renderSummary() {
  const totalTokens = state.usageRecords.reduce(
    (sum, record) => sum + Number(record.inputTokens || 0) + Number(record.outputTokens || 0),
    0,
  );
  const spend = state.usageRecords.reduce((sum, record) => sum + Number(record.cost || 0), 0);
  const roiTotals = state.useCases.reduce(
    (totals, useCase) => {
      const roi = roiFor(useCase);
      totals.annualGross += roi.annualGross;
      totals.annualCost += roi.annualCost;
      totals.annualNet += roi.annualNet;
      return totals;
    },
    { annualGross: 0, annualCost: 0, annualNet: 0 },
  );
  const roi = roiTotals.annualCost > 0 ? (roiTotals.annualNet / roiTotals.annualCost) * 100 : 0;

  els.totalTokens.textContent = number(totalTokens);
  els.usageRecordCount.textContent = `${number(state.usageRecords.length)} usage records`;
  els.totalSpend.textContent = money(spend, spend > 0 && spend < 1 ? 4 : 0);
  els.annualBenefit.textContent = money(roiTotals.annualGross);
  els.annualRoi.textContent = percent(roi);
  els.netBenefit.textContent = `${money(roiTotals.annualNet)} net benefit`;
}

function renderConnectors() {
  if (!state.connectors.length) {
    els.connectorList.innerHTML = '<p class="empty-state">No connectors configured yet.</p>';
    return;
  }

  els.connectorList.innerHTML = state.connectors
    .map(
      (connector) => `
        <article class="connector-card">
          <header>
            <div>
              <h3>${escapeHtml(connector.name)}</h3>
              <p class="muted">${escapeHtml(connector.baseUrl || "No API URL configured")}</p>
            </div>
            <span class="status-pill">${escapeHtml(connector.provider)}</span>
          </header>
          <p>${connectorHint(connector)}</p>
          <div class="card-meta">
            <span>${escapeHtml(connector.status || "Ready")}</span>
            <span>${connector.lastSync ? `Last sync ${escapeHtml(connector.lastSync)}` : "Never synced"}</span>
          </div>
          <div class="card-actions">
            <button class="button button-secondary" type="button" data-action="sync-connector" data-id="${connector.id}">Sync</button>
            <button class="button button-secondary" type="button" data-action="edit-connector" data-id="${connector.id}">Edit</button>
            <button class="button button-ghost danger" type="button" data-action="delete-connector" data-id="${connector.id}">Delete</button>
          </div>
        </article>
      `,
    )
    .join("");
}

function connectorHint(connector) {
  if (connector.provider === "gemini") {
    return "Gemini responses are parsed for usageMetadata. For organization-level usage, point this at a local billing/audit proxy or exported usage endpoint.";
  }
  if (connector.provider === "open-webui") {
    return "Open WebUI responses are parsed for chat, response, and OpenAI-compatible token usage fields.";
  }
  return "Custom connectors are parsed for common input, output, total token, request count, and cost fields.";
}

function renderUsage() {
  if (!state.usageRecords.length) {
    els.usageList.innerHTML = '<p class="empty-state">No token usage records yet.</p>';
    return;
  }

  els.usageList.innerHTML = `
    <div class="table-wrap">
      <table class="usage-table">
        <thead>
          <tr>
            <th>Provider</th>
            <th>Model</th>
            <th>Date</th>
            <th>Input tokens</th>
            <th>Output tokens</th>
            <th>Total</th>
            <th>Cost</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${state.usageRecords
            .map(
              (record) => `
                <tr>
                  <td>${escapeHtml(record.provider)}</td>
                  <td>${escapeHtml(record.model || "Unknown")}</td>
                  <td>${escapeHtml(record.date || "Imported")}</td>
                  <td>${number(Number(record.inputTokens || 0))}</td>
                  <td>${number(Number(record.outputTokens || 0))}</td>
                  <td>${number(Number(record.inputTokens || 0) + Number(record.outputTokens || 0))}</td>
                  <td>${money(Number(record.cost || 0), Number(record.cost || 0) < 1 ? 4 : 2)}</td>
                  <td><button class="link-button danger" type="button" data-action="delete-usage" data-id="${record.id}">Delete</button></td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderFilters() {
  const categories = [...new Set(state.useCases.map((useCase) => useCase.category).filter(Boolean))].sort();
  const tags = [...new Set(state.useCases.flatMap((useCase) => useCase.tags || []).filter(Boolean))].sort();

  els.categoryFilter.innerHTML = [
    '<option value="">All categories</option>',
    ...categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`),
  ].join("");
  els.tagFilter.innerHTML = [
    '<option value="">All tags</option>',
    ...tags.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`),
  ].join("");
  els.categoryFilter.value = filters.category;
  els.tagFilter.value = filters.tag;
}

function renderUseCases() {
  const filtered = state.useCases.filter((useCase) => {
    const haystack = [
      useCase.title,
      useCase.category,
      useCase.status,
      useCase.description,
      (useCase.tags || []).join(" "),
    ]
      .join(" ")
      .toLowerCase();

    return (
      (!filters.search || haystack.includes(filters.search.toLowerCase())) &&
      (!filters.category || useCase.category === filters.category) &&
      (!filters.tag || (useCase.tags || []).includes(filters.tag))
    );
  });

  if (!filtered.length) {
    els.useCaseList.innerHTML = '<p class="empty-state">No use cases match the current filters.</p>';
    return;
  }

  els.useCaseList.innerHTML = filtered
    .map((useCase) => {
      const roi = roiFor(useCase);
      return `
        <article class="use-case-card">
          <header>
            <div>
              <span class="category-pill">${escapeHtml(useCase.category)}</span>
              <h3>${escapeHtml(useCase.title)}</h3>
            </div>
            <span class="status-pill">${escapeHtml(useCase.status)}</span>
          </header>
          <p>${escapeHtml(useCase.description || "No description provided.")}</p>
          <div class="pill-row">
            ${(useCase.tags || []).map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join("")}
          </div>
          <div class="roi-line">
            <div><span>Annual gross</span><strong>${money(roi.annualGross)}</strong></div>
            <div><span>Annual net</span><strong>${money(roi.annualNet)}</strong></div>
            <div><span>ROI</span><strong>${percent(roi.roi)}</strong></div>
            <div><span>Payback</span><strong>${Number.isFinite(roi.paybackMonths) ? `${roi.paybackMonths.toFixed(1)} mo` : "N/A"}</strong></div>
          </div>
          <div class="card-actions">
            <button class="button button-secondary" type="button" data-action="edit-use-case" data-id="${useCase.id}">Edit</button>
            <button class="button button-ghost danger" type="button" data-action="delete-use-case" data-id="${useCase.id}">Delete</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function render() {
  renderSummary();
  renderStorageSettings();
  renderConnectors();
  renderUsage();
  renderFilters();
  renderUseCases();
}

function renderStorageSettings() {
  setField("storageMode", storageSettings.mode);
  setField("sharePointSiteUrl", storageSettings.siteUrl);
  setField("connectorListName", storageSettings.connectorListName);
  setField("usageListName", storageSettings.usageListName);
  setField("useCaseListName", storageSettings.useCaseListName);
  els.storageStatus.textContent =
    storageSettings.mode === "sharepoint" ? "SharePoint Lists" : "Local browser storage";
}

function openDialog(dialog) {
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

function closeDialog(dialog) {
  dialog.close?.();
  dialog.removeAttribute("open");
}

function setField(id, value) {
  const field = document.getElementById(id);
  if (field) field.value = value ?? "";
}

function readNumber(id) {
  return Number(document.getElementById(id).value || 0);
}

function openConnectorForm(connector = null) {
  $("#connectorDialogTitle").textContent = connector ? "Edit connector" : "Add connector";
  setField("connectorId", connector?.id || "");
  setField("connectorName", connector?.name || "");
  setField("connectorProvider", connector?.provider || "open-webui");
  setField("connectorBaseUrl", connector?.baseUrl || "");
  setField("connectorUsagePath", connector?.usagePath || defaultUsagePath(connector?.provider || "open-webui"));
  setField("connectorAuthType", connector?.authType || defaultAuthType(connector?.provider || "open-webui"));
  setField("connectorToken", connector?.token || "");
  setField("connectorInputCost", connector?.inputCost ?? 0);
  setField("connectorOutputCost", connector?.outputCost ?? 0);
  openDialog(els.connectorDialog);
}

function openUsageForm(record = null) {
  $("#usageDialogTitle").textContent = record ? "Edit usage record" : "Add usage record";
  setField("usageId", record?.id || "");
  setField("usageProvider", record?.provider || "");
  setField("usageModel", record?.model || "");
  setField("usageInputTokens", record?.inputTokens ?? 0);
  setField("usageOutputTokens", record?.outputTokens ?? 0);
  setField("usageCost", record?.cost ?? 0);
  setField("usageDate", record?.date || today);
  openDialog(els.usageDialog);
}

function openUseCaseForm(useCase = null) {
  $("#useCaseDialogTitle").textContent = useCase ? "Edit use case" : "Add use case";
  setField("useCaseId", useCase?.id || "");
  setField("useCaseTitle", useCase?.title || "");
  setField("useCaseCategory", useCase?.category || "");
  setField("useCaseDescription", useCase?.description || "");
  setField("useCaseTags", (useCase?.tags || []).join(", "));
  setField("useCaseStatus", useCase?.status || "Idea");
  setField("currentMinutes", useCase?.currentMinutes ?? 0);
  setField("aiMinutes", useCase?.aiMinutes ?? 0);
  setField("monthlyVolume", useCase?.monthlyVolume ?? 0);
  setField("hourlyRate", useCase?.hourlyRate ?? 0);
  setField("monthlyAiCost", useCase?.monthlyAiCost ?? 0);
  setField("implementationCost", useCase?.implementationCost ?? 0);
  setField("confidence", useCase?.confidence ?? 0.75);
  openDialog(els.useCaseDialog);
}

function defaultUsagePath(provider) {
  if (provider === "gemini") return "/v1beta/models";
  if (provider === "open-webui") return "/api/v1/chats/all";
  return "/usage";
}

function defaultAuthType(provider) {
  return provider === "gemini" ? "x-goog-api-key" : "bearer";
}

function upsertConnector(event) {
  event.preventDefault();
  const id = $("#connectorId").value || crypto.randomUUID();
  const existing = state.connectors.find((connector) => connector.id === id);
  const connector = {
    id,
    name: $("#connectorName").value.trim(),
    provider: $("#connectorProvider").value,
    baseUrl: $("#connectorBaseUrl").value.trim().replace(/\/+$/, ""),
    usagePath: $("#connectorUsagePath").value.trim(),
    authType: $("#connectorAuthType").value,
    token: $("#connectorToken").value.trim(),
    inputCost: readNumber("connectorInputCost"),
    outputCost: readNumber("connectorOutputCost"),
    status: existing?.status || "Ready",
    lastSync: existing?.lastSync || "",
  };

  if (!connector.name || !connector.baseUrl) {
    showToast("Connector name and base API URL are required.", true);
    return;
  }

  state.connectors = existing
    ? state.connectors.map((item) => (item.id === id ? connector : item))
    : [connector, ...state.connectors];
  closeDialog(els.connectorDialog);
  persistAndRenderAsync("connectors", connector).then(() => showToast("Connector saved."));
}

function upsertUsage(event) {
  event.preventDefault();
  const id = $("#usageId").value || crypto.randomUUID();
  const existing = state.usageRecords.find((record) => record.id === id);
  const record = {
    id,
    provider: $("#usageProvider").value.trim(),
    model: $("#usageModel").value.trim(),
    inputTokens: readNumber("usageInputTokens"),
    outputTokens: readNumber("usageOutputTokens"),
    cost: readNumber("usageCost"),
    date: $("#usageDate").value || today,
  };

  if (!record.provider) {
    showToast("Usage provider is required.", true);
    return;
  }

  state.usageRecords = existing
    ? state.usageRecords.map((item) => (item.id === id ? record : item))
    : [record, ...state.usageRecords];
  closeDialog(els.usageDialog);
  persistAndRenderAsync("usageRecords", record).then(() => showToast("Usage record saved."));
}

function upsertUseCase(event) {
  event.preventDefault();
  const id = $("#useCaseId").value || crypto.randomUUID();
  const existing = state.useCases.find((useCase) => useCase.id === id);
  const useCase = {
    id,
    title: $("#useCaseTitle").value.trim(),
    category: $("#useCaseCategory").value.trim() || "Uncategorized",
    description: $("#useCaseDescription").value.trim(),
    tags: $("#useCaseTags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
    status: $("#useCaseStatus").value,
    currentMinutes: readNumber("currentMinutes"),
    aiMinutes: readNumber("aiMinutes"),
    monthlyVolume: readNumber("monthlyVolume"),
    hourlyRate: readNumber("hourlyRate"),
    monthlyAiCost: readNumber("monthlyAiCost"),
    implementationCost: readNumber("implementationCost"),
    confidence: readNumber("confidence"),
  };

  if (!useCase.title) {
    showToast("Use case title is required.", true);
    return;
  }

  state.useCases = existing
    ? state.useCases.map((item) => (item.id === id ? useCase : item))
    : [useCase, ...state.useCases];
  closeDialog(els.useCaseDialog);
  persistAndRenderAsync("useCases", useCase).then(() => showToast("Use case saved."));
}

async function syncConnector(id) {
  const connector = state.connectors.find((item) => item.id === id);
  if (!connector?.baseUrl) {
    showToast("Add a base API URL before syncing.", true);
    return;
  }

  updateConnector(id, { status: "Syncing...", lastSync: new Date().toLocaleString() });

  try {
    const response = await fetch(buildUrl(connector), { headers: authHeaders(connector) });
    if (!response.ok) throw new Error(`API returned HTTP ${response.status}`);

    const payload = await response.json();
    const records = normalizeUsagePayload(payload, connector);
    state.usageRecords = [
      ...records,
      ...state.usageRecords.filter((record) => record.connectorId !== connector.id),
    ];
    updateConnector(id, {
      status: `Synced ${records.length} record${records.length === 1 ? "" : "s"}`,
      lastSync: new Date().toLocaleString(),
    });
    persistAndRenderAsync().then(() =>
      showToast(`Synced ${records.length} usage records from ${connector.name}.`),
    );
  } catch (error) {
    updateConnector(id, {
      status: `Sync failed: ${error.message}`,
      lastSync: new Date().toLocaleString(),
    });
    persistAndRenderAsync("connectors", state.connectors.find((item) => item.id === id));
    showToast(`Sync failed: ${error.message}`, true);
  }
}

function buildUrl(connector) {
  const path = connector.usagePath || "";
  const separator = path.startsWith("/") ? "" : "/";
  const url = new URL(`${connector.baseUrl}${separator}${path}`);
  if (connector.authType === "query-key" && connector.token) {
    url.searchParams.set("key", connector.token);
  }
  return url.toString();
}

function authHeaders(connector) {
  const headers = { Accept: "application/json" };
  if (!connector.token) return headers;
  if (connector.authType === "bearer") headers.Authorization = `Bearer ${connector.token}`;
  if (connector.authType === "x-goog-api-key") headers["x-goog-api-key"] = connector.token;
  return headers;
}

function normalizeUsagePayload(payload, connector) {
  const items = collectUsageCandidates(payload);

  return items.flatMap((item) => {
    const flattened = flattenUsageItem(item);
    const inputTokens = toNumber(
      flattened.inputTokens ??
        flattened.promptTokens ??
        flattened.prompt_tokens ??
        flattened.promptTokenCount ??
        flattened.prompt_token_count,
    );
    const outputTokens = toNumber(
      flattened.outputTokens ??
        flattened.completionTokens ??
        flattened.completion_tokens ??
        flattened.candidatesTokenCount ??
        flattened.candidates_token_count,
    );
    const totalTokens = toNumber(
      flattened.totalTokens ?? flattened.total_tokens ?? flattened.totalTokenCount,
    );
    const input = inputTokens || Math.max(totalTokens - outputTokens, 0);
    const output = outputTokens || Math.max(totalTokens - inputTokens, 0);
    const cost =
      toNumber(flattened.cost ?? flattened.spend ?? flattened.amount) ||
      estimateCost(input, output, connector);

    if (!input && !output && !cost) return [];

    return {
      id: crypto.randomUUID(),
      connectorId: connector.id,
      provider: connector.name,
      model: flattened.model || flattened.modelName || flattened.name || connector.provider,
      inputTokens: input,
      outputTokens: output,
      cost,
      date: flattened.date || flattened.created_at || flattened.createdAt || today,
    };
  });
}

function collectUsageCandidates(payload) {
  const preferredItems = Array.isArray(payload)
    ? payload
    : payload?.data || payload?.items || payload?.records || payload?.usage || payload?.chats;
  const roots = preferredItems ? (Array.isArray(preferredItems) ? preferredItems : [preferredItems]) : [payload];
  const candidates = [];

  roots.forEach((root) => walkForUsage(root, candidates, 0));
  return candidates.length ? candidates : roots;
}

function walkForUsage(value, candidates, depth) {
  if (!value || depth > 6) return;
  if (Array.isArray(value)) {
    value.forEach((item) => walkForUsage(item, candidates, depth + 1));
    return;
  }
  if (typeof value !== "object") return;

  if (hasUsageFields(value) || hasUsageFields(value.usage) || hasUsageFields(value.usageMetadata)) {
    candidates.push(value);
  }

  Object.entries(value).forEach(([key, nested]) => {
    if (["usage", "usageMetadata"].includes(key)) return;
    if (typeof nested === "object") walkForUsage(nested, candidates, depth + 1);
  });
}

function hasUsageFields(value) {
  if (!value || typeof value !== "object") return false;
  return [
    "inputTokens",
    "outputTokens",
    "promptTokens",
    "completionTokens",
    "prompt_tokens",
    "completion_tokens",
    "promptTokenCount",
    "candidatesTokenCount",
    "totalTokens",
    "total_tokens",
    "totalTokenCount",
    "cost",
    "spend",
    "amount",
  ].some((field) => field in value);
}

function flattenUsageItem(item) {
  const usage = item?.usageMetadata || item?.usage || item?.meta?.usage || {};
  return { ...item, ...usage };
}

function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function estimateCost(inputTokens, outputTokens, connector) {
  return (
    (inputTokens / 1000000) * Number(connector.inputCost || 0) +
    (outputTokens / 1000000) * Number(connector.outputCost || 0)
  );
}

function updateConnector(id, changes) {
  state.connectors = state.connectors.map((connector) =>
    connector.id === id ? { ...connector, ...changes } : connector,
  );
}

function persistAndRender() {
  saveState();
  render();
}

async function persistAndRenderAsync(collectionName = null, changedItem = null) {
  saveState();
  render();

  if (storageSettings.mode !== "sharepoint") return;

  try {
    if (collectionName && changedItem) {
      await upsertSharePointRecord(collectionName, changedItem);
    } else {
      await saveAllToSharePoint();
    }
  } catch (error) {
    showToast(`Saved locally, but SharePoint sync failed: ${error.message}`, true);
  }
}

function readStorageSettingsFromForm() {
  return {
    mode: els.storageMode.value,
    siteUrl: els.sharePointSiteUrl.value.trim().replace(/\/+$/, ""),
    connectorListName: els.connectorListName.value.trim() || defaultStorageSettings.connectorListName,
    usageListName: els.usageListName.value.trim() || defaultStorageSettings.usageListName,
    useCaseListName: els.useCaseListName.value.trim() || defaultStorageSettings.useCaseListName,
  };
}

function validateSharePointSettings() {
  if (storageSettings.mode !== "sharepoint") return;
  if (!storageSettings.siteUrl) {
    throw new Error("SharePoint site URL is required when SharePoint Lists mode is enabled.");
  }
}

async function saveStorageForm(event) {
  event.preventDefault();
  storageSettings = readStorageSettingsFromForm();
  sharePointDigest = null;
  saveStorageSettings();
  renderStorageSettings();
  showToast(
    storageSettings.mode === "sharepoint"
      ? "SharePoint Lists storage settings saved."
      : "Local browser storage selected.",
  );
}

async function loadFromSharePoint() {
  storageSettings = readStorageSettingsFromForm();
  saveStorageSettings();
  validateSharePointSettings();
  showToast("Loading SharePoint list data...");

  try {
    const [connectors, usageRecords, useCases] = await Promise.all([
      fetchSharePointCollection("connectors"),
      fetchSharePointCollection("usageRecords"),
      fetchSharePointCollection("useCases"),
    ]);
    state = { connectors, usageRecords, useCases };
    persistAndRender();
    showToast("Loaded dashboard data from SharePoint Lists.");
  } catch (error) {
    showToast(`SharePoint load failed: ${error.message}`, true);
  }
}

async function saveAllToSharePoint() {
  validateSharePointSettings();
  showToast("Saving dashboard data to SharePoint Lists...");

  await Promise.all([
    syncSharePointCollection("connectors", state.connectors),
    syncSharePointCollection("usageRecords", state.usageRecords),
    syncSharePointCollection("useCases", state.useCases),
  ]);
  showToast("Saved dashboard data to SharePoint Lists.");
}

async function syncSharePointCollection(collectionName, records) {
  const existing = await fetchSharePointListItems(collectionName);
  const existingByDashboardId = new Map(existing.map((item) => [item.DashboardId, item]));
  const desiredIds = new Set(records.map((record) => record.id));

  await Promise.all(records.map((record) => upsertSharePointRecord(collectionName, record, existingByDashboardId)));
  await Promise.all(
    existing
      .filter((item) => item.DashboardId && !desiredIds.has(item.DashboardId))
      .map((item) => deleteSharePointItem(collectionName, item.Id)),
  );
}

async function fetchSharePointCollection(collectionName) {
  const items = await fetchSharePointListItems(collectionName);
  return items
    .map((item) => parseJsonSafe(item.Payload))
    .filter(Boolean)
    .map((payload) => ({ ...payload, id: payload.id || crypto.randomUUID() }));
}

async function upsertSharePointRecord(collectionName, record, existingByDashboardId = null) {
  validateSharePointSettings();
  const existing =
    existingByDashboardId?.get(record.id) ||
    (await findSharePointItemByDashboardId(collectionName, record.id));
  const entityTypeName = await getSharePointListEntityType(collectionName);
  const payload = {
    __metadata: { type: entityTypeName },
    Title: sharePointTitleFor(record),
    DashboardId: record.id,
    Payload: JSON.stringify(record),
  };

  if (existing) {
    const headers = await sharePointWriteHeaders({
      "IF-MATCH": "*",
      "X-HTTP-Method": "MERGE",
    });
    await sharePointRequest(listItemUrl(collectionName, existing.Id), {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } else {
    await sharePointRequest(listItemsUrl(collectionName), {
      method: "POST",
      headers: await sharePointWriteHeaders(),
      body: JSON.stringify(payload),
    });
  }
}

async function deleteSharePointRecord(collectionName, dashboardId) {
  if (storageSettings.mode !== "sharepoint") return;
  validateSharePointSettings();
  const existing = await findSharePointItemByDashboardId(collectionName, dashboardId);
  if (!existing) return;
  await deleteSharePointItem(collectionName, existing.Id);
}

async function deleteSharePointItem(collectionName, itemId) {
  await sharePointRequest(listItemUrl(collectionName, itemId), {
    method: "POST",
    headers: await sharePointWriteHeaders({
      "IF-MATCH": "*",
      "X-HTTP-Method": "DELETE",
    }),
  });
}

async function findSharePointItemByDashboardId(collectionName, dashboardId) {
  const url = `${listItemsUrl(collectionName)}?$select=Id,DashboardId&$filter=DashboardId eq '${escapeODataString(
    dashboardId,
  )}'&$top=1`;
  const data = await sharePointRequest(url);
  return sharePointItems(data)[0] || null;
}

async function fetchSharePointListItems(collectionName) {
  const data = await sharePointRequest(
    `${listItemsUrl(collectionName)}?$select=Id,Title,DashboardId,Payload&$top=5000`,
  );
  return sharePointItems(data);
}

async function sharePointRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      Accept: "application/json;odata=verbose",
      "Content-Type": "application/json;odata=verbose",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`SharePoint returned HTTP ${response.status}`);
  }

  if (response.status === 204) return {};
  const data = await response.json();
  return data.d || data;
}

async function sharePointWriteHeaders(extraHeaders = {}) {
  return {
    "X-RequestDigest": await getSharePointDigest(),
    ...extraHeaders,
  };
}

async function getSharePointDigest() {
  if (sharePointDigest?.expiresAt > Date.now()) {
    return sharePointDigest.value;
  }

  const response = await fetch(`${storageSettings.siteUrl}/_api/contextinfo`, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json;odata=verbose",
      "Content-Type": "application/json;odata=verbose",
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to get SharePoint form digest: HTTP ${response.status}`);
  }

  const data = await response.json();
  const context = data.d?.GetContextWebInformation;
  sharePointDigest = {
    value: context?.FormDigestValue,
    expiresAt: Date.now() + Number(context?.FormDigestTimeoutSeconds || 1500) * 1000 - 60000,
  };
  if (!sharePointDigest.value) {
    throw new Error("SharePoint did not return a form digest value.");
  }
  return sharePointDigest.value;
}

async function getSharePointListEntityType(collectionName) {
  const cacheKey = `${storageSettings.siteUrl}|${listNameFor(collectionName)}`;
  if (sharePointEntityTypeCache.has(cacheKey)) {
    return sharePointEntityTypeCache.get(cacheKey);
  }

  const data = await sharePointRequest(
    `${listRootUrl(collectionName)}?$select=ListItemEntityTypeFullName`,
  );
  sharePointEntityTypeCache.set(cacheKey, data.ListItemEntityTypeFullName);
  return data.ListItemEntityTypeFullName;
}

function listItemsUrl(collectionName) {
  return `${listRootUrl(collectionName)}/items`;
}

function listRootUrl(collectionName) {
  return `${storageSettings.siteUrl}/_api/web/lists/getbytitle('${escapeODataString(
    listNameFor(collectionName),
  )}')`;
}

function listItemUrl(collectionName, itemId) {
  return `${listItemsUrl(collectionName)}(${itemId})`;
}

function listNameFor(collectionName) {
  return {
    connectors: storageSettings.connectorListName,
    usageRecords: storageSettings.usageListName,
    useCases: storageSettings.useCaseListName,
  }[collectionName];
}

function sharePointItems(data) {
  return data?.value || data?.results || [];
}

function sharePointTitleFor(record) {
  return String(record.title || record.name || record.model || record.provider || record.id).slice(0, 255);
}

function escapeODataString(value) {
  return String(value).replaceAll("'", "''");
}

function parseJsonSafe(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn("Skipping invalid SharePoint list payload", error);
    return null;
  }
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ai-roi-dashboard-export.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function importData(event) {
  const [file] = event.target.files;
  if (!file) return;

  try {
    const payload = JSON.parse(await file.text());
    state = {
      connectors: Array.isArray(payload.connectors) ? payload.connectors : state.connectors,
      usageRecords: Array.isArray(payload.usageRecords) ? payload.usageRecords : state.usageRecords,
      useCases: Array.isArray(payload.useCases) ? payload.useCases : state.useCases,
    };
    persistAndRender();
    showToast("Import complete.");
  } catch (error) {
    showToast(`Import failed: ${error.message}`, true);
  } finally {
    event.target.value = "";
  }
}

function resetDemoData() {
  state = structuredClone(demoState);
  persistAndRender();
  showToast("Demo data restored.");
}

function showToast(message, isError = false) {
  els.toast.textContent = message;
  els.toast.className = isError ? "toast error" : "toast";
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.textContent = "";
    els.toast.className = "";
  }, 4500);
}

document.addEventListener("click", (event) => {
  const closeButton = event.target.closest("[data-close-dialog]");
  if (closeButton) closeDialog(closeButton.closest("dialog"));

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;

  const { action, id } = actionButton.dataset;
  if (action === "sync-connector") syncConnector(id);
  if (action === "edit-connector") openConnectorForm(state.connectors.find((item) => item.id === id));
  if (action === "delete-connector") {
    state.connectors = state.connectors.filter((item) => item.id !== id);
    persistAndRenderAsync().then(() => deleteSharePointRecord("connectors", id));
  }
  if (action === "delete-usage") {
    state.usageRecords = state.usageRecords.filter((item) => item.id !== id);
    persistAndRenderAsync().then(() => deleteSharePointRecord("usageRecords", id));
  }
  if (action === "edit-use-case") openUseCaseForm(state.useCases.find((item) => item.id === id));
  if (action === "delete-use-case") {
    state.useCases = state.useCases.filter((item) => item.id !== id);
    persistAndRenderAsync().then(() => deleteSharePointRecord("useCases", id));
  }
});

$("#addConnectorButton").addEventListener("click", () => openConnectorForm());
$("#addUsageButton").addEventListener("click", () => openUsageForm());
$("#addUseCaseButton").addEventListener("click", () => openUseCaseForm());
$("#openAdminButton").addEventListener("click", () => openDialog(els.adminDialog));
$("#exportDataButton").addEventListener("click", exportData);
$("#importDataInput").addEventListener("change", importData);
$("#resetDemoButton").addEventListener("click", resetDemoData);
els.storageForm.addEventListener("submit", saveStorageForm);
$("#loadSharePointButton").addEventListener("click", loadFromSharePoint);
$("#saveSharePointButton").addEventListener("click", () => {
  storageSettings = readStorageSettingsFromForm();
  saveStorageSettings();
  saveAllToSharePoint().catch((error) => showToast(`SharePoint save failed: ${error.message}`, true));
});

$("#connectorProvider").addEventListener("change", (event) => {
  setField("connectorUsagePath", defaultUsagePath(event.target.value));
  setField("connectorAuthType", defaultAuthType(event.target.value));
});

els.connectorForm.addEventListener("submit", upsertConnector);
els.usageForm.addEventListener("submit", upsertUsage);
els.useCaseForm.addEventListener("submit", upsertUseCase);

els.searchFilter.addEventListener("input", (event) => {
  filters.search = event.target.value;
  renderUseCases();
});
els.categoryFilter.addEventListener("change", (event) => {
  filters.category = event.target.value;
  renderUseCases();
});
els.tagFilter.addEventListener("change", (event) => {
  filters.tag = event.target.value;
  renderUseCases();
});

render();
