function (user, context, callback) {
  console.log("Context: ", context);
  var GOOGLE_TOKEN_AUDIENCE = 'https://accounts.google.com/o/oauth2/token';
  var GOOGLE_AUTH_TOKEN_HOST = 'accounts.google.com';
  var GOOGLE_AUTH_TOKEN_PATH = '/o/oauth2/token';
  var GOOGLE_AUTH_TOKEN_PORT = 443;
  var ONE_HOUR_IN_SECONDS = 60 * 60;
  var JWT_ALGORITHM = 'RS256';
  var BLACKLISTED_CLAIMS = [
    'acr', 'amr', 'at_hash', 'aud', 'auth_time', 'azp', 'cnf', 'c_hash', 'exp', 'iat', 'iss', 'jti',
    'nbf', 'nonce'
  ];
  var FIREBASE_AUTH_HEADER = {
    'Content-Type': 'application/json',
    'X-Client-Version': 'Node/Admin/5.5.1'
  };
  var FIREBASE_AUTH_HOST = 'www.googleapis.com';
  var FIREBASE_AUTH_PATH = '/identitytoolkit/v3/relyingparty/';
  var FIREBASE_AUTH_PORT = 443;
  var FIREBASE_AUDIENCE = 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';

  var namespace = 'urn:smc:';
  var crypto = require('crypto');
  function md5(str, raw) {
    var hash = crypto.createHash('md5').update(str);
    if (raw)
      return hash.digest();
    return hash.digest('hex');
  }
  var jwt = require('jsonwebtoken');
  var Q = require('q');
  var request = require('request');
  // request.debug = true;
  var _ = require('lodash');
  var additionalClaims = {
    permissions: user.permissions
  };
  var uid = md5(user.email);
  var cert = JSON.parse(configuration['firebase-cert']);

  var errorCreateUser = function (error) {
    console.log("Failed to create user '" + user.email + "': ", error);
    callback(error, user, context);
  };
  getToken().then(function () {
    getUser(uid).then(function (user) {
      console.log("got user: ", user);
      if (typeof user.localId === 'undefined' || user.localId === null) {
        createUser().then(function (uid) {
          createFirebaseToken(user, context, callback);
        }).catch(errorCreateUser);
      } else {
        createFirebaseToken(user, context, callback);
      }
    }).catch(function (error) {
      console.log("No user");
      console.log("Failed to get user '" + user.email + "': ", error);
      createUser().then(function (uid) {
        createFirebaseToken(user, context, callback);
      }).catch(errorCreateUser);
    });
  });
  function createUser() {
    var newUser = {
      uid: uid,
      email: user.email,
      disabled: false
    };
    if (user.picture)
      newUser.photoUrl = user.picture;
    if (user.name)
      newUser.displayName = user.name;
    if (typeof user.emailVerified === 'boolean')
      newUser.emailVerified = user.emailVerified;
    if (typeof newUser.uid !== 'undefined') {
      newUser.localId = newUser.uid;
      delete newUser.uid;
    }
    if (typeof newUser.photoURL !== 'undefined') {
      newUser.photoUrl = newUser.photoURL;
      delete newUser.photoURL;
    }
    return invokeRequestHandler('signupNewUser', newUser)
      .then(function (response) {
        return response.localId;
      });
  }
  function getUser(uid) {
    var requestInfo = {
      localId: [uid]
    };
    return invokeRequestHandler('getAccountInfo', requestInfo)
      .then(function (response) {
        return response.users[0];
      });
  }
  function updateUser(uid, properties) {
    var request = _.cloneDeep(properties);
    request.localId = uid;
    request.deleteAttributes = [];
    var deletableParams = {
      displayName: "DISPLAY_NAME",
      photoURL: "PHOTO_URL",
      photoUrl: "PHOTO_URL"
    };
    for (var key in deletableParams) {
      if (request[key] === null) {
        request.deleteAttributes.push(deletableParams[key]);
        delete request[key];
      }
    }
    if (request.deleteAttributes.length === 0)
      delete request.deleteAttributes;
    if (request.phoneNumber === null) {
      request.deleteProvider = ['phone'];
      delete request.phoneNumber;
    } else {
      delete request.deleteProvder;
    }
    if (typeof request.phoneURL !== 'undefined') {
      request.phoineUrl = request.phoneURL;
      delete request.phoneURL;
    }
    if (typeof request.disabed !== 'undefined') {
      request.disbaleUser = request.disabled;
      delete request.disabled;
    }
    return invokeRequestHandler('setAccountInfo', request)
      .then(function(response) { return response.userId; });
  }
  function createCustomToken(uid, developerClaims) {
    var errorMessage;
    if (typeof uid !== 'string' || uid === '') {
      errorMessage = 'First argument to createCustomToken() must be a non-empty string uid.';
    }
    else if (uid.length > 128) {
      errorMessage = 'First argument to createCustomToken() must a uid with less than or equal to 128 characters.';
    }
    if (typeof errorMessage !== 'undefined') {
      throw new Error(errorMessage);
    }
    if (typeof errorMessage !== 'undefined') {
      throw new Error(errorMessage);
    }
    var jwtPayload = {};
    if (typeof developerClaims !== 'undefined') {
      var claims = {};
      for (var key in developerClaims) {
        /* istanbul ignore else */
        if (developerClaims.hasOwnProperty(key)) {
          if (BLACKLISTED_CLAIMS.indexOf(key) !== -1) {
            throw new Error("Developer claim \"" + key + "\" is reserved and cannot be specified.");
          }
          claims[key] = developerClaims[key];
        }
      }
      jwtPayload.claims = claims;
    }
    jwtPayload.uid = uid;
    var customToken = jwt.sign(jwtPayload, cert.private_key, {
      audience: FIREBASE_AUDIENCE,
      expiresIn: ONE_HOUR_IN_SECONDS,
      issuer: cert.client_email,
      subject: cert.client_email,
      algorithm: JWT_ALGORITHM
    });
    return customToken;
  }
  function createFirebaseToken(user, context, callback) {
    var customToken = createCustomToken(uid, additionalClaims);
    context.idToken[namespace + 'firebase_custom_token'] = customToken;
    callback(null, user, context);
  }
  function invokeRequestHandler(method, req) {
    var headers = _.clone(FIREBASE_AUTH_HEADER);
    return getToken().then(function (token) {
      headers['Authorization'] = 'Bearer ' + token.accessToken;
      var options = {
        method: 'POST',
        url: 'https://' + FIREBASE_AUTH_HOST + ':' + FIREBASE_AUTH_PORT + FIREBASE_AUTH_PATH + method,
        headers: headers,
        json: req
      };
      return Q.Promise(function (resolve, reject) {
        request(options, function (error, response, json) {
          if (error) {
            console.log("Request error: ", error, response, json);
            reject(error);
            return;
          }
          var statusCode = response.statusCode || 200;
          if (json.error) {
            console.log("json: ", json);
            var errorMessage = 'Error fetching access token: ' + json.error.errors.join("; ");
            if (json.error_description) {
              errorMessage += ' (' + json.error_description + ')';
            }
            reject(new Error(errorMessage));
          } else if (statusCode < 200 || statusCode > 300) {
            console.log("json: ", json);
            reject({
              statusCode: statusCode,
              error: json
            });
          }
          else {
            resolve(json);
          }
        });
      });
    });
  }
  function createAuthJwt() {
    var privateKey = cert.private_key,
      clientEmail = cert.client_email;
    var claims = {
      scope: [
        'https://www.googleapis.com/auth/firebase.database',
        'https://www.googleapis.com/auth/firebase.messaging',
        'https://www.googleapis.com/auth/identitytoolkit',
        'https://www.googleapis.com/auth/userinfo.email'
      ].join(' ')
    };
    // This method is actually synchronous so we can capture and return the buffer.
    return jwt.sign(claims, privateKey, {
      audience: GOOGLE_TOKEN_AUDIENCE,
      expiresIn: ONE_HOUR_IN_SECONDS,
      issuer: clientEmail,
      algorithm: JWT_ALGORITHM,
    });
  }

  var cachedToken = null;
  var cachedTokenPromise = null;
  function getToken(forceRefresh) {
    var expired = cachedToken && cachedToken.expirationTime < Date.now();
    if (cachedTokenPromise && !forceRefresh && !expired) {
      return cachedTokenPromise.catch(function (error) {
        console.log("Error fetching access token: ", error);
        if (cachedToken) {
          cachedTokenPromise = Q.defer().resolve(cachedToken);
          return cachedTokenPromise;
        }
        cachedTokenPromise = null;
        throw error;
      })
    } else {
      cachedTokenPromise = Q(getAccessToken())
        .then(function (result) {
          if (!_.isObject(result) ||
            typeof result.expires_in !== 'number' ||
            typeof  result.access_token !== 'string') {
            throw new Error("Invalid access token generated: \"" + JSON.stringify(result) + "\". Valid access " +
              'tokens must be an object with the "expires_in" (number) and "access_token" ' +
              '(string) properties.');
          }
          var token = {
            accessToken: result.access_token,
            expirationTime: Date.now() + (result.expires_in * 1000)
          };
          var hasAccessTokenChanged = (cachedToken && cachedToken.accessToken !== token.accessToken);
          var hasExpirationChanged = (cachedToken && cachedToken.expirationTime !== token.expirationTime);
          if (!cachedToken || hasAccessTokenChanged || hasExpirationChanged) {
            cachedToken = token;
          }
          return token;
        }).catch(function (error) {
          var errorMessage = (typeof error === 'string') ? error : error.message;
          errorMessage = 'Credential implementation provided to initializeApp() via the ' +
            '"credential" property failed to fetch a valid Google OAuth2 access token with the ' +
            ("following error: \"" + errorMessage + "\".");
          if (errorMessage.indexOf('invalid_grant') !== -1) {
            errorMessage += ' There are two likely causes: (1) your server time is not properly ' +
              'synced or (2) your certificate key file has been revoked. To solve (1), re-sync the ' +
              'time on your server. To solve (2), make sure the key ID for your key file is still ' +
              'present at https://console.firebase.google.com/iam-admin/serviceaccounts/project. If ' +
              'not, generate a new key file at ' +
              'https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk.';
          }
          throw new Error(errorMessage);
        });
      return cachedTokenPromise;
    }
  }
  function getAccessToken(forceRefresh) {
    var token = createAuthJwt();
    var options = {
      method: 'POST',
      url: 'https://' + GOOGLE_AUTH_TOKEN_HOST + ':' +
      GOOGLE_AUTH_TOKEN_PORT + GOOGLE_AUTH_TOKEN_PATH,
      form: {
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: token
      }
    };
    return Q.Promise(function (resolve, reject) {
      request(options, function (error, response, body) {
        try {
          var json = JSON.parse(body);
          if (_.isArray(json))
            json = json[0];
          if (json.error && json.error.errors.length) {
            var errorMessage = 'Error fetching access token: ' + json.error.errors.join("; ");
            if (json.error_description) {
              errorMessage += ' (' + json.error_description + ')';
            }
            reject(new Error(errorMessage));
          }
          else if (!json.access_token || !json.expires_in) {
            reject(new Error("Unexpected response while fetching access token: " + JSON.stringify(json)));
          }
          else {
            resolve(_.extend({id_token: token}, json));
          }
        }
        catch (err) {
          reject(new Error("Failed to parse access token response: " + err.toString()));
        }
      });
    });
  }
}

