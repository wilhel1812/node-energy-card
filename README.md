# Battery Telemetry Setup Card

UI helper card for Home Assistant that generates and copies ready-to-paste ApexCharts dashboard YAML for Battery Telemetry Forecast.

No visible code block: users select entity and click a large copy button.

## Install (HACS)
1. HACS -> Custom repositories
2. Add this repo as category `Dashboard`
3. Install `Battery Telemetry Setup Card`
4. Ensure `ApexCharts Card` is also installed from HACS Frontend

## Use
Add card:

```yaml
type: custom:battery-telemetry-setup-card
title: Battery Telemetry Setup
```

Backward-compatible alias still works: `custom:node-energy-setup-card`.

In UI:
1. Pick your Battery Telemetry sensor (dropdown is filtered to valid entities only).
2. Click `Copy Dashboard Config`.
3. Paste in Dashboard -> Edit -> Raw configuration editor.

This project is independent and not affiliated with Meshtastic.
