# MashuPack Sister-App Style Guide

Use this document as the visual and interaction brief for any new product that should feel like it belongs in the same family as MashuPack.

The goal is not to copy MashuPack screen-for-screen. The goal is to reproduce its design logic: warm paper surfaces, crisp ink typography, restrained terracotta accents, compact professional controls, generous breathing room, and clear information hierarchy.

## 1. Product character

A MashuPack sister app should feel:

- Warm, calm, and trustworthy rather than cold or aggressively technical.
- Professional and precise, but not corporate or sterile.
- Editorial in its typography and spacing, with software-tool clarity.
- Dense enough for serious work, but never cramped.
- Quiet by default. Important actions and current state should carry the visual emphasis.

The visual metaphor is "paper and ink for modern software": warm cream backgrounds, dark brown-black text, thin neutral rules, white translucent working surfaces, and one saffron/terracotta product accent.

Avoid the common dark SaaS, neon developer-tool, glassmorphism, and card-dashboard aesthetics. Do not make every section a raised card. Prefer one coherent workspace divided by spacing, rules, and subtle surface shifts.

## 2. Non-negotiable family traits

These are the strongest signals that make another app look related to MashuPack:

1. Warm cream canvas instead of pure white or cool gray.
2. Ink-colored text rather than neutral black.
3. Fraunces for brand and prominent display moments.
4. Inter Tight for interface copy and controls.
5. JetBrains Mono for paths, filenames, counts, shortcuts, code, metadata, and machine-like information.
6. One primary terracotta/saffron accent used selectively.
7. Thin borders and dividers do most of the structural work.
8. Soft, low-opacity white surfaces rather than heavy gray panels.
9. Compact controls with clear labels, small radii, and restrained shadows.
10. Helpful microcopy near actions so the user understands what will happen.

## 3. Core design tokens

Use OKLCH where supported. These are the current MashuPack source tokens and should be treated as the starting palette.

```css
:root {
  /* Warm paper canvas */
  --bg:        oklch(0.97 0.005 80);
  --bg-2:      oklch(0.95 0.005 80);
  --surface:   oklch(0.98 0.004 80);
  --surface-2: oklch(0.92 0.005 80);

  /* Rules and separators */
  --line:      oklch(0.78 0.008 80 / 0.70);
  --line-soft: oklch(0.78 0.008 80 / 0.35);

  /* Ink hierarchy */
  --ink:       oklch(0.22 0.013 70);
  --ink-2:     oklch(0.34 0.013 70);
  --ink-3:     oklch(0.50 0.013 70);
  --ink-4:     oklch(0.65 0.013 70);

  /* Product accent */
  --accent:      oklch(0.68 0.13 50);
  --accent-2:    oklch(0.64 0.11 44);
  --accent-soft: oklch(0.68 0.13 50 / 0.12);

  /* Semantic colors: reserve for meaning */
  --positive: oklch(0.62 0.14 155);
  --warn:     oklch(0.65 0.16 50);
  --danger:   oklch(0.58 0.20 25);

  /* Shape */
  --radius-sm: 6px;
  --radius:    10px;
  --radius-lg: 14px;

  /* Depth */
  --shadow-small:  0 1px 2px rgb(0 0 0 / 0.04);
  --shadow-medium: 0 6px 24px rgb(0 0 0 / 0.08);

  /* Type */
  --font-ui:   "Inter Tight", "Inter", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "Fira Code", monospace;
  --font-disp: "Fraunces", "Inter Tight", serif;
}
```

### Color rules

- Use `--bg` as the main application canvas.
- Use `--bg-2` for quiet secondary regions or hover fills.
- Use translucent white, such as `oklch(1 0 0 / 0.5)` to `0.9`, for work surfaces.
- Use `--ink` only for the most important copy.
- Use `--ink-2` for standard body and control text.
- Use `--ink-3` for explanatory copy and secondary metadata.
- Use `--ink-4` for labels, placeholders, subtle counts, and inactive states.
- Use `--accent` for the main action, selection state, focus, active navigation, and a few brand moments.
- Do not spread the accent across every icon, border, heading, and control.
- Use green, red, or other hues only when they communicate status or file/content type.

## 4. Typography system

### Display and brand: Fraunces

Use Fraunces for:

- The product wordmark.
- Large empty-state headlines.
- Important page titles.
- Hero statistics where an editorial feel improves hierarchy.

Typical treatment:

```css
font-family: var(--font-disp);
font-weight: 500-600;
letter-spacing: -0.02em to -0.04em;
line-height: 1.04 to 1.2;
```

Use italic Fraunces sparingly for one highlighted word in a hero statement. The highlighted word may use the accent.

### Interface: Inter Tight

Use Inter Tight for:

- Navigation.
- Buttons.
- Labels.
- Descriptions.
- Forms.
- General product copy.

Default interface copy should be compact and highly legible, generally 12-14px with a 1.5-1.7 line height.

### Machine information: JetBrains Mono

Use JetBrains Mono for:

