const express = require('express')
const fileUpload = require('express-fileupload')
const app = express()
const bodyParser = require('body-parser')
const nunjucks = require('nunjucks')
const util = require('util')
const fs = require('fs')
const path = require('path')
const writer = require('express-writer')

// for examples/podanie/odoslanie
const jwt = require('jsonwebtoken')
const uuidv1 = require('uuid/v1')
const axios = require('axios')

const readdir = util.promisify(fs.readdir)

const helperFunctions = require('../lib/helper-functions')
const fileHelper = require('../lib/file-helper')
const configPaths = require('../config/paths.json')

// Set up views
const appViews = [
  configPaths.layouts,
  configPaths.views,
  configPaths.examples,
  configPaths.fullPageExamples,
  configPaths.components,
  configPaths.src
]

module.exports = (options) => {
  const nunjucksOptions = options ? options.nunjucks : {}

  // Configure nunjucks
  let env = nunjucks.configure(appViews, {
    autoescape: true, // output with dangerous characters are escaped automatically
    express: app, // the express app that nunjucks should install to
    noCache: true, // never use a cache and recompile templates each time
    trimBlocks: true, // automatically remove trailing newlines from a block/tag
    lstripBlocks: true, // automatically remove leading whitespace from a block/tag
    watch: true, // reload templates when they are changed. needs chokidar dependency to be installed
    ...nunjucksOptions // merge any additional options and overwrite defaults above.
  })

  writer.setWriteDirectory('./dist/html')

  // make the function available as a filter for all templates
  env.addFilter('componentNameToMacroName', helperFunctions.componentNameToMacroName)

  // static html export
  // if (app.get('env') === 'dist') {
  // app.use(writer.watch)
  // }

  // Set view engine
  app.set('view engine', 'njk')

  app.use(fileUpload())

  // Disallow search index indexing
  app.use(function (req, res, next) {
    // none - Equivalent to noindex, nofollow
    // noindex - Do not show this page in search results and do not show a
    //   "Cached" link in search results.
    // nofollow - Do not follow the links on this page
    res.setHeader('X-Robots-Tag', 'none')
    next()
  })

  // Set up middleware to serve static assets
  app.use('/public', express.static(configPaths.public))

  app.use('/docs', express.static(configPaths.sassdoc))

  // serve html5-shiv from node modules
  app.use('/vendor/html5-shiv/', express.static('node_modules/html5shiv/dist/'))
  app.use('/assets', express.static(path.join(configPaths.src, 'assets')))

  // Turn form POSTs into data that can be used for validation.
  app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }))

  // Handle the banner component serverside.
  require('./banner.js')(app)

  // Define routes

  // Index page - render the component list template
  app.get('/', async function (req, res) {
    const components = fileHelper.allComponents
    const sdnComponents = fileHelper.allSdnComponents
    const examples = await readdir(path.resolve(configPaths.examples))
    const fullPageExamples = await readdir(path.resolve(configPaths.fullPageExamples))

    res.render('index', {
      componentsDirectory: components,
      sdnComponentsDirectory: sdnComponents,
      examplesDirectory: examples,
      fullPageExamplesDirectory: fullPageExamples
    })
  })

  // Index page - render the component list template
  app.get('/homepage', async function (req, res) {
    const components = fileHelper.allComponents
    const sdnComponents = fileHelper.allSdnComponents
    const examples = await readdir(path.resolve(configPaths.examples))

    res.render('homepage', {
      componentsDirectory: components,
      sdnComponentsDirectory: sdnComponents,
      examplesDirectory: examples
    })
  })

  // Whenever the route includes a :component parameter, read the component data
  // from its YAML file
  app.param('component', function (req, res, next, componentName) {
    res.locals.componentData = fileHelper.getComponentData(componentName)
    next()
  })

  // Whenever the route includes a :component parameter, read the component data
  // from its YAML file
  app.param('custom_component', function (req, res, next, componentName) {
    res.locals.sdnComponentData = fileHelper.getSdnComponentData(componentName)
    next()
  })

  // All components view
  app.get('/components/all', function (req, res, next) {
    const components = fileHelper.allComponents

    res.locals.componentData = components.map(componentName => {
      let componentData = fileHelper.getComponentData(componentName)
      let defaultExample = componentData.examples.find(
        example => example.name === 'default'
      )
      return {
        componentName,
        examples: [defaultExample]
      }
    })
    res.render(`all-components`, function (error, html) {
      if (error)
      {
        next(error)
      }
      else
      {
        res.send(html)
      }
    })
  })

  // Component 'README' page
  app.get('/components/:component', function (req, res, next) {
    // make variables available to nunjucks template
    res.locals.componentPath = req.params.component

    res.render('component', function (error, html) {
      if (error)
      {
        next(error)
      }
      else
      {
        res.send(html)
      }
    })
  })
  // Component 'README' page
  app.get('/custom-components/:custom_component', function (req, res, next) {
    // make variables available to nunjucks template
    res.locals.componentPath = req.params.custom_component

    res.render('custom_component', function (error, html) {
      if (error)
      {
        next(error)
      }
      else
      {
        res.send(html)
      }
    })
  })

  // Component example preview
  app.get('/components/_custom/:custom_component/:example*?/preview', function (req, res, next) {
    // Find the data for the specified example (or the default example)
    let componentName = req.params.custom_component
    let requestedExampleName = req.params.example || 'default'

    let previewLayout = res.locals.sdnComponentData.previewLayout || 'layout'

    let exampleConfig = res.locals.sdnComponentData.examples.find(
      example => example.name.replace(/ /g, '-') === requestedExampleName
    )

    if (!exampleConfig)
    {
      next()
    }

    // Construct and evaluate the component with the data for this example
    let macroName = helperFunctions.componentNameToMacroName(componentName)
    let macroParameters = JSON.stringify(exampleConfig.data, null, '\t')

    res.locals.componentView = env.renderString(
      `{% from '_custom/${componentName}/macro.njk' import ${macroName} %}
      {{ ${macroName}(${macroParameters}) }}`
    )

    let bodyClasses = ''
    if (req.query.iframe)
    {
      bodyClasses = 'app-iframe-in-component-preview'
    }

    res.render('component-preview', { bodyClasses, previewLayout })
  })

  // Component example preview
  app.get('/components/:component/:example*?/preview', function (req, res, next) {
    // Find the data for the specified example (or the default example)
    let componentName = req.params.component
    let requestedExampleName = req.params.example || 'default'

    let previewLayout = res.locals.componentData.previewLayout || 'layout'

    let exampleConfig = res.locals.componentData.examples.find(
      example => example.name.replace(/ /g, '-') === requestedExampleName
    )

    if (!exampleConfig)
    {
      next()
    }

    // Construct and evaluate the component with the data for this example
    let macroName = helperFunctions.componentNameToMacroName(componentName)
    let macroParameters = JSON.stringify(exampleConfig.data, null, '\t')

    res.locals.componentView = env.renderString(
      `{% from '${componentName}/macro.njk' import ${macroName} %}
      {{ ${macroName}(${macroParameters}) }}`
    )

    let bodyClasses = ''
    if (req.query.iframe)
    {
      bodyClasses = 'app-iframe-in-component-preview'
    }

    res.render('component-preview', { bodyClasses, previewLayout })
  })

  // Component example preview
  app.get('/custom-components/:custom_component/:example*?/preview', function (req, res, next) {
    // Find the data for the specified example (or the default example)
    let componentName = req.params.custom_component
    let requestedExampleName = req.params.example || 'default'

    let previewLayout = res.locals.sdnComponentData.previewLayout || 'layout'

    let exampleConfig = res.locals.sdnComponentData.examples.find(
      example => example.name.replace(/ /g, '-') === requestedExampleName
    )

    if (!exampleConfig)
    {
      next()
    }

    // Construct and evaluate the component with the data for this example
    let macroName = helperFunctions.componentNameToMacroName(componentName)
    let macroParameters = JSON.stringify(exampleConfig.data, null, '\t')

    res.locals.componentView = env.renderString(
      `{% from '_custom/${componentName}/macro.njk' import ${macroName} %}
      {{ ${macroName}(${macroParameters}) }}`
    )

    let bodyClasses = ''
    if (req.query.iframe)
    {
      bodyClasses = 'app-iframe-in-component-preview'
    }

    res.render('component-preview', { bodyClasses, previewLayout })
  })

  // Example view
  app.get('/examples/:example/:action?', function (req, res, next) {
    res.render(`${req.params.example}/${req.params.action || 'index'}`, function (error, html) {
      if (error)
      {
        next(error)
      }
      else
      {
        res.send(html)
      }
    })
  })

  app.post('/podanie-submit', function (req, res, next) {
    const response = {}
    const { subject, message } = req.body

    response.xml = {
      data: Buffer.from(nunjucks.render(path.join('podanie', 'templates', 'general_agenda.xml.njk'), { subject, text: message })).toString('base64'),
      mimeType: 'application/xml',
      name: 'form.xml',
    }

    if (req.files)
    {
      var file = req.files.file
      response.file = { data: file.data.toString('base64'), mimeType: file.mimetype, name: file.name }
    }
    else
    {
      response.file = null
    }

    res.send(response)
  })

  app.post('/examples/podanie/odoslanie', function (req, res, next) {
    var { oboToken, messageSubject, objects: { form, attachments } } = req.body

    privateKey = fs.readFileSync(path.join(configPaths.examples, 'podanie', 'api-key.pem'))
    var token = jwt.sign({
        obo: oboToken,
        exp: Math.floor(Date.now() / 1000) + 1000,
        jti: uuidv1()
      },
      privateKey,
      {
        algorithm: 'RS256',
        header: {
          cty: 'JWT',
        }
      }
    )

    var message = nunjucks.render(path.join('podanie', 'templates', 'sktalk_envelope.xml.njk'), {
      messageId: uuidv1(),
      correlationId: uuidv1(),
      senderId: jwt.decode(oboToken).sub,
      messageSubject,
      form: {id: uuidv1(), ...form},
      attachments: attachments.map(attachment => ({id: uuidv1(), ...attachment})),
    })

    axios.post(
      // 'https://podaas.ekosystem.staging.slovensko.digital/api/sktalk/receive_and_save_to_outbox', //FIX
      'https://slovensko-sk-api.ekosystem.staging.slovensko.digital/api/sktalk/receive_and_save_to_outbox', //DEV
      { message },
      { headers: { Authorization: `Bearer ${token}`} }
    ).then(({data}) => {
      res.send(data)
    }).catch(({response: {status, data}}) => {
      res.status(status).send(data)
    })
  })

  // Full page example views
  require('./full-page-examples.js')(app)

  app.get('/robots.txt', function (req, res) {
    res.type('text/plain')
    res.send('User-agent: *\nDisallow: /')
  })

  return app
}
