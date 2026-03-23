# QuickScreen System Technical Details

## System 1: Horizontal Slat Screen (Side Frame)

The most common system. Aluminium slats sit horizontally in vertical side frame channels.

### Components per Panel
- **2x Side Frame** (QS-5800-SF-{colour}): 5800mm long C-channel. Cut to screen height. Slats friction-fit into channels.
- **2x CFC Cover** (QS-5800-CFC-{colour}): Concealed fixing cover snaps onto side frame to hide screws.
- **4x Side Frame Cap** (QS-SFC-{colour}): Nylon end caps for top + bottom of each side frame. 2 per frame.
- **Nx Slats**: Either 90mm (QS-6100-S90-{colour}) or 65mm (XP-6100-S65-{colour}). Cut to panel width.

### Optional Components
- **F-section** (QS-5800-F-{colour}): Replaces side frame where screen meets a wall or returns into a void. One arm captures slat, other arm fixes to wall.
- **Centre Support Rail** (XP-5800-CSR-{colour}): Required for panels wider than 2000mm. 40x13mm rail with snap-on CFC. Sits vertically at mid-span.
  - Needs: 2x Centre Support Plate (XP-BTP-{colour}) for top + bottom mounting
  - Needs: 2x Centre Support Cap (XP-CSRC-{colour}) for top + bottom ends
- **135° Adapter** (QS-135DEG): For angled screen runs (not 90°).

### Slat Sizing
- **65mm slat**: 65 x 16.5mm with centre web. 6100mm stock length.
- **90mm slat**: 90 x 16.5mm with centre web. 6100mm stock length.
- **Gap options**: 5mm, 9mm, or 20mm between slats.

### Height Formula
```
actual_height_mm = (num_slats × (slat_height + gap)) - gap + 3
```
Where:
- slat_height = 65 or 90
- gap = 5, 9, or 20
- The +3mm accounts for the lip of the side frame channel

### Common Heights (90mm slat, 9mm gap)
| Slats | Height (mm) | Approx (m) |
|-------|-------------|------------|
| 10 | 993 | ~1.0 |
| 12 | 1191 | ~1.2 |
| 15 | 1488 | ~1.5 |
| 18 | 1785 | ~1.8 |
| 20 | 1983 | ~2.0 |

### Common Heights (65mm slat, 9mm gap)
| Slats | Height (mm) | Approx (m) |
|-------|-------------|------------|
| 14 | 1039 | ~1.0 |
| 17 | 1261 | ~1.3 |
| 20 | 1483 | ~1.5 |
| 24 | 1779 | ~1.8 |
| 27 | 2001 | ~2.0 |

---

## System 2: Vertical Slat Screen

Slats are mounted vertically using the same side frame as a top and bottom rail, with U-channel horizontals.

### Components per Panel
- **2x Side Frame** (QS-5800-SF-{colour}): Used as TOP and BOTTOM horizontal rails (not vertical).
- **2x CFC Cover** (QS-5800-CFC-{colour}): Cover for each horizontal rail.
- **Nx QS-5800-F sections** (QS-5800-F-{colour}): Used as the VERTICAL SLATS themselves. Cut to screen height.
- **Horizontal U-channels** (QS-5000-HORIZ-{colour}): Optional intermediate horizontal supports at mid-height for stability.

### Key Dimensions
- Max practical panel width before needing intermediate support: ~1800mm
- For panels >1800mm wide, use XP-FOOT-ADJ (adjustable foot) at the base of each vertical slat
- Slat spacing determined by customer preference (typically 10-25mm gaps)

### Vertical Slat Quantity Formula
```
num_vertical_slats = floor(panel_width / (slat_width + gap)) + 1
```

---

## System 3: Pedestrian Gate

Swing gate for foot traffic. Built with a perimeter frame and horizontal slat infill.

### Maximum Dimensions
- **Width**: 1200mm max (single leaf)
- **Height**: 2100mm max

### Gate Construction
The gate uses a GATE SIDE FRAME (different from screen side frame) as the perimeter:
- 2x vertical gate side frames (top to bottom)
- 2x horizontal rails connecting them (top + bottom)
- Joiner blocks at each corner
- Slats (gate blades) screw-fixed to rails (not friction-fit)

