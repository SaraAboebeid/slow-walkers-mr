// ===== Slow Walkers controller panel =====
//
// Time-of-day slider, view switch (Chalmers / all of Gothenburg) and legend for
// animations/slow-walkers.js. The display owns the state and reports it back
// with 'slow_walkers_info'; this panel only sends 'slow_walkers_control' and
// redraws from what it hears, so a second controller stays in step.

(function () {
    'use strict';

    const CONTROL = 'slow_walkers_control';
    const INFO = 'slow_walkers_info';
    const channel = new BroadcastChannel('map_controller_channel');
    // Legend defaults until the display reports the palette in the data file
    const state = {
        departures: [], timeIndex: -1, view: 'campus', playing: false,
        bins: [0, 5, 10, 15, 20, 25, 30, 35],
        colors: ['#ffffb2', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#b10026'],
    };

    function send(action, value) {
        channel.postMessage({ type: CONTROL, action, value });
    }

    function timeLabel() {
        return state.timeIndex < 0 ? 'All day' : state.departures[state.timeIndex] || '--:--';
    }

    function legendItems() {
        const { bins, colors } = state;
        return colors.map((c, i) => {
            const label = i === colors.length - 1 ? `${bins[i]}+` : `${bins[i]}-${bins[i + 1]}`;
            return `
                <div class="legend-item">
                    <div class="legend-color" style="background:${c};"></div>
                    <span class="legend-label">${label} min</span>
                </div>`;
        }).join('');
    }

    function render(dashboardContent, legendContent) {
        const max = Math.max(state.departures.length - 1, 0);
        dashboardContent.innerHTML = `
            <div class="dashboard-container">
                <div class="dashboard-card">
                    <div class="dashboard-section-title">
                        <span class="material-icons" style="font-size: 18px;">schedule</span>
                        Time of day
                    </div>
                    <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.75rem;">
                        <input type="range" id="sw-time" class="modern-range" style="flex:1;"
                               min="0" max="${max}" step="1" value="${Math.max(state.timeIndex, 0)}">
                        <span id="sw-time-label" class="control-value" style="min-width:4.5rem; text-align:right;">${timeLabel()}</span>
                    </div>
                    <div class="action-grid" style="grid-template-columns: repeat(2, 1fr);">
                        <button id="sw-all-day" class="modern-btn">
                            <span class="material-icons">today</span> All day
                        </button>
                        <button id="sw-play" class="modern-btn primary">
                            <span class="material-icons">play_arrow</span> Play day
                        </button>
                    </div>
                </div>
                <div class="dashboard-card">
                    <div class="dashboard-section-title">
                        <span class="material-icons" style="font-size: 18px;">map</span>
                        View
                    </div>
                    <div class="action-grid" style="grid-template-columns: repeat(3, 1fr);">
                        <button id="sw-campus" class="modern-btn">
                            <span class="material-icons">school</span> Chalmers
                        </button>
                        <button id="sw-city" class="modern-btn">
                            <span class="material-icons">location_city</span> Gothenburg
                        </button>
                        <button id="sw-replay" class="modern-btn">
                            <span class="material-icons">replay</span> Replay
                        </button>
                    </div>
                </div>
            </div>
        `;

        legendContent.innerHTML = `
            <div class="dashboard-card">
                <div class="dashboard-section-title">Minutes lost per missed connection</div>
                <div id="sw-legend" style="display:flex; flex-direction:column; gap:0.4rem;">${legendItems()}</div>
                <p class="info-text" style="margin-top:0.75rem;">
                    Average extra minutes a slow walker (4.235 km/h) loses on trips where they miss
                    a connection that a medium-speed walker (4.8 km/h) makes. Västtrafik timetable,
                    weekday departures 06:00-22:00.
                </p>
            </div>
        `;

        const slider = document.getElementById('sw-time');
        slider.addEventListener('input', () => {
            state.timeIndex = parseInt(slider.value, 10);
            document.getElementById('sw-time-label').textContent = timeLabel();
            send('set_time', state.timeIndex);
        });
        document.getElementById('sw-all-day').addEventListener('click', () => send('set_time', -1));
        document.getElementById('sw-play').addEventListener('click', () => send('play', !state.playing));
        document.getElementById('sw-campus').addEventListener('click', () => send('set_view', 'campus'));
        document.getElementById('sw-city').addEventListener('click', () => send('set_view', 'city'));
        document.getElementById('sw-replay').addEventListener('click', () => send('replay'));

        sync();
        send('request_status');
    }

    // Reflect display state in the panel without rebuilding it
    function sync() {
        const slider = document.getElementById('sw-time');
        if (!slider) return;
        slider.max = Math.max(state.departures.length - 1, 0);
        if (state.timeIndex >= 0) slider.value = state.timeIndex;
        slider.style.opacity = state.timeIndex < 0 ? '0.5' : '1';
        document.getElementById('sw-time-label').textContent = timeLabel();
        document.getElementById('sw-all-day').classList.toggle('active', state.timeIndex < 0);
        const play = document.getElementById('sw-play');
        play.innerHTML = state.playing
            ? '<span class="material-icons">pause</span> Pause'
            : '<span class="material-icons">play_arrow</span> Play day';
        document.getElementById('sw-campus').classList.toggle('active', state.view === 'campus');
        document.getElementById('sw-city').classList.toggle('active', state.view === 'city');
    }

    channel.addEventListener('message', (event) => {
        const msg = event.data || {};
        if (msg.type !== INFO) return;
        Object.assign(state, {
            departures: msg.departures || [],
            timeIndex: msg.timeIndex,
            view: msg.view,
            playing: msg.playing,
        });
        if (msg.bins && msg.colors) Object.assign(state, { bins: msg.bins, colors: msg.colors });
        const legend = document.getElementById('sw-legend');
        if (legend) legend.innerHTML = legendItems();
        sync();
    });

    window.slowWalkersUI = { render };
})();
