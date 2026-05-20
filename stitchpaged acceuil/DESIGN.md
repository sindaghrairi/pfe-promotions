---
name: Growth Vision
colors:
  surface: '#fcf8fa'
  surface-dim: '#dcd9db'
  surface-bright: '#fcf8fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f5'
  surface-container: '#f0edef'
  surface-container-high: '#eae7e9'
  surface-container-highest: '#e4e2e4'
  on-surface: '#1b1b1d'
  on-surface-variant: '#45464d'
  inverse-surface: '#303032'
  inverse-on-surface: '#f3f0f2'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#006a61'
  on-secondary: '#ffffff'
  secondary-container: '#86f2e4'
  on-secondary-container: '#006f66'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#2a1700'
  on-tertiary-container: '#b87500'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#89f5e7'
  secondary-fixed-dim: '#6bd8cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#fcf8fa'
  on-background: '#1b1b1d'
  surface-variant: '#e4e2e4'
typography:
  headline-xl:
    fontFamily: Manrope
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  xs: 0.5rem
  sm: 1rem
  md: 1.5rem
  lg: 2.5rem
  xl: 4rem
  gutter: 1.5rem
  container-max: 1280px
---

## Brand & Style

This design system is engineered to position the platform as a high-tier leader in the growth and promotion space. The aesthetic balances the gravity of a fintech application with the vibrant energy of a marketing powerhouse. 

The core style is **Modern Glassmorphism**, utilizing translucent layers and frosted surfaces to create a sense of digital depth and airiness. This is complemented by **Minimalist** layout principles, prioritizing excessive whitespace to ensure that every promotional offer feels exclusive rather than cluttered. The visual language conveys trust through deep, stable tones, while dynamic gradients signal innovation and momentum.

## Colors

The palette is built on a foundation of **Deep Navy** (#0F172A) to provide a sophisticated, premium "anchor." This is contrasted by a **Vibrant Teal to Emerald** gradient used for primary actions and hero elements, representing growth and vitality.

- **Primary:** Deep Navy for text, primary navigation, and heavy backgrounds.
- **Secondary:** Teal/Emerald (#0D9488) used in gradients to draw the eye to conversion points.
- **Accents:** Soft Gold (#F59E0B) for "Flash Deals" or high-value alerts; Coral (#FB7185) for playful highlights and notification badges.
- **Surfaces:** A mix of pure white and ultra-light grey (#F8FAFC) to maintain a clean, high-end environment.

## Typography

This design system utilizes **Manrope** for its technical precision and modern, geometric flair. The typography strategy relies on heavy weight contrasts to establish a clear information hierarchy.

Headlines should utilize the "ExtraBold" (800) or "Bold" (700) weights with tight letter-spacing to create a "locked-in," authoritative look for marketing copy. Body text remains spacious and clean at a "Regular" (400) weight. Labels and small metadata use a "SemiBold" (600) weight with slight tracking increases to maintain legibility even at smaller scales.

## Layout & Spacing

The layout follows a **Fixed Grid** model for desktop views, centered with a maximum width of 1280px to ensure content density feels intentional and premium. 

We employ a 12-column grid system. The spacing rhythm is strictly based on an 8px scale, with significant padding (40px+) inside container cards to allow the glassmorphic effects and typography to "breathe." Sections should be separated by large vertical gaps (64px+) to prevent the user from feeling overwhelmed by the volume of promotional content.

## Elevation & Depth

Hierarchy is achieved through **Backdrop Blurs** and **Ambient Shadows**. 

1.  **Level 0 (Floor):** The light grey page background.
2.  **Level 1 (Cards):** White surfaces with a very soft, diffused 15% opacity Navy shadow (Blur: 30px, Spread: -5px).
3.  **Level 2 (Glass Overlays):** Semi-transparent white (80% opacity) with a 20px Backdrop Blur. These are used for navigation bars and floating stat cards.
4.  **Level 3 (Modals/Popovers):** Higher contrast shadows with a subtle border-stroke (1px white at 20% opacity) to simulate the edge of a glass pane.

Transitions between these states should use a 300ms "ease-out" curve to feel natural and fluid.

## Shapes

The design system leans into **Rounded** geometry to feel approachable and modern. 

Base components like small buttons or input fields utilize a 0.5rem (8px) radius. However, the defining "container" elements—such as feature cards, hero sections, and promotional banners—must use a minimum of 1rem (16px) or 1.5rem (24px) for a softer, high-end appearance. Buttons should often utilize pill-shapes (rounded-full) when they represent primary "Growth" actions.

## Components

### Buttons
- **Primary:** Linear gradient from Teal to Emerald. Rounded-full (pill). White text. Subtle glow shadow on hover.
- **Secondary:** Transparent with a 2px Deep Navy border or a glassmorphic white blur.
- **Tertiary:** Text-only with a Coral hover underline.

### Cards
Cards are the primary vehicle for promotions. They should feature high-quality imagery at the top, followed by a clear headline and a secondary-colored "Value" label (e.g., "15% Off"). Card corners should be 16px or 24px.

### Inputs
Search bars and subscription fields should use a "glass" style: a very light grey fill (5-10% opacity) with a 1px border. On focus, the border should transition to the Vibrant Teal.

### Progress & Stat Badges
Use "Micro-gradients" for progress bars and badges. Growth indicators (like "+18%") should be paired with a subtle upward-trending sparkline icon.

### Modern Transitions
All hover states on interactive cards should include a subtle "lift" (Y-axis -4px) and a slight increase in shadow spread to emphasize the physical depth of the glass layers.