### Component List per Gate
| Component | Code Pattern | Qty | Notes |
|-----------|-------------|-----|-------|
| Gate Lock Box Kit | XP-GKIT-LSET09 or XP-GKIT-LSET20 | 1 | Includes: 2x GSF, 2x inserts, 3x stops, rubber, caps, screws |
| Gate Blades (65mm) | XP-6100-GB65-{colour} | N | Screw-fixed slats. Qty = same as screen slat formula |
| HD Rail (for top/bottom) | XP-6100-HD6545-{colour} | 2 | Cut to gate width. 65x45mm with screw flutes |
| Gate Infill | XP-XBAT-4200-INF-{colour} | 2 | For hinge and latch sides of gate frame |
| Hinges | ML-TL-KF-H-FT or separate | 1 set | D&D Kwik Fit or TruClose hinges |
| Latch | ML-TL or XP-LBOX-DL + Lockwood | 1 | Magna Latch or D-Latch with lock box |
| Gate Posts | XP-2400-FP or XP-2400-65HD | 2 | One hinge post, one latch post |

### Gate Kit Details (XP-GKIT-LSET09/20)
The gate lock box kit is the foundation. It includes:
- 2x 2094mm Gate Side Frame (slotted at 9mm or 20mm spacing)
- 1 piece has extra machining for the lock set
- 2x 2094mm Gate Inserts
- 1x Right hand machined Gate Stop (2200mm)
- 1x Left hand machined Gate Stop (2200mm)
- 1x Non-machined Gate Stop for hinge side (2200mm)
- 2x Gate Stop Rubber (2250mm)
- 2x Gate Frame Cap (nylon)
- 1x 10pk Wafer head screws for gate stop

**NOT included in kit:** Hinges, latch/lock, gate blades (slats), HD rails.

---

## System 4: Sliding Gate

For driveways and wide openings. Gate slides along a track.

### Maximum Dimensions
- **Opening width**: Up to ~6150mm
- **Gate panel width**: Opening + ~300-400mm overlap each side
- **Height**: Match fence height (typically 1200-2100mm)

### Components per Sliding Gate
| Component | Code Pattern | Qty | Notes |
|-----------|-------------|-----|-------|
| Top Rail | XPSG-6100-TR-{colour} | 1-2 | 65x82mm. May need 2 joined for wide gates |
| Bottom Rail | XPSG-6100-BR-{colour} | 1-2 | 120x45mm. May need 2 joined for wide gates |
| Wheels | XPSG-WHEEL | 2 | 80mm diameter, 20mm groove |
| Wheel Clamping Sets | XPSG-WHEEL-CS | 2 | One per wheel |
| Track (Steel 3m) | XPSG-3000-TRACK-ST | varies | Or 6m: XPSG-6000-TRACK-ST |
| Track (Aluminium 6m) | XPSG-6000-TRACK-AL | varies | Alternative to steel |
| Track Anchors | XPSG-ANCHOR | varies | For bolting track to concrete |
| Slide Guide | XPSG-GUIDE | 1 | Self-adjusting, mounts at far end |
| Top Rollers | XPSG-TOPROLL-2PK | 1 pack | Left + right roller pair |
| Gate Posts (Steel) | XPSG-2700-ST65-{colour} | 2-3 | Galv steel, includes BP + cap |
| Slats (65mm gate blade) | XP-6100-GB65-{colour} | N | Screw-fixed to rails |

### Track Length Rule
Track total length = gate panel width + pocket length. The pocket (where gate slides to) must be at least as wide as the opening.

---

## System 5: Equipment Enclosure

Horizontal slat enclosure for AC units, pool pumps, bins. Uses 65mm slats only.

### Construction
- Same as horizontal slat system but forms a 3 or 4 sided enclosure
- Each side is a panel with side frames
- Optional lid (top panel) with hinges
- Typically smaller: 900-1200mm wide × 900-1200mm deep × 600-1200mm high
- All cuts are custom to suit equipment dimensions

### Components
Same as System 1 (Horizontal Slat) but in smaller quantities. Plus:
- Extra corner posts if freestanding
- Lid hinges (if applicable)
- Often base-plated for easy relocation

---

## System 6: POSTA Letterbox

A fence-mountable letterbox that installs between two 50x50mm posts at exactly 600mm centres.

### Requirements
- 2x 50x50mm posts at 600mm centre-to-centre spacing
- Posts can be part of the fence run (dedicated letterbox bay)
- The POSTA unit itself is a separate product (not found in current price list - check availability)

### Integration with Fence
When incorporating a letterbox:
- Add an extra section to the fence with posts at 600mm apart
- The letterbox panel replaces slats in that 600mm bay
- Fence continues either side with normal panel widths
