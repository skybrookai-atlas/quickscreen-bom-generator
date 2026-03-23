---
name: quickscreen-bom
description: >-
  QuickScreen slat screening and gates BOM (Bill of Materials) generator for The Glass Outlet.
  Use when a user needs to configure a fence, screen, or gate using QuickScreen/XPRESS aluminium
  slat screening products. Guides users through system selection, dimensions, colours, post mounting,
  gate placement, and generates a complete priced BOM with all required components.
  Trigger phrases: fence quote, screening quote, slat fence, QuickScreen, BOM, bill of materials,
  gate quote, sliding gate, pedestrian gate, equipment enclosure, POSTA letterbox.
---

# QuickScreen BOM Generator

## When to Use This Skill

Use this skill when the user needs to:
- Configure a QuickScreen or XPRESS slat screening fence/screen
- Generate a Bill of Materials (BOM) for screening, gates, or enclosures
- Quote materials for a fencing job using Glass Outlet products
- Determine which components are needed for a specific fence scenario
- Calculate slat quantities based on height and gap requirements

## Reference Files

Load these as needed — do NOT load all at once. Load on first use for that system.

| File | When to Load |
|------|-------------|
| `references/calculation_rules.md` | First time you need to calculate any quantities — contains ALL formulas |
| `references/product_mapping.json` | When looking up specific product codes from catalogue names |
| `references/product_list.csv` | When looking up prices for BOM line items |
| `references/system_details.md` | When user asks technical questions about a system's specs/capabilities |

## Overview of Systems

There are 6 QuickScreen systems:

| # | System | Key Use | Max Dimensions |
|---|--------|---------|----------------|
| 1 | Horizontal Slat (Side Frame) | Privacy/feature screens, boundary fences | Height: ~2700mm, Width: ~6000mm per panel |
| 2 | Vertical Slat | Decorative vertical screens, dividers | Same frame, slats rotated 90° |
| 3 | Pedestrian Gate (XP hinged) | Swing gates for foot traffic | Max ~1200mm W × 2100mm H |
| 4 | QSG Pedestrian Gate | QuickScreen Gate system hinged gates | Similar to XP but different frame |
| 5 | Sliding Gate | Driveway/wide opening gates | Up to ~6150mm wide |
| 6 | Equipment Enclosure | AC units, pool pumps, bins | Custom to equipment size |
| 7 | POSTA Letterbox | Fence-mounted letterbox | Between 50mm posts at 600mm centres |

## Instructions

### Phase 1: Greeting & Project Discovery

Start conversational and friendly. Ask what they're building. Present systems as choices.

**Ask:** "What are you looking to build today?"
- Horizontal slat fence/screen
- Vertical slat screen
- Pedestrian gate (hinged)
- Sliding gate (driveway)
- Equipment enclosure
- POSTA letterbox
- Full project (fence + gates + extras — describe it)

**Key discovery questions** (ask naturally, not as a checklist dump):
1. What is it for? (privacy, boundary, pool, decorative)
2. Roughly how long is the fence run?
3. Any gates needed? Where?
4. Any 90° turns or angles?
5. Where does it start and end? (post, wall, corner of building)
6. What's the ground surface? (soil for concreted posts, concrete slab for base plates)

### Phase 2: Gather Dimensions & Configure

For each selected system, gather dimensions through natural conversation. Use multiple-choice questions and calculators to make it easy.

**CRITICAL: Display the BOM as a table after each significant addition.** The user must be able to see what's being added in real-time and correct mistakes immediately.

#### 2A. Horizontal/Vertical Slat Screens

Gather these inputs (in order of importance):

1. **Colour** — ask first, affects all product codes
   - Standard: Black (B), Monument (MN), Woodland Grey (G), Surfmist (SM), Pearl White (W), Basalt (BS), Dune (D), Mill (M)
   - Limited: Primrose (P), Paperbark (PB), Palladium Silver (S)

