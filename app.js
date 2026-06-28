const API = {
  released: "https://pogoapi.net/api/v1/released_pokemon.json",
  evolutions: "https://pogoapi.net/api/v1/pokemon_evolutions.json",
  frenchNames: "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv"
};

const SPRITE = id =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

const GENERATIONS = [
  [1, 151], [152, 251], [252, 386], [387, 493], [494, 649],
  [650, 721], [722, 809], [810, 905], [906, 1025]
];
const REGION_NAMES = ["Kanto", "Johto", "Hoenn", "Sinnoh", "Unys", "Kalos", "Alola", "Galar", "Paldea"];

const FALLBACK = [
  { pokemon_id: 1, pokemon_name: "Bulbasaur", form: "Normal", evolutions: [{ pokemon_id: 2, pokemon_name: "Ivysaur", candy_required: 25 }] },
  { pokemon_id: 2, pokemon_name: "Ivysaur", form: "Normal", evolutions: [{ pokemon_id: 3, pokemon_name: "Venusaur", candy_required: 100 }] },
  { pokemon_id: 4, pokemon_name: "Charmander", form: "Normal", evolutions: [{ pokemon_id: 5, pokemon_name: "Charmeleon", candy_required: 25 }] },
  { pokemon_id: 5, pokemon_name: "Charmeleon", form: "Normal", evolutions: [{ pokemon_id: 6, pokemon_name: "Charizard", candy_required: 100 }] },
  { pokemon_id: 7, pokemon_name: "Squirtle", form: "Normal", evolutions: [{ pokemon_id: 8, pokemon_name: "Wartortle", candy_required: 25 }] },
  { pokemon_id: 8, pokemon_name: "Wartortle", form: "Normal", evolutions: [{ pokemon_id: 9, pokemon_name: "Blastoise", candy_required: 100 }] },
  { pokemon_id: 10, pokemon_name: "Caterpie", form: "Normal", evolutions: [{ pokemon_id: 11, pokemon_name: "Metapod", candy_required: 12 }] },
  { pokemon_id: 11, pokemon_name: "Metapod", form: "Normal", evolutions: [{ pokemon_id: 12, pokemon_name: "Butterfree", candy_required: 50 }] },
  { pokemon_id: 25, pokemon_name: "Pikachu", form: "Normal", evolutions: [{ pokemon_id: 26, pokemon_name: "Raichu", candy_required: 50 }] },
  { pokemon_id: 129, pokemon_name: "Magikarp", form: "Normal", evolutions: [{ pokemon_id: 130, pokemon_name: "Gyarados", candy_required: 400 }] },
  { pokemon_id: 133, pokemon_name: "Eevee", form: "Normal", evolutions: [
    { pokemon_id: 134, pokemon_name: "Vaporeon", candy_required: 25 },
    { pokemon_id: 135, pokemon_name: "Jolteon", candy_required: 25 },
    { pokemon_id: 136, pokemon_name: "Flareon", candy_required: 25 }
  ] }
];

const state = {
  pokemon: [],
  evolutions: new Map(),
  familyById: new Map(),
  collection: JSON.parse(localStorage.getItem("pokedex-go-collection") || "{}"),
  candies: JSON.parse(localStorage.getItem("pokedex-go-candies") || "{}"),
  filter: "all",
  generation: "all",
  query: "",
  view: "pokedex"
};

const $ = selector => document.querySelector(selector);
const grid = $("#pokemonGrid");
const template = $("#pokemonCardTemplate");

function pokemonKey(p) {
  return `${p.id}-${p.form || "Normal"}`;
}

function generationFor(id) {
  const index = GENERATIONS.findIndex(([min, max]) => id >= min && id <= max);
  return index + 1;
}

function normalizeReleased(data) {
  const rows = Array.isArray(data) ? data : Object.values(data || {});
  return rows.map((p, index) => ({
    id: Number(p.id ?? p.pokemon_id ?? index + 1),
    name: p.name ?? p.pokemon_name ?? `Pokémon ${index + 1}`,
    form: p.form || "Normal"
  })).filter(p => p.id > 0 && p.id <= 1025);
}

