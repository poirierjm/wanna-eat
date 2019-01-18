/**
 * Copyright 2016 Google Inc. All Rights Reserved.
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

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase); // wannaeat-4fa78.appspot.com
var db = admin.firestore();
const emfp = require('express-multipart-file-parser')
const express = require('express');
const cookieParser = require('cookie-parser');
const paypal = require('paypal-rest-sdk');
const exphbs = require('express-handlebars');
const app = express();

const firebaseUser = require('./firebaseUser');

app.engine('handlebars', exphbs({
   defaultLayout: 'main',
   helpers: require("./hbshelpers.js"),
}));
app.set('view engine', 'handlebars');
app.use(firebaseUser.validateFirebaseIdToken);
app.use(cookieParser());

//
paypal.configure({
   'mode': 'sandbox', //sandbox or live
   'client_id': 'AZjNcvknAVixKcGb_5TZTwJdk1x2OKZMYPahjBL7lOEqkkdqb8dRf_n8gcl_ImQa3_CxR8z7LdSc18AI',
   'client_secret': 'EJX2l46pDqLwlx5x6WK88U9ciALn6xo3fo3bR7oEYfO7EusQ2R7ObfvGD-dYMhzCY3HgVCe6ui47b6Ef'
});

// const PAYPAL_RETURN_URL = "http://localhost:5000/success";
// const PAYPAL_CANCEL_URL = "http://localhost:5000/cancel";
const PAYPAL_RETURN_URL = "https://wannaeat-4fa78.firebaseapp.com/success";
const PAYPAL_CANCEL_URL = "https://wannaeat-4fa78.firebaseapp.com/cancel";

const SHIPPING_PRICE = 4.99;

/*************************************************
 * TEST AND EXEMPLES
 *************************************************/


/**
 * Page de test pour créer un compte
 * Ex: http://localhost:5000/create-account/bob@gmail.com va créer un compte dans la base de données
 */
app.get('/create-account/:courriel', function (req, res) {
   var docRef = db.collection('users').doc();
   var setAda = docRef.set({
      email: req.params.courriel,
      isCook: false,
   });
   res.redirect('/');
});



/*************************************************
 * Pages accesibles à tout le monde
 *************************************************/

app.get('/delete-cart/:mealId', function (req, res) {
   db.collection('cart').doc(req.user.uid).get().then(snapshot => {
      var mealsArray = snapshot.data().meals;
      for (var i in mealsArray) {
         if (mealsArray[i].mealId == req.params.mealId) {
            mealsArray.splice(i, 1);
            db.collection('cart').doc(req.user.uid).set({ meals: mealsArray, }).then(retour => {
               res.redirect("/cart");
            });
         }
      }
   });
});



app.post('/update-cart/:mealId', function (req, res) {
   var mealObject = {
      mealQty: req.body.mealQty,
      mealId: req.body.mealId
   }
   cart(req, function (err, mealsArray) {

      for (var j in mealsArray) {
         if (mealsArray[j].mealId == mealObject.mealId) {
            mealsArray[j].portion = mealObject.mealQty
         }
      }
      db.collection('cart').doc(req.user.uid).set({ meals: mealsArray }).then(doc => {
         res.redirect('/cart');
      }).catch(err => {
         console.log('Error getting document', err);
         res.redirect('/');
      });
   });
});

function deleteAllCart(req, callback) {
   db.collection("cart").doc(req.user.uid).delete().then(function () {
      callback(null, "Document successfully deleted!")
   }).catch(function (error) {
      console.error("Error removing document: ", error);
      callback(error)
   });
}



app.get('/cart', function (req, res) {
   cookData(req, function (err, cookData) {
      mealsCartQty(req, function (err, mealsCartQty) {
         cart(req, function (err, mealsArray) {
            if (err || mealsArray == null) {
               res.render('cart', { user: req.user, userdb: cookData, mealsLength: mealsCartQty, });
            } else {
               var subtotal = 0;
               var cart = [];
               var count = 0;
               var mealObject;
               db.collection('meals').get().then(function (snapshot) {
                  snapshot.forEach(function (doc) {
                     for (var j in mealsArray) {
                        if (mealsArray[j].mealId == doc.id) {
                           mealObject = doc.data();
                           mealObject.id = doc.id;
                           mealObject.portionToBuy = mealsArray[j].portion;
                           mealObject.priceTotal = mealsArray[j].portion * mealObject.price;
                           subtotal += mealObject.priceTotal;
                           count++;
                           cart.push(mealObject);
                        }
                     }
                  });
                  if (mealsArray.length == count) {
                     res.render('cart', {
                        user: req.user, userdb: cookData, mealsLength: mealsCartQty,
                        cart: cart, subtotal: subtotal, shipping: SHIPPING_PRICE, total: (SHIPPING_PRICE + subtotal).toFixed(2),
                     });
                  }
               }).catch(err => {
                  console.log('Error getting documents', err);
               });
            }
         });
      });
   });
});


