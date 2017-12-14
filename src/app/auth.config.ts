
// This api will come in the next version

import {AuthOptions, RenewAuthOptions} from 'auth0-js';

export const authOptions: AuthOptions = {

  audience: 'https://shambhalamountain.auth0.com/userinfo',
  domain: 'shambhalamountain.auth0.com',

  // URL of the SPA to redirect the user to after login
  redirectUri: window.location.origin + '/',

  // The SPA's id. The SPA is registerd with this id at the auth-server
  clientID: '2b4dzaAE6l0gaAAlE3ufshMTIeJBG508',

  // set the scope for the permissions the client should request
  // The first three are defined by OIDC. The 4th is a usecase-specific one
  scope: 'openid profile email',
  responseType: 'token id_token'
}

export const renewOptions: RenewAuthOptions = {
  redirectUri: window.location.origin + '/silent',
  timeout: 1000 * 90,
  responseMode: 'fragment'
};