function parseFrenchNames(csv) {
  const names = new Map();
  csv.split(/\r?\n/).slice(1).forEach(line => {
    const columns = [];
    let value = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"') {
        value += '"';
        i++;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        columns.push(value);
        value = "";
      } else {
        value += char;
      }
    }
    columns.push(value);
    if (Number(columns[1]) === 5) names.set(Number(columns[0]), columns[2]);
  });
  return names;
}

function buildCatalog(released, evolutionRows, frenchNames = new Map()) {
  const byId = new Map();
  const releasedPokemon = normalizeReleased(released);
  const hasReleasedCatalog = releasedPokemon.length > 0;
  releasedPokemon.forEach(p => {
    p.englishName = p.name;
    p.name = frenchNames.get(p.id) || p.name;
    const existing = byId.get(p.id);
    if (!existing || p.form === "Normal") byId.set(p.id, p);
  });

  evolutionRows.forEach(row => {
    if (!hasReleasedCatalog && !byId.has(row.pokemon_id)) {
      byId.set(row.pokemon_id, {
        id: row.pokemon_id,
        name: frenchNames.get(row.pokemon_id) || row.pokemon_name,
        englishName: row.pokemon_name,
        form: row.form || "Normal"
      });
    }
    (row.evolutions || []).forEach(evo => {
      if (!hasReleasedCatalog && !byId.has(evo.pokemon_id)) {
        byId.set(evo.pokemon_id, {
          id: evo.pokemon_id,
          name: frenchNames.get(evo.pokemon_id) || evo.pokemon_name,
          englishName: evo.pokemon_name,
          form: evo.form || "Normal"
        });
      }
    });
  });

  state.pokemon = [...byId.values()].sort((a, b) => a.id - b.id);
  state.evolutions = new Map();
  evolutionRows.forEach(row => {
    if (!byId.has(row.pokemon_id)) return;
    const current = state.evolutions.get(row.pokemon_id) || [];
    const available = (row.evolutions || [])
      .filter(evo => byId.has(evo.pokemon_id))
      .map(evo => ({
        ...evo,
        englishName: evo.pokemon_name,
        pokemon_name: frenchNames.get(evo.pokemon_id) || evo.pokemon_name
      }));
    state.evolutions.set(row.pokemon_id, [...current, ...available]);
  });
  buildFamilies(evolutionRows);
}

function buildFamilies(rows) {
  const graph = new Map();
  const connect = (a, b) => {
    if (!graph.has(a)) graph.set(a, new Set());
    if (!graph.has(b)) graph.set(b, new Set());
    graph.get(a).add(b);
    graph.get(b).add(a);
  };
  rows.forEach(row => (row.evolutions || []).forEach(e => connect(row.pokemon_id, e.pokemon_id)));

  state.familyById.clear();
  state.pokemon.forEach(p => {
    if (state.familyById.has(p.id)) return;
    const component = [];
    const queue = [p.id];
    const seen = new Set();
    while (queue.length) {
      const id = queue.shift();
      if (seen.has(id)) continue;
      seen.add(id);
      component.push(id);
      (graph.get(id) || []).forEach(next => queue.push(next));
    }
    const family = Math.min(...component);
    component.forEach(id => state.familyById.set(id, family));
  });
}

function familyKey(id) {
  return String(state.familyById.get(id) || id);
}

function searchable(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function save() {
  localStorage.setItem("pokedex-go-collection", JSON.stringify(state.collection));
  localStorage.setItem("pokedex-go-candies", JSON.stringify(state.candies));
}

function backupPayload() {
  return {
    app: "pokemon-go-helper",
    version: 1,
    exportedAt: new Date().toISOString(),
    collection: state.collection,
    candies: state.candies
  };
}

function setBackupStatus(message, type = "") {
  const status = $("#backupStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("success", type === "success");
  status.classList.toggle("error", type === "error");
}

function exportData() {
  const payload = JSON.stringify(backupPayload(), null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pokemon-go-helper-${date}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setBackupStatus("Sauvegarde exportée. Garde bien ce fichier, c’est ton petit coffre à Poké-bonbons.", "success");
}

function sanitizeNumberMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, number]) => [
    String(key),
    Math.max(0, Math.min(99999, Number(number) || 0))
  ]));
}