2. **Slat size**: 65mm or 90mm
   - 65mm: More slats per height = denser look, more material cost
   - 90mm: Fewer slats = more open feel, slightly cheaper

3. **Slat spacing/gap**: 5mm, 9mm, or 20mm
   - 5mm: Near-privacy (minimal light through)
   - 9mm: Standard privacy fence
   - 20mm: Open/decorative look

4. **Screen height** (in mm)
   - Show the user what the ACTUAL achievable height will be (it won't match their target exactly)
   - Use the slat count formula from `calculation_rules.md`:
     ```
     num_slats = lookup from height table
     actual_height = ROUND(num_slats × (slat_width + gap) - gap + 3, 0)
     ```

5. **Total fence run length** (mm or metres)

6. **Panel layout**:
   - Max panel width: 2600mm (2000mm for windy areas)
   - Panels > 2000mm need centre support rails
   - Calculate: `num_panels = CEIL(run_length / max_panel_width)`
   - Then: `panel_width = run_length / num_panels` (distribute evenly)

7. **Termination at each end**: Post, Wall, or Existing structure
   - Post-to-Post → Side Frames both sides
   - Post-to-Wall → Side Frame + F-Section
   - Wall-to-Wall → F-Sections both sides

8. **90° turns**: Each turn = 1 corner post + independent panels each side

9. **Louvre mode**: Slats angled? (adds louvre brackets, changes width deduction)

#### 2B. Post Configuration

**Ask:** "How will the posts be mounted?"
- **Concreted into ground** → post length = screen height + 450mm min
- **Base-plated to slab** → need base plate set + domical cover per post
- **Core-drilled into concrete** → need dress ring + chemical anchor per post
- **Existing posts** → just verify size (50mm or 65mm)

**Post size selection** (recommend automatically):
- Screen ≤ 1800mm: 50×50mm posts
- Screen > 1800mm or windy: 65×65mm HD posts
- Sliding gates: 65mm steel posts (XPSG-2700-ST65)
- Gate posts: 65mm HD recommended

#### 2C. Pedestrian Gates (XP System)

1. **Opening width** (max 1200mm recommended)
2. **Gate height** (max 2100mm, should match fence height)
3. **Slat size and gap** (should match adjacent fence)
4. **Gate side frame size**: 50mm, 60mm, or 65mm
5. **Hinge side**: Left or right viewed from outside
6. **Hardware choice**:
   - Option A: Gate Kit (XP-GKIT-LSET09 or XP-GKIT-LSET20) — includes stops, slat count depends on gap
   - Option B: Magna Latch + TruClose hinge combo
   - Option C: Separate latch + separate hinges + lock box

#### 2D. QSG Pedestrian Gates

Similar to XP gates but uses QSG frame system:
- QSG rails (65mm or 90mm profile)
- QSG gate side frames
- QSG joiner blocks
- QSG screw covers and rail screws

#### 2E. Sliding Gates

1. **Opening width** (gate panel extends beyond for pocket)
2. **Height from ground** (includes 31mm ground clearance for steel track)
3. **Slat size, spacing, and colour**
4. **Track type**: Steel (standard) or Aluminium
5. **Number of identical gates**

**Auto-add for every sliding gate:**
- 2× Wheels (XPSG-WHEEL)
- 2× Wheel Clamping Sets (XPSG-WHEEL-CS — 2-pack, 1 per wheel)
- 1× Top Rollers (XPSG-TOPROLL-2PK)
- 1× Slide Guide (XPSG-GUIDE)
- 1× Gate Stop (XPSG-STOP)
- 1× U-Catch (XPSG-CATCH-U)
- Track: calculate length = gate_width × 2, pick 3000mm or 6000mm lengths
- Track Anchors: 22 per 3000mm track, 42 per 6000mm track
- Steel gate posts (XPSG-2700-ST65): typically 2 per gate

### Phase 3: Calculate & Build BOM

Read `references/calculation_rules.md` for exact formulas.

#### 3A. Interactive Calculator Display

When calculating slat counts, **show the user a mini calculator**:

```
╔═══════════════════════════════════════════╗
║  SLAT CALCULATOR                          ║
║  Slat: 90mm  |  Gap: 9mm  |  Colour: B   ║
╠═══════════════════════════════════════════╣
║  Target Height: 1800mm                    ║
║  ─────────────────────────────            ║
║  Calculated Slats: 18                     ║
║  Actual Height: 1782mm ← closest match    ║
║  Next option: 19 slats = 1881mm           ║
╚═══════════════════════════════════════════╝
```

Let the user pick which slat count they want if the target falls between two options.

#### 3B. Progressive BOM Display

After each calculation step, display the BOM table so far:

```
| Qty | Code | Description | Unit $ | Line $ |
|-----|------|-------------|--------|--------|
| 18  | QS-6100-S90-B | 90mm Slat Black 6100mm | $50.49 | $908.82 |
| ← just added ↑ |
```

Keep appending rows as new items are calculated. This lets the user catch errors early.

#### 3C. Auto-Add Companion Items

**CRITICAL:** These must be added automatically whenever their parent product appears. Never leave a BOM without these.

Load the full auto-add rules from `references/calculation_rules.md` Section 9.

Key auto-adds:
- Side Frame → always add CFC Cover (1:1) + Side Frame Caps (1 pack per 2 SFs)
- Centre Support Rail → add CSR Caps + Top/Base Plates
- Slats → add Spacers (50-packs) + Screws (50-packs)
- F-Section → add F-section fixing screws
- Posts → add mounting accessories based on method
- Gates → add hardware (hinges, latch, lock box if needed)
- Sliding gates → add wheels, track, guides, stops, catches

#### 3D. Stock Length Optimisation

All extrusions are sold in fixed stock lengths. Calculate how many stock lengths to order:

```python
pieces_per_stock = ROUNDDOWN(stock_length / cut_length, 0)
stocks_to_order = ROUNDUP(total_pieces / pieces_per_stock, 0)
```

Stock lengths:
- Slats (65mm/90mm): 6100mm
- Side Frame: 5800mm
- CFC Cover: 5800mm
- F-Section: 5800mm
- Centre Support Rail: 5800mm
- Gate Stop: 4200mm
- QSG Rails: 4800mm

### Phase 4: Review & Validate

#### 4A. Completeness Check

Before presenting the final BOM, verify:

- [ ] Every side frame has a matching CFC cover
- [ ] Every side frame has caps (2 per frame, sold in 2-packs)
- [ ] Every centre support rail has caps + top/base plates
- [ ] Screws and spacers are included (in 50-packs)
- [ ] Post mounting accessories match the mounting method
- [ ] Gate hardware is included (hinges + latch for every gate)
- [ ] Sliding gate components are complete (wheels, track, guides, stops)
- [ ] Panels > 2000mm have centre support rails
- [ ] Colour is consistent across all components

#### 4B. Gotcha Warnings

Flag these if detected:

| Gotcha | Warning |
|--------|---------|
| Panel > 2600mm wide | "Panel exceeds recommended max. Consider splitting into 2 panels." |
| Panel > 2000mm without CSR | "Centre support rail required for panels over 2000mm." |
| Gate > 1200mm wide (pedestrian) | "Exceeds max recommended pedestrian gate width. Consider sliding gate." |
| Gate > 2100mm high | "Exceeds max gate height for standard hardware." |
| Missing gate hardware | "No hinges/latch selected for gate — these are required." |
| 6000mm post without cap | "6000mm posts don't include caps — must order separately or cut 2400mm post." |
| Louvre mode with wide panels | "Louvre brackets add 42mm to width deduction per side." |
| Mixed post sizes | "Mixing 50mm and 65mm posts — verify this is intentional." |
| No track anchors with track | "Track anchors needed to secure track to concrete." |

#### 4C. Final BOM Presentation

Display the complete BOM grouped by category:

**1. Screening Materials**
| Qty | Code | Description | Unit $ | Line $ |

**2. Frames & Fixings**
| Qty | Code | Description | Unit $ | Line $ |

**3. Posts & Mounting**
| Qty | Code | Description | Unit $ | Line $ |

**4. Gate Components** (if applicable)
| Qty | Code | Description | Unit $ | Line $ |

**5. Gate Hardware** (if applicable)
| Qty | Code | Description | Unit $ | Line $ |

**6. Accessories & Consumables**
| Qty | Code | Description | Unit $ | Line $ |

**TOTAL: $X,XXX.XX**

### Phase 5: Adjust & Export

1. Let the user adjust any quantities manually
2. Recalculate totals after adjustments
3. Ask about pricing tier (1 = standard, 2 = mid volume, 3 = trade)
4. Export as structured data (CSV or formatted table)

## Pricing Tiers

The price list has 3 tiers:
- **Tier 1** (price_1): Standard / small qty — default
- **Tier 2** (price_2): Mid volume
- **Tier 3** (price_3): Large volume / trade

Ask the user which applies. Default to Tier 1 if not specified.

## Colour Codes Reference

| Colour | Suffix | Notes |
|--------|--------|-------|
| Black Satin | B | Most popular |
| Monument Matt | MN | Popular dark grey |
| Woodland Grey Matt | G | Mid grey-green |
| Surfmist Matt | SM | Light grey |
| Pearl White Gloss | W | White |
| Basalt Satin | BS | Dark charcoal |
| Dune Satin | D | Sandy/beige |
| Mill (raw aluminium) | M | Cheapest, no coating |
| Primrose | P | Limited availability |
| Paperbark | PB | Limited availability |
| Palladium Silver Pearl | S | Silver metallic |

## Product Code Patterns

```
Slats:              XP-6100-S65-{col}  or  QS-6100-S90-{col}
Side Frame:         QS-5800-SF-{col}
CFC Cover:          QS-5800-CFC-{col}
F-Section:          QS-5800-F-{col}
CSR:                XP-5800-CSR-{col}
50mm Post 2400:     XP-2400-FP-{col}
50mm Post 6000:     XP-6000-FP-{col}
65mm Post 2400:     XP-2400-65HD-{col}
65mm Post 5800:     XP-5800-65HD-{col}
Base Plate 50mm:    XP-BP-SET-{col}
Base Plate 65mm:    XP-65BP-SET-{col}
Domical 50mm:       XP-DC-2P-{col}
Domical 65mm:       XP-65DC-2P-{col}
Dress Ring 50mm:    XP-DR-{col}
Dress Ring 65mm:    XP-65DR-{col}
SF Cap:             QS-SFC-B  ← individual (not a 2-pack), only available in Black, 2 per frame
CSR Cap:            XP-CSRC-{col}  ← has colour suffix (B, G, MN, S, SM, W)
Spacers:            XPL-SB-50PK-05MM / XPL-SB-50PK-09MM / XPL-SB-50PK-20MM
Screws (screening): XP-SCREWS-{col}  ← 100-pack (not 50)
Screws (gate frame):XP-SCREWSGF-10PK  ← 12G×65mm, 10-pack, separate from screening screws
Gate Blade 65mm:    XP-6100-GB65-{col}  ← only gate blade in catalogue (no 90mm gate blade)
Gate Kit (9mm):     XP-GKIT-LSET09-{col}
Gate Kit (20mm):    XP-GKIT-LSET20-{col}
HD Rail (ped gate): XP-6100-HD6545-{col}  ← top + bottom rail for pedestrian gate
SG Top Rail:        XPSG-6100-TR-{col}  ← 65×82mm, for SLIDING gates only
SG Bottom Rail:     XPSG-6100-BR-{col}  ← 120×45mm, for SLIDING gates only
Gate Stop:          XP-4200-GSTOP-{col}
Steel Post:         XPSG-2700-ST65-{col}
Top Rollers:        XPSG-TOPROLL-2PK
Track 3m:           XPSG-3000-TRACK-ST
Track 6m:           XPSG-6000-TRACK-ST
Wheel:              XPSG-WHEEL
Wheel Clamp:        XPSG-WHEEL-CS  ← 2-pack, 1 per wheel
Slide Guide:        XPSG-GUIDE
Gate Stop (SG):     XPSG-STOP
U-Catch:            XPSG-CATCH-U
F-Catch:            XPSG-CATCH-F
Track Anchors:      XPSG-ANCHOR
Latch+Hinge combo:  ML-TL-KF-H-FT  (Magna Latch + Kwik Fit fixed tension)
Latch only:         ML-TL
Hinge only:         TC-H-AT-2L-B  (TruClose adjustable pair)
```

## Common Gotchas (CRITICAL — memorise these)

1. **Where fences start/stop**: Always ask. Post-to-wall needs F-section, not side frame.
2. **90° turns**: Extra corner post + panels each side terminate independently.
3. **Gate locations break the run**: Each gate = fence stops, gate opening, fence resumes.
4. **Post mounting accessories**: NEVER forget base plates/covers for base-plated, dress rings for core-drilled.
5. **Centre support for wide panels**: Anything > 2000mm needs CSR + plates + caps.
6. **Gate kits include stops/frames but NOT hinges or blades**: Always add blades, HD rail, and a hinge+latch combo separately.
7. **Sliding gate posts**: Steel posts (XPSG-2700-ST65) required — not aluminium.
8. **Sliding gate rails are different products to pedestrian gate rails**: XPSG-6100-TR/BR (sliding) vs XP-6100-HD6545 (pedestrian). Do not mix them.
9. **Sliding gates also need top rollers**: XPSG-TOPROLL-2PK — easy to forget.
10. **Track length**: Must extend beyond opening on pocket side by at least gate width.
11. **2400mm posts include cap, 6000mm/5800mm do NOT** — order caps separately.
12. **Spacers match gap size**: XPL-SB-50PK-05MM, XPL-SB-50PK-09MM, or XPL-SB-50PK-20MM — must match the slat spacing.
13. **Screws combine SF + CSR**: Total screw count = SF screws + CSR screws, sold in 100-packs (XP-SCREWS-{col}).
14. **Gate frame screws are separate**: XP-SCREWSGF-10PK (12G×65mm), different product from screening screws.
15. **SF caps are sold individually (not as packs)**: QS-SFC-B, only black, 2 per side frame.
16. **Actual height differs from target**: Always show the user what height they'll actually get.
17. **No 90mm gate blade exists**: All gates use XP-6100-GB65 (65mm) regardless of fence slat size.

## Unverified Items

These catalogue items could not be matched to price list SKUs. Flag for manual pricing:

| Code | Description | Recommendation |
|------|-------------|----------------|
| QS-135DEG | 135° Adapter | Custom/special order |
| QSG-4800-RAIL65/90 | QSG Gate Rails | May use XP-6100-HD6545 cut to length |
| QSG-JBLOCK-50/65 | QSG Joiner Blocks | May be included in gate kits |
| QSG-RS-10PK | QSG Rail Screws | Check FIXINGS & TOOLS group |
| QSG-SC-10PK | QSG Screw Covers | May be included in gate kits |
| QSG-FTC-65 | 65mm Gate Frame Cap | Check warehouse for HD gate caps |
| QSG-HINGE-BT/ADJ | QSG Gate Hinges | Source D&D Technologies (KF/TruClose) |
| QSG-DLATCH | QSG D-Latch | Use XP-LBOX-DL + Lockwood 001 latch |
| QSG-S-STOP | Sliding Gate Stop | May use XPSG-STOP |
| POSTA | Letterbox | Third-party product — check availability |

---

## App Changelog — `quickscreen_bom_ai_intake.html`

This section documents every fix applied to the BOM generator app. Update this immediately after any change.

### 2026-03-20 — Full audit and rewrite of generateBOM()

**Colour dropdown**
- Removed 3 non-existent colours: `night_sky`, `jasper`, `manor_red` (none exist in catalogue)
- Added all real QuickScreen colours: Black Satin, Monument, Woodland Grey, Surfmist, Pearl White, Basalt, Dune, Mill, Palladium Silver
- Updated AI parse prompt to use matching values

**Fence BOM — complete rewrite**
- Old code used completely fake SKUs (`QS-SLAT-65`, `QS-TRK-3M`, `QS-POST-1800`, `QS-BP-100`, `QS-CAP-3M`, `QS-FIX-BAG`, `QS-END-CAP`) — all removed
- Slat count now calculated correctly from height using `round(N × (slat_width + gap) - gap + 3)` formula (§1.3)
- Stock-length optimisation now applied via `ROUNDDOWN`/`ROUNDUP` (§1.6)
- Real slat codes: `XP-6100-S65-{col}` ($37.29) / `QS-6100-S90-{col}` ($50.49)
- Side frames `QS-5800-SF-{col}` ($24.35) now added with correct stock-length calc
- CFC covers `QS-5800-CFC-{col}` ($16.92) now mandatory 1:1 with side frames
- SF end caps `QS-SFC-B` ($0.86 ea) now added — 2 per frame, sold individually, black only
- Spacers `XPL-SB-50PK-09MM` ($3.01/pk) now added — qty: `2×(slats+1)` per panel in 50-packs
- Screws `XP-SCREWS-{col}` ($6.06/100-pk) now added — qty: `slats×2×1.01 + CSR_screws` in 100-packs
- CSR `XP-5800-CSR-{col}` ($43.48) now auto-added for panels ≥ 2000mm, with caps (`XP-CSRC-B`, $1.03) and base/top plates (`XP-BTP-{col}`, $4.64 × 2)
- Posts: `XP-2400-FP-{col}` ($38.55) for ≤1800mm; `XP-2400-65HD-{col}` ($56.71) for >1800mm
- Base plates: `XP-BP-SET-{col}` ($9.79) + `XP-DC-2P-{col}` ($5.11) or 65mm equivalents
- Full 3-tier pricing added throughout (all prices from `product_list.csv`)
- BOM header now shows actual achieved height (e.g. "target 1800mm → actual 1782mm (18 slats)")

**Sliding gate — fixes**
- Top/bottom rails corrected: now `XPSG-6100-TR-{col}` + `XPSG-6100-BR-{col}` ($147.48 each) — old code wrongly used `XP-6100-HD6545` (pedestrian gate product)
- Added missing `XPSG-TOPROLL-2PK` ($37.96)
- Fixed wheel clamp SKU: `XPSG-WHEEL-CS` ($6.00) — old code used non-existent `QSG-S-WHEEL-CS-2PK`
- Corrected all prices: wheel $21.53, guide $38.69, stop $18.20, U-catch $13.88, 3m track $26.52, 6m track $50.44, anchors $0.72/ea, steel posts $54.96
- Motor placeholder replaced with `XPSG-FILO-400` ($726.55, verify flag)

**Pedestrian gate — fixes**
- Now uses `XP-GKIT-LSET09-{col}` ($157.41 / $132.00 mill) as the correct foundation kit
- Gate blades `XP-6100-GB65-{col}` ($55.36) — all gates use 65mm blade (only type in catalogue)
- HD rail `XP-6100-HD6545-{col}` ($124.56) — real price, correct for pedestrian gate
- Hardware: `ML-TL-KF-H-FT` ($61.48) replaces fake `XP-HINGE-TC` + `XP-LATCH-ML` codes
- Gate frame screws: `XP-SCREWSGF-10PK` ($3.02) — correct product (12G×65mm)
- Old `XP-4200-GSTOP` removed from pedestrian gate — now covered by gate kit
