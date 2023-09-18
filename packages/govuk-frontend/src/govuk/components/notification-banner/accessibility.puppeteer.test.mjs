import { axe, goToComponent } from '@govuk-frontend/helpers/puppeteer'
import { getExamples } from '@govuk-frontend/lib/components'

describe('/components/notification-banner', () => {
  let axeRules

  beforeAll(() => {
    axeRules = {
      /**
       * Ignore 'The banner landmark is contained in another landmark'
       * for wrapping 'main'
       */
      'landmark-banner-is-top-level': { enabled: false },

      /**
       * Ignore 'Element has a tabindex greater than 0' for custom
       * tabindex tests
       */
      tabindex: { enabled: false }
    }
  })

  describe('component examples', () => {
    let exampleNames

    beforeAll(async () => {
      exampleNames = Object.keys(await getExamples('notification-banner'))
    })

    it('passes accessibility tests', async () => {
      for (const exampleName of exampleNames) {
        // Navigation to example, create report
        await goToComponent(page, 'notification-banner', { exampleName })
        await expect(axe(page, axeRules)).resolves.toHaveNoViolations()
      }
    }, 90000)
  })
})