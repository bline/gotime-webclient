'use strict';

const admin = require('firebase-admin');
const functions = require('firebase-functions');

admin.initializeApp(functions.config().firebase);
const wipeout = require('./wipeout');

const WIPEOUT_CONFIG = {
    'credential': admin.credential.applicationDefault(),
    'db': admin.database(),
    'serverValue': admin.database.ServerValue,
    'users': functions.auth.user(),
    'DB_URL': functions.config().firebase.databaseURL,
  };

wipeout.initialize(WIPEOUT_CONFIG);

/** expose cleanupUserDat as Cloud Function */
exports.cleanupUserData = wipeout.cleanupUserData();

/** expose showWipeoutConfig as Cloud Function */
exports.showWipeoutConfig = wipeout.showWipeoutConfig();

exports.wipeUser = functions.https.onRequest((req, res) => {
  res.status(200).send("all good").end();
});