- Filenames and paths.
- Code and structured text.
- File sizes and counts.
- Keyboard shortcuts.
- Export metadata.
- Small technical labels.

Do not use monospace for ordinary explanations or all navigation. Its purpose is to distinguish machine-readable information from human guidance.

### Label style

Section labels often use:

```css
font-size: 10px to 11px;
font-weight: 600;
letter-spacing: 0.10em to 0.18em;
text-transform: uppercase;
color: var(--ink-4);
```

## 5. Layout and spacing

MashuPack uses a workspace layout, not a dashboard of cards.

### Application shell

A typical desktop shell contains:

- A 52-56px top bar.
- A left navigation, tree, or source panel.
- A narrow draggable divider where resizing is useful.
- A flexible main workspace.
- An optional right information or settings rail on wider screens.
- A 56-60px bottom action or status bar when the workflow benefits from persistent actions.

Use CSS Grid for the top-level shell. Let the main workspace absorb available width. Side panels should be visually separated with 1px rules, not floating containers.

### Spacing rhythm

Use a compact 4px-based rhythm:

- 4-6px: micro gaps inside controls.
- 8-10px: closely related controls.
- 12-16px: standard component padding.
- 18-24px: section spacing.
- 32-48px: large empty-state or documentation spacing.

The interface should have visible whitespace around major regions, but individual controls can remain compact.

### Responsive behavior

- Hide secondary metadata before shrinking essential controls.
- Collapse or remove the optional right rail at narrower widths.
- Let the left panel narrow, but preserve readable filenames and labels.
- At genuinely small mobile widths, prefer a purpose-built simplified view rather than squeezing the full desktop workspace into a phone.

## 6. Surfaces, borders, and depth

The family look depends on restrained depth.

### Borders

- Default border: `1px solid var(--line)`.
- Quiet separators: `1px solid var(--line-soft)`.
- Active selection may use a 2px accent edge or a narrow accent bar.
- Dashed borders are appropriate for drop zones and upload targets.

### Surfaces

- Primary canvas: warm cream.
- Working surfaces: translucent white or nearly white warm surfaces.
- Secondary panels: subtle warm tint, not dark gray.
- Hover state: a slight increase in white opacity or a faint ink wash.

### Shadows

Use shadows only when an element genuinely floats:

- Small buttons and thumbnails: `--shadow-small`.
- Modals, drag overlays, toasts, and major menus: `--shadow-medium`.
- Primary actions may use a warm accent-colored shadow and a faint inset highlight.

Never stack multiple heavy shadows. Do not add shadows to every section.

## 7. Component language

### Primary button

The primary button is the strongest visual object in the workflow. It should be used for the single action that completes or advances the task.

```css
background: var(--accent);
color: #fff;
border: 1px solid var(--accent);
border-radius: 8px;
font-weight: 600;
box-shadow:
  0 1px 0 oklch(0.75 0.16 50 / 0.50) inset,
  0 4px 14px oklch(0.62 0.16 50 / 0.22);
```

On hover, deepen the terracotta slightly. Do not introduce a new hue or dramatic gradient.

### Secondary button

- White or translucent white background.
- Ink text.
- Thin neutral border.
- Very small shadow.
- Slightly warmer fill on hover.

### Ghost button

- Transparent background.
- No shadow.
- Low-emphasis ink text.
- Reveal a faint surface and border on hover.

### Inputs and search

- 38-40px high.
- 10px radius.
- Translucent white background.
- Thin border.
- Placeholder in `--ink-4`.
- Accent focus ring: `0 0 0 3px var(--accent-soft)`.
- Keyboard shortcut hints may appear as small bordered mono badges inside the field.

### Tabs

- Use text tabs on a shared baseline rather than pill buttons.
- Inactive tabs are `--ink-3`.
- Active tab is `--ink` with a 2px accent underline.
- Avoid putting the tab bar inside a separate card.

### Rows and lists

For trees, tables, file lists, presets, or media rows:

- Use compact 34-38px rows.
- Keep the row background transparent by default.
- Add a faint ink wash on hover.
- Show selection with a soft accent tint and a narrow accent marker.
- Use tabular numbers for sizes and counts.
- Prefer ellipsis over wrapping filenames or machine identifiers.

### Checkboxes

- 16px square, 4px radius.
- White background with an ink-gray border.
- Accent fill when selected.
- White hand-drawn-style check or minus mark.
- Visible accent focus outline.

### Chips and pills

Use pills for filters, status, scope, and compact metadata, not as the default shape for every button.

- Neutral pills: transparent or warm white, thin border, mono text.
- Active filter pills: accent background with white text.
- Status pills: soft semantic tint with matching text.

### Drop zones and empty states

A MashuPack-style empty state should be inviting rather than blank.

- Center a concise editorial headline and practical subcopy.
- Use a large dashed drop zone with a faint warm radial accent glow.
- Place the upload/folder icon in an accent-tinted square with a larger radius.
- State privacy or processing behavior directly beneath the action.
- Keep the whole composition spacious and calm.

