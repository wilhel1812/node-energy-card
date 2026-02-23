# Node Energy Card (HACS Plugin)

Custom Lovelace card for the Node Energy integration.

## HACS Install
1. HACS -> 3 dots -> Custom repositories
2. Add this repository URL
3. Category: `Dashboard`
4. Install `Node Energy Card`
5. Add resource if HACS does not auto-add:
   - URL: `/hacsfiles/node-energy-card.js`
   - Type: `module`

## Card
```yaml
type: custom:node-energy-card
entity: sensor.node_energy
cells: 2
days: 7
```
