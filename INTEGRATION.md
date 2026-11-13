# Wiring the layer into interactive_map

Written against branch `dev`. Three files are copied in; five existing files get
a small addition each. Nothing is removed and nothing existing is rewritten, so
the change is additive and easy to back out.

## 1. Copy the files

Keep the paths as they are here — `slow-walkers.js` fetches its data by relative
path, so `media/slow-walkers/` has to sit where it is.

```
animations/slow-walkers.js
controller/slow-walkers-ui.js
media/slow-walkers/slow-walkers.geojson
```

## 2. `index.html` — the display

**a.** The toolbar button. Put it beside the other layer buttons; in our tree it
sits just before `fcc-demo-btn`.

```html
<button id="slow-walkers-btn" class="icon-btn" title="Slow Walkers: Time Lost">
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="4" r="2"/>
    <path d="M11 7 L10 13 L13 17 L13 22"/>
    <path d="M10 13 L7 22"/>
    <path d="M11 8 L7 11"/>
    <path d="M11 8 L15 11 L17 22"/>
  </svg>
</button>
```

**b.** The script, with the other animations. It needs `map` from `main.js`, so
it must come after it.

```html
<script src="animations/slow-walkers.js"></script>
```

## 3. `controller.html` — the controller

**a.** The matching button. Ours is next to `isovist-btn`:

```html
<button class="control-btn animation-btn" data-action="click" data-target="slow-walkers-btn" title="Slow Walkers: Time Lost">
    <span class="material-icons">elderly</span>
</button>
```

**b.** The panel script, with the other `controller/*.js`:

```html
<script src="controller/slow-walkers-ui.js"></script>
```

## 4. `controller.js` — three additions

**a.** Add the id to `ANIMATION_BUTTONS`, so the button toggles like a layer
rather than firing like an action:

```js
const ANIMATION_BUTTONS = [
    ...
    'street-view-btn',
    'slow-walkers-btn'      // <- add
];
```

**b.** In `updateDashboard(targetId)`, add a branch beside the other layers:

```js
} else if (targetId === 'slow-walkers-btn') {
    // Time slider, view switch and legend: controller/slow-walkers-ui.js
    if (dashboardTitle) dashboardTitle.textContent = 'Slow Walkers';
    // setSunStudyLayout(false) above resets the metadata band after
    // updateMetadata filled it, so fill it again before the panel renders
    updateMetadata(targetId);
    window.slowWalkersUI.render(dashboardContent, legendContent);

}
```

**c.** In `updateMetadata(layerId)`, add a case to the `switch`:

```js
case 'slow-walkers-btn':
    name = 'Slow Walkers: Time Lost';
    desc = 'Minutes lost by slow walkers (4.235 km/h) who miss a public-transport '
         + 'connection that medium-speed walkers (4.8 km/h) make. r5py routing on the '
         + 'Västtrafik timetable; 100 m cells around Chalmers, 200 m across Gothenburg.';
    // The dashboard renders the legend - see controller/slow-walkers-ui.js.
    legend = '';
    break;
```

## 5. `style.css` — the active button

`.active` is styled per button in this file, so a layer with no rule of its own
shows no active state:

```css
/* Slow walkers: the red of the layer's worst delay class */
#slow-walkers-btn.active {
  background: #b10026;
  color: white;
}

#slow-walkers-btn.active:hover {
  background: #8f001f;
}
```

## 6. `animations/street-life.js` — one line

The delay cells sit under the street-life canvas, so street life has to stand
down while this layer is up. Add the id to the `activeButtons` list inside
`isAnyVisualizationActive()`:

```js
    'ecom-energy-btn',
    // Slow walkers: its delay cells sit under this canvas on the map
    'slow-walkers-btn'      // <- add
  ];
```

Without this, cars and live transit keep moving on top of the delay grid.

## Checking it works

Serve the folder over HTTP — `file://` will not do, the layer fetches its
geojson. Open the display and the controller, press the slow-walkers button on
the controller, and the grid should grow in from the worst areas over about six
seconds, with the legend in the controller's panel.

If the map stays empty, check the browser console for a 404 on
`media/slow-walkers/slow-walkers.geojson` — that is almost always a path
problem rather than a code one.
