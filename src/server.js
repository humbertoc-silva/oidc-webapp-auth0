const crypto = require('crypto');
const path = require('path');
const express = require('express');
const handlebars = require('express-handlebars');
const session = require('express-session');
const bodyParser = require('body-parser');
// const cookieParser = require('cookie-parser');
const passport = require('passport');
const Auth0Strategy = require('passport-auth0');
const request = require('request-promise');

// loading env vars from .env file
require('dotenv').config();

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
// app.use(cookieParser(crypto.randomBytes(16).toString('hex')));
app.use(
  session({
    secret: crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false
  })
);
app.engine('handlebars', handlebars.engine());
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

// configure Passport to use Auth0
const auth0Strategy = new Auth0Strategy(
  {
    domain: process.env.OIDC_PROVIDER,
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: 'http://localhost:3000/callback'
  },
  (accessToken, refreshToken, extraParams, profile, done) => {
    profile.idToken = extraParams.id_token;
    profile.accessToken = extraParams.access_token;
    return done(null, profile);
  }
);
passport.use(auth0Strategy);
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

app.use(passport.initialize());
app.use(passport.session());

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/profile', (req, res) => {
  const { user } = req.session.passport;
  res.render('profile', {
    idToken: user.idToken,
    decodedIdToken: user._json
  });
});

app.get(
  '/login',
  passport.authenticate('auth0', {
    audience: process.env.API_IDENTIFIER,
    scope: 'openid email profile read:to-dos'
  })
);

app.get('/callback', (req, res, next) => {
  passport.authenticate('auth0', (err, user) => {
    if (err) return next(err);
    if (!user) return res.redirect('/login');

    req.logIn(user, err => {
      if (err) return next(err);
      res.redirect('/profile');
    });
  })(req, res, next);
});

app.get('/to-dos', async (req, res) => {
  const delegatedRequestOptions = {
    url: 'http://localhost:3001',
    headers: {
      Authorization: `Bearer ${req.session.passport.user.accessToken}`
    }
  };

  try {
    const delegatedResponse = await request(delegatedRequestOptions);
    const toDos = JSON.parse(delegatedResponse);
    res.render('to-dos', {
      toDos
    });
  } catch (error) {
    res.status(error.statusCode).send(error);
  }
});

app.get('/remove-to-do/:id', async (req, res) => {
  res.status(501).send();
});

app.listen(3000, () => {
  console.log(`Server running on http://localhost:3000`);
});