app.get('/add-to-cart/:mealId/:mealPortion', function (req, res) {
   db.collection('cart').doc(req.user.uid).get().then(snapshot => {
      if (!snapshot.exists) {
         var meals = {
            meals: [{ mealId: req.params.mealId, portion: parseInt(req.params.mealPortion) }],
         }
         db.collection('cart').doc(req.user.uid).set(meals).then(retour => {
            res.redirect("/cart");
         });
      } else {
         var mealsArray = snapshot.data().meals;
         if (mealsArray.length == 0) {
            mealsArray.push({ mealId: req.params.mealId, portion: parseInt(req.params.mealPortion) });
            db.collection('cart').doc(req.user.uid).set({ meals: mealsArray }).then(retour => {
               res.redirect("/cart");
            });
         } else {
            var count = 0;
            for (var i in mealsArray) {
               if (mealsArray[i].mealId == req.params.mealId) {
                  mealsArray[i].portion += parseInt(req.params.mealPortion);
                  count++;
               }
            }
            if (count == 0) {
               mealsArray.push({ mealId: req.params.mealId, portion: parseInt(req.params.mealPortion) });
            }
            db.collection('cart').doc(req.user.uid).set({ meals: mealsArray, }).then(retour => {
               res.redirect("/cart");
            });
         }
      }
   });
});



/**
 * La page d'accueil.
 * Permet d'obtenir la localisation des cuisiniers en ligne dans la portée de la localisation d'un client.
 */
app.get('/', function (req, res) {
   var fullUrl = req.protocol + '://' + req.get('host') + "/success";
   console.log(fullUrl);
   cookData(req, function (err, cookData) {
      mealsCartQty(req, function (err, mealsCartQty) {
         res.render('index', { user: req.user, userdb: cookData, mealsLength: mealsCartQty, });
      });
   });
});


app.get('/success-order', function (req, res) {
   cookData(req, function (err, cookData) {
      mealsCartQty(req, function (err, mealsCartQty) {
         res.render('success-order', { user: req.user, userdb: cookData, mealsLength: mealsCartQty, });
      });
   });
});


app.get('/cancel', function (req, res) {
   cookData(req, function (err, cookData) {
      mealsCartQty(req, function (err, mealsCartQty) {
         res.render('cancel', { user: req.user, userdb: cookData, mealsLength: mealsCartQty, });
      });
   });
});


app.get('/pay', (req, res) => {
   cart(req, function (err, mealsArray) {
      if (err || mealsArray == null) {
         res.redirect("/cart");
      } else {
         var subtotal = 0.00;
         var cart = [];
         var count = 0;
         var mealObject = {};
         db.collection('meals').get().then(function (snapshot) {
            snapshot.forEach(function (doc) {
               for (var i in mealsArray) {
                  if (mealsArray[i].mealId == doc.id) {
                     mealObject.name = doc.data().name;
                     mealObject.sku = doc.id;
                     mealObject.price = (doc.data().price).toString();
                     mealObject.currency = "USD";
                     mealObject.quantity = (mealsArray[i].portion).toString();
                     subtotal += mealsArray[i].portion * doc.data().price;
                     count++;
                     cart.push(mealObject);
                     mealObject = {};
                  }
               }
            });
            if (mealsArray.length == count) {
               var create_payment_json = {
                  "intent": "sale",
                  "payer": {
                     "payment_method": "paypal"
                  },
                  "redirect_urls": {
                     "return_url": PAYPAL_RETURN_URL,
                     "cancel_url": PAYPAL_CANCEL_URL
                  },
                  "transactions": [{
                     "item_list": {
                        "items": cart
                     },
                     "amount": {
                        "currency": "USD",
                        "total": ((SHIPPING_PRICE + subtotal).toFixed(2)).toString(),
                        "details": {
                           "subtotal": subtotal.toString(),
                           //"tax": "0.07",
                           "shipping": SHIPPING_PRICE.toString()
                           //"handling_fee": "1.00",
                           //"shipping_discount": "1.00",
                           //"insurance": "1.00"
                        }

                     },
                     "description": "Wanna Eat - Fresh Homemade Food"
                  }]
               };
               paypal.payment.create(create_payment_json, function (error, payment) {
                  if (error) {
                     console.log(error);
                     throw error;
                  } else {
                     for (let i = 0; i < payment.links.length; i++) {
                        if (payment.links[i].rel === 'approval_url') {
                           res.redirect(payment.links[i].href);
                        }
                     }
                  }
               });
            }
         }).catch(err => {
            console.log('Error getting documents', err);
         });
      }
   });
});

