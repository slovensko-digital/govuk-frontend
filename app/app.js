const express = require('express')
const fileUpload = require('express-fileupload')
const app = express()
const bodyParser = require('body-parser')
const nunjucks = require('nunjucks')
const util = require('util')
const fs = require('fs')
const path = require('path')
const writer = require('express-writer')
const cookieParser = require('cookie-parser')
const FormData = require('form-data')
const axios = require('axios')

if (app.get('env') === 'development') {
  require('dotenv').config()
}

const readdir = util.promisify(fs.readdir)

const helperFunctions = require('../lib/helper-functions')
const fileHelper = require('../lib/file-helper')
const configPaths = require('../config/paths.json')
const endToEndHelpers = require('../app/views/examples/end-to-end/lib/helpers')

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
  app.use('/app/slovensko.sk/opravnenia/assets', express.static('app/views/examples/end-to-end/app-slovensko-sk-opravnenia/assets'))

  app.use(cookieParser())

  // serve html5-shiv from node modules
  app.use('/vendor/html5-shiv/', express.static('node_modules/html5shiv/dist/'))
  app.use('/assets', express.static(path.join(configPaths.src, 'assets')))

  // Turn form POSTs into data that can be used for validation.
  app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }))

  // Handle the banner component serverside.
  require('./banner.js')(app)

  // Define routes

  endToEndRoutes(app)

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
      if (error) {
        next(error)
      } else {
        res.send(html)
      }
    })
  })

  // Component 'README' page
  app.get('/components/:component', function (req, res, next) {
    // make variables available to nunjucks template
    res.locals.componentPath = req.params.component

    res.render('component', function (error, html) {
      if (error) {
        next(error)
      } else {
        res.send(html)
      }
    })
  })
  // Component 'README' page
  app.get('/custom-components/:custom_component', function (req, res, next) {
    // make variables available to nunjucks template
    res.locals.componentPath = req.params.custom_component

    res.render('custom_component', function (error, html) {
      if (error) {
        next(error)
      } else {
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

    if (!exampleConfig) {
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
    if (req.query.iframe) {
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

    if (!exampleConfig) {
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
    if (req.query.iframe) {
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

    if (!exampleConfig) {
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
    if (req.query.iframe) {
      bodyClasses = 'app-iframe-in-component-preview'
    }

    res.render('component-preview', { bodyClasses, previewLayout })
  })

  // Example view
  app.get('/examples/:example/:action?', function (req, res, next) {
    res.render(`${req.params.example}/${req.params.action || 'index'}`, function (error, html) {
      if (error) {
        next(error)
      } else {
        res.send(html)
      }
    })
  })

  /**
   * PODANIE: Aplikacia na poslanie spravy do schranky na slovensko.sk
   */
  function endToEndRoutes (app) {
    /**
     * APP: TRVALY POBYT
     */
    const appTrvalyPobyt = function (app) {
      app.get('/app/trvaly-pobyt', function (req, res, next) {
        endToEndHelpers.withUserSession(req, res, true)
          .then(function (locals) {
            res.locals = { ...res.locals, ...locals }

            if (req.query.permissions && req.query.permissions === 'denied') {
              res.locals.show_permissions_denied_message = true
            }

            res.locals.loginConfig = endToEndHelpers.loginConfig({}, req, res.locals)

            endToEndHelpers.render(res, 'trvaly-pobyt', 'index', next)
          })
          .catch(function (error) {
            console.log(error)
            next()
          })
      })

      app.post('/app/trvaly-pobyt/receive-signed', function (req, res, next) {
        endToEndHelpers.withUserSession(req, res, true).then(function (locals) {
          const bucket = JSON.parse(req.body.bucket)
          locals.bucket = bucket
          res.locals = locals

          endToEndHelpers.render(res, 'trvaly-pobyt', 'receiveSigned', next)
        })
      })

      app.post('/app/trvaly-pobyt', function (req, res, next) {
        endToEndHelpers.withUserSession(req, res, true)
          .then(function (locals) {
            const isSubmitted = req.body.submit !== undefined
            const people = req.body.people
            const address = req.body.address

            if (isSubmitted) {
              const formData = new FormData()

              formData.append('apiKey', 'super-secret-api-key')
              formData.append('message', 'Podpiste ' + (people.length > 1 ? 'vsetky dokumenty' : 'dokument') + ' s prihlasenim na trvaly pobyt.')
              formData.append('successUrl', locals.base_url + 'app/trvaly-pobyt/receive-signed')
              formData.append('failUrl', locals.base_url + 'app/trvaly-pobyt')

              let fileIndex = 1

              people.forEach(function (name) {
                formData.append('file-' + fileIndex, generateRtfFile(name, address, locals.user.name), {
                  filename: 'trvaly-pobyt-' + removeDiacritics(name).replace(/ +/, '-').toLowerCase() + '.rtf',
                  contentType: 'application/rtf'
                })

                fileIndex++
              })

              axios.post(locals.base_url + 'app/podpisovac/api/create-bucket', formData, {
                headers: formData.getHeaders()
              }).then(({ data }) => {
                res.redirect('/app/podpisovac?bucket-id=' + data.bucketId)
              }).catch(({ response: { status, data } }) => {
                res.status(status).send(data)
              })
            } else {
              res.redirect('/app/trvaly-pobyt')
            }
          })
          .catch(function (error) {
            console.log(error)
            next()
          })
      })

      app.get('/app/trvaly-pobyt/odhlasenie', function (req, res, next) {
        endToEndHelpers.withUserSession(req, res, true).then(function (locals) {
          if (locals.user === null) {
            res.clearCookie('obo')
            res.clearCookie('fake_user')
          } else {
            res.clearCookie('obo')
            res.clearCookie('fake_user')
            // const token = userRequestToken(locals.user)
            // axios.post(
            //   'https://slovensko-sk-api.ekosystem.staging.slovensko.digital/logout', // DEV
            //   { callback: 'asd' },
            //   { headers: { Authorization: `Bearer ${token}` } }
            // )
            //   .then(function () {
            //     console.log('success')
            //     res.cookie('obo', null, { httpOnly: true })
            //     res.send({ success: true })
            //   })
            //   .catch(function (e) {
            //     console.log(e, 'not success!!')
            //     res.send(e)
            //   })
          }

          res.redirect('/app/trvaly-pobyt')
        }).catch(function (error) {
          console.log(error)
          res.redirect('/app/trvaly-pobyt')
        })
      })
    }

    const appPodavac = function (app) {
      app.post('/app/podavac/api/send', function (req, res, next) {
        endToEndHelpers.withUserSession(req, res, true).then(function (locals) {
          if (req.body.apiKey !== 'super-secret-api-key') {
            res.status(401).send('Wrong Credentials')

            return 0
          }

          const messageData = {
            RecipientId: req.body.RecipientId,
            MessageSubject: req.body.MessageSubject,
            Form: req.body.form,
            SuccessUrl: req.body.successUrl,
            FailUrl: req.body.failUrl,
            Files: []
          }

          let signedFiles = {}

          if (req.body.SignedFiles !== undefined) {
            if (Array.isArray(req.body.SignedFiles)) {
              req.body.SignedFiles.forEach(function (i) {
                signedFiles[i] = true
              })
            } else {
              signedFiles[req.body.SignedFiles] = true
            }
          }

          if (req.files !== undefined && req.files !== null) {
            let fileIndex = 0
            Object.keys(req.files).forEach(function (i) {
              let file = req.files[i]
              file.data =
                messageData.Files.push({
                  data: file.toString('base64'),
                  mimeType: file.mimetype,
                  name: file.name,
                  isSigned: signedFiles[fileIndex] || false
                })
            })
            fileIndex++
          }

          if (messageData.Files.length > 3) {
            res.status(400).send('No Many Files')

            return 0
          }

          function calculateBufferId (data) {
            return Buffer.from(JSON.stringify(data)).toString('base64')
          }

          let bufferId = calculateBufferId(messageData)

          if (bufferId.length > 1900) {
            messageData.Files.forEach(function (file, i) {
              file.data = Buffer.from('Originálny súbor ' + file.name + ' bol pre demo účely nahradený textovým súborom.').toString('base64')
              file.mimeType = 'text/plain'
              file.name = file.name + '.txt'

              messageData.Files[i] = file
            })

            bufferId = calculateBufferId(messageData)
          }

          endToEndHelpers.sendMessage(locals.user, messageData)
            .then(({ data }) => {
              res.send(data)
            })
            .catch(({ response: { status, data } }) => {
              res.status(status).send(data)
            })

          endToEndHelpers.render(res, 'podavac', 'index', next)
        })
      })
    }

    const appPodpisovac = function (app) {
      app.get('/app/podpisovac', function (req, res, next) {
        let bucket = JSON.parse(Buffer.from(req.query['bucket-id'], 'base64'))
        bucket.files.forEach(function (file, i) {
          if (file.special_file === 'pdf-agreement') {
            bucket.files[i].data = fs.readFileSync(agreementPdfFile()).toString('base64')
          }
        })

        res.locals.back_url = bucket.successUrl
        res.locals.bucket = bucket
        res.locals.bucket_json = JSON.stringify(bucket)

        endToEndHelpers.render(res, 'podpisovac', 'index', next)
      })

      app.get('/app/podpisovac/api/create-bucket', function (req, res, next) {
        res.redirect('/examples/podanie/test-uploadu-suborov-na-podpis')
      })

      app.post('/app/podpisovac/api/create-bucket', function (req, res, next) {
        if (req.body.apiKey !== 'super-secret-api-key' && req.body.apiKey !== 'super-secret-special-key-for-agreement-pdf') {
          res.status(401).send('Wrong Credentials')

          return 0
        }

        if (req.files === undefined || req.files === null || req.files.length === 0) {
          res.status(400).send('No Files')

          return 0
        }

        if (req.files.length > 3) {
          res.status(400).send('No Many Files')

          return 0
        }

        const isSpecialPdfFile = req.body.apiKey === 'super-secret-special-key-for-agreement-pdf'
        let filesData = []

        Object.keys(req.files).forEach(function (i) {
          let file = req.files[i]
          if (isSpecialPdfFile) {
            filesData.push({ special_file: 'pdf-agreement', mimeType: file.mimetype, name: file.name })
          } else {
            filesData.push({ data: file.data.toString('base64'), mimeType: file.mimetype, name: file.name })
          }
        })

        const responseData = {
          successUrl: req.body.successUrl,
          failUrl: req.body.failUrl,
          message: req.body.message,
          files: filesData
        }

        function calculateBufferId (data) {
          return Buffer.from(JSON.stringify(data)).toString('base64')
        }

        let bufferId = calculateBufferId(responseData)

        if (bufferId.length > 1900) {
          filesData = []

          Object.keys(req.files).forEach(function (i) {
            let file = req.files[i]
            filesData.push({
              data: Buffer.from('Originálny súbor ' + file.name + ' bol nahradený textovým súborom, aby v demo implementácii nebol prekročený limit na maximálnu veľkosť bucketu.').toString('base64'),
              mimeType: 'text/plain',
              name: file.name + '.txt'
            })
          })

          responseData.files = filesData

          bufferId = calculateBufferId(responseData)
        }

        res.send({
          demoInstruction: 'Go to ' + req.protocol + '://' + req.headers.host + '/examples/end-to-end/test-podpisovanie-bucketu and enter bucketId to the form.              ',
          bucketId: bufferId
        })
      })

      app.post('/app/podpisovac/api/podpisujsk-credentials', function (req, res, next) {
        res.send({
          status_url: 'http://127.0.0.1:14741/',
          login_url: 'http://127.0.0.1:14741/login',
          sign_url: 'http://127.0.0.1:14741/sign',
          params: {
            username: process.env.PODPISUJSK_USERNAME,
            partnerId: process.env.PODPISUJSK_PARTNER_ID,
            authorizationCode: endToEndHelpers.podpisujskAuthorizationCode()
          }
        })
      })
    }

    const appFakeLogin = function (app) {
      app.get('/app/fake-login', function (req, res, next) {
        res.locals.next_url = req.query.next_url
        endToEndHelpers.render(res, 'fake-login', 'index', next)
      })
    }

    const appSlovenskoSkOpravnenia = function (app) {
      app.post('/app/slovensko.sk/opravnenia', function (req, res, next) {
        if (req.query['sign'] === 'success') {
          endToEndHelpers.render(res, 'slovensko-sk-opravnenia', 'grantPermissions', next)
        }
      })

      app.get('/app/slovensko.sk/opravnenia', function (req, res, next) {
        res.locals.is_signed = req.query.signed === 'true'

        if (req.query.sign && req.query.sign === 'failed') {
          res.locals.show_sign_failed_message = true
        }

        endToEndHelpers.render(res, 'slovensko-sk-opravnenia', 'index', next)
      })

      app.get('/app/slovensko.sk/opravnenia/agreement', function (req, res, next) {
        endToEndHelpers.withUserSession(req, res, true).then(function (locals) {
          res.locals = locals
          if (locals.user) {
            endToEndHelpers.render(res, 'slovensko-sk-opravnenia', 'agreement', next)
          } else {
            res.redirect(locals.login_url)
          }
        })
      })

      app.get('/app/slovensko.sk/opravnenia/podpis', function (req, res, next) {
        const formData = new FormData()
        const baseUrl = req.protocol + '://' + req.headers.host + '/'

        formData.append('apiKey', 'super-secret-special-key-for-agreement-pdf')
        formData.append('message', 'Potvrdenie udelenia oprávnení pre aplikáciu Prihlásenie na trvalý pobyt')
        formData.append('successUrl', baseUrl + 'app/slovensko.sk/opravnenia?sign=success')
        formData.append('failUrl', baseUrl + 'app/slovensko.sk/opravnenia?sign=failed')
        formData.append('file', agreementPdfFileStream(), {
          filename: 'dohoda-o-udeleni-opravneni.pdf',
          contentType: 'application/pdf'
        })

        axios.post(baseUrl + 'app/podpisovac/api/create-bucket', formData, {
          headers: formData.getHeaders()
        }).then(({ data }) => {
          res.redirect('/app/podpisovac?bucket-id=' + data.bucketId)
        }).catch(({ response: { status, data } }) => {
          res.status(status).send(data)
        })
      })
    }

    const appSlovenskoSkLogin = function (app) {
      app.get('/app/slovensko.sk/login', function (req, res, next) {
        // res.locals.login_url = 'https://podaas.ekosystem.staging.slovensko.digital/login'
        res.locals.login_url = 'https://slovensko-sk-api.ekosystem.staging.slovensko.digital/login'
        res.locals.next_url = req.query.next_url

        endToEndHelpers.render(res, 'slovensko-sk-login', 'index', next)
      })

      // slovensko.sk vola pre dev prostredie natvrdo POST localhost/auth/saml/callback url a preto je nutne redirectnut
      // (odoslanim POST formulara) na https://slovensko-sk-api.ekosystem.staging.slovensko.digital/auth/saml/callback
      // co finalne zavola GET /auth/saml/callback (routa je definovana nizsie)
      app.post('/auth/saml/callback', function (req, res, next) {
        res.locals = req.body
        endToEndHelpers.render(res, 'slovensko-sk-login', 'auth-callback-rely', next)
      })
    }

    appTrvalyPobyt(app)
    appFakeLogin(app)
    appSlovenskoSkLogin(app)
    appSlovenskoSkOpravnenia(app)
    appPodpisovac(app)
    appPodavac(app)

    const agreementPdfFile = function () {
      return path.join(configPaths.examples, 'end-to-end', 'app-slovensko-sk-opravnenia', 'assets', 'dohoda-o-udeleni-opravneni.pdf')
    }

    const agreementPdfFileStream = function () {
      return fs.createReadStream(agreementPdfFile())
    }

    /*
    *
    *
    *
    *
    *
    *
    *
    *
    *
    *
    *
    *
    *
    */

    app.get('/examples/podanie/odoslanie', function (req, res, next) {
      const formData = JSON.parse(decodeURIComponent(req.cookies['podanie-form-data']))

      res.locals.subject = formData.subject
      res.locals.message = formData.message

      next()
    })

    app.post('/examples/podanie/udelenie-opravneni-agreement', function (req, res, next) {
      res.locals.is_signed = req.query.signed === 'true'

      next()
    })

    app.get('/examples/podanie/udelenie-opravneni', function (req, res, next) {
      const fileName = 'dohoda-o-udeleni-opravneni.pdf'
      res.locals.agreement_file = {
        name: fileName,
        mime_type: 'application/pdf',
        content: fs.readFileSync(path.join(configPaths.examples, 'podanie', 'assets', fileName)).toString('base64'),
        description: 'Potvrdenie udelenia oprávnení pre aplikáciu Prihlásenie na trvalý pobyt'
      }

      next()
    })

    app.post('/examples/podanie/:action?', function (req, res, next) {
      res.locals.back_url = req.body.back_url

      if (req.body.files !== undefined && req.body.files.length === 1) {
        res.locals.file = req.body.files[0]
      }

      next()
    })

    // app.get('/examples/:example/:action?', endToEndHelpers.defaultResponseWithSession)

    // app.post('/examples/podanie/:action?', function (req, res, next) {
    //   defaultResponseWithSession(req, res, function () {
    //     res.render(`podanie/${req.params.action || 'index'}`, function (error, html) {
    //       if (error) {
    //         next(error)
    //       } else {
    //         res.send(html)
    //       }
    //     })
    //   })
    // })

    // function permissions (req, locals, payload) {
    //   payload.permissions_required = (req.cookies['podanie-settings-user-granted-permissions'] !== 'yes')
    //   payload.permissions_url = locals.base_url + 'examples/podanie/udelenie-opravneni'
    //   return payload
    // }

    // app.post('/podanie/login', function (req, res, next) {
    //   withUserSession(req, res, true)
    //     .then(function (locals) {
    //       res.send(permissions(req, locals, login({}, req, locals, req.body.next_url)))
    //     })
    //     .catch(function (error) {
    //       console.log(error)
    //       res.send({ error: error })
    //     })
    // })

    // app.post('/podanie/submit', function (req, res, next) {
    //   withUserSession(req, res, true)
    //     .then(function (locals) {
    //       let payload = {
    //         file: null
    //       }
    //
    //       if (req.files) {
    //         const file = req.files.file
    //         payload.file = { data: file.data.toString('base64'), mimeType: file.mimetype, name: file.name }
    //       }
    //
    //       payload = permissions(req, locals, login(payload, req, locals, 'examples/podanie/udelenie-opravneni'))
    //
    //       if (payload.permissions_required && req.cookies['podanie-settings-login-flow'] === 'during_auth') {
    //         payload.login_required = false
    //       }
    //
    //       res.send(payload)
    //     })
    //     .catch(function (error) {
    //       console.log(error)
    //       res.send({ error: error })
    //     })
    // })

    app.post('/podanie/send', function (req, res, next) {
      withUserSession(req, res, true)
        .then(function (locals) {
          // console.log(locals)
          // let { messageSubject, objects: { form, attachments } } = req.body

          let token = userRequestToken(locals.user)

          let message = nunjucks.render(path.join('podanie', 'templates', 'sktalk_envelope.xml.njk'), {
            messageId: uuidv1(),
            correlationId: uuidv1(),
            senderId: locals.user.sub,
            messageSubject: 'test', // messageSubject,
            form: {
              id: uuidv1(),
              name: 'test.txt',
              description: 'test file',
              encoding: 'Base64',
              mimeType: 'plain/text',
              isSigned: 'false',
              content: 'VGVzdG92YWNpYSBzcHJhdmE='
            },
            // form: { id: uuidv1(), ...form },
            attachments: [] // attachments.map(attachment => ({ id: uuidv1(), ...attachment }))
          })

          axios.post(
            // 'https://podaas.ekosystem.staging.slovensko.digital/api/sktalk/receive_and_save_to_outbox', // FIX
            'https://slovensko-sk-api.ekosystem.staging.slovensko.digital/api/sktalk/receive_and_save_to_outbox', // DEV
            { message },
            { headers: { Authorization: `Bearer ${token}` } }
          ).then(({ data }) => {
            res.send(data)
          }).catch(({ response: { status, data } }) => {
            res.status(status).send(data)
          })
        })
        .catch(function (error) {
          console.log(error)
          res.send({ error: error })
        })
    })

    // const { subject, message } = req.body
    // response.xml = {
    //   data: Buffer.from(nunjucks.render(path.join('podanie', 'templates', 'general_agenda.xml.njk'), {
    //     subject,
    //     text: message
    //   })).toString('base64'),
    //   mimeType: 'application/xml',
    //   name: 'form.xml'
    // }

    // app.get('/auth/saml/callback', function (req, res, next) {
    //   res.cookie('obo', req.query.token, { httpOnly: true })
    //   res.redirect('/examples/podanie/podpisovanie')
    // })

    // app.get('/examples/podanie/odhlasenie', function (req, res, next) {
    //   const token = userRequestToken(res.locals.user)
    //
    //   const form = {
    //     name: 'test',
    //     description: 'test',
    //     encoding: 'Base64',
    //     mimeType: 'text/plain',
    //     isSigned: 'true',
    //     content: Buffer.from('test content').toString('base64')
    //   }
    //
    //   let message = nunjucks.render(path.join('podanie', 'templates', 'sktalk_envelope.xml.njk'), {
    //     messageId: uuidv1(),
    //     correlationId: uuidv1(),
    //     senderId: res.locals.user.sub,
    //     messageSubject: 'test',
    //     form: { id: uuidv1(), ...form },
    //     attachments: [] // attachments.map(attachment => ({ id: uuidv1(), ...attachment }))
    //   })
    //
    //   console.log(message)
    //
    //   // axios.get('https://slovensko-sk-api.ekosystem.staging.slovensko.digital/logout', {
    //   axios.post(
    //     // 'https://podaas.ekosystem.staging.slovensko.digital/api/sktalk/receive_and_save_to_outbox', // FIX
    //     'https://slovensko-sk-api.ekosystem.staging.slovensko.digital/api/sktalk/receive_and_save_to_outbox', // DEV
    //     { message },
    //     { headers: { Authorization: `Bearer ${token}` } }
    //   ).then(({ data }) => {
    //     res.send(data)
    //   })
    //     //   .catch(({ response: { status, data } }) => {
    //     //   res.status(status).send(data)
    //     // })
    //     .catch(function (error) {
    //       // console.log(error)
    //       res.send(error)
    //     })
    //
    //   // axios.get('https://slovensko-sk-api.ekosystem.staging.slovensko.digital/logout', {
    // })

    function generateRtfFile (name, address, sender) {
      const rtfTemplate = '{\\rtf1\\f0\\b\\fs48 \\cf0 Prihlasenie na trvaly pobyt\\fs36 \\\n' +
        '\\\n' +
        '\n' +
        '~CONTENT~' +
        'S pozdravom\\\n' +
        '~SENDER~}'

      const rtfLine = '\\f1\\b0 Prihlasujem osobu \\f0\\b ~NAME~\\f1\\b0  na trvaly pobyt na adresu \\f0\\b ~ADDRESS~\\f1\\b0 .\\\n' +
        '\\\n' +
        '\n'

      return rtfTemplate
        .replace('~CONTENT~', rtfLine
          .replace('~NAME~', removeDiacritics(name))
          .replace('~ADDRESS~', removeDiacritics(address)))
        .replace('~SENDER~', removeDiacritics(sender))
    }

    const defaultDiacriticsRemovalMap = [
      {
        'base': 'A',
        'letters': /[\u0041\u24B6\uFF21\u00C0\u00C1\u00C2\u1EA6\u1EA4\u1EAA\u1EA8\u00C3\u0100\u0102\u1EB0\u1EAE\u1EB4\u1EB2\u0226\u01E0\u00C4\u01DE\u1EA2\u00C5\u01FA\u01CD\u0200\u0202\u1EA0\u1EAC\u1EB6\u1E00\u0104\u023A\u2C6F]/g
      },
      { 'base': 'AA', 'letters': /[\uA732]/g },
      { 'base': 'AE', 'letters': /[\u00C6\u01FC\u01E2]/g },
      { 'base': 'AO', 'letters': /[\uA734]/g },
      { 'base': 'AU', 'letters': /[\uA736]/g },
      { 'base': 'AV', 'letters': /[\uA738\uA73A]/g },
      { 'base': 'AY', 'letters': /[\uA73C]/g },
      { 'base': 'B', 'letters': /[\u0042\u24B7\uFF22\u1E02\u1E04\u1E06\u0243\u0182\u0181]/g },
      { 'base': 'C', 'letters': /[\u0043\u24B8\uFF23\u0106\u0108\u010A\u010C\u00C7\u1E08\u0187\u023B\uA73E]/g },
      {
        'base': 'D',
        'letters': /[\u0044\u24B9\uFF24\u1E0A\u010E\u1E0C\u1E10\u1E12\u1E0E\u0110\u018B\u018A\u0189\uA779]/g
      },
      { 'base': 'DZ', 'letters': /[\u01F1\u01C4]/g },
      { 'base': 'Dz', 'letters': /[\u01F2\u01C5]/g },
      {
        'base': 'E',
        'letters': /[\u0045\u24BA\uFF25\u00C8\u00C9\u00CA\u1EC0\u1EBE\u1EC4\u1EC2\u1EBC\u0112\u1E14\u1E16\u0114\u0116\u00CB\u1EBA\u011A\u0204\u0206\u1EB8\u1EC6\u0228\u1E1C\u0118\u1E18\u1E1A\u0190\u018E]/g
      },
      { 'base': 'F', 'letters': /[\u0046\u24BB\uFF26\u1E1E\u0191\uA77B]/g },
      {
        'base': 'G',
        'letters': /[\u0047\u24BC\uFF27\u01F4\u011C\u1E20\u011E\u0120\u01E6\u0122\u01E4\u0193\uA7A0\uA77D\uA77E]/g
      },
      {
        'base': 'H',
        'letters': /[\u0048\u24BD\uFF28\u0124\u1E22\u1E26\u021E\u1E24\u1E28\u1E2A\u0126\u2C67\u2C75\uA78D]/g
      },
      {
        'base': 'I',
        'letters': /[\u0049\u24BE\uFF29\u00CC\u00CD\u00CE\u0128\u012A\u012C\u0130\u00CF\u1E2E\u1EC8\u01CF\u0208\u020A\u1ECA\u012E\u1E2C\u0197]/g
      },
      { 'base': 'J', 'letters': /[\u004A\u24BF\uFF2A\u0134\u0248]/g },
      {
        'base': 'K',
        'letters': /[\u004B\u24C0\uFF2B\u1E30\u01E8\u1E32\u0136\u1E34\u0198\u2C69\uA740\uA742\uA744\uA7A2]/g
      },
      {
        'base': 'L',
        'letters': /[\u004C\u24C1\uFF2C\u013F\u0139\u013D\u1E36\u1E38\u013B\u1E3C\u1E3A\u0141\u023D\u2C62\u2C60\uA748\uA746\uA780]/g
      },
      { 'base': 'LJ', 'letters': /[\u01C7]/g },
      { 'base': 'Lj', 'letters': /[\u01C8]/g },
      { 'base': 'M', 'letters': /[\u004D\u24C2\uFF2D\u1E3E\u1E40\u1E42\u2C6E\u019C]/g },
      {
        'base': 'N',
        'letters': /[\u004E\u24C3\uFF2E\u01F8\u0143\u00D1\u1E44\u0147\u1E46\u0145\u1E4A\u1E48\u0220\u019D\uA790\uA7A4]/g
      },
      { 'base': 'NJ', 'letters': /[\u01CA]/g },
      { 'base': 'Nj', 'letters': /[\u01CB]/g },
      {
        'base': 'O',
        'letters': /[\u004F\u24C4\uFF2F\u00D2\u00D3\u00D4\u1ED2\u1ED0\u1ED6\u1ED4\u00D5\u1E4C\u022C\u1E4E\u014C\u1E50\u1E52\u014E\u022E\u0230\u00D6\u022A\u1ECE\u0150\u01D1\u020C\u020E\u01A0\u1EDC\u1EDA\u1EE0\u1EDE\u1EE2\u1ECC\u1ED8\u01EA\u01EC\u00D8\u01FE\u0186\u019F\uA74A\uA74C]/g
      },
      { 'base': 'OI', 'letters': /[\u01A2]/g },
      { 'base': 'OO', 'letters': /[\uA74E]/g },
      { 'base': 'OU', 'letters': /[\u0222]/g },
      { 'base': 'P', 'letters': /[\u0050\u24C5\uFF30\u1E54\u1E56\u01A4\u2C63\uA750\uA752\uA754]/g },
      { 'base': 'Q', 'letters': /[\u0051\u24C6\uFF31\uA756\uA758\u024A]/g },
      {
        'base': 'R',
        'letters': /[\u0052\u24C7\uFF32\u0154\u1E58\u0158\u0210\u0212\u1E5A\u1E5C\u0156\u1E5E\u024C\u2C64\uA75A\uA7A6\uA782]/g
      },
      {
        'base': 'S',
        'letters': /[\u0053\u24C8\uFF33\u1E9E\u015A\u1E64\u015C\u1E60\u0160\u1E66\u1E62\u1E68\u0218\u015E\u2C7E\uA7A8\uA784]/g
      },
      {
        'base': 'T',
        'letters': /[\u0054\u24C9\uFF34\u1E6A\u0164\u1E6C\u021A\u0162\u1E70\u1E6E\u0166\u01AC\u01AE\u023E\uA786]/g
      },
      { 'base': 'TZ', 'letters': /[\uA728]/g },
      {
        'base': 'U',
        'letters': /[\u0055\u24CA\uFF35\u00D9\u00DA\u00DB\u0168\u1E78\u016A\u1E7A\u016C\u00DC\u01DB\u01D7\u01D5\u01D9\u1EE6\u016E\u0170\u01D3\u0214\u0216\u01AF\u1EEA\u1EE8\u1EEE\u1EEC\u1EF0\u1EE4\u1E72\u0172\u1E76\u1E74\u0244]/g
      },
      { 'base': 'V', 'letters': /[\u0056\u24CB\uFF36\u1E7C\u1E7E\u01B2\uA75E\u0245]/g },
      { 'base': 'VY', 'letters': /[\uA760]/g },
      { 'base': 'W', 'letters': /[\u0057\u24CC\uFF37\u1E80\u1E82\u0174\u1E86\u1E84\u1E88\u2C72]/g },
      { 'base': 'X', 'letters': /[\u0058\u24CD\uFF38\u1E8A\u1E8C]/g },
      {
        'base': 'Y',
        'letters': /[\u0059\u24CE\uFF39\u1EF2\u00DD\u0176\u1EF8\u0232\u1E8E\u0178\u1EF6\u1EF4\u01B3\u024E\u1EFE]/g
      },
      {
        'base': 'Z',
        'letters': /[\u005A\u24CF\uFF3A\u0179\u1E90\u017B\u017D\u1E92\u1E94\u01B5\u0224\u2C7F\u2C6B\uA762]/g
      },
      {
        'base': 'a',
        'letters': /[\u0061\u24D0\uFF41\u1E9A\u00E0\u00E1\u00E2\u1EA7\u1EA5\u1EAB\u1EA9\u00E3\u0101\u0103\u1EB1\u1EAF\u1EB5\u1EB3\u0227\u01E1\u00E4\u01DF\u1EA3\u00E5\u01FB\u01CE\u0201\u0203\u1EA1\u1EAD\u1EB7\u1E01\u0105\u2C65\u0250]/g
      },
      { 'base': 'aa', 'letters': /[\uA733]/g },
      { 'base': 'ae', 'letters': /[\u00E6\u01FD\u01E3]/g },
      { 'base': 'ao', 'letters': /[\uA735]/g },
      { 'base': 'au', 'letters': /[\uA737]/g },
      { 'base': 'av', 'letters': /[\uA739\uA73B]/g },
      { 'base': 'ay', 'letters': /[\uA73D]/g },
      { 'base': 'b', 'letters': /[\u0062\u24D1\uFF42\u1E03\u1E05\u1E07\u0180\u0183\u0253]/g },
      { 'base': 'c', 'letters': /[\u0063\u24D2\uFF43\u0107\u0109\u010B\u010D\u00E7\u1E09\u0188\u023C\uA73F\u2184]/g },
      {
        'base': 'd',
        'letters': /[\u0064\u24D3\uFF44\u1E0B\u010F\u1E0D\u1E11\u1E13\u1E0F\u0111\u018C\u0256\u0257\uA77A]/g
      },
      { 'base': 'dz', 'letters': /[\u01F3\u01C6]/g },
      {
        'base': 'e',
        'letters': /[\u0065\u24D4\uFF45\u00E8\u00E9\u00EA\u1EC1\u1EBF\u1EC5\u1EC3\u1EBD\u0113\u1E15\u1E17\u0115\u0117\u00EB\u1EBB\u011B\u0205\u0207\u1EB9\u1EC7\u0229\u1E1D\u0119\u1E19\u1E1B\u0247\u025B\u01DD]/g
      },
      { 'base': 'f', 'letters': /[\u0066\u24D5\uFF46\u1E1F\u0192\uA77C]/g },
      {
        'base': 'g',
        'letters': /[\u0067\u24D6\uFF47\u01F5\u011D\u1E21\u011F\u0121\u01E7\u0123\u01E5\u0260\uA7A1\u1D79\uA77F]/g
      },
      {
        'base': 'h',
        'letters': /[\u0068\u24D7\uFF48\u0125\u1E23\u1E27\u021F\u1E25\u1E29\u1E2B\u1E96\u0127\u2C68\u2C76\u0265]/g
      },
      { 'base': 'hv', 'letters': /[\u0195]/g },
      {
        'base': 'i',
        'letters': /[\u0069\u24D8\uFF49\u00EC\u00ED\u00EE\u0129\u012B\u012D\u00EF\u1E2F\u1EC9\u01D0\u0209\u020B\u1ECB\u012F\u1E2D\u0268\u0131]/g
      },
      { 'base': 'j', 'letters': /[\u006A\u24D9\uFF4A\u0135\u01F0\u0249]/g },
      {
        'base': 'k',
        'letters': /[\u006B\u24DA\uFF4B\u1E31\u01E9\u1E33\u0137\u1E35\u0199\u2C6A\uA741\uA743\uA745\uA7A3]/g
      },
      {
        'base': 'l',
        'letters': /[\u006C\u24DB\uFF4C\u0140\u013A\u013E\u1E37\u1E39\u013C\u1E3D\u1E3B\u017F\u0142\u019A\u026B\u2C61\uA749\uA781\uA747]/g
      },
      { 'base': 'lj', 'letters': /[\u01C9]/g },
      { 'base': 'm', 'letters': /[\u006D\u24DC\uFF4D\u1E3F\u1E41\u1E43\u0271\u026F]/g },
      {
        'base': 'n',
        'letters': /[\u006E\u24DD\uFF4E\u01F9\u0144\u00F1\u1E45\u0148\u1E47\u0146\u1E4B\u1E49\u019E\u0272\u0149\uA791\uA7A5]/g
      },
      { 'base': 'nj', 'letters': /[\u01CC]/g },
      {
        'base': 'o',
        'letters': /[\u006F\u24DE\uFF4F\u00F2\u00F3\u00F4\u1ED3\u1ED1\u1ED7\u1ED5\u00F5\u1E4D\u022D\u1E4F\u014D\u1E51\u1E53\u014F\u022F\u0231\u00F6\u022B\u1ECF\u0151\u01D2\u020D\u020F\u01A1\u1EDD\u1EDB\u1EE1\u1EDF\u1EE3\u1ECD\u1ED9\u01EB\u01ED\u00F8\u01FF\u0254\uA74B\uA74D\u0275]/g
      },
      { 'base': 'oi', 'letters': /[\u01A3]/g },
      { 'base': 'ou', 'letters': /[\u0223]/g },
      { 'base': 'oo', 'letters': /[\uA74F]/g },
      { 'base': 'p', 'letters': /[\u0070\u24DF\uFF50\u1E55\u1E57\u01A5\u1D7D\uA751\uA753\uA755]/g },
      { 'base': 'q', 'letters': /[\u0071\u24E0\uFF51\u024B\uA757\uA759]/g },
      {
        'base': 'r',
        'letters': /[\u0072\u24E1\uFF52\u0155\u1E59\u0159\u0211\u0213\u1E5B\u1E5D\u0157\u1E5F\u024D\u027D\uA75B\uA7A7\uA783]/g
      },
      {
        'base': 's',
        'letters': /[\u0073\u24E2\uFF53\u00DF\u015B\u1E65\u015D\u1E61\u0161\u1E67\u1E63\u1E69\u0219\u015F\u023F\uA7A9\uA785\u1E9B]/g
      },
      {
        'base': 't',
        'letters': /[\u0074\u24E3\uFF54\u1E6B\u1E97\u0165\u1E6D\u021B\u0163\u1E71\u1E6F\u0167\u01AD\u0288\u2C66\uA787]/g
      },
      { 'base': 'tz', 'letters': /[\uA729]/g },
      {
        'base': 'u',
        'letters': /[\u0075\u24E4\uFF55\u00F9\u00FA\u00FB\u0169\u1E79\u016B\u1E7B\u016D\u00FC\u01DC\u01D8\u01D6\u01DA\u1EE7\u016F\u0171\u01D4\u0215\u0217\u01B0\u1EEB\u1EE9\u1EEF\u1EED\u1EF1\u1EE5\u1E73\u0173\u1E77\u1E75\u0289]/g
      },
      { 'base': 'v', 'letters': /[\u0076\u24E5\uFF56\u1E7D\u1E7F\u028B\uA75F\u028C]/g },
      { 'base': 'vy', 'letters': /[\uA761]/g },
      { 'base': 'w', 'letters': /[\u0077\u24E6\uFF57\u1E81\u1E83\u0175\u1E87\u1E85\u1E98\u1E89\u2C73]/g },
      { 'base': 'x', 'letters': /[\u0078\u24E7\uFF58\u1E8B\u1E8D]/g },
      {
        'base': 'y',
        'letters': /[\u0079\u24E8\uFF59\u1EF3\u00FD\u0177\u1EF9\u0233\u1E8F\u00FF\u1EF7\u1E99\u1EF5\u01B4\u024F\u1EFF]/g
      },
      {
        'base': 'z',
        'letters': /[\u007A\u24E9\uFF5A\u017A\u1E91\u017C\u017E\u1E93\u1E95\u01B6\u0225\u0240\u2C6C\uA763]/g
      }
    ]

    function removeDiacritics (str) {
      for (let i = 0; i < defaultDiacriticsRemovalMap.length; i++) {
        str = str.replace(defaultDiacriticsRemovalMap[i].letters, defaultDiacriticsRemovalMap[i].base)
      }
      return str
    }
  }

  // Full page example views
  require('./full-page-examples.js')(app)

  app.get('/robots.txt', function (req, res) {
    res.type('text/plain')
    res.send('User-agent: *\nDisallow: /')
  })

  return app
}
