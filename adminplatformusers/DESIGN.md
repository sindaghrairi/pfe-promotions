# Design System: High-End Editorial for Business Promotion

## 1. Overview & Creative North Star

### The Creative North Star: "The Strategic Architect"
This design system is built to move beyond the commoditized "SaaS look." It is defined by a philosophy of **The Strategic Architect**—a visual language that balances the authoritative depth of business management with the kinetic energy of promotion. 

We break the "template" look by rejecting rigid, boxy grids and predictable borders. Instead, we use **intentional asymmetry**, **tonal layering**, and **cinematic typography scales**. The layout should feel like a premium editorial spread: breathing room is a functional tool, not a luxury, and depth is achieved through light and shadow rather than structural lines.

---

## 2. Colors: Tonal Depth & Soul

Our palette transitions from the grounded, authoritative `primary` (#003036) to the high-energy `secondary` orange (#964900). 

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders for sectioning or containment. 
Boundaries must be defined solely through:
- **Background Color Shifts:** Place a `surface-container-low` (#e6f6ff) section against a `surface` (#f3faff) background to define area.
- **Negative Space:** Use the spacing scale to create "invisible containers" that guide the eye without trapping the content.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Each layer deeper into the stack uses a progressively higher or lower tier:
- **Level 1 (Base):** `surface` (#f3faff)
- **Level 2 (Sectioning):** `surface-container-low` (#e6f6ff)
- **Level 3 (Interactive/Cards):** `surface-container-lowest` (#ffffff) for a "lifted" feel, or `surface-container-high` (#d5ecf8) for a "recessed" feel.

### The "Glass & Gradient" Rule
To achieve a signature feel, apply `backdrop-blur` (12px–20px) to floating elements using semi-transparent variations of `surface_container_lowest`. 
- **Signature Textures:** For Hero sections and primary CTAs, use a linear gradient from `primary` (#003036) to `primary_container` (#004851) at a 135-degree angle. This adds "soul" and prevents the flatness common in budget interfaces.

---

## 3. Typography: Authority & Clarity

The system uses a dual-font approach to separate strategic "Display" from functional "Action."

*   **Display & Headlines (Manrope):** We use Manrope for all `display` and `headline` tiers. Its geometric yet slightly condensed nature feels modern and high-impact. Use `display-lg` (3.5rem) sparingly to anchor major promotional pages.
*   **Body & Labels (Inter):** We use Inter for its unparalleled readability at small scales. It provides a clean, neutral balance to the expressive Manrope headlines.

**Hierarchy as Identity:** 
High-contrast sizing is our primary tool for hierarchy. A `display-sm` headline paired directly with `body-md` text creates an editorial look that signals premium quality and intentional design.

---

## 4. Elevation & Depth: Tonal Layering

Traditional shadows are often a crutch for poor layout. In this system, depth is earned through **Tonal Layering**.

*   **The Layering Principle:** Place a `surface-container-lowest` (#ffffff) card on top of a `surface-container-low` (#e6f6ff) background. The subtle 3% shift in luminosity creates a sophisticated "lift" that feels natural and expensive.
*   **Ambient Shadows:** Where a shadow is required for floating elements (like a navigation bar or modal), use an "Ambient Shadow":
    - **Blur:** 40px–60px.
    - **Opacity:** 4%–8% of `on-surface` (#071e27).
    - **Offset:** Y: 10px, X: 0. 
*   **The "Ghost Border" Fallback:** If a border is required for accessibility (e.g., in a high-density data table), use the `outline-variant` (#bfc8ca) at **15% opacity**. High-contrast, 100% opaque borders are strictly forbidden.

---

## 5. Components

### Buttons
- **Primary:** Gradient-fill (Primary to Primary Container), `DEFAULT` (0.5rem) roundedness. 
- **Secondary:** Transparent background with a `Ghost Border` and `secondary` (#964900) text.
- **States:** On hover, primary buttons should slightly increase their "Ambient Shadow" spread rather than changing color significantly.

### Cards & Lists
- **Prohibition:** No divider lines between list items. Use 16px–24px of vertical white space or alternating backgrounds using `surface-container-low` and `surface-container-lowest`.
- **Promotion Cards:** Use `secondary_container` (#fc820c) as a very subtle 5% opacity tint for the card background to signify an "active" promotion.

### Chips
- **Action Chips:** Use `secondary_fixed` (#ffdcc6) backgrounds with `on_secondary_fixed` (#311300) text for high-impact status indicators.
- **Style:** Pill-shaped (`full` roundedness) to contrast with the more structured `DEFAULT` roundedness of cards.

### Input Fields
- **Signature Style:** No bottom-line-only inputs. Use a full container with `surface_container_highest` (#cfe6f2) background and a `Ghost Border`. When focused, the border transitions to `surface_tint` (#2d6670) at 50% opacity.

### Additional Component: The "Promotion Metric"
- A large-scale display component featuring a `display-md` number and a `label-sm` caption, used to highlight business ROI. It should sit in a `surface_container_lowest` card with a `xl` (1.5rem) corner radius.

---

## 6. Do’s and Don’ts

### Do
- **Do** use `surface-dim` (#c7dde9) for footer backgrounds to ground the layout.
- **Do** utilize "Staggered Entrance" animations (200ms delay) for cards to reinforce the premium feel.
- **Do** lean into `secondary` (#964900) for interactive elements only, keeping the `primary` deep teal as the dominant structural color.

### Don't
- **Don’t** use pure black (#000000) for text. Always use `on-surface` (#071e27) for softer, more natural contrast.
- **Don’t** use "Drop Shadows" with sharp edges or high opacity. It breaks the "Strategic Architect" aesthetic.
- **Don’t** use a standard 12-column grid for everything. Experiment with "Offset Layouts" where the headline starts on column 2 and the body text starts on column 4 to create editorial tension.
- **Don't** use lines to separate content; use `surface` shifts or whitespace.