app.get('/success', (req, res) => {
   cart(req, function (err, mealsArray) {
      if (err || mealsArray == null) {
         res.redirect("/cart");
      } else {
         var subtotal = 0.00;
         var cart = [];
         var count = 0;
         var mealObject = {};
         db.collection('meals').get().then(function (snapshot) {
            snapshot.forEach(function (doc) {
               for (var i in mealsArray) {
                  if (mealsArray[i].mealId == doc.id) {
                     mealObject = doc.data();
                     mealObject.id = doc.id;
                     mealObject.quantity = mealsArray[i].portion;
                     cart.push(mealObject);
                     subtotal += mealsArray[i].portion * doc.data().price;
                     count++;
                     mealObject = {};
                  }
               }
            });
            if (mealsArray.length == count) {
               const total = ((SHIPPING_PRICE + subtotal).toFixed(2)).toString();
               const payerId = req.query.PayerID;
               const paymentId = req.query.paymentId;

               const execute_payment_json = {
                  "payer_id": payerId,
                  "transactions": [{
                     "amount": {
                        "currency": "USD",
                        "total": total
                     }
                  }]
               };
               paypal.payment.execute(paymentId, execute_payment_json, function (error, payment) {
                  if (error) {
                     console.log(error.response);
                     res.redirect('/cart');
                  } else {
                     console.log(JSON.stringify(payment));
                     var order = payment.transactions[0].item_list.shipping_address;
                     order.transactionId = payment.transactions[0].related_resources[0].sale.id;
                     order.date = payment.transactions[0].related_resources[0].sale.create_time;
                     order.ready = false;
                     for (var j in cart) {
                        order.mealName = cart[j].name;
                        order.idCook = cart[j].idCook;
                        order.quantity = cart[j].quantity;
                        order.price = cart[j].price;
                        order.total = cart[j].price * cart[j].quantity;
                        console.log(order);
                        db.collection('orders').doc().set(order).then(doc => {
                        }).catch(err => {
                           console.log('Error getting document', err);
                        });
                     }
                     // If the customer paid signed in an account, the transaction will be save in his transaction historic.
                     if (req.user.name) {
                        const transactionId = payment.transactions[0].related_resources[0].sale.id;
                        var transaction = {
                           cart: cart,
                           clientId: req.user.uid,
                           date: payment.transactions[0].related_resources[0].sale.create_time,
                           shippingPrice: payment.transactions[0].amount.details.shipping,
                           subtotal: payment.transactions[0].amount.details.subtotal,
                           total: payment.transactions[0].amount.total,
                        }
                        db.collection('transactions').doc(transactionId).set(transaction).then(doc => {
                           deleteAllCart(req, function (err, result) {
                              if (err) {
                                 console.log(err);
                              } else {
                                 res.redirect('/success-order');
                              }
                           });
                        }).catch(err => {
                           console.log('Error getting document', err);
                           res.redirect('/');
                        });
                     } else {
                        res.redirect('/success-order');
                     }

                  }
               });
            }
         }).catch(err => {
            console.log('Error getting documents', err);
         });
      }
   });
});

/**
 * La page de la carte google. 
 * Permet d'obtenir la localisation des cuisiniers en ligne dans la portée de la localisation d'un client.
 */

