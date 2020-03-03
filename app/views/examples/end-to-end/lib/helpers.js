const axios = require('axios')
const jwt = require('jsonwebtoken')
const uuidv1 = require('uuid/v1')
const crypto = require('crypto')
const nunjucks = require('nunjucks')
const path = require('path')

const loginConfig = function (payload, req, locals, nextUrl) {
  if (locals.user === null) {
    payload.login_required = true
    nextUrl = nextUrl || req.protocol + '://' + req.get('host') + req.originalUrl

    if (req.cookies['podanie-settings-use-fake-user'] === 'yes') {
      payload.login_url = '/app/fake-login' +
        '?next_url=' + encodeURI(nextUrl)
    } else {
      payload.login_url = '/app/slovensko.sk/login' +
        '?next_url=' + encodeURI(nextUrl)
    }
  } else {
    payload.login_required = false
  }

  return payload
}

const withUserSession = function (req, res, verifyUserSession) {
  return new Promise(function (resolve) {
    let result = {}
    let token = null

    result.base_url = req.protocol + '://' + req.headers.host + '/'

    result.login_url = result.base_url + 'app/trvaly-pobyt'

    if (req.cookies['podanie-settings-use-fake-user'] === 'yes') {
      try {
        result.user = JSON.parse(decodeURIComponent(req.cookies.fake_user))
      } catch (e) {
        result.user = null
      }

      if (result.user !== null) {
        token = 'fake-token'
      }
    } else {
      token = req.query.token ? req.query.token : req.cookies.obo
      result.user = token ? userFromJwt(token) : null
    }

    if (result.user !== null) {
      res.cookie('obo', token, { httpOnly: true })
      result.user.obo_token = token
    } else {
      res.clearCookie('obo')
    }

    if (result.user !== null && verifyUserSession && token !== 'fake-token') {
      console.log('Checking user session...')
      axios.get('https://slovensko-sk-api.ekosystem.staging.slovensko.digital/api/upvs/user/info.saml', {
        headers: { Authorization: 'Bearer ' + userRequestToken(result.user) }
      }).then(function () {
        resolve(result)
      })
        .catch(function (response) {
          result.user = null
          res.clearCookie('obo')
          res.clearCookie('fake_user')

          resolve(result)
        })
    } else {
      resolve(result)
    }
  })
}

const sendMessage = function (user, messageData) {
  if (user === null) {
    return new Promise(function (resolve, reject) {
      const error = new Error('User is not logged')
      error.code = 'user_not_logged'
      reject(error)
    })
  }

  const token = userRequestToken(user)
  let message = nunjucks.render(path.join('end-to-end', 'app-podavac', 'templates', 'sktalk_envelope.xml.njk'), {
    messageId: uuidv1(),
    correlationId: uuidv1(),
    senderId: user.sub,
    messageSubject: messageData.Subject,
    form: {
      id: uuidv1(),
      name: 'form.xml',
      description: 'General Agenda XML',
      encoding: 'Base64',
      mimeType: 'application/x-eform-xml',
      isSigned: 'false',
      content: Buffer.from(messageData.Form).toString('base64')
    },
    attachments: messageData.Files.map(file => ({ id: uuidv1(), ...file }))
  })

  return axios.post(
    // 'https://podaas.ekosystem.staging.slovensko.digital/api/sktalk/receive_and_save_to_outbox', // FIX
    'https://slovensko-sk-api.ekosystem.staging.slovensko.digital/api/sktalk/receive_and_save_to_outbox', // DEV
    { message },
    { headers: { Authorization: `Bearer ${token}` } }
  )
}

const userRequestToken = function (user) {
  const privateKey = Buffer.from(process.env.SLOVENSKO_DIGITAL_API_PRIVATE_KEY, 'base64').toString()

  return jwt.sign(
    {
      exp: user.exp,
      jti: uuidv1(),
      obo: user.obo_token
    },
    privateKey,
    {
      algorithm: 'RS256',
      header: {
        cty: 'JWT'
      }
    }
  )
}

const userFromJwt = function (token) {
  const base64UrlParts = token.split('.')

  if (base64UrlParts.length > 1) {
    const base64Url = base64UrlParts[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(Buffer.from(base64, 'base64').toString())
  }

  return null
}

const render = function (res, app, action, next) {
  res.render(`end-to-end/app-${app}/${action}`, function (error, html) {
    if (error) {
      if (next === null) {
        console.log(error)
      } else {
        next(error)
      }
    } else {
      res.send(html)
    }
  })
}

const podpisujskAuthorizationCode = function () {
  const privateKey = Buffer.from(process.env.PODPISUJSK_API_PRIVATE_KEY, 'base64').toString()
  const currentTime = Date.now() + ''
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(currentTime)

  return (currentTime + ':' + signer.sign(privateKey, 'base64'))
}

// exports.userRequestToken = userRequestToken
exports.withUserSession = withUserSession
exports.loginConfig = loginConfig
exports.podpisujskAuthorizationCode = podpisujskAuthorizationCode
exports.userRequestToken = userRequestToken
exports.sendMessage = sendMessage
exports.render = render
