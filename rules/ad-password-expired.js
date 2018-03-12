function (user, context, callback) {

  if (context.connection !== 'ActiveDirectory') {
    return callback(null, user, context);
  }
  
  var ISSUER = 'https://shambhalamountain.auth0.com/';
  var CLIENT_ID = configuration.ADCP_CLIENT_ID;
  var CLIENT_SECRET = JSON.parse(Buffer.from(configuration.ADCP_CLIENT_SECRET, 'base64').toString('ascii')).secret;
  var REDIRECT_TO = configuration.ADCP_REDIRECT_TO;
  var MAX_PASSWORD_AGE = configuration.ADCP_MAX_PASS_AGE;

  if (context.protocol !== 'redirect-callback') {
    profile = getADProfile(user);
    // Require a password change every X days.
    var last_change_date = getLastPasswordChange(profile);
    console.log('Last password change: ' + profile.last_pwd_change);
    console.log('Last password change: ' + last_change_date);
    if (!profile.hasOwnProperty("last_pwd_change") || (profile.last_pwd_change > 0 && dayDiff(last_change_date, new Date()) <= MAX_PASSWORD_AGE)) {
      return callback(null, user, context);
    }
    
    // Create token for the external site.
    var sAMAccountName = profile.sAMAccountName || user.username;
    var email = profile.email || sAMAccountName + '@shambhalamountain.org';
    var token = createToken(CLIENT_ID, CLIENT_SECRET, ISSUER, {
      sub: profile.user_id,
      email: email,
      emails: profile.emails,
      validated: false,
      sAMAccountName: sAMAccountName,
      picture: user.picture,
      ip: context.request.ip
    });

    // Redirect to the external site.
    context.redirect = {
      url: REDIRECT_TO + token
    };
    
    console.log('Redirecting to: ' +context.redirect.url);
    return callback(null, user, context);
  }
  else 
  {
    console.log('User redirected back after password change. Token: ' +  
      context.request.query.token);
    
    // Verify the incoming token.
    verifyToken(CLIENT_ID, CLIENT_SECRET, ISSUER, context.request.query.token, 
      function(err, decoded) {
        if (err) {
          console.log('Token error: ' + JSON.stringify(err));
          return callback(new UnauthorizedError('Password change failed.'));  
        } else if (decoded.sub !== user.user_id) {
          return callback(
            new UnauthorizedError('Token does not match the current user.')); 
        } else if (!decoded.pwd_change) {
          return callback(
            new UnauthorizedError('Invalid token.')); 
        }
        else {
          console.log('Decoded token: ' + JSON.stringify(decoded));
          return callback(null, user, context);
        }
      });
  }
  
  function getADProfile(user) {
    if (user.sAMAccountName) {
      return user;
    }
    if (!user.identities) {
      console.log("User " + user.email + " has no identities!!!");
      return user;
    }
    var idents = user.identities
    for (var i = 0, len = idents.length; i < len; ++i) {
      if (idents[i].provider == 'ad') {
        return idents[i].profileData;
      }
    }
    console.log("Failed to find AD provider for " + user.email);
    return user;
  }

  // Get the last password change from AD.
  function getLastPasswordChange(user) {
    var last_change = user.last_pwd_change || 0;
    return new Date((last_change/10000) - 11644473600000);
  }
  
  // Calculate the days between 2 days.
  function dayDiff(first, second) {
    return (second-first)/(1000*60*60*24);
  }
  
  // Generate a JWT.
  function createToken(client_id, client_secret, issuer, user) {
    var options = {
      algorithm: 'RS256',
      expiresInMinutes: 90,
      audience: client_id,
      issuer: issuer
    };

    var token = jwt.sign(user, client_secret, options);
    return token;
  }
  
  // Verify a JWT.
  function verifyToken(client_id, client_secret, issuer, token, cb) {
    var secret = client_secret;
    var token_description = {
      algorithms: ['RS256'],
      maxAge: "3h",
      audience: client_id,
      issuer: issuer
    };
    
    jwt.verify(token, secret, token_description, cb);
  }
}
