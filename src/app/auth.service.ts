import { Injectable } from '@angular/core';
import { authOptions, renewOptions } from './auth.config';
import { Router } from '@angular/router';
import * as auth0 from 'auth0-js';

@Injectable()
export class AuthService {

  auth0 = new auth0.WebAuth(authOptions);

  constructor(public router: Router) {}

  public login(): void {
    this.auth0.authorize();
  }

  public renew(): void {
    this.auth0.renewAuth(renewOptions, (err, authResults) => {
      if (err || !authResults) {
        console.log('renew failed: ', err);
        this.login();
      } else {
        console.log('Results: ', authResults);
        this.setSession(authResults);
      }
    });
  }

  public handleAuthentication(): void {
    this.auth0.parseHash((err, authResult) => {
      if (authResult && authResult.accessToken && authResult.idToken) {
        this.setSession(authResult);
        // needed to clear the hash portion of the url, goes to default route
        this.router.navigate([]);
      } else if (err) {
        alert(`Error: ${err.error}. Check the console for further details.`);
        // needed to clear the hash portion of the url, goes to default route
        this.router.navigate([]);
      }
    });
  }

  private setSession(authResult): void {
    // Set the time that the access token will expire at
    const expiresAt = JSON.stringify((authResult.expiresIn * 1000) + new Date().getTime());
    localStorage.setItem('access_token', authResult.accessToken);
    localStorage.setItem('id_token', authResult.idToken);
    localStorage.setItem('expires_at', expiresAt);
  }

  public logout(): void {
    // Remove tokens and expiry time from localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('id_token');
    localStorage.removeItem('expires_at');
    // Go back to the home route
    this.router.navigate(['/']);
  }

  public isAuthenticated(): boolean {
    // Check whether the current time is past the
    // access token's expiry time
    const expiresAt = JSON.parse(localStorage.getItem('expires_at'));
    return new Date().getTime() < expiresAt;
  }

}
