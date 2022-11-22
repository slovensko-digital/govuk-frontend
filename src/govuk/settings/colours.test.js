const { join } = require('path')

const configPaths = require('../../../config/paths')
const { renderSass } = require('../../../lib/jest-helpers')

const sassConfig = {
  includePaths: [join(configPaths.src, 'govuk'), 'node_modules/'],
  outputStyle: 'compressed'
}

describe('Organisation colours', () => {
  it('should define websafe colours that meet contrast requirements', async () => {
    const sass = `
      @import "settings/compatibility";
      @import "settings/colours-palette";
      @import "settings/colours-organisations";
      @import "settings/colours-applied";
      @import "helpers/colour";

      @import "sass-color-helpers/stylesheets/color-helpers";

      $minimum-contrast: 4.5;

      @each $organisation in map-keys($govuk-colours-organisations) {

        $colour: govuk-organisation-colour($organisation);
        $contrast: ch-color-contrast($govuk-body-background-colour, $colour);

        @if ($contrast < $minimum-contrast) {
          @error "Contrast ratio for #{$organisation} too low."
          + " #{$colour} on #{$govuk-body-background-colour} has a contrast of: #{$contrast}."
          + " Must be higher than #{$minimum-contrast} for WCAG AA support.";
        }
      }`

    await renderSass({ data: sass, ...sassConfig })
  })
})
