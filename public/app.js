/* Komute web — a port of the Komute Android app (Version 14).
   Screens: Plan (home), AI commute plan (results), Saved, Guide. No build step. */
(() => {
  "use strict";

  const API_BASE = String(window.KOMUTE_API_BASE_URL || "").replace(/\/$/, "");
  const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
  const MANILA = { latitude: 14.5995, longitude: 120.9842, label: "Manila" };

  // ---------------------------------------------------------------- data
  const SAVED_PLACES = [
    { name: "Home", address: "Sta. Mesa, Manila", type: "home" },
    { name: "School", address: "PUP Main Campus", type: "school" },
    { name: "Work", address: "Ayala Triangle, Makati", type: "work" },
    { name: "Araneta City", address: "Cubao, Quezon City", type: "recent" }
  ];

  const GUIDE_TOPICS = [
    {
      id: "jeepney", title: "Riding a jeepney", subtitle: "Routes, payment, and getting off", mode: "jeepney",
      tips: [
        "Check the route sign displayed on the windshield or side panel.",
        "Prepare small bills or coins and say your destination when paying.",
        "Say “Para po” early enough for the driver to stop safely."
      ]
    },
    {
      id: "train", title: "Using LRT and MRT", subtitle: "Stations, directions, and transfers", mode: "train",
      tips: [
        "Confirm whether you need the northbound, southbound, eastbound, or westbound platform.",
        "Keep your ticket or stored-value card until you exit the final station.",
        "Stand clear of the doors and allow passengers to exit first."
      ]
    },
    {
      id: "payment", title: "Fares and payment", subtitle: "Know what to prepare before boarding", mode: null,
      tips: [
        "Komute estimates the total fare before you leave.",
        "Carry a small cash backup even when you use a stored-value card.",
        "Ask for the current fare when route or service information is unclear."
      ]
    },
    {
      id: "safety", title: "Travel safety", subtitle: "Simple habits for unfamiliar trips", mode: null,
      tips: [
        "Wait only in designated loading areas and well-lit locations.",
        "Share your route with a trusted contact before an unfamiliar trip.",
        "Keep your phone secure and avoid displaying valuables near doors or windows."
      ]
    }
  ];

  // Material "rounded" icon paths (24px grid)
  const ICONS = {
    home: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
    my_location: "M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V2c0-.55-.45-1-1-1s-1 .45-1 1v1.06A8.994 8.994 0 0 0 3.06 11H2c-.55 0-1 .45-1 1s.45 1 1 1h1.06A8.994 8.994 0 0 0 11 20.94V22c0 .55.45 1 1 1s1-.45 1-1v-1.06A8.994 8.994 0 0 0 20.94 13H22c.55 0 1-.45 1-1s-.45-1-1-1h-1.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z",
    location_on: "M12 2C8.13 2 5 5.13 5 9c0 4.17 4.42 9.92 6.24 12.11.4.48 1.13.48 1.53 0C14.58 18.92 19 13.17 19 9c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z",
    search: "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l4.99 4.99c.49.49 1.28.49 1.77 0s.49-1.28 0-1.77L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
    map: "M14.65 4.98 9 3 3.64 4.8c-.38.13-.64.5-.64.9v13.58c0 .72.73 1.21 1.4.94L9 18.5l5.35 1.87c.2.07.41.07.61 0l5.4-1.8c.38-.13.64-.5.64-.9V4.72c0-.72-.73-1.21-1.4-.94L15 5.5l-.35-.52zM15 18l-6-2V6l6 2v10z",
    route: "M19 15.18V7c0-2.21-1.79-4-4-4s-4 1.79-4 4v10c0 1.1-.9 2-2 2s-2-.9-2-2V8.82C8.16 8.4 9 7.3 9 6c0-1.66-1.34-3-3-3S3 4.34 3 6c0 1.3.84 2.4 2 2.82V17c0 2.21 1.79 4 4 4s4-1.79 4-4V7c0-1.1.9-2 2-2s2 .9 2 2v8.18c-1.16.41-2 1.51-2 2.82 0 1.66 1.34 3 3 3s3-1.34 3-3c0-1.3-.84-2.4-2-2.82zM6 7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm12 12c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z",
    school: "M5 13.18v2.81c0 .73.4 1.41 1.04 1.76l5 2.73c.6.33 1.32.33 1.92 0l5-2.73c.64-.35 1.04-1.03 1.04-1.76v-2.81l-6.04 3.3c-.6.33-1.32.33-1.92 0L5 13.18zm6.04-9.66-8.43 4.6c-.69.38-.69 1.38 0 1.76l8.43 4.6c.6.33 1.32.33 1.92 0L21 10.09V16c0 .55.45 1 1 1s1-.45 1-1V9.59c0-.37-.2-.7-.52-.88l-9.52-5.19a2.04 2.04 0 0 0-1.92 0z",
    shield: "M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z",
    info: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z",
    auto_awesome: "M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z",
    open_in_new: "M18 19H6c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h5c.55 0 1-.45 1-1s-.45-1-1-1H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-6c0-.55-.45-1-1-1s-1 .45-1 1v5c0 .55-.45 1-1 1zM14 4c0 .55.45 1 1 1h2.59l-8.13 8.13a.996.996 0 1 0 1.41 1.41L19 6.41V9c0 .55.45 1 1 1s1-.45 1-1V4c0-.55-.45-1-1-1h-5c-.55 0-1 .45-1 1z",
    arrow_back: "M19 11H7.83l4.88-4.88a.996.996 0 1 0-1.41-1.41l-6.59 6.59a.996.996 0 0 0 0 1.41l6.59 6.59a.996.996 0 1 0 1.41-1.41L7.83 13H19c.55 0 1-.45 1-1s-.45-1-1-1z",
    expand_more: "M15.88 9.29 12 13.17 8.12 9.29a.996.996 0 1 0-1.41 1.41l4.59 4.59c.39.39 1.02.39 1.41 0l4.59-4.59a.996.996 0 0 0 0-1.41c-.39-.38-1.03-.39-1.42 0z",
    expand_less: "M11.29 8.71 6.7 13.3a.996.996 0 1 0 1.41 1.41L12 10.83l3.88 3.88a.996.996 0 1 0 1.41-1.41L12.7 8.71a.996.996 0 0 0-1.41 0z",
    work: "M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z",
    bookmarks: "M19 18l2 1V3c0-1.1-.9-2-2-2H8.99C7.89 1 7 1.9 7 3h10c1.1 0 2 .9 2 2v13zM15 5H5c-1.1 0-2 .9-2 2v16l7-3 7 3V7c0-1.1-.9-2-2-2z",
    menu_book: "M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z",
    jeepney: "M18.92 6.01C18.72 5.42 18.16 5 17.5 5H15V3H9v2H6.5c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm11 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM5 11l1.5-4.5h11L19 11H5z",
    train: "M4 15.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V5c0-3.5-3.58-4-8-4s-8 .5-8 4v10.5zm8 1.5c-.83 0-1.5-.67-1.5-1.5S11.17 14 12 14s1.5.67 1.5 1.5S12.83 17 12 17zm6-7H6V5h12v5z"
  };

  const icon = (name, size = 24) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ""}"/></svg>`;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const $ = (selector, root = document) => root.querySelector(selector);

  // ---------------------------------------------------------------- state
  const state = {
    screen: "home",
    origin: "PUP Sta. Mesa",
    destination: "",
    originPoint: null,
    destinationPoint: null,
    newCommuterMode: true,
    expandedGuideId: null,
    savedRouteIds: new Set(),
    aiAnswer: "",
    aiSources: [],
    usedMapsGrounding: false,
    isAiLoading: false,
    aiError: null
  };

  // ---------------------------------------------------------------- API
  async function post(path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const text = await response.text();
      let data = {};
      try { data = JSON.parse(text || "{}"); } catch { /* not JSON */ }
      if (!response.ok) {
        throw new Error((data && data.error) || `Server returned HTTP ${response.status}`);
      }
      return data;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("The request took too long. Please try again.");
      if (error instanceof TypeError) throw new Error("Could not reach the Komute backend.");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  const endpointJson = (text, point) => ({
    text,
    location: point ? { latitude: point.latitude, longitude: point.longitude } : null
  });

  async function searchPlaces(query, near) {
    const data = await post("/api/places", {
      query,
      near: near ? { latitude: near.latitude, longitude: near.longitude } : null
    });
    return (data.suggestions || []).map((item) => ({
      id: item.id || item.label,
      label: item.label,
      point: { latitude: item.location.latitude, longitude: item.location.longitude, label: item.label }
    }));
  }

  async function reverseLabel(latitude, longitude) {
    try {
      const data = await post("/api/reverse", { latitude, longitude });
      return data.label || null;
    } catch {
      return null;
    }
  }

  async function planCommute() {
    const data = await post("/api/commute-plan", {
      origin: endpointJson(state.origin, state.originPoint),
      destination: endpointJson(state.destination, state.destinationPoint),
      beginnerMode: state.newCommuterMode
    });
    return {
      plan: String(data.plan || ""),
      usedMapsGrounding: Boolean(data.usedMapsGrounding),
      sources: (data.sources || [])
        .map((s) => ({ title: s.title || "Google Maps source", url: s.url || "" }))
        .filter((s) => /^https?:\/\//i.test(s.url))
    };
  }

  // ---------------------------------------------------------------- map
  function createMap(container, { center, zoom, onClick }) {
    let map = null;
    let ready = false;
    let markers = [];
    let pending = null;

    const status = document.createElement("div");
    status.className = "map-status";
    status.innerHTML = "<span>Loading free map…</span>";
    container.appendChild(status);
    const setStatus = (text) => {
      if (text) { status.firstChild.textContent = text; status.hidden = false; } else { status.hidden = true; }
    };

    if (!window.maplibregl) {
      setStatus("Map could not load: the map library is unavailable. Check your internet connection.");
      return { update() {}, resize() {}, destroy() {} };
    }

    try {
      map = new maplibregl.Map({
        container,
        style: MAP_STYLE,
        center: [center.longitude, center.latitude],
        zoom,
        attributionControl: { compact: true }
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => {
        ready = true;
        setStatus("");
        if (pending) { const p = pending; pending = null; apply(p); }
      });
      map.on("error", (event) => {
        if (!ready) setStatus(`Map could not load: ${(event.error && event.error.message) || "network error"}`);
      });
      if (onClick) {
        map.on("click", (event) => onClick({
          latitude: event.lngLat.lat, longitude: event.lngLat.lng, label: "Pinned destination"
        }));
        map.getCanvas().style.cursor = "crosshair";
      }
    } catch (error) {
      setStatus(`Map could not load: ${error.message}`);
      return { update() {}, resize() {}, destroy() {} };
    }

    function dotElement() {
      const el = document.createElement("div");
      el.className = "dot-marker";
      el.title = "Current location";
      return el;
    }
    function pinElement() {
      const el = document.createElement("div");
      el.className = "pin-marker";
      el.innerHTML = '<svg viewBox="0 0 56 72" width="28" height="36"><path fill="#DA3633" d="M28 6a22 22 0 0 0-22 22c0 6 2.4 10.6 6 16l16 26 16-26c3.600-5.400 6-10 6-16A22 22 0 0 0 28 6z"/><circle cx="28" cy="28" r="8" fill="#fff"/></svg>';
      return el;
    }

    function apply({ center: c, zoom: z, current, destination }) {
      markers.forEach((m) => m.remove());
      markers = [];
      if (current) {
        markers.push(new maplibregl.Marker({ element: dotElement(), anchor: "center" })
          .setLngLat([current.longitude, current.latitude]).addTo(map));
      }
      if (destination) {
        markers.push(new maplibregl.Marker({ element: pinElement(), anchor: "bottom" })
          .setLngLat([destination.longitude, destination.latitude]).addTo(map));
      }
      map.easeTo({ center: [c.longitude, c.latitude], zoom: z, duration: 600 });
    }

    return {
      update(view) { if (ready) apply(view); else pending = view; },
      resize() { map && map.resize(); },
      destroy() { markers.forEach((m) => m.remove()); map && map.remove(); }
    };
  }

  // ---------------------------------------------------------------- navigation
  const screens = {
    home: $("#screen-home"), results: $("#screen-results"),
    saved: $("#screen-saved"), guide: $("#screen-guide")
  };
  const tabsBar = $("#tabs");
  const contentEl = $("#content");
  let resultsMap = null;

  function show(name, { focus = true } = {}) {
    if (name !== "results") destroyResultsMap();
    state.screen = name;
    Object.entries(screens).forEach(([key, el]) => { el.hidden = key !== name; });
    const topLevel = name === "home" || name === "saved" || name === "guide";
    tabsBar.hidden = !topLevel;
    tabsBar.querySelectorAll(".tab").forEach((tab) => {
      const selected = tab.dataset.tab === name;
      tab.classList.toggle("selected", selected);
      tab.setAttribute("aria-current", selected ? "page" : "false");
    });
    if (name === "saved") renderSaved();
    if (name === "guide") renderGuide();
    if (name === "home") requestAnimationFrame(() => { currentMap.resize(); destMap && destMap.resize(); });
    contentEl.scrollTop = 0;
    if (focus) contentEl.focus({ preventScroll: true });
    try { history.replaceState(null, "", name === "home" ? location.pathname : `#${name}`); } catch { /* ignore */ }
  }

  tabsBar.addEventListener("click", (event) => {
    const tab = event.target.closest(".tab");
    if (tab) show(tab.dataset.tab);
  });

  // ---------------------------------------------------------------- inject icons
  function paintIcons(root) {
    root.querySelectorAll("[data-icon]").forEach((el) => {
      el.innerHTML = icon(el.dataset.icon, Number(el.dataset.size) || 24);
      el.removeAttribute("data-icon");
    });
  }
  paintIcons(document);

  // ---------------------------------------------------------------- HOME
  const originInput = $("#origin");
  const destInput = $("#destination");
  const findButton = $("#find-routes");
  const searchButton = $("#dest-search");
  const pinButton = $("#dest-pin");

  // --- Live current location card
  const locSub = $("#loc-sub");
  const locAllow = $("#loc-allow");
  const locText = $("#loc-text");
  let hasPermission = false;
  let watchId = null;
  let currentFix = null;      // {latitude, longitude, accuracy}
  let placeLabel = "Waiting for a location estimate…";
  let lastResolved = null;    // coordinates last sent for address lookup
  let resolving = false;

  const currentMap = createMap($("#map-current"), { center: MANILA, zoom: 11 });

  function distanceMeters(a, b) {
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (b.latitude - a.latitude) * rad, dLon = (b.longitude - a.longitude) * rad;
    const h = Math.sin(dLat / 2) ** 2 +
      Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function renderLocationCard() {
    locSub.textContent = hasPermission
      ? "The blue dot follows this device while this page is open."
      : "Allow location to show the blue dot.";
    locAllow.hidden = hasPermission;
    locText.textContent = currentFix
      ? `${placeLabel} • accuracy about ${Math.round(currentFix.accuracy || 0)} m`
      : placeLabel;
    const point = currentFix ? { latitude: currentFix.latitude, longitude: currentFix.longitude } : null;
    currentMap.update({ center: point || MANILA, zoom: point ? 17 : 11, current: point });
  }

  async function onPosition(position) {
    hasPermission = true;
    const { latitude, longitude, accuracy } = position.coords;
    currentFix = { latitude, longitude, accuracy };
    const coordinateLabel = `Current location (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`;
    setOrigin({ latitude, longitude, label: coordinateLabel });

    const moved = !lastResolved || distanceMeters(lastResolved, currentFix) > 50;
    if (moved && !resolving) {
      resolving = true;
      lastResolved = { latitude, longitude };
      placeLabel = "Finding the nearest address or landmark…";
      renderLocationCard();
      const resolved = await reverseLabel(latitude, longitude);
      resolving = false;
      placeLabel = resolved || coordinateLabel;
      if (currentFix && currentFix.latitude === latitude && currentFix.longitude === longitude) {
        setOrigin({ latitude, longitude, label: placeLabel });
      }
    } else if (!resolving && placeLabel.startsWith("Waiting")) {
      placeLabel = coordinateLabel;
    }
    renderLocationCard();
  }

  function onPositionError(error) {
    if (error.code === error.PERMISSION_DENIED) {
      hasPermission = false;
      placeLabel = "Location permission was denied. Allow it in your browser's site settings to see the blue dot.";
      if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    } else if (error.code === error.POSITION_UNAVAILABLE) {
      placeLabel = "Your location is unavailable right now. Turn on Wi-Fi or location services and try again.";
    } else {
      placeLabel = "Finding your location is taking longer than usual…";
    }
    renderLocationCard();
  }

  function startWatching() {
    if (!("geolocation" in navigator)) {
      placeLabel = "This browser does not support location.";
      renderLocationCard();
      return;
    }
    if (watchId !== null) return;
    if (!window.isSecureContext) {
      placeLabel = "Location needs a secure (https) connection.";
      renderLocationCard();
      return;
    }
    watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, {
      enableHighAccuracy: true, maximumAge: 2000, timeout: 20000
    });
  }

  locAllow.addEventListener("click", () => {
    placeLabel = "Waiting for a location estimate…";
    renderLocationCard();
    startWatching();
  });

  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: "geolocation" }).then((status) => {
      if (status.state === "granted") { hasPermission = true; renderLocationCard(); startWatching(); }
      status.onchange = () => {
        if (status.state === "granted" && watchId === null) { hasPermission = true; renderLocationCard(); startWatching(); }
      };
    }).catch(() => {});
  }
  renderLocationCard();

  // --- origin / destination state helpers
  function updateOrigin(value) {
    state.origin = value;
    if (state.originPoint && state.originPoint.label !== value) state.originPoint = null;
  }
  function setOrigin(point) {
    state.origin = point.label;
    state.originPoint = point;
    if (document.activeElement !== originInput) originInput.value = point.label;
  }

  originInput.addEventListener("input", () => updateOrigin(originInput.value));

  // --- Destination picker
  let suggestions = [];
  let selectedPoint = { ...MANILA };
  let showDestMap = false;
  let isSearching = false;
  let destMessage = null;
  let destMap = null;

  function syncSelectedFromState() {
    selectedPoint = state.destinationPoint ? { ...state.destinationPoint } : { ...MANILA };
  }

  function setDestination(point) {
    state.destination = point.label;
    state.destinationPoint = point;
    if (document.activeElement !== destInput) destInput.value = point.label;
    syncSelectedFromState();
    renderDestination();
  }

  function updateDestinationText(value) {
    state.destination = value;
    if (state.destinationPoint && state.destinationPoint.label !== value) {
      state.destinationPoint = null;
      syncSelectedFromState();
    }
    destMessage = null;
    renderDestination();
  }

  function renderSuggestions() {
    const box = $("#dest-suggestions");
    box.innerHTML = suggestions.map((s, i) =>
      `<button type="button" class="btn btn-outlined" data-i="${i}">${icon("location_on", 24)}<span>${esc(s.label)}</span></button>`
    ).join("");
  }

  function renderDestination() {
    findButton.disabled = !state.destination.trim();
    searchButton.disabled = !state.destination.trim() || isSearching;
    $("#dest-progress").hidden = !isSearching;
    const msg = $("#dest-message");
    msg.hidden = !destMessage;
    msg.textContent = destMessage || "";
    $("#dest-map-wrap").hidden = !showDestMap;
    if (showDestMap) {
      if (!destMap) {
        destMap = createMap($("#map-dest"), { center: selectedPoint, zoom: 16, onClick: (p) => selectPoint(p, true) });
      }
      destMap.update({ center: selectedPoint, zoom: 16, destination: selectedPoint });
      $("#pinned-label").textContent = (state.destinationPoint && state.destinationPoint.label) || selectedPoint.label;
    }
  }

  async function selectPoint(point, resolveLabel) {
    selectedPoint = point;
    showDestMap = true;
    suggestions = [];
    renderSuggestions();
    if (!resolveLabel) { setDestination(point); return; }
    destMessage = "Finding the nearest address or landmark…";
    renderDestination();
    const resolved = await reverseLabel(point.latitude, point.longitude);
    const label = resolved ||
      `Pinned destination (${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)})`;
    destMessage = "Pin selected";
    setDestination({ ...point, label });
  }

  destInput.addEventListener("input", () => updateDestinationText(destInput.value));
  destInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !searchButton.disabled) { event.preventDefault(); searchButton.click(); }
  });

  searchButton.addEventListener("click", async () => {
    const query = state.destination.trim();
    if (!query || isSearching) return;
    isSearching = true;
    destMessage = null;
    renderDestination();
    try {
      suggestions = await searchPlaces(query, state.originPoint);
      destMessage = suggestions.length === 0
        ? "No OpenStreetMap matches found. Try a fuller name or use the pin."
        : "Select a place.";
    } catch (error) {
      suggestions = [];
      destMessage = error.message;
    }
    isSearching = false;
    renderSuggestions();
    renderDestination();
  });

  $("#dest-suggestions").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-i]");
    if (button) selectPoint(suggestions[Number(button.dataset.i)].point, false);
  });

  pinButton.addEventListener("click", () => {
    showDestMap = true;
    renderDestination();
    $("#dest-map-wrap").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  // --- quick destinations
  const chips = $("#chips");
  chips.innerHTML = SAVED_PLACES.map((p, i) =>
    `<button type="button" class="chip" data-i="${i}">${icon("location_on", 18)}<span>${esc(p.name)}</span></button>`
  ).join("");
  chips.addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (chip) useSavedPlace(SAVED_PLACES[Number(chip.dataset.i)]);
  });

  function useSavedPlace(place) {
    state.destination = place.address;
    state.destinationPoint = null;
    destInput.value = place.address;
    syncSelectedFromState();
    destMessage = null;
    renderDestination();
  }

  // --- new commuter mode
  $("#new-commuter").addEventListener("change", (event) => { state.newCommuterMode = event.target.checked; });

  // --- find routes
  findButton.addEventListener("click", () => {
    if (!state.destination.trim()) return;
    state.aiAnswer = "";
    state.aiSources = [];
    state.usedMapsGrounding = false;
    state.aiError = null;
    state.isAiLoading = true;
    show("results");
    renderResults();
    requestAiPlan();
  });

  renderDestination();

  // ---------------------------------------------------------------- RESULTS
  function tripMapView() {
    const o = state.originPoint, d = state.destinationPoint;
    let center = MANILA;
    if (o && d) center = { latitude: (o.latitude + d.latitude) / 2, longitude: (o.longitude + d.longitude) / 2, label: "Trip overview" };
    else if (d) center = d;
    else if (o) center = o;
    return { center, zoom: o && d ? 11.5 : 15, current: o, destination: d };
  }

  function destroyResultsMap() {
    if (resultsMap) { resultsMap.destroy(); resultsMap = null; }
  }

  async function requestAiPlan() {
    try {
      const result = await planCommute();
      if (!result.plan.trim()) throw new Error("Invalid response from server.");
      state.aiAnswer = result.plan;
      state.aiSources = result.sources;
      state.usedMapsGrounding = result.usedMapsGrounding;
      state.aiError = null;
    } catch (error) {
      state.aiError = error.message || "Could not reach the Komute backend.";
    }
    state.isAiLoading = false;
    if (state.screen === "results") renderAiParts();
  }

  function renderResults() {
    const el = screens.results;
    el.innerHTML = `
      <div class="topbar">
        <button class="icon-btn" type="button" id="results-back" aria-label="Go back">${icon("arrow_back", 24)}</button>
        <div class="grow">
          <div class="title-lg">AI commute plan</div>
          <div class="sub">${esc(state.origin)} to ${esc(state.destination)}</div>
        </div>
      </div>
      <div class="stack">
        <div class="trip-card">
          <div id="map-trip" class="map" style="height:330px"></div>
          <div class="caption body-sm">Blue: Point A • Red: Point B • Map: OpenFreeMap/OpenStreetMap</div>
        </div>
        <div class="notice notice-primary" style="margin-top:0">
          ${icon("info", 24)}
          <p>This plan is generated by AI from Point A and Point B. Routes, fares, stops, and schedules may change—verify signs and operator notices before boarding.</p>
        </div>
        <div id="ai-slot"></div>
        <div id="sources-slot"></div>
      </div>`;
    $("#results-back").addEventListener("click", () => show("home"));
    destroyResultsMap();
    const view = tripMapView();
    resultsMap = createMap($("#map-trip"), { center: view.center, zoom: view.zoom });
    resultsMap.update(view);
    renderAiParts();
  }

  function renderAiParts() {
    const slot = $("#ai-slot");
    if (!slot) return;
    let body = "";
    if (state.isAiLoading) {
      body = `<div class="ai-loading" role="status"><div class="spinner"></div><span>Designing commute options and guidelines…</span></div>`;
    } else if (state.aiError) {
      body = `<p class="ai-error" role="alert">${esc(state.aiError)}</p>
              <button type="button" class="btn btn-filled btn-wide" data-retry>Try generating again</button>`;
    } else if (state.aiAnswer.trim()) {
      body = `<p class="ai-answer">${esc(state.aiAnswer)}</p>
              <button type="button" class="btn btn-outlined btn-wide" data-retry>Generate another plan</button>`;
    }
    slot.innerHTML = `
      <div class="ai-card">
        <div class="ai-head">${icon("auto_awesome", 24)}<span class="title-lg">Komute AI suggestions</span></div>
        <p class="ai-sub body-sm">${state.usedMapsGrounding
          ? "Generated with Google Maps location grounding."
          : "Generated from the selected endpoints; live route data was not confirmed."}</p>
        ${body}
      </div>`;
    const retry = slot.querySelector("[data-retry]");
    if (retry) retry.addEventListener("click", retryAiPlan);

    const sources = $("#sources-slot");
    sources.innerHTML = state.aiSources.length ? `
      <div class="title-md">Location sources</div>
      <p class="body-sm muted" style="margin:4px 0 12px">Google Maps data contributed to this AI response.</p>
      <div class="sources">${state.aiSources.map((s) =>
        `<a class="btn btn-outlined source-btn" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer"><span>${esc(s.title)}</span>${icon("open_in_new", 24)}</a>`
      ).join("")}</div>` : "";
  }

  function retryAiPlan() {
    if (!state.destination.trim()) return;
    state.isAiLoading = true;
    state.aiError = null;
    state.aiAnswer = "";
    state.aiSources = [];
    state.usedMapsGrounding = false;
    renderAiParts();
    requestAiPlan();
  }

  // ---------------------------------------------------------------- SAVED
  function renderSaved() {
    const n = state.savedRouteIds.size;
    screens.saved.innerHTML = `
      <div class="page">
        <div class="intro">${icon("bookmarks", 24)}</div>
        <h2 class="headline" style="margin-top:10px">Saved places</h2>
        <p class="sub-lead">${n} route${n === 1 ? "" : "s"} bookmarked in this demo session.</p>
        <div class="list">${SAVED_PLACES.map((p, i) => `
          <button type="button" class="place-card" data-i="${i}">
            ${icon(p.type === "home" ? "home" : p.type === "school" ? "school" : p.type === "work" ? "work" : "location_on", 24)}
            <span class="txt"><span class="title-md">${esc(p.name)}</span><span class="addr">${esc(p.address)}</span></span>
          </button>`).join("")}
        </div>
      </div>`;
    screens.saved.querySelectorAll(".place-card").forEach((card) =>
      card.addEventListener("click", () => {
        useSavedPlace(SAVED_PLACES[Number(card.dataset.i)]);
        show("home");
      }));
  }

  // ---------------------------------------------------------------- GUIDE
  function renderGuide() {
    screens.guide.innerHTML = `
      <div class="page">
        <div class="intro">${icon("menu_book", 24)}</div>
        <h2 class="headline" style="margin-top:10px">New Commuter Guide</h2>
        <p class="sub-lead">Learn common transit steps before your first trip.</p>
        <div class="list guide">${GUIDE_TOPICS.map((t) => {
          const open = state.expandedGuideId === t.id;
          return `
          <section class="guide-card">
            <button type="button" class="guide-top" data-id="${t.id}" aria-expanded="${open}">
              ${t.mode ? icon(t.mode, 24) : ""}
              <span class="txt grow">
                <span class="title-md">${esc(t.title)}</span>
                <span class="body-md muted">${esc(t.subtitle)}</span>
              </span>
              <span class="chev" aria-hidden="true">${icon(open ? "expand_less" : "expand_more", 24)}</span>
            </button>
            ${open ? `<ol class="tips">${t.tips.map((tip, i) => `<li><b>${i + 1}.</b><span>${esc(tip)}</span></li>`).join("")}</ol>` : ""}
          </section>`;
        }).join("")}</div>
      </div>`;
    screens.guide.querySelectorAll(".guide-top").forEach((card) =>
      card.addEventListener("click", () => {
        state.expandedGuideId = state.expandedGuideId === card.dataset.id ? null : card.dataset.id;
        const top = contentEl.scrollTop;
        renderGuide();
        contentEl.scrollTop = top;
      }));
  }

  // ---------------------------------------------------------------- start
  const initial = location.hash.replace("#", "");
  show(initial === "saved" || initial === "guide" ? initial : "home", { focus: false });
})();