function sanitizeCollection(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, record]) => {
    const quantity = Math.max(0, Math.min(9999, Number(record?.quantity) || 0));
    const owned = Boolean(record?.owned) || quantity > 0;
    return [String(key), { owned, quantity: owned && quantity === 0 ? 1 : quantity }];
  }));
}

async function importData(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data !== "object" || (!data.collection && !data.candies)) {
      throw new Error("Format invalide");
    }
    if (!confirm("Charger cette sauvegarde va remplacer ta collection et tes bonbons actuels. Continuer ?")) {
      setBackupStatus("Chargement annulé.");
      return;
    }
    state.collection = sanitizeCollection(data.collection);
    state.candies = sanitizeNumberMap(data.candies);
    save();
    render();
    const owned = Object.values(state.collection).filter(record => record.owned).length;
    const candyFamilies = Object.keys(state.candies).length;
    setBackupStatus(`Sauvegarde chargée : ${owned} Pokémon possédés et ${candyFamilies} familles de bonbons.`, "success");
  } catch (error) {
    setBackupStatus("Impossible de charger ce fichier. Vérifie que c’est bien une sauvegarde JSON de l’app.", "error");
  }
}

function getRecord(p) {
  return state.collection[pokemonKey(p)] || { owned: false, quantity: 0 };
}

function hasEnoughCandy(p) {
  const candy = Number(state.candies[familyKey(p.id)] || 0);
  return (state.evolutions.get(p.id) || []).some(e => candy >= Number(e.candy_required || 0));
}

function filteredPokemon() {
  const query = searchable(state.query.trim());
  return state.pokemon.filter(p => {
    const record = getRecord(p);
    const matchesQuery = !query ||
      searchable(p.name).includes(query) ||
      searchable(p.englishName).includes(query) ||
      String(p.id).includes(query);
    const matchesGeneration = state.generation === "all" || generationFor(p.id) === Number(state.generation);
    const matchesFilter =
      state.filter === "all" ||
      (state.filter === "owned" && record.owned) ||
      (state.filter === "missing" && !record.owned) ||
      (state.filter === "ready" && record.owned && hasEnoughCandy(p) && (state.evolutions.get(p.id) || []).length);
    return matchesQuery && matchesGeneration && matchesFilter;
  });
}

function conditionText(evo) {
  const conditions = [];
  if (evo.item_required) conditions.push(evo.item_required);
  if (evo.lure_required) conditions.push(evo.lure_required);
  if (evo.no_candy_cost_if_traded) conditions.push("0 bonbon après échange");
  if (evo.buddy_distance_required) conditions.push(`${evo.buddy_distance_required} km en copain`);
  if (evo.gender_required) conditions.push(`genre : ${evo.gender_required}`);
  return conditions.join(" · ");
}

function updateProgress() {
  const owned = state.pokemon.filter(p => getRecord(p).owned).length;
  const total = state.pokemon.length;
  const percent = total ? Math.round(owned / total * 100) : 0;
  $("#progressLabel").textContent = `${owned} / ${total}`;
  $("#progressPercent").textContent = `${percent} % de la collection`;
  $("#progressBar").style.width = `${percent}%`;
}