/*
var user = {
  "name":        "sbeck@shambhalamountain.org",
  "email":       "sbeck@shambhalamountain.org",
  "user_id":     "google-apps|sbeck@shambhalamountain.org",
  "nickname":    "scotty",
  "picture":     "http://foobar.com/pictures/jdoe.png",
  "identities": [
    {
      "provider": "google-apps",
      "user_id": "sbeck@shambhalamountain.org",
      "connection": "shambhalamountain-org",
      "isSocial": false
    }
  ],
  "permissions": ["read-any:user", "read-any:timecard", "read:reports"]
};
context = {
  "clientID":            "2b4dzaAE6l0gaAAlE3ufshMTIeJBG508",
  "clientName":          "Gotime Web Client",
  "connection":          "google-apps",
  "connectionStrategy":  "oauth2",
  "protocol":            "oidc-basic-profile",
  "request": {
    "query":             { "scope": "openid email profile" },
    "body":              {},
    "userAgent":         "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/32.0.1700.107 Safari/537.36",
    "ip":                "X.X.X.X",
    "geoip":             { "country_code":"AR", "country_code3":"ARG", "country_name":"Argentina", "region":"08", "city":"Federal", "postal_code":"3180", "latitude":-30.954599380493164, "longitude":-58.78329849243164, "continent_code":"SA", "time_zone":"America/Argentina/Buenos_Aires" }  },
  "samlConfiguration":   {},
  "stats":               { "loginsCount": 5 },
  "accessToken":         {},
  "idToken":             {}
};

entry(user, context, function (error, context, user) {
  if (error) {
    console.log("Error: ", error);
  }
  console.log("Context: ", JSON.stringify(context, null, 2));
  console.log("User: ", JSON.stringify(user, null, 2));
});

{
  "name":        "sbeck@shambhalamountain.org",
  "email":       "sbeck@shambhalamountain.org",
  "user_id":     "google-apps|sbeck@shambhalamountain.org",
  "nickname":    "scotty",
  "picture":     "http://foobar.com/pictures/jdoe.png",
  "identities": [
    {
      "provider": "google-apps",
      "user_id": "sbeck@shambhalamountain.org",
      "connection": "shambhalamountain-org",
      "isSocial": false
    }
  ]
}

{
  "clientID":            "2b4dzaAE6l0gaAAlE3ufshMTIeJBG508",
  "clientName":          "Gotime Web Client",
  "connection":          "google-apps",
  "connectionStrategy":  "oauth2",
  "protocol":            "oidc-basic-profile",
  "request": {
    "query":             { "scope": "openid email profile" },
    "body":              {},
    "userAgent":         "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/32.0.1700.107 Safari/537.36",
    "ip":                "X.X.X.X",
    "geoip":             { "country_code":"AR", "country_code3":"ARG", "country_name":"Argentina", "region":"08", "city":"Federal", "postal_code":"3180", "latitude":-30.954599380493164, "longitude":-58.78329849243164, "continent_code":"SA", "time_zone":"America/Argentina/Buenos_Aires" }  },
  "samlConfiguration":   {},
  "stats":               { "loginsCount": 5 },
  "accessToken":         {},
  "idToken":             {}
}

 */
