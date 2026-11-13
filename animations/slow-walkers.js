// ===== Slow Walkers: time lost missing public transport =====
//
// Grid cells coloured by the extra minutes a slow walker (4.235 km/h) loses
// on trips where they miss a connection that a medium-speed walker (4.8 km/h)
// makes. Computed with r5py on Västtrafik GTFS in the slow_walkers project,
// exported to media/slow-walkers/slow-walkers.geojson.
//
// Cells are 50 m around Chalmers (the table's calibrated view, from a 100 m
// routing grid) and 200 m over the rest of Gothenburg, so the layer holds up both on the campus model and
// zoomed out to the whole city on a bigger table. Each cell carries the
// all-day average ('a') and one value per sampled departure ('d0'..'dN'); the
// controller's time slider picks which one is drawn.
//
// Native MapLibre layer rather than a canvas: the map already handles zoom,
// rotation and basemap changes, and switching the hour is a paint-property
// change, not a redraw.

(function () {
    'use strict';

    const DATA_URL = 'media/slow-walkers/slow-walkers.geojson';
    const SOURCE_ID = 'slow-walkers';
    const LAYER_ID = 'slow-walkers-fill';
    const BUTTON_ID = 'slow-walkers-btn';

    const OPACITY = 0.85;
    const GROW_MS = 6000;        // cells grow in from the worst areas, as in the original GIF
    const FADE = 0.04;           // share of the grow-in each cell takes to fade in
    const PLAY_STEP_MS = 1500;   // autoplay: time between departures
    const CITY_PADDING = 40;

    const channel = new BroadcastChannel('map_controller_channel');

    let data = null;             // the GeoJSON, fetched on first activation
    let active = false;
    let timeIndex = -1;          // -1 = whole-day average, else index into departures
    let view = 'campus';
    let growFrame = null;
    let growStart = 0;
    let growKey = 'tc';
    let playTimer = null;

    function departures() {
        return (data && data.metadata && data.metadata.departures) || [];
    }

    function valueKey() {
        return timeIndex < 0 ? 'a' : `d${timeIndex}`;
    }

    // ---- paint expressions -------------------------------------------------

    function colorExpression() {
        const { bins, colors } = data.metadata;
        // Continuous blend with each legend colour at its class midpoint: the
        // campus cells come from a 100 m grid, and hard class steps turned them
        // into blocks on the model. Legend colours still match at the midpoints.
        const expr = ['interpolate', ['linear'], ['get', valueKey()]];
        colors.forEach((c, i) => expr.push((bins[i] + bins[i + 1]) / 2, c));
        return expr;
    }

    function opacityExpression(progress) {
        // Cells with no routed trips carry -1 and stay hidden
        const grown = progress >= 1 + FADE
            ? OPACITY
            : ['interpolate', ['linear'], ['get', growKey], progress - FADE, OPACITY, progress, 0];
        return ['case', ['<', ['get', valueKey()], 0], 0, grown];
    }

    function applyPaint(progress) {
        if (!map.getLayer(LAYER_ID)) return;
        map.setPaintProperty(LAYER_ID, 'fill-color', colorExpression());
        map.setPaintProperty(LAYER_ID, 'fill-opacity', opacityExpression(progress));
    }

    // ---- grow-in animation -------------------------------------------------

    function grow() {
        cancelAnimationFrame(growFrame);
        // City view grows from the worst areas ('t'); on the model it grows
        // outward from the table centre ('tc'), so the table is never left empty
        growKey = view === 'city' ? 't' : 'tc';
        growStart = performance.now();
        const step = (now) => {
            const progress = (now - growStart) / GROW_MS * (1 + FADE);
            applyPaint(Math.min(progress, 1 + FADE));
            if (active && progress < 1 + FADE) growFrame = requestAnimationFrame(step);
        };
        growFrame = requestAnimationFrame(step);
    }

    function growing() {
        return performance.now() - growStart < GROW_MS;
    }

    // ---- data and layer ----------------------------------------------------

    async function loadData() {
        if (data) return data;
        const response = await fetch(DATA_URL);
        if (!response.ok) throw new Error(`Slow walkers: ${DATA_URL} (${response.status})`);
        data = await response.json();
        return data;
    }

    function addLayer() {
        if (!map.getSource(SOURCE_ID)) {
            map.addSource(SOURCE_ID, { type: 'geojson', data });
        }
        if (!map.getLayer(LAYER_ID)) {
            // No beforeId: on top of the basemap and other map layers, like the rest
            map.addLayer({
                id: LAYER_ID,
                type: 'fill',
                source: SOURCE_ID,
                paint: { 'fill-color': colorExpression(), 'fill-opacity': opacityExpression(0),
                         'fill-antialias': false },
            });
        }
        map.setLayoutProperty(LAYER_ID, 'visibility', 'visible');
    }

    // ---- views -------------------------------------------------------------

    function campusCamera() {
        // tableCenter / initialZoom / initialBearing come from main.js (map-calibration.json)
        return {
            center: typeof tableCenter !== 'undefined' ? tableCenter : data.metadata.campus_center,
            zoom: typeof initialZoom !== 'undefined' ? initialZoom : 16,
            bearing: typeof initialBearing !== 'undefined' ? initialBearing : map.getBearing(),
            pitch: 0,
        };
    }

    function cityCamera() {
        const bounds = new maplibregl.LngLatBounds();
        for (const f of data.features) {
            for (const c of f.geometry.coordinates[0]) bounds.extend(c);
        }
        const bearing = map.getBearing();
        const camera = map.cameraForBounds(bounds, { padding: CITY_PADDING, bearing });
        return camera ? { ...camera, bearing, pitch: 0 } : { center: bounds.getCenter(), zoom: 11, bearing, pitch: 0 };
    }

    function setView(next) {
        view = next === 'city' ? 'city' : 'campus';
        map.flyTo({ ...(view === 'city' ? cityCamera() : campusCamera()), duration: 2500, essential: true });
        broadcastInfo();
    }

    // ---- time of day -------------------------------------------------------

    function setTime(index) {
        const n = departures().length;
        timeIndex = Number.isInteger(index) && index >= 0 && index < n ? index : -1;
        if (!growing()) applyPaint(1 + FADE);
        broadcastInfo();
    }

    function setPlaying(on) {
        clearInterval(playTimer);
        playTimer = null;
        if (on && departures().length) {
            playTimer = setInterval(() => setTime((timeIndex + 1) % departures().length), PLAY_STEP_MS);
        }
        broadcastInfo();
    }

    // ---- activation --------------------------------------------------------

    function broadcastState() {
        channel.postMessage({ type: 'animation_state', animationId: BUTTON_ID, isActive: active });
    }

    function broadcastInfo() {
        if (!active) return;
        channel.postMessage({
            type: 'slow_walkers_info',
            departures: departures(),
            timeIndex,
            view,
            playing: !!playTimer,
            measure: data && data.metadata.measure,
            // The controller's legend draws from these, so it always matches the data
            bins: data && data.metadata.bins,
            colors: data && data.metadata.colors,
        });
    }

    function syncButton() {
        const btn = document.getElementById(BUTTON_ID);
        // Set before street-life looks at it: its observer pauses the cars on
        // any active layer button, and restarts them if the class is late.
        if (btn) btn.classList.toggle('active', active);
    }

    async function activate() {
        if (active) return;
        try {
            await loadData();
            if (!map.isStyleLoaded()) await new Promise((resolve) => map.once('load', resolve));
        } catch (err) {
            console.error(err);
            if (typeof showToast === 'function') showToast('Slow walkers: data not found');
            return;
        }
        active = true;
        syncButton();
        if (window.streetLifeAnimation) window.streetLifeAnimation.stop();
        addLayer();
        grow();
        broadcastState();
        broadcastInfo();
    }

    function deactivate() {
        if (!active) return;
        active = false;
        cancelAnimationFrame(growFrame);
        setPlaying(false);
        if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, 'visibility', 'none');
        syncButton();
        // Back on the model, so the next layer starts where the table expects it
        if (view === 'city') setView('campus');
        view = 'campus';
        if (window.streetLifeAnimation) setTimeout(window.streetLifeAnimation.updateVisibility, 60);
        broadcastState();
    }

    function toggle() {
        return active ? Promise.resolve(deactivate()) : activate();
    }

    // ---- controller messages -----------------------------------------------

    channel.addEventListener('message', (event) => {
        const msg = event.data || {};
        if (msg.type !== 'slow_walkers_control' || !active) return;
        switch (msg.action) {
            case 'set_time': setTime(parseInt(msg.value, 10)); break;
            case 'set_view': setView(msg.value); break;
            case 'play': setPlaying(!!msg.value); break;
            case 'replay': grow(); break;
            case 'request_status': broadcastInfo(); break;
        }
    });

    // Loaded after the sidebar markup, so the button already exists
    const btn = document.getElementById(BUTTON_ID);
    if (btn) btn.addEventListener('click', toggle);

    window.slowWalkersLayer = {
        activate, deactivate, toggle, setTime, setView,
        isActive: () => active,
    };
})();