function evolutionCompletionCost(id, available = false, visited = new Set()) {
  if (visited.has(id)) return 0;
  const nextVisited = new Set(visited);
  nextVisited.add(id);
  const canEvolve = available || isOwnedById(id);
  const evolutions = dedupeEvolutions(state.evolutions.get(id) || []);

  return evolutions.reduce((total, evo) => {
    const childOwned = isOwnedById(evo.pokemon_id);
    if (childOwned) {
      return total + evolutionCompletionCost(evo.pokemon_id, true, nextVisited);
    }
    if (canEvolve) {
      return total +
        Number(evo.candy_required || 0) +
        evolutionCompletionCost(evo.pokemon_id, true, nextVisited);
    }
    return total + evolutionCompletionCost(evo.pokemon_id, false, nextVisited);
  }, 0);
}

function candyShoppingList() {
  const families = new Map();
  state.pokemon.forEach(pokemon => {
    const key = familyKey(pokemon.id);
    if (!families.has(key)) families.set(key, []);
    families.get(key).push(pokemon);
  });

  return [...families.entries()].map(([key, members]) => {
    if (!members.some(pokemon => isOwnedById(pokemon.id))) return null;
    const roots = familyRoots(members[0].id);
    const required = roots.reduce(
      (total, rootId) => total + evolutionCompletionCost(rootId),
      0
    );
    const current = Number(state.candies[key] || 0);
    const missing = Math.max(0, required - current);
    const root = pokemonById(Number(key)) || members[0];
    return { key, root, required, current, missing };
  }).filter(item => item && item.required > 0 && item.missing > 0)
    .sort((a, b) => b.missing - a.missing || a.root.id - b.root.id);
}

function renderDashboard() {
  const regionStats = $("#regionStats");
  regionStats.innerHTML = REGION_NAMES.map((name, index) => {
    const generation = index + 1;
    const pokemon = state.pokemon.filter(p => generationFor(p.id) === generation);
    const owned = pokemon.filter(p => getRecord(p).owned).length;
    const total = pokemon.length;
    const percent = total ? Math.round(owned / total * 100) : 0;
    return `
      <button class="region-stat ${owned === total && total ? "complete" : ""}" data-generation="${generation}" type="button">
        <span class="region-stat-top">
          <strong>${name}</strong>
          <span>${owned} / ${total}</span>
        </span>
        <span class="mini-progress"><span style="width:${percent}%"></span></span>
      </button>`;
  }).join("");
  $("#regionTotal").textContent = `${REGION_NAMES.length} régions`;

  const needs = candyShoppingList();
  const totalMissing = needs.reduce((total, item) => total + item.missing, 0);
  $("#candyFamiliesCount").textContent = needs.length
    ? `${needs.length} famille${needs.length > 1 ? "s" : ""} · ${totalMissing} 🍬`
    : "Liste complète";

  const needsByRegion = new Map();
  needs.forEach(item => {
    const generation = generationFor(item.root.id);
    if (!needsByRegion.has(generation)) needsByRegion.set(generation, []);
    needsByRegion.get(generation).push(item);
  });

  $("#candyNeeds").innerHTML = needs.length
    ? [...needsByRegion.entries()].sort(([a], [b]) => a - b).map(([generation, items]) => {
      const regionMissing = items.reduce((total, item) => total + item.missing, 0);
      return `
        <section class="candy-region">
          <header class="candy-region-heading">
            <h3>${REGION_NAMES[generation - 1]}</h3>
            <span>${items.length} famille${items.length > 1 ? "s" : ""} · ${regionMissing} bonbons manquants</span>
          </header>
          <div class="candy-region-list">
            ${items.map(item => `
              <button class="candy-need" data-pokemon-id="${item.root.id}" type="button">
                <img src="${SPRITE(item.root.id)}" alt="">
                <span>
                  <strong>Bonbons ${escapeHtml(item.root.name)}</strong>
                  <small>${item.current} disponibles · ${item.required} nécessaires</small>
                </span>
                <span class="candy-missing">+${item.missing} 🍬</span>
              </button>
            `).join("")}
          </div>
        </section>`;
    }).join("")
    : `
    <div class="dashboard-empty">
      Tu as déjà assez de bonbons pour toutes les familles suivies.<br>
      Coche d’autres Pokémon possédés pour ajouter leurs évolutions à la liste.
    </div>`;
}

