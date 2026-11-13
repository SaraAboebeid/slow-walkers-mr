# Slow Walkers: Time Lost — MR Studio layer

A layer for the ACE MR Studio projection table ([Nodal-Works/interactive_map](https://github.com/Nodal-Works/interactive_map)).

It colours grid cells by the extra minutes a **slow walker** (4.235 km/h, Västtrafik's
"slow" speed, typical of elderly passengers) loses on trips where they miss a
public-transport connection that a **medium-speed walker** (4.8 km/h) makes.

The analysis behind it lives in a separate repository,
[SaraAboebeid/slow_walkers](https://github.com/SaraAboebeid/slow_walkers): r5py
routing over the Västtrafik GTFS timetable, exported here by its
`export_mr_layer.py`. This repository holds only what the table needs to draw it.

## What is in here

```
animations/slow-walkers.js              the map layer
controller/slow-walkers-ui.js           the controller panel
media/slow-walkers/slow-walkers.geojson the data, 14,939 cells
INTEGRATION.md                          how to wire it into interactive_map
```

Three files to copy, and five small edits to files that already exist.
`INTEGRATION.md` has them in full.

## How it draws

A native MapLibre fill layer, not a canvas. The map already handles zoom,
rotation and basemap changes, and switching the hour is a paint-property change
rather than a redraw.

Cells are **50 m around Chalmers** — the table's calibrated view, resampled from
a 100 m routing grid — and **200 m across the rest of Gothenburg**, so the layer
holds up both on the campus model and zoomed out to the whole city on a larger
table. On activation they grow in from the worst-affected areas, as in the
original animation.

## The data

`media/slow-walkers/slow-walkers.geojson` is a `FeatureCollection` of 14,939
polygons, 3.4 MB, with a `metadata` block carrying the legend:

| Key | Meaning |
|---|---|
| `departures` | the sampled departure times, in order |
| `bins` | legend breaks, in minutes: 0, 5, 10 … 35 |
| `colors` | seven colours, pale yellow through to `#b10026` |
| `campus_center` | `[11.9778, 57.6884]` |

Each cell carries:

| Property | Meaning |
|---|---|
| `a` | all-day average extra minutes |
| `d0` … `dN` | one value per sampled departure |
| `g` | grid the cell came from |
| `t`, `tc` | fade timing for the grow-in |

**Note on the current export:** it holds a single departure, `d0` at **06:25**, so
the controller's time slider has one position and the all-day average equals it.
The layer already reads `d0`..`dN`, so re-exporting with more departures needs no
code change here — only a new geojson.

## Controls

The controller panel gives a time-of-day slider (or the all-day average), a play
button that steps through the sampled departures, a Chalmers / Gothenburg view
switch, and the legend.

## Licence and data credit

Timetable data from Västtrafik via Trafiklab. Routing by
[r5py](https://r5py.readthedocs.io/). Add whatever licence the MR Studio
repository uses before publishing.
