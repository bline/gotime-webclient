function (user, context, callback) {

  // Generate a random UUID: http://en.wikipedia.org/wiki/Universally_unique_identifier
  // Used in the token's jti claim to protect against replay attacks
  var uuid = require('uuid');
  var groups = user.groups || [];

  if (groups.indexOf('Zendesk Agent') != -1) {
    // Create the JWT as required by Zendesk
    var payload = {
      iat: new Date().getTime() / 1000,
      jti: uuid.v4(),
      email: user.email,
      name: user.name,
      role: 'agent',
      external_id: user.user_id
    };

    context.accessToken = context.accessToken || {};
    context.idToken = context.accessToken || {};
    var namespace = 'https://shambhalamountain.zendesk.com/';
    // Sign the token and add it to the profile
    var zendesk_token = jwt.sign(payload, configuration.ZENDESK_JWT_SECRET);
    var key = namespace + 'zendesk_jwt_url';
    context.idToken[key] = context.accessToken[key] = 'https://' + configuration.ZENDESK_SUBDOMAIN + '.zendesk.com/access/jwt?jwt=' + zendesk_token;
  }

  callback(null, user, context);
}