app.get('/map/:mapAddress', function (req, res) {
   var mapAddress = req.params.mapAddress
   var resMap = cookMapData();
   setTimeout(function () {
      cookData(req, function (err, cookData) {
         mealsCartQty(req, function (err, mealsCartQty) {
            console.log(resMap);
            res.render('map', {
               user: req.user, userdb: cookData, mealsLength: mealsCartQty, map: mapAddress,
               mealsOnline: encodeURIComponent(JSON.stringify(resMap)), //encoded beaucase I'm using it in javascript instead of html
            });
         });
      });
   }, 600);
});




/**
 * La page de connexion.
 */
app.get('/login', function (req, res) {
   if (req.user && req.user.name) {
      res.redirect('/');
   } else {
      mealsCartQty(req, function (err, mealsCartQty) {
         res.render('login', { user: req.user, mealsLength: mealsCartQty, });
      });
   }
});


/**
 * La page d'inscription.
 */
app.get('/signup', function (req, res) {
   if (req.user && req.user.name) {
      res.redirect('/');
   } else {
      mealsCartQty(req, function (err, mealsCartQty) {
         res.render('signup', { user: req.user, mealsLength: mealsCartQty });
      });
   }
});



/*************************************************
 * Pages accesibles aux personnes inscrites Client/Cuisinier
 *************************************************/


/**
 * La page pour devenir cuisinier et
 * Pour afficher et modifier les informations personnelles d'un cuisinier .
 * (Nom, adresse, email, paypal email)
 */
app.get('/user', function (req, res) {
   if (req.user && req.user.name) {
      cookData(req, function (err, cookData) {
         mealsCartQty(req, function (err, mealsCartQty) {
            res.render('user', { user: req.user, userdb: cookData, mealsLength: mealsCartQty, });
         });
      });
   } else {
      res.redirect('/login');
   }
});


/**
 * Cette requete créer/update les informations personnelles d'un cuisinier. 
 * On lance cette requete lorsqu'on soummet le formulaire de la page /user
 */
app.post('/create-cook', function (req, res) {
   var userObject = {
      email: req.user.email,
      displayName: req.body.name,
      address: req.body.address,
      city: req.body.city,
      country: req.body.country,
      state: req.body.state,
      zip: req.body.zip,
      paypal: req.body.paypal,
      isCook: true,
   }
   db.doc('users/' + req.user.uid).set(userObject).then(doc => {
      res.redirect('/menu');
   }).catch(err => {
      console.log('Error getting document', err);
      res.redirect('/');
   });
});


/**  
 * La page de l'historique d'achats d'un client
 */
app.get('/historic', function (req, res) {
   if (req.user && req.user.name) {
      cookData(req, function (err, cookData) {
         mealsCartQty(req, function (err, mealsCartQty) {
            var transactionsArray = []
            db.collection('transactions').where("clientId", "==", req.user.uid).get()
               .then(function (snapshot) {
                  snapshot.forEach(transaction => {
                     var transactionObject = transaction.data();
                     transactionObject.id = transaction.id;
                     transactionsArray.push(transactionObject);
                  });
                  res.render('historic', { user: req.user, userdb: cookData, mealsLength: mealsCartQty, transactions: transactionsArray });
               }).catch(err => {
                  console.log('Error getting documents', err);
               });
         });
      });
   } else {
      res.redirect('/login');
   }
});



/*************************************************
 * Pages accesibles aux cuisniers
 *************************************************/

/**
 * La page affiche les repas online et offline d'un cuisinier.
 */
app.get('/menu', function (req, res) {
   cookData(req, function (err, result) {
      if (result && result.address) {
         var mealsOnline = [];
         var mealsOffline = [];
         db.collection('meals').where("idCook", "==", req.user.uid).get()
            .then(function (snapshot) {
               snapshot.forEach(meal => {
                  var mealObject = meal.data();
                  mealObject.id = meal.id;
                  if (meal.data().portion <= 0) {
                     mealsOffline.push(mealObject);
                  } else {
                     mealsOnline.push(mealObject);
                  }
               });
               mealsCartQty(req, function (err, mealsCartQty) {
                  res.render('menu', {
                     user: req.user, userdb: result,
                     mealsOnline: mealsOnline, mealsOffline: mealsOffline, mealsLength: mealsCartQty,
                  });
               });
            }).catch(err => {
               console.log('Error getting documents', err);
            });
      } else {
         res.redirect('/user');
      }
   });
});


/**  
 * La page pour ajouter un repas au menu d'un cuisinier. 
 */
