# Wanna Eat


## Description

Wanna Eat is an online cooking homemade food service.  
You can order homemade food from anyone who is online on the platform cooking food at their home.   
This project was develop as part of the course  
[INF6150 - Génie logiciel: conduite de projets informatiques : conception](https://etudier.uqam.ca/cours?sigle=INF6150) at [Université du Québec à Montréal](https://uqam.ca/).  


## Sprints

[Planification détaillée et processus](https://docs.google.com/spreadsheets/d/1YeODxGiWksm-ZpzW9KWMSLkNKD7xiaEpfYt-k74o7C0/edit?usp=sharing)


## Technologies

- Node.js (Backend)
- Express.js (Web application framework for node.js)
- Handlebars.js (Templating system)
- Firebase  (Database)


## Informations about technologies

### Handlebars.js:  
This website serve server-side generated HTML pages using the [HandlebarsJs](http://handlebarsjs.com/) templating system. (To seprate Frontend from Backend)  
### How firebase session work:  
A user specific content is pass in the Firebase ID token of the signed-in user in a `__session` cookie.  
Checking and decoding the ID token passed in the `__session` cookie is done with an ExpressJs middleware.  
Some custom scripts in [functions/views/layouts/main.handlebars] maintain the Firebase ID token in the `__session` cookie.  
### Get, set, update and delete data in Firestore: 
[Example to get or set data in Firestore.](https://firebase.google.com/docs/firestore/query-data/get-data)


## Setting up the website

 1. Install node.js with `sudo apt install nodejs`
 1. Create a Firebase Project using the [Firebase Console](https://console.firebase.google.com).
 1. Enable the **Google** Provider in the **Auth** section.
 1. Clone or download this repo and open the `wanna-eat` directory.
 1. You must have the Firebase CLI installed. If you don't have it install it with `npm install -g firebase-tools` and then configure it with `firebase login`.
 1. Configure the CLI locally by using `firebase use wanna` and select your project in the list. (wannaeat-4fa78)
 1. Install dependencies locally by running: `cd functions` then `npm install` and come back to the project directory with `cd ../`


## Deploy and test

To test locally do:

 1. Start serving your project locally using `firebase serve --only hosting,functions`
 1. Open the app in a browser at `https://localhost:5000`.

To deploy and test the app on prod do: (Required for firebase functions to work)

 1. Deploy your project using `firebase deploy`   
  (Firebase functions only work by deploying. They are not working locally)
 1. Open the app in a browser at [https://wannaeat-4fa78.firebaseapp.com/](https://wannaeat-4fa78.firebaseapp.com/).


 ## Paypal testing 
 
 This is only for testing purpose.  
 To order a meal use one of these paypal sandbox account:

Sending payments emails:  
email: `Valerie-Berger@gmail.com`  password: `Aa12345678`  
email  `johny-personnal@gmail.com`  password: `Aa12345678`  

Receiving payments email:  
email  `melany-business@gmail.com`  password: `Aa12345678`  
 
To view the transactions go here : [https://www.sandbox.paypal.com/](https://www.sandbox.paypal.com/).


## Contributor

- Antoine Monzerol (MONA12029506)
- Bruno Bellerive (BELB02018405)
- Jean-Michel Poirier (POIJ26089200)
- Jonathan Roy (ROYJ17058807)


## License

© Google, 2017. Licensed under an [Apache-2](../LICENSE) license.
