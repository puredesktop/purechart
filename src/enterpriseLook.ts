import { createGlobalStyle } from 'styled-components'

/**
 * Pure Server marks the page it serves `<html data-pure-look="enterprise">`;
 * PureDesktop never does. Every rule here, and every `${enterprise} &` block
 * in the components, applies only under that mark, so the desktop app is
 * unchanged. Chrome gets near-square corners, hairlines instead of shadows,
 * quiet sans labels and neutral selected states; primary actions keep the
 * accent the theme supplies. The chart itself is content and keeps its own
 * palette.
 */
export const enterprise = ":root[data-pure-look='enterprise']"

export const EnterpriseLook = createGlobalStyle`
  /* The White sidebar's cream hover, warm hairline and sage labels give way to
     the neutral values around them. html outranks the shared appearance rule. */
  html${enterprise}[data-platform-appearance] [data-chrome='sidebar'] {
    --pure-chrome-line: inherit;
    --pure-chrome-fence: inherit;
    --pure-chrome-muted: inherit;
    --pure-chrome-hover: inherit;
    --pure-chrome-selection: inherit;
  }
`
