const symbolEl = document.getElementById("symbol");
const stateEl = document.getElementById("position_state");
const heldFields = document.getElementById("held-fields");
const card = document.getElementById("card");
const errorEl = document.getElementById("error");

stateEl.addEventListener("change", () => {
  heldFields.classList.toggle("hidden", stateEl.value !== "HELD");
});

async function loadUniverse() {
  const res = await fetch("/api/universe");
  const data = await res.json();
  for (const s of data.securities) {
    const opt = document.createElement("option");
    opt.value = s.nse_symbol;
    opt.textContent = `${s.nse_symbol} — ${s.name}`;
    symbolEl.appendChild(opt);
  }
}

function renderCard(data) {
  const d = data.decision;
  const a = data.assessment;
  const e = data.evidence;
  const p = data.position_display;
  const c = data.context;

  card.innerHTML = `
    <h2>${data.security.nse_symbol}</h2>
    <p class="muted">${data.security.name}</p>
    <div class="row">
      <span class="pill disabled">ACTION / DECISION: ${d.state}</span>
      <span class="pill">${d.reason}</span>
      <span class="pill">CONFIDENCE: ${data.confidence.state}</span>
    </div>
    <p><strong>Horizon:</strong> ${data.horizon}</p>
    <p><strong>as_of:</strong> ${c.as_of} · <strong>data_version:</strong> ${c.data_version}</p>
    <p><strong>Evidence status:</strong> ${e.status} · <strong>Sufficiency:</strong> ${a.sufficiency}</p>
    <p><strong>Tape window:</strong> ${a.tape_window} · <strong>Event timing:</strong> ${a.event_timing}</p>
    <h3>Position</h3>
    <pre>${JSON.stringify(p, null, 2)}</pre>
    <h3>Why</h3>
    <ul>${a.why.map((x) => `<li>${x}</li>`).join("")}</ul>
    <h3>What would change assessment</h3>
    <ul>${a.what_would_change_assessment.map((x) => `<li>${x}</li>`).join("")}</ul>
    <h3>Nifty 50 price-index comparison</h3>
    <pre>${JSON.stringify(a.nifty50_price_index_comparison, null, 2)}</pre>
    <p class="muted">This UI renders API JSON only. It does not invent trading verbs.</p>
  `;
  card.classList.remove("hidden");
}

document.getElementById("assess-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  errorEl.classList.add("hidden");
  card.classList.add("hidden");
  const position = { state: stateEl.value };
  if (position.state === "HELD") {
    position.quantity = Number(document.getElementById("quantity").value || 0);
    position.average_entry_price = Number(
      document.getElementById("average_entry_price").value || 0,
    );
    position.entry_date = document.getElementById("entry_date").value || undefined;
  }
  const as_of = document.getElementById("as_of").value.trim() || undefined;
  const res = await fetch("/api/assess", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol: symbolEl.value, as_of, position }),
  });
  const data = await res.json();
  if (!res.ok) {
    errorEl.textContent = data.error || JSON.stringify(data);
    errorEl.classList.remove("hidden");
    return;
  }
  renderCard(data);
});

loadUniverse();
