# Battery Telemetry Card

Native custom chart card for Home Assistant that renders battery telemetry history + forecast from `sensor.*.attributes.apex_series`.

## Install (HACS)
1. HACS -> Custom repositories
2. Add this repo as category `Dashboard`
3. Install `Battery Telemetry Card`
4. Ensure `ApexCharts Card` is also installed from HACS Frontend

## Use
Add card:

```yaml
type: custom:battery-telemetry-card
```

Configure in UI editor:
1. Pick your Battery Telemetry sensor (dropdown is filtered to valid entities only).
2. Toggle which groups to show (power/sun/clear-sky).
3. Save. No raw YAML templates required.

Backward-compatible aliases still work:
- `custom:node-energy-card`
- `custom:battery-telemetry-setup-card`
- `custom:node-energy-setup-card`

This project is independent and not affiliated with Meshtastic.
