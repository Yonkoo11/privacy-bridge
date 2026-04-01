# Design Research Brief -- Privacy Bridge

## Product Category: Privacy Bridge (ZK Cross-Chain)
## Comparables Studied: Tornado Cash, Railgun/Railway, Aztec/zk.money, LayerSwap, Stargate, Across, Wormhole

## Product Metaphor: CLASSIFIED DOCUMENT DEAD DROP

The bridge is a dead drop system. You file a classified document on one chain (deposit), receive a redacted receipt (note), and retrieve the declassified version on another chain (withdraw). The metaphor drives every design decision:

- **Shape language:** zero border-radius = documents, file folders, stamps
- **Texture:** gap-px grids = filing cabinet dividers
- **Signature:** redact-bar = literal redaction in classified documents
- **Color meaning:** warm off-white = aged paper/stamps, green = cleared/confirmed, amber = classified/pending, red = denied/breach
- **Motion:** minimal, precise, mechanical. Classified systems don't animate playfully. Cursor blink, status change, done.
- **Density:** packed but readable. Intelligence briefings are information-dense.

## Common Patterns (table stakes):

- Chain selector with logos and clear active state
- Fixed denomination selector (pill buttons, not free entry)
- Note backup with download + copy + confirmation checkbox
- Dark background with single saturated accent
- Transaction status with progress indication
- Explorer link after confirmation
- Mobile-responsive layout

## Differentiation Opportunities:

- **Anonymity set size shown per denomination** (Aztec did this, nobody else). Display "~N other deposits at this amount" to gamify privacy accumulation. This is THE most impactful UX innovation for a privacy product.
- **Source-to-Destination panel layout** (LayerSwap pattern) instead of single-chain deposit form. Show the flow: EVM Chain -> Starknet visually as two connected panels.
- **Reduce withdrawal to 1-click** where possible. Current 4-step manual flow (load note, prove, calldata, relay) should be collapsed. The user pastes a note and clicks "Withdraw" -- everything else is automated behind a progress indicator.
- **The classified document aesthetic is already unique** in the space. No other bridge looks like a declassified intelligence report. Double down on this instead of softening it.

## Stolen Elements (adopt and adapt):

- From **Aztec/zk.money**: anonymity set counter that updates as you select denomination, nudging toward round amounts
- From **Tornado Cash**: "I backed up the note" checkbox before deposit execution
- From **LayerSwap**: two-panel Source/Destination bridge layout with directional arrow
- From **Stargate**: near-monochrome palette with minimal accent (institutional trust)
- From **Across**: auto-default source chain to connected wallet chain, countdown/progress after submission
- From **Railgun**: "Private Balance" concept -- show shielded vs unshielded clearly

## Anti-patterns (must avoid):

- Multi-step wizards with no way back (Wormhole pattern -- confusing)
- Chain selector as flat grid with 20+ items (breaks at scale, fine for our 6 chains)
- Generic spinner with no progress indication after transaction
- "Relayer Status: Not connected" as a static dead indicator
- Permanently-zero anonymity set counters (current Dashboard problem)
- Denomination amounts without the native token symbol context

## Design Constraints:

- Must work as static export (GitHub Pages, no SSR)
- 6 chains maximum (grid works, no need for search)
- wagmi/viem for wallet interaction
- IBM Plex Mono + Space Grotesk already loaded (keep these)
- Zero border-radius is the brand (non-negotiable)
- Must look good in a 2-minute demo video at 720p