app.get('/meal', function (req, res) {
   cookData(req, function (err, result) {
      if (result && result.address) {
         mealsCartQty(req, function (err, mealsCartQty) {
            res.render('meal', { user: req.user, userdb: result, mealsLength: mealsCartQty, });
         });
      } else {
         res.redirect('/user');
      }
   });
});


/**  SECURITY ************* 
 * La page pour modifier le repas d'un cuisinier. 
 */
app.get('/meal/:mealId', function (req, res) {
   cookData(req, function (err, result) {
      if (result && result.address) {
         db.collection('meals').doc(req.params.mealId).get()
            .then(meal => {
               if (!meal.exists) {
                  console.log('No such document!');
                  res.redirect('/menu');
               } else {
                  var mealObject = meal.data();
                  mealObject.id = meal.id;
                  mealsCartQty(req, function (err, mealsCartQty) {
                     res.render('meal-edit', { user: req.user, userdb: result, mealsLength: mealsCartQty, meal: mealObject, });
                  });
               }
            })
            .catch(err => {
               console.log('Error getting document', err);
            });
      } else {
         res.redirect('/user');
      }
   });
});


app.post('/edit-meal', emfp, function (req, res) {
   var file = req.files[0];
   if (file && file.originalname) {
      uploadImageToStorage(file)
         .then((success) => {
            const mealObject = {
               name: req.body.name,
               description: req.body.description,
               portion: parseInt(req.body.portion),
               price: parseFloat(req.body.price),
               image: success
            };
            //console.log(mealObject);
            db.collection('meals').doc(req.body.mealid).update(mealObject).then(doc => {
               res.redirect('/menu');
            }).catch(err => {
               console.log('Error setting document', err);
               return res.status(500).send(err);
            });

         }).catch((error) => {
            console.error('/Error uploading image', error);
            res.redirect('/menu');
         });
   } else {
      const mealObject = {
         name: req.body.name,
         description: req.body.description,
         portion: parseInt(req.body.portion),
         price: parseFloat(req.body.price),
         image: req.body.image
      };
      //console.log(mealObject);
      db.collection('meals').doc(req.body.mealid).update(mealObject).then(doc => {
         res.redirect('/menu');
      }).catch(err => {
         console.log('Error updating document', err);
         return res.status(500).send(err);
      });
   }
});


app.post('/create-meal', emfp, function (req, res) {
   var file = req.files[0];
   if (file && file.originalname) {
      uploadImageToStorage(file)
         .then((success) => {
            const mealObject = {
               name: req.body.name,
               idCook: req.user.uid,
               description: req.body.description,
               portion: parseInt(req.body.portion),
               price: parseFloat(req.body.price),
               image: success
            };
            //console.log(mealObject);
            db.collection('meals').doc().set(mealObject).then(doc => {
               res.redirect('/menu');
            }).catch(err => {
               console.log('Error getting document', err);
               return res.status(500).send(err);
            });

         }).catch((error) => {
            console.error('/Error uploading image', error);
            res.redirect('/menu');
         });
   } else {
      res.redirect('/menu');
   }
});




/**  
 * La page affiche les commandes en cours et les commandes conclus. 
 * La page permet d'accepter ou de refuser la commande. 
 * Le client sera facturer seulement après que le cuisinier aille accepter la commande.
 */
app.get('/order', function (req, res) {
   cookData(req, function (err, result) {
      if (result && result.address) {
         var orders = [];
         mealsCartQty(req, function (err, mealsCartQty) {
            db.collection('orders').where("idCook", "==", req.user.uid).get()
               .then(function (snapshot) {
                  snapshot.forEach(doc => {
                     var order = doc.data();
                     order.id = doc.id;
                     orders.push(order);
                  });
                  res.render('order', { user: req.user, userdb: result, mealsLength: mealsCartQty, orders: orders });
               }).catch(err => {
                  console.log('Error getting documents', err);
               });
         });
      } else {
         res.redirect('/user');
      }
   });
});


app.get('/order-complete/:id', function (req, res) {
   cookData(req, function (err, result) {
      if (result && result.address) {
         db.collection('orders').doc(req.params.id).update({ ready: true, }).then(retour => {
            res.redirect("/order");
         });
      } else {
         res.redirect('/user');
      }
   });
});


/**  
 * La page affiche les information des revenus d'un cuisinier des commandes conclus. 
 */
