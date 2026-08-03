(function () {
  "use strict";

  const ACRONYMS = { mk: "Mk", em: "EM", sr: "SR" };
  const ROMAN = { i: "I", ii: "II", iii: "III" };
  const NAME_OVERRIDES = { "re-composing-assembler": "Re-Composing Assembler" };
  const CATEGORY_LABEL = {
    assembling: "Assembling",
    smelting: "Smelting",
    lab: "Research",
    refining: "Refining",
    chemical: "Chemical",
    fractionating: "Fractionating",
    colliding: "Particle Collision",
    assembler: "Construction"
  };

  let items = [];
  let buildings = [];
  let recipes = [];
  let craftingTables = {};
  let belts = {};
  let descriptions = {};

  let itemSet, buildingSet;
  let recipesByResult = new Map(); // id -> [recipe,...]
  let usedIn = new Map(); // id -> Set of result ids that consume it
  let buildingsByCategory = new Map(); // building id -> category (assembling/smelting/etc)

  let currentTab = "items";
  let currentFilter = "all";
  let searchTerm = "";
  let selected = null; // { kind: 'item'|'building', id }

  function displayName(id) {
    if (NAME_OVERRIDES[id]) return NAME_OVERRIDES[id];
    const words = id.split("-");
    const out = [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (w === "mk" && ROMAN[words[i + 1]]) {
        out.push("Mk." + ROMAN[words[i + 1]]);
        i++;
      } else if (ACRONYMS[w]) {
        out.push(ACRONYMS[w]);
      } else {
        out.push(w.charAt(0).toUpperCase() + w.slice(1));
      }
    }
    return out.join(" ");
  }

  function iconPath(id, kind) {
    return kind === "building" ? `assets/buildings/${id}.png` : `assets/items/${id}.png`;
  }

  function kindOf(id) {
    if (itemSet.has(id)) return "item";
    if (buildingSet.has(id)) return "building";
    return null;
  }

  async function loadJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.json();
  }

  async function init() {
    [items, buildings, recipes, craftingTables, belts, descriptions] = await Promise.all([
      loadJSON("items.json"),
      loadJSON("buildings.json"),
      loadJSON("recipes.json"),
      loadJSON("crafting-tables.json"),
      loadJSON("belts.json"),
      loadJSON("descriptions.json")
    ]);

    itemSet = new Set(items);
    buildingSet = new Set(buildings);

    for (const category in craftingTables) {
      for (const buildingId in craftingTables[category]) {
        buildingsByCategory.set(buildingId, category);
      }
    }

    for (const recipe of recipes) {
      for (const resultId in recipe.result) {
        if (!recipesByResult.has(resultId)) recipesByResult.set(resultId, []);
        recipesByResult.get(resultId).push(recipe);
      }
      for (const ingredientId in recipe.recipe) {
        if (!usedIn.has(ingredientId)) usedIn.set(ingredientId, new Set());
        for (const resultId in recipe.result) {
          usedIn.get(ingredientId).add(resultId);
        }
      }
    }

    bindUI();
    renderList();
  }

  function bindUI() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentTab = btn.dataset.tab;
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
        document.getElementById("item-filters").classList.toggle("hidden", currentTab !== "items");
        renderList();
      });
    });

    document.querySelectorAll(".filter-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentFilter = btn.dataset.filter;
        document.querySelectorAll(".filter-chip").forEach((b) => b.classList.toggle("active", b === btn));
        renderList();
      });
    });

    document.getElementById("search").addEventListener("input", (e) => {
      searchTerm = e.target.value.trim().toLowerCase();
      renderList();
    });
  }

  function isRaw(itemId) {
    return !recipesByResult.has(itemId);
  }

  function renderList() {
    const container = document.getElementById("entity-list");
    container.innerHTML = "";

    let ids = currentTab === "items" ? items.slice() : buildings.slice();

    if (currentTab === "items" && currentFilter !== "all") {
      ids = ids.filter((id) => (currentFilter === "raw" ? isRaw(id) : !isRaw(id)));
    }

    if (searchTerm) {
      ids = ids.filter((id) => displayName(id).toLowerCase().includes(searchTerm) || id.includes(searchTerm));
    }

    ids.sort((a, b) => displayName(a).localeCompare(displayName(b)));

    if (ids.length === 0) {
      const empty = document.createElement("div");
      empty.className = "list-empty";
      empty.textContent = "No matches.";
      container.appendChild(empty);
      return;
    }

    const kind = currentTab === "items" ? "item" : "building";

    for (const id of ids) {
      const row = document.createElement("div");
      row.className = "list-row";
      if (selected && selected.kind === kind && selected.id === id) row.classList.add("selected");

      const img = document.createElement("img");
      img.src = iconPath(id, kind);
      img.alt = "";

      const name = document.createElement("span");
      name.className = "name";
      name.textContent = displayName(id);

      row.appendChild(img);
      row.appendChild(name);

      if (kind === "item") {
        const dot = document.createElement("span");
        dot.className = "dot " + (isRaw(id) ? "raw" : "crafted");
        row.appendChild(dot);
      }

      row.addEventListener("click", () => selectEntity(kind, id));
      container.appendChild(row);
    }
  }

  function selectEntity(kind, id) {
    selected = { kind, id };

    // keep sidebar in sync with what's being viewed
    const targetTab = kind === "item" ? "items" : "buildings";
    if (targetTab !== currentTab) {
      currentTab = targetTab;
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === currentTab));
      document.getElementById("item-filters").classList.toggle("hidden", currentTab !== "items");
    }
    renderList();
    renderDetail();
  }

  function chip(id, qty) {
    const kind = kindOf(id);
    const el = document.createElement("div");
    el.className = "item-chip";
    const qtyNum = qty !== undefined ? `<span class="qty-num">${qty}</span>` : "";
    el.innerHTML = `${qtyNum}<img src="${iconPath(id, kind)}" alt=""><span>${displayName(id)}</span>`;
    el.addEventListener("click", () => selectEntity(kind, id));
    return el;
  }

  function machineChip(buildingId) {
    const el = document.createElement("div");
    el.className = "machine-chip";
    el.innerHTML = `<img src="${iconPath(buildingId, "building")}" alt=""><span>${displayName(buildingId)}</span>`;
    el.addEventListener("click", () => selectEntity("building", buildingId));
    return el;
  }

  function buildFlowRow(ids, resultObj) {
    const row = document.createElement("div");
    row.className = "flow-group";
    for (const id of ids) {
      row.appendChild(chip(id, resultObj[id]));
    }
    return row;
  }

  function renderRecipeCard(recipe) {
    const card = document.createElement("div");
    card.className = "recipe-card";

    const meta = document.createElement("div");
    meta.className = "recipe-meta";

    const madeInEl = document.createElement("div");
    madeInEl.className = "made-in-row";

    const label = document.createElement("span");
    label.innerHTML = "<b>Made in:</b>";
    madeInEl.appendChild(label);
    const machines = document.createElement("div");
    machines.className = "machine-list";
    const table = craftingTables[recipe.type] || {};
    for (const buildingId in table) {
      machines.appendChild(machineChip(buildingId));
    }
    madeInEl.appendChild(machines);
    meta.appendChild(madeInEl);

    const timeEl = document.createElement("div");
    timeEl.className = "recipe-time";
    if (recipe.chance !== undefined) {
      const pct = recipe.chance * 100;
      const pctDisplay = Number.isInteger(pct) ? pct : parseFloat(pct.toFixed(2));
      timeEl.innerHTML = `<span class="meta-icon">🎲</span>${pctDisplay}%`;
    } else {
      const displayTime = recipe.time >= 100000 ? "unknown" : `${recipe.time}s`;
      timeEl.innerHTML = `<span class="meta-icon">⏱</span>${displayTime}`;
    }
    meta.appendChild(timeEl);

    card.appendChild(meta);

    const flow = document.createElement("div");
    flow.className = "flow-row";
    flow.appendChild(buildFlowRow(Object.keys(recipe.recipe), recipe.recipe));
    const arrow = document.createElement("span");
    arrow.className = "flow-arrow";
    arrow.textContent = "→";
    flow.appendChild(arrow);
    flow.appendChild(buildFlowRow(Object.keys(recipe.result), recipe.result));
    card.appendChild(flow);

    return card;
  }

  function renderDescription(id, detail) {
    const desc = descriptions[id];
    if (!desc) return;
    const box = document.createElement("div");
    box.className = "description-text";
    box.textContent = desc;
    detail.appendChild(box);
  }

  function renderItemDetail(id) {
    const detail = document.getElementById("detail");
    const raw = isRaw(id);

    const header = document.createElement("div");
    header.className = "detail-header";
    header.innerHTML = `
      <img src="${iconPath(id, "item")}" alt="">
      <div>
        <h2>${displayName(id)}</h2>
        <span class="badge ${raw ? "raw" : "crafted"}">${raw ? "Raw Material" : "Crafted Item"}</span>
      </div>
    `;
    detail.appendChild(header);
    renderDescription(id, detail);

    const recipeTitle = document.createElement("div");
    recipeTitle.className = "section-title";
    recipeTitle.textContent = raw ? "Source" : `Recipe${(recipesByResult.get(id) || []).length > 1 ? "s" : ""}`;
    detail.appendChild(recipeTitle);

    if (raw) {
      const note = document.createElement("div");
      note.className = "no-data";
      note.textContent = "Gathered directly (mining, pumping, or collecting) — no production recipe.";
      detail.appendChild(note);
    } else {
      for (const recipe of recipesByResult.get(id)) {
        detail.appendChild(renderRecipeCard(recipe));
      }
    }

    const usedTitle = document.createElement("div");
    usedTitle.className = "section-title";
    usedTitle.textContent = "Used In";
    detail.appendChild(usedTitle);

    const consumers = usedIn.get(id);
    if (!consumers || consumers.size === 0) {
      const note = document.createElement("div");
      note.className = "no-data";
      note.textContent = "Not used as an ingredient in any known recipe.";
      detail.appendChild(note);
    } else {
      const list = document.createElement("div");
      list.className = "used-in-list";
      [...consumers]
        .sort((a, b) => displayName(a).localeCompare(displayName(b)))
        .forEach((consumerId) => list.appendChild(chip(consumerId)));
      detail.appendChild(list);
    }
  }

  function renderBuildingDetail(id) {
    const detail = document.getElementById("detail");

    const header = document.createElement("div");
    header.className = "detail-header";
    header.innerHTML = `
      <img src="${iconPath(id, "building")}" alt="">
      <div>
        <h2>${displayName(id)}</h2>
        <span class="badge building">Building</span>
      </div>
    `;
    detail.appendChild(header);
    renderDescription(id, detail);

    const category = buildingsByCategory.get(id);
    if (category) {
      const speedTitle = document.createElement("div");
      speedTitle.className = "section-title";
      speedTitle.textContent = "Production Speed";
      detail.appendChild(speedTitle);

      const box = document.createElement("div");
      box.className = "throughput-box";
      box.innerHTML = `<b>${CATEGORY_LABEL[category] || category}</b> speed multiplier: <b>${craftingTables[category][id]}&times;</b>`;
      detail.appendChild(box);
    }

    if (belts[id] !== undefined) {
      const beltTitle = document.createElement("div");
      beltTitle.className = "section-title";
      beltTitle.textContent = "Throughput";
      detail.appendChild(beltTitle);

      const box = document.createElement("div");
      box.className = "throughput-box";
      box.innerHTML = `<b>${belts[id]}</b> items/sec (<b>${belts[id] * 60}</b> items/min) max belt capacity`;
      detail.appendChild(box);
    }

    const recipeTitle = document.createElement("div");
    recipeTitle.className = "section-title";
    recipeTitle.textContent = "Construction Cost";
    detail.appendChild(recipeTitle);

    const constructionRecipes = recipesByResult.get(id) || [];
    if (constructionRecipes.length === 0) {
      const note = document.createElement("div");
      note.className = "no-data";
      note.textContent = "No construction recipe recorded.";
      detail.appendChild(note);
    } else {
      for (const recipe of constructionRecipes) {
        detail.appendChild(renderRecipeCard(recipe));
      }
    }

    const usedTitle = document.createElement("div");
    usedTitle.className = "section-title";
    usedTitle.textContent = "Used In";
    detail.appendChild(usedTitle);

    const consumers = usedIn.get(id);
    if (!consumers || consumers.size === 0) {
      const note = document.createElement("div");
      note.className = "no-data";
      note.textContent = "Not used as an ingredient in any known recipe.";
      detail.appendChild(note);
    } else {
      const list = document.createElement("div");
      list.className = "used-in-list";
      [...consumers]
        .sort((a, b) => displayName(a).localeCompare(displayName(b)))
        .forEach((consumerId) => list.appendChild(chip(consumerId)));
      detail.appendChild(list);
    }
  }

  function renderDetail() {
    const detail = document.getElementById("detail");
    detail.innerHTML = "";
    if (!selected) return;
    if (selected.kind === "item") renderItemDetail(selected.id);
    else renderBuildingDetail(selected.id);
  }

  init().catch((err) => {
    document.getElementById("detail").innerHTML =
      `<div class="empty-state">Failed to load data: ${err.message}. If you opened this file directly, serve it over a local web server instead (fetch of local JSON is blocked from file://).</div>`;
    console.error(err);
  });
})();
