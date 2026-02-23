# Node Energy Setup Card

UI helper card for Home Assistant that generates and copies ready-to-paste ApexCharts dashboard YAML for Node Energy.

No visible code block: users select entity and click a large copy button.

## Install (HACS)
1. HACS -> Custom repositories
2. Add this repo as category `Dashboard`
3. Install `Node Energy Card`
4. Ensure `ApexCharts Card` is also installed from HACS Frontend

## Use
Add card:

```yaml
type: custom:node-energy-setup-card
title: Node Energy Setup
```

In UI:
1. Pick your Node Energy sensor (dropdown is filtered to valid entities only).
2. Click `Copy Dashboard Config`.
3. Paste in Dashboard -> Edit -> Raw configuration editor.