function render() {
  const list = filteredPokemon();
  grid.replaceChildren();
  const fragment = document.createDocumentFragment();
  list.forEach(p => fragment.appendChild(createCard(p)));
  grid.appendChild(fragment);
  $("#resultCount").textContent = `${list.length} Pokémon affiché${list.length > 1 ? "s" : ""}`;
  $("#emptyState").hidden = state.view !== "pokedex" || list.length !== 0;
  updateProgress();
  renderDashboard();
}

function createCard(p) {
  const card = template.content.firstElementChild.cloneNode(true);
  const record = getRecord(p);
  const evolutions = dedupeEvolutions(state.evolutions.get(p.id) || []);
  const candyKey = familyKey(p.id);

  card.dataset.key = pokemonKey(p);
  card.classList.toggle("is-owned", record.owned);
  card.querySelector(".dex-number").textContent = `#${String(p.id).padStart(4, "0")}`;
  card.querySelector(".pokemon-name").textContent = p.name;
  card.querySelector(".form-name").textContent = p.form && p.form !== "Normal" ? `Forme ${p.form}` : "";
  const image = card.querySelector(".sprite");
  image.src = SPRITE(p.id);
  image.alt = p.name;
  image.onerror = () => { image.src = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png"; };

  const ownedToggle = card.querySelector(".owned-toggle");
  const quantity = card.querySelector(".quantity");
  const candy = card.querySelector(".candy");
  ownedToggle.checked = record.owned;
  quantity.value = record.quantity || 0;
  candy.value = state.candies[candyKey] || 0;

  ownedToggle.addEventListener("change", () => {
    const current = getRecord(p);
    state.collection[pokemonKey(p)] = {
      owned: ownedToggle.checked,
      quantity: ownedToggle.checked && !current.quantity ? 1 : current.quantity
    };
    save();
    render();
  });

  const setQuantity = value => {
    const next = Math.max(0, Math.min(9999, Number(value) || 0));
    state.collection[pokemonKey(p)] = { owned: next > 0, quantity: next };
    save();
    render();
  };
  quantity.addEventListener("change", () => setQuantity(quantity.value));
  card.querySelector(".minus").addEventListener("click", () => setQuantity(Number(quantity.value) - 1));
  card.querySelector(".plus").addEventListener("click", () => setQuantity(Number(quantity.value) + 1));
  const preview = card.querySelector(".evolution-preview");
  if (!evolutions.length) {
    preview.innerHTML = `<p class="final-form">Forme finale</p>`;
  } else {
    const candyCount = Number(state.candies[candyKey] || 0);
    preview.innerHTML = evolutions.slice(0, 2).map(e => {
      const ready = candyCount >= Number(e.candy_required || 0);
      return `<div class="evo-pill ${ready ? "ready" : "blocked"}" data-cost="${e.candy_required || 0}">
        <span class="evo-name">→ ${escapeHtml(e.pokemon_name)}</span>
        <span class="evo-cost">${e.candy_required || 0} 🍬</span>
      </div>`;
    }).join("");
  }

  candy.addEventListener("input", () => {
    const value = Math.max(0, Math.min(99999, Number(candy.value) || 0));
    state.candies[candyKey] = value;
    save();
    preview.querySelectorAll(".evo-pill").forEach(pill => {
      const ready = value >= Number(pill.dataset.cost || 0);
      pill.classList.toggle("ready", ready);
      pill.classList.toggle("blocked", !ready);
    });
    renderDashboard();
  });
  candy.addEventListener("change", () => render());

  card.querySelector(".card-main").addEventListener("click", () => openDetails(p));
  return card;
}

function dedupeEvolutions(evolutions) {
  const seen = new Set();
  return evolutions.filter(e => {
    const key = String(e.pokemon_id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pokemonById(id) {
  return state.pokemon.find(pokemon => pokemon.id === id);
}

function isOwnedById(id) {
  const pokemon = pokemonById(id);
  return pokemon ? getRecord(pokemon).owned : false;
}

function familyRoots(id) {
  const family = state.familyById.get(id) || id;
  const familyIds = state.pokemon
    .filter(pokemon => (state.familyById.get(pokemon.id) || pokemon.id) === family)
    .map(pokemon => pokemon.id);
  const children = new Set();
  familyIds.forEach(parentId => {
    dedupeEvolutions(state.evolutions.get(parentId) || [])
      .forEach(evo => children.add(evo.pokemon_id));
  });
  const roots = familyIds.filter(familyId => !children.has(familyId));
  return roots.length ? roots : [id];
}

function candyPlan(path, candyCount) {
  const target = path[path.length - 1].pokemon;
  if (isOwnedById(target.id)) return { label: "Déjà possédé", status: "owned" };

  let ownedIndex = -1;
  for (let index = path.length - 2; index >= 0; index--) {
    if (isOwnedById(path[index].pokemon.id)) {
      ownedIndex = index;
      break;
    }
  }
  if (ownedIndex < 0) {
    return { label: `Attrape d’abord ${path[0].pokemon.name}`, status: "need-pokemon" };
  }

  const required = path
    .slice(ownedIndex + 1)
    .reduce((total, step) => total + Number(step.edge?.candy_required || 0), 0);
  const missing = Math.max(0, required - candyCount);
  return missing === 0
    ? { label: `Prêt · ${required} bonbons nécessaires`, status: "ready" }
    : { label: `Il te manque ${missing} bonbon${missing > 1 ? "s" : ""}`, status: "missing" };
}

function renderEvolutionNode(id, path, candyCount, incomingEdge = null, visited = new Set()) {
  const pokemon = pokemonById(id);
  if (!pokemon || visited.has(id)) return "";
  const nextVisited = new Set(visited);
  nextVisited.add(id);
  const currentPath = [...path, { pokemon, edge: incomingEdge }];
  const plan = candyPlan(currentPath, candyCount);
  const evolutions = dedupeEvolutions(state.evolutions.get(id) || []);
  const conditions = incomingEdge ? conditionText(incomingEdge) : "";

  return `
    <div class="tree-node">
      ${incomingEdge ? `<div class="tree-arrow">↓ <strong>${incomingEdge.candy_required || 0} 🍬</strong></div>` : ""}
      <div class="evolution-pokemon ${plan.status}">
        <img src="${SPRITE(pokemon.id)}" alt="">
        <div class="evolution-copy">
          <strong>${escapeHtml(pokemon.name)}</strong>
          ${conditions ? `<small>${escapeHtml(conditions)}</small>` : ""}
          <span class="candy-plan">${escapeHtml(plan.label)}</span>
        </div>
        <span class="ownership">${isOwnedById(pokemon.id) ? "✓ Possédé" : "À obtenir"}</span>
      </div>
      ${evolutions.length ? `
        <div class="tree-branches ${evolutions.length > 1 ? "has-choices" : ""}">
          ${evolutions.map(evo =>
            renderEvolutionNode(evo.pokemon_id, currentPath, candyCount, evo, nextVisited)
          ).join("")}
        </div>
      ` : ""}
    </div>`;
}

function openDetails(p) {
  const candyCount = Number(state.candies[familyKey(p.id)] || 0);
  const roots = familyRoots(p.id);
  const familyName = pokemonById(Number(familyKey(p.id)))?.name || p.name;
  const evolutionTree = roots.map(rootId => renderEvolutionNode(rootId, [], candyCount)).join("");
  const family = state.familyById.get(p.id) || p.id;
  const hasChoices = state.pokemon.some(pokemon =>
    (state.familyById.get(pokemon.id) || pokemon.id) === family &&
    dedupeEvolutions(state.evolutions.get(pokemon.id) || []).length > 1
  );

  $("#dialogContent").innerHTML = `
    <section class="dialog-hero">
      <img src="${SPRITE(p.id)}" alt="${escapeHtml(p.name)}">
      <div>
        <span class="dex-number">#${String(p.id).padStart(4, "0")}</span>
        <h2>${escapeHtml(p.name)}</h2>
        <p>${p.form && p.form !== "Normal" ? `Forme ${escapeHtml(p.form)}` : `Génération ${generationFor(p.id)}`}</p>
        <strong>🍬 ${candyCount} bonbons ${escapeHtml(familyName)}</strong>
      </div>
    </section>
    <section class="dialog-body">
      <div class="evolution-heading">
        <h3>Lignée d’évolution complète</h3>
        ${hasChoices ? `<span>Plusieurs choix possibles</span>` : ""}
      </div>
      <p class="tree-help">Le calcul part du Pokémon le plus avancé que tu possèdes déjà.</p>
      <div class="evolution-tree">${evolutionTree}</div>
    </section>`;
  $("#pokemonDialog").showModal();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function setupEvents() {
  document.querySelector(".main-tabs").addEventListener("click", e => {
    const button = e.target.closest("[data-view]");
    if (!button) return;
    const view = button.dataset.view;
    state.view = view;
    document.querySelectorAll(".main-tab").forEach(tab => {
      tab.classList.toggle("active", tab === button);
    });
    document.querySelectorAll("[data-view-section]").forEach(section => {
      if (section.dataset.viewSection !== view) {
        section.hidden = true;
      } else if (section.id === "emptyState") {
        section.hidden = filteredPokemon().length !== 0;
      } else {
        section.hidden = false;
      }
    });
  });
  $("#searchInput").addEventListener("input", e => {
    state.query = e.target.value;
    render();
  });
  $("#generationSelect").addEventListener("change", e => {
    state.generation = e.target.value;
    render();
  });
  $("#regionStats").addEventListener("click", e => {
    const button = e.target.closest("[data-generation]");
    if (!button) return;
    state.generation = button.dataset.generation;
    $("#generationSelect").value = state.generation;
    render();
    grid.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("#candyNeeds").addEventListener("click", e => {
    const button = e.target.closest("[data-pokemon-id]");
    if (!button) return;
    const pokemon = pokemonById(Number(button.dataset.pokemonId));
    if (pokemon) openDetails(pokemon);
  });
  $("#filters").addEventListener("click", e => {
    const button = e.target.closest("[data-filter]");
    if (!button) return;
    state.filter = button.dataset.filter;
    document.querySelectorAll(".filter").forEach(b => b.classList.toggle("active", b === button));
    render();
  });
  $("#closeDialog").addEventListener("click", () => $("#pokemonDialog").close());
  $("#pokemonDialog").addEventListener("click", e => {
    if (e.target === $("#pokemonDialog")) $("#pokemonDialog").close();
  });
  $("#resetButton").addEventListener("click", () => {
    if (!confirm("Effacer toute ta collection et tous tes bonbons enregistrés ?")) return;
    state.collection = {};
    state.candies = {};
    save();
    render();
  });
  $("#exportButton").addEventListener("click", exportData);
  $("#importFile").addEventListener("change", e => {
    importData(e.target.files?.[0]);
    e.target.value = "";
  });
}

async function loadData() {
  setupEvents();
  try {
    const [releasedResponse, evolutionsResponse, frenchResponse] = await Promise.all([
      fetch(API.released), fetch(API.evolutions), fetch(API.frenchNames)
    ]);
    if (!releasedResponse.ok || !evolutionsResponse.ok || !frenchResponse.ok) throw new Error("API indisponible");
    const [released, evolutions, frenchCsv] = await Promise.all([
      releasedResponse.json(), evolutionsResponse.json(), frenchResponse.text()
    ]);
    buildCatalog(released, evolutions, parseFrenchNames(frenchCsv));
    $("#dataStatus").textContent = "Données Pokémon GO en français";
  } catch (error) {
    buildCatalog([], FALLBACK);
    $("#dataStatus").textContent = "Mode hors-ligne : Pokédex de démonstration";
  }
  render();
}

loadData();