### Modals and overlays

- Warm white modal on the cream canvas.
- 12-16px radius.
- Thin border and medium shadow.
- Optional 3px accent strip along the top.
- Full-screen drag overlays may use a translucent cream backdrop with 8px blur.

### Thumbnails and previews

For image-heavy sister apps:

- Use modest 8-10px radii.
- Apply a soft, low-opacity shadow to smaller thumbnails so they lift from the paper surface.
- Selected thumbnails receive an accent outline or narrow marker, not a large colored card.
- The main preview should be allowed to dominate the workspace with minimal chrome around it.

## 8. Information hierarchy and microcopy

Every major control should answer three questions:

1. What does this do?
2. What is currently selected or in scope?
3. What will happen when I continue?

Use short explanatory lines below complex controls. Examples:

- "Exports 1080 x 1920."
- "Nothing is uploaded. Files stay in your browser."
- "Downloads as one ZIP file."
- "Stats and exports reflect your current selection."

Use plain language. Avoid technical jargon unless the user needs it to make a decision.

A useful pattern is `data-help` or contextual hover help: the interface can expose a one-line explanation in a persistent bottom help area without filling the screen with tooltips.

## 9. Motion and interaction

Motion should be short and functional:

- 120-180ms for color, border, shadow, and opacity changes.
- 1px lift on hover is acceptable for browse buttons or compact controls.
- 1px downward movement on press gives tactile feedback.
- Use transform and opacity for overlays and notifications.
- Avoid bouncy springs, large zooms, or decorative page transitions.

Focus must remain visible. Use a 2px accent outline with a 2px offset, or a soft accent halo around fields.

## 10. What to avoid

Do not:

- Use pure white as the entire app background.
- Use cool blue-gray as the dominant neutral.
- Make the app monochrome except for one overused accent.
- Put cards inside cards.
- Add thick borders or high-contrast panel boxes everywhere.
- Use large 20px+ radii on ordinary controls.
- Turn all navigation into pills.
- Use gradients as decoration across the whole interface.
- Apply the display serif to body copy, tables, or dense controls.
- Use monospace for all text.
- Use colorful icons without semantic reason.
- Hide essential explanations behind unlabeled icons.
- Make every action equally prominent.

## 11. Sister-app adaptation rules

A sister app may change its layout to fit its job, but it should retain the family DNA.

Keep constant:

- The cream-and-ink foundation.
- The typography roles.
- The terracotta primary accent.
- The compact radii and restrained shadows.
- The editorial headline plus practical interface-copy combination.
- The use of dividers and whitespace instead of nested cards.
- The primary action treatment.

Adapt as needed:

- Panel arrangement.
- Whether a left source rail or right settings rail exists.
- Whether the bottom bar is persistent.
- Domain-specific semantic colors and icons.
- Density of rows, previews, and data visualizations.

For an image tool, for example, the main preview may dominate the center, thumbnails may run along the bottom, and export settings may occupy a right rail. It will still look like MashuPack if the chrome, type, spacing, colors, controls, and action hierarchy follow this guide.

## 12. AI implementation brief

Paste the following instruction before describing the new product:

> Design this product as a sister application to MashuPack. Use a warm paper-and-ink visual system: cream OKLCH backgrounds, ink-brown text hierarchy, translucent white work surfaces, thin warm-neutral rules, compact 6-14px radii, and restrained soft shadows. Use Fraunces for the brand and important display headings, Inter Tight for the interface, and JetBrains Mono for paths, filenames, counts, shortcuts, and technical metadata. Use a single terracotta/saffron product accent for the primary action, selection, focus, and active navigation. Reserve other colors for semantic meaning. Structure the interface as one coherent workspace divided by whitespace and hairline rules, not a dashboard of nested cards. Keep controls compact, labels explicit, focus states visible, and add short practical microcopy explaining consequential actions. The result should feel warm, editorial, precise, calm, and professional.

Then provide the product-specific requirements, user flow, and screen structure.

## 13. Acceptance checklist

A result belongs in the MashuPack family when:

- The first impression is warm paper and dark ink.
- The product feels calm even when it contains dense information.
- Fraunces, Inter Tight, and JetBrains Mono have distinct jobs.
- Terracotta clearly identifies the main action and current state.
- Most structure comes from spacing and thin rules.
- Buttons, fields, and rows are compact and legible.
- Shadows are soft and limited to floating elements.
- Technical metadata is easy to scan.
- The interface explains what important actions will do.
- The new app looks related to MashuPack without appearing to be the same product with different labels.

## Source of truth

This guide synthesizes the current `junovhs/mashu` styling and layout from:

- `src/css/app.css`
- `src/css/components.css`
- `src/css/tree.css`
- `src/css/viewer.css`
- `src/css/modals.css`
- `src/css/report.css`
- `src/css/stats.css`
- `src/css/dropoverlay.css`
- `src/css/extensions.css`
- `src/ts/ui/layout.ts`
- `index.html`
- `REDESIGN_README.md`
