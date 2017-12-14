import { Injectable } from '@angular/core';
import { authOptions, renewOptions } from './auth.config';
import { Router } from '@angular/router';
import * as auth0 from 'auth0-js';
import * as firebase from 'firebase';
@Injectable()
export class AuthService {

  auth0 = new auth0.WebAuth(authOptions);

  public userProfile: any;

  constructor(public router: Router) {}

  public login(): void {
    const currentRoute = this.router.routerState.snapshot.url;
    if (currentRoute && currentRoute !== '/') {
      localStorage.setItem('saved_route', currentRoute);
    }
    this.auth0.authorize();
  }

  public renew(): void {
    this.auth0.renewAuth(renewOptions, this.handleAuthResult.bind(this));
  }

  public handleAuthentication(): void {
    this.auth0.parseHash(this.handleAuthResult.bind(this));
  }

  private handleAuthResult(err, authResult): void {
    if (err) {
      console.log('Authentication failed: ', err);
      return this.login();
    }
    if (authResult && authResult.accessToken && authResult.idToken) {
      this.setSession(authResult);
      this.auth0.client.userInfo(authResult.accessToken, (err, user) => {
        if (err) {
          console.log('get userinfo failed: ', err);
          return this.login();
        }
        this.setUser(user);
        // needed to clear the hash portion of the url, goes to default route
        this.router.navigate([]).then(() => {
          const lastRoute = localStorage.getItem('saved_route');
          if (lastRoute) {
            localStorage.removeItem('saved_route');
            this.router.navigate([lastRoute], {});
          }
        });
      });
    } else if (err) {
      alert(`Error: ${err.error}. Check the console for further details.`);
      // needed to clear the hash portion of the url, goes to default route
      this.router.navigate([]);
    }
  }

  private setUser(user): void {
    this.userProfile = user;
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
