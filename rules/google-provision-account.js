function (user, context, callback) {
  var
    _      = require('lodash'),
    crypto = require('crypto'),
    async  = require('async');

  var STDGROUPS = [
    'allstaff@shambhalamountain.org',
    'smc-community@shambhalamountain.org',
    'urgent@shambhalamountain.org'
  ];
  var MGRGROUPS = ['leadership@shambhalamountain.org'];
  var DIRGROUPS = ['leadership@shambhalamountain.org','oc@shambhalamountain.org'];
  user.app_metadata = user.app_metadata || {};
  if (user.app_metadata.googleProvisioned) {
    return callback(null, user, context);
  }
  function Ctrl(options) {
    this._user = options.user;
    this._context = options.context;
    this._scope = options.scope;
    this._admin_email = options.admin_email;
    this._access_token = null;
    this._googleAuth = JSON.parse(configuration['google-auth']);
  }
  Ctrl.prototype.fetchToken = function (callback) {
    if (this._access_token) {
      return callback(null, this._access_token);
    }
    var token = jwt.sign({
      scope: this._scope,
      sub: this._admin_email
    }, this._googleAuth.private_key, {
      audience: "https://accounts.google.com/o/oauth2/token",
      issuer: this._googleAuth.client_email,
      expiresInMinutes: 60,
      algorithm: 'RS256'
    });
    var that = this;
    request.post({ url: 'https://accounts.google.com/o/oauth2/token', form: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: token } }, function(err, resp, body) {
      if (err) return callback(err);
      var result = JSON.parse(body);
      if (result.error) {
        return callback(result.error);
      }
      that._access_token = result.access_token;
      callback(null, result.access_token);
    });
  };
  Ctrl.prototype.getUser = function (callback) {
    var user = this._user;
    this.fetchToken(function (err, access_token) {
      if (err) return callback(err);
      var getUserUrl = 'https://www.googleapis.com/admin/directory/v1/users/' + encodeURIComponent(user.email);
      request.get({
        url: getUserUrl,
        headers: {
          "Authorization": "OAuth " + access_token
        }
      }, function (err, resp, body) {
        if (err) return callback(err, false);
        var result = JSON.parse(body);
        if (result.error) {
          console.log(body);
          return callback(result.error, false);
        }
        console.log("User: ", result);
        callback(null, result);
      });
    });
  };
  Ctrl.prototype.hasGroupMembership = function (group, callback) {
    var user = this._user;
    this.fetchToken(function (err, access_token) {
      if (err) return callback(err);
      var hasMemberUrl = 'https://www.googleapis.com/admin/directory/v1/groups/' + encodeURIComponent(group) + '/hasMember/' + encodeURIComponent(user.email);
      request.get({
        url: hasMemberUrl,
        headers: {
          "Authorization": "OAuth " + access_token
        }
      }, function (err, resp, body) {
        if (err) return callback(err, false);
        var result = JSON.parse(body);
        if (result.error) {
          console.log(result);
          return callback(result.error, false);
        }
        callback(null, result.isMember);
      });
    });
  };
  Ctrl.prototype.addToGroups = function (groups, callback) {
    ctrl = this;
    async.eachSeries(groups, function (group, callback) {
      console.log("Checking " + group);
      ctrl.hasGroupMembership(group, function (err, isMember) {
        if (err || !isMember) {
          if (err) {
            console.log("Error getting group: " + err);
          }
          console.log("Adding membership");
          ctrl.addGroupMembership(group, function (err, success) {
            if (err) {
              console.log("Add group " + group + "; error: ", err);
            }
            else {
              console.log("Success");
            }
            callback(null);
          });
        } else {
          console.log("Already member");
          callback(null);
        }
      });
    }, function (err) {
      if (err) {
        console.log("Add groups error: " + err);
      }
      return callback(null);
    });
  };
  Ctrl.prototype.addGroupMembership = function (group, callback) {
    var user = this._user;
    this.fetchToken(function (err, access_token) {
      if (err) return callback(err);
      var addMemberUrl = 'https://www.googleapis.com/admin/directory/v1/groups/' + encodeURIComponent(group) + '/members';
      console.log("Add Member Url: " + addMemberUrl);
      request.post({
        url: addMemberUrl,
        headers: {
          "Authorization": "OAuth " + access_token
        },
        json: {
          email: user.email,
          role: "MEMBER"
        }
      }, function (err, resp, body) {
        if (err) return callback(err, false);
        var result = body;
        if (result.error) {
          console.log("Error: ", result.error);
          return callback(result.error, false);
        }
        console.log("AddGroup Res: ", result);
        callback(null, result);
      });
    });
  };
  Ctrl.prototype.createUser = function (callback) {
    var user = this._user;
    this.fetchToken(function (err, access_token) {
      if (err) return callback(err);
      var pass = crypto.randomBytes(20).toString('hex');
      var createUserUrl = 'https://www.googleapis.com/admin/directory/v1/users';
      var familyName = user.family_name || user.name;
      var givenName = user.given_name || user.name;
      request.post({
        url: createUserUrl,
        headers: {
          "Authorization": "OAuth " + access_token
        },
        json: {
          name: {
            familyName: familyName,
            givenName: givenName
          },
          password: pass,
          primaryEmail: user.email
        }
      }, function (err, resp, body) {
        if (err) {
          console.log("createUser: ", err);
          return callback(err, false);
        }
        var result = body;
        if (result.error) {
          console.log("createUser resError: ", result.error);
          return callback(result.error, false);
        }
        console.log("User Res: ", result);
        user.app_metadata.googleProvisioned = true;
        auth0.users.updateAppMetadata(user.user_id, user.app_metadata);
        callback(null, result);
      });
    });
  };
  var ctrl = new Ctrl({
    user: user,
    context: context,
    scope: 'https://www.googleapis.com/auth/admin.directory.user https://www.googleapis.com/auth/admin.directory.group',
    admin_email: 'sbeck@shambhalamountain.org'
  });

  ctrl.getUser(function (err, gUser) {
    if (err || !gUser) {
      console.log("userExists error: ", err);
      ctrl.createUser(function (err, guser) {
        if (err) {
          console.log("createUser error: ", err);
          return callback(null, user, context);
        } else {
          console.log("Created: ", guser);
          var adProfile = _.find(user.identities, { provider: 'ad' });
          var adGroups;
          if (adProfile && adProfile.groups) {
            adGroups = adProfile.groups;
          } else if (user.groups) {
            adGroups = user.groups;
          }
          var groups = STDGROUPS.slice(0);
          if (adGroups) {
            if (_.indexOf(adGroups, 'Director') > -1) {
              groups = groups.concat(DIRGROUPS);
            } else if (_.indexOf(adGroups, 'Manager') > -1) {
              groups = groups.concat(MGRGROUPS);
            }
          }
          ctrl.addToGroups(groups, function (err) {
            if (err) {
              console.log("Add groups error: " + err);
            }
            user.app_metadata.googleProvisioned = true;
            auth0.users.updateAppMetadata(user.user_id, user.app_metadata);
            return callback(null, user, context);
          });
        }
      });
    } else {
      user.app_metadata.googleProvisioned = true;
      auth0.users.updateAppMetadata(user.user_id, user.app_metadata);
      callback(null, user, context);
    }
  });
}
/*
{
  "name":        "jdoe@shambhalamountain.org",
  "email":       "jdoe@shambhalamountain.org",
  "family_name": "Doe",
  "given_name":  "John",
  "user_id":     "auth0|0123456789",
  "nickname":    "jdoe",
  "picture":     "http://foobar.com/pictures/jdoe.png",
  "identities": [
    {
      "provider":    "auth0",
      "user_id":     "0123456789",
      "connection":  "Username-Password-Connection",
      "isSocial":    false
    }
  ]
}
*/
