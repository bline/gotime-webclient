/**
 * Copyright 2018 Scott Beck. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';


const request = require('request-promise');
const functions = require('firebase-functions');

const Util = (req, res) => {
  return {
    sendError: (st, msg) => {
      res.setHeader('Content-Type', 'application/json');
      res.status(st).send(JSON.stringify({statusCode: st, response: {message: msg}}));
    };
    sendJson: (st, data) => {
      res.setHeader('Content-Type', 'application/json');
      res.status(st).send(JSON.stringify({statusCode: st, response: data}));
    };
  };
};

exports.clockIn = () => functions.https.onRequest((req, res) => {
  util = Util(req, res);
  util.sendJson(200, { status: "All Good" });
});


