import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-nav-account',
  templateUrl: './nav-account.component.html',
  styleUrls: ['./nav-account.component.css']
})
export class NavAccountComponent implements OnInit {

  constructor(public auth: AuthService) { }

  ngOnInit() {
  }

}
