---
name: Hyperlocal Collective
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3d4949'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6d7a79'
  outline-variant: '#bcc9c8'
  surface-tint: '#006a6a'
  primary: '#006a6a'
  on-primary: '#ffffff'
  primary-container: '#0ea5a5'
  on-primary-container: '#003333'
  inverse-primary: '#5ed8d8'
  secondary: '#576060'
  on-secondary: '#ffffff'
  secondary-container: '#d8e1e1'
  on-secondary-container: '#5b6465'
  tertiary: '#95491d'
  on-tertiary: '#ffffff'
  tertiary-container: '#d87d4d'
  on-tertiary-container: '#511e00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#7df5f5'
  primary-fixed-dim: '#5ed8d8'
  on-primary-fixed: '#002020'
  on-primary-fixed-variant: '#004f50'
  secondary-fixed: '#dbe4e4'
  secondary-fixed-dim: '#bfc8c8'
  on-secondary-fixed: '#151d1d'
  on-secondary-fixed-variant: '#404849'
  tertiary-fixed: '#ffdbcb'
  tertiary-fixed-dim: '#ffb692'
  on-tertiary-fixed: '#341100'
  on-tertiary-fixed-variant: '#773206'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  container-margin: 20px
  gutter: 16px
---

## Brand & Style
The design system is centered on fostering a sense of belonging, trust, and local connectivity. The brand personality is approachable yet dependable, bridging the gap between digital utility and physical community.

The visual style is **Contemporary Minimalism** with a focus on high-clarity layouts. It leverages generous whitespace to reduce cognitive load, ensuring that community news and neighborly interactions remain the focus. Elements are soft and welcoming, utilizing rounded geometry and subtle depth to create a friendly, "neighborly" interface that feels modern and lightweight.

## Colors
The palette is anchored by a vibrant Teal, representing growth and community vitality. 

- **Primary Teal (#0EA5A5):** Used for key actions, active states, and brand-defining moments.
- **Secondary Mint (#F0F9F9):** A soft tint used for large surface areas, highlight backgrounds, and subtle decorative gradients to soften the UI.
- **Neutral Slate (#64748B):** Provides high-legibility text and icon contrast without the harshness of pure black.
- **Surface & Background:** A pure white background is used for the primary canvas, while a very light gray is reserved for card containers and grouping elements to provide a gentle structural hierarchy.

Subtle teal gradients should be applied with a 45-degree angle, transitioning from `#0EA5A5` to `#2DD4BF` at low opacity for a modern, luminous feel.

## Typography
The design system utilizes **Inter** exclusively to maintain a clean, systematic, yet friendly appearance. 

Tight letter spacing is applied to larger headlines to provide a confident, modern "editorial" look for community news. Body text uses a standard tracking with a generous line height to ensure maximum readability for long-form community posts. Use weight as the primary driver of hierarchy—bold headers for navigation and medium weights for interactive labels.

## Layout & Spacing
This design system follows a **8px soft grid** to ensure consistency across all components.

- **Mobile:** Uses a single-column fluid layout with 20px side margins and 16px gutters between cards.
- **Tablet/Desktop:** Content is centered in a max-width container (1200px) using a 12-column grid.
- **Negative Space:** Whitespace is treated as a functional element. Group related items with 8px–12px gaps, but separate distinct sections with 40px+ to maintain a clear visual breath.

## Elevation & Depth
Depth is created through **Ambient Shadows** rather than stark borders. This reinforces the "clean and soft" brand personality.

- **Level 0 (Flat):** Used for the main background canvas.
- **Level 1 (Surface):** Light gray surfaces used for subtle grouping in lists.
- **Level 2 (Cards):** Used for feed items and interactive blocks. Shadows are extremely diffused: `0px 4px 20px rgba(0, 0, 0, 0.04)`.
- **Level 3 (Overlays):** Used for modals and floating action buttons. Higher diffusion: `0px 12px 32px rgba(14, 165, 165, 0.1)`. Note the subtle teal tint in the shadow to create a luminous, modern effect.

## Shapes
The shape language is defined by significant roundedness to evoke friendliness. 

- **Containers & Cards:** Use a minimum of 16px (`rounded-lg`) corner radius to create a soft, modern look.
- **Buttons:** Use 12px for standard actions and fully rounded (pill-shaped) for primary call-to-actions.
- **Inputs:** Maintain a consistent 12px radius to match the button aesthetic.
- **Avatars:** Always circular to emphasize the human, personal nature of a local community.

## Components

- **Buttons:** Primary buttons use a solid Teal fill with white text. Secondary buttons use the Mint tint background with Teal text. Avoid heavy borders; use subtle depth or color shifts for hover states.
- **Cards:** The hallmark of the system. 16px border radius, white background, and Level 2 ambient shadow. Internal padding should be a minimum of 20px.
- **Input Fields:** Use a subtle light gray fill (`#F1F5F9`) with no border in their default state. On focus, transition to a white background with a 2px Teal outline.
- **Chips/Tags:** Used for "Tags" (e.g., #Events, #HelpWanted). Pill-shaped with Secondary Mint background and Teal text.
- **Lists:** Clean, edge-to-edge on mobile with 1px light gray dividers that do not touch the screen edges (inset dividers).
- **Community Markers:** Map markers or location pins should use the Teal gradient for a high-tech, modern feel within the map view.