app.get('/payout', function (req, res) {
   cookData(req, function (err, result) {
      if (result && result.address) {
         mealsCartQty(req, function (err, mealsCartQty) {
            res.render('payout', { user: req.user, userdb: result, mealsLength: mealsCartQty, });
         });
      } else {
         res.redirect('/user');
      }
   });
});



/*************************************************
 * Fontions
 *************************************************/


function cookMapData() {
   var mealsOnline = [];
   db.collection('meals').where("portion", ">=", 1).get().then(function (snapshot2) {
      snapshot2.forEach(meal => {
         db.collection('users').doc(meal.data().idCook).get().then(cookUser => {
            var mealObject = meal.data();
            mealObject.id = meal.id;
            mealObject.address = cookUser.data().address + ", " + cookUser.data().city + ", " + cookUser.data().zip;
            mealObject.cookName = cookUser.data().displayName;
            mealsOnline.push(mealObject);
         });
      });
   }).catch(err => {
      console.log('Error getting documents', err);
   });
   return mealsOnline;
}


/**
 * Cette fonction retourne les informations d'un compte dans la base de donnée à partir du parametre uid 
 * 
 * @param {*} uid       L'id d'un utilisateur (Cuisisier et client)
 * @param {*} callback  Le return 
 */
function cookData(req, callback) {
   if (req.user && req.user.name) {
      db.collection('users').doc(req.user.uid).get()
         .then(snapshot => {
            if (!snapshot.exists) {
               callback(null, null);
            } else {
               callback(null, snapshot.data());
            }
         })
         .catch(err => {
            console.log('Error getting document', err);
            callback(err);
         });
   } else {
      callback(null, null);
   }
}


function cart(req, callback) {
   if (req.user && req.user.uid) {
      db.collection('cart').doc(req.user.uid).get()
         .then(function (doc) {
            // Si le client n'a jamais ajouter de repas à son panier.
            if (!doc.exists) {
               callback(null, null)
            } else { // Si le client a ajouter au moins un repas à son panier.
               if (doc.data().meals.length != 0) {
                  callback(null, doc.data().meals)
               } else { // Si le client a ajouté auparavant au moins un repas à son panier, mais le panier est dorénavent vide.
                  callback(null, null)
               }
            }
         }).catch(err => {
            console.log('Error getting documents', err);
            callback(err)
         });
   } else {
      callback(null, null);
   }
}


function mealsCartQty(req, callback) {
   if (req.user && req.user.uid) {
      db.collection('cart').doc(req.user.uid).get().then(function (snapshot) {
         if (!snapshot.exists) {
            callback(null, 0);
         } else {
            var mealsLength = snapshot.data().meals.length;
            callback(null, mealsLength);
         }
      }).catch(err => {
         console.log('Error getting document', err);
         callback(err);
      });
   } else {
      callback(null, 0);
   }
}


function uploadImageToStorage(file) {
   let prom = new Promise((resolve, reject) => {
      if (!file) {
         reject('No image file');
      }
      let newFileName = `${file.originalname}_${Date.now()}`;

      let fileUpload = admin.storage().bucket().file(newFileName);

      const blobStream = fileUpload.createWriteStream({
         metadata: {
            contentType: file.mimetype
         }
      });

      blobStream.on('error', (error) => {
         reject('Something is wrong! Unable to upload at the moment.');
      });


      blobStream.on('finish', () => {
         // The public URL can be used to directly access the file via HTTP.
         const url = `https://storage.cloud.google.com/${admin.storage().bucket().name}/${fileUpload.name}`
         resolve(url);
      });

      blobStream.end(file.buffer);
   });
   return prom;
}



/*************************************************
 * Firebase Fonctions | Deploy mode NÉCESSAIRE pour que ses fonctions fonctionnent
 *************************************************/

/**
 * Ajoute un utilisateur a la base de donnée lorsque celui ci se connecte avec google authentifation pour la premiere fois. 
 */
exports.createProfile = functions.auth.user().onCreate((user) => {
   if (user.email) {
      var userObject = {
         displayName: user.displayName,
         email: user.email,
         isCook: false,
      };
      return db.doc('users/' + user.uid).set(userObject);
   } else {
      return null;
   }
});


// This HTTPS endpoint can only be accessed by your Firebase Users.
// Requests need to be authorized by providing an `Authorization` HTTP header
// with value `Bearer <Firebase ID Token>`.
exports.app = functions.https.onRequest(app);
