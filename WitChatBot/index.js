const config = require('./config');
const bodyParser = require('body-parser');
const express = require('express');
const Wit = require('node-wit').Wit;
const FB = require('./facebook.action');
const async = require('async');
const request = require('request');
var distance = require('google-distance');

// Webserver parameter
const PORT = process.env.PORT || 3000;

// Messenger API parameters
if (!config.FB_PAGE_ID) {
    throw new Error('missing FB_PAGE_ID');
}
if (!config.FB_PAGE_TOKEN) {
    throw new Error('missing FB_PAGE_TOKEN');
}

// See the Webhook reference
// https://developers.facebook.com/docs/messenger-platform/webhook-reference
const getFirstMessagingEntry = (body) => {
    const val = body.object == 'page' &&
            body.entry &&
            Array.isArray(body.entry) &&
            body.entry.length > 0 &&
            body.entry[0] &&
            body.entry[0].id === config.FB_PAGE_ID &&
            body.entry[0].messaging &&
            Array.isArray(body.entry[0].messaging) &&
            body.entry[0].messaging.length > 0 &&
            body.entry[0].messaging[0]
        ;
    return val || null;
};

var sessions = {};
const findOrCreateSession = (sessions, fbid, cb) => {

    if (!sessions[fbid]) {
        console.log("New Session for:", fbid);
        sessions[fbid] = {context: {}};
    }

    cb(sessions, fbid);
};

// Wit.ai bot specific code

// Import our bot actions and setting everything up
const actions = require('./wit.actions');
const wit = new Wit(config.WIT_TOKEN, actions);

// Starting our webserver and putting it all together
const app = express();
app.set('port', PORT);
app.listen(app.get('port'));
app.use(bodyParser.json());

// Webhook setup
app.get('/', (req, res) => {
    if (!config.FB_VERIFY_TOKEN) {
        throw new Error('missing FB_VERIFY_TOKEN');
    }
    if (req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === config.FB_VERIFY_TOKEN) {
        res.send(req.query['hub.challenge']);
    } else {
        res.sendStatus(400);
    }
});

// Message handler
app.post('/', (req, res) => {
    // Parsing the Messenger API response
    const messaging = getFirstMessagingEntry(req.body);
    if (messaging && messaging.recipient.id === config.FB_PAGE_ID) {
        // Yay! We got a new message!

        // We retrieve the Facebook user ID of the sender
        const sender = messaging.sender.id;

        // We retrieve the user's current session, or create one if it doesn't exist
        // This is needed for our bot to figure out the conversation history
        findOrCreateSession(sessions, sender, (sessions, sessionId) => {
            // We retrieve the message content

            //First do Postbacks -> then go with this context to wit.ai
            async.series(
                [
                    function (callback) {
                        if (messaging.postback) {
                            //POSTBACK
                            const postback = messaging.postback;

                            if (postback) {
                                // var context = sessions[sessionId].context;
                                // FB.handlePostback(sessionId, context, postback.payload, (context) => {
                                //     callback(null, context);
                                // });
                                receivedPostback(messaging);
                            }
                        } else {
                            callback(null, {});
                        }
                    },
                    function (callback) {
                        if (messaging.message) {
                            //MESSAGE

                            const msg = messaging.message.text;
                            const atts = messaging.message.attachments;

                            if (atts) {
                                // We received an attachment

                                // Let's reply with an automatic message
                                FB.sendText(
                                    sender,
                                    'Sorry I can only process text messages for now.'
                                );
                                callback(null, {});

                            } else {

                                if (msg == 'generic') {
                                  sendGenericMessage(sender);
                                } else if (msg == 'Delhi') {
                                  receivedWeatherMessage(messaging);
                                } else {
                                    console.log("Run wit with context", sessions[sessionId].context);
                                    // Let's forward the message to the Wit.ai Bot Engine
                                    // This will run all actions until our bot has nothing left to do
                                    wit.runActions(
                                        sessionId, // the user's current session
                                        msg, // the user's message
                                        sessions[sessionId].context, // the user's current session state
                                        (error, context) => {
                                            if (error) {
                                                console.log('Oops! Got an error from Wit:', error);
                                            } else {
                                                // Our bot did everything it has to do.
                                                // Now it's waiting for further messages to proceed.
                                                console.log('Waiting for futher messages.');

                                                // Based on the session state, you might want to reset the session.
                                                // This depends heavily on the business logic of your bot.
                                                // Example:
                                                // if (context['done']) {
                                                //   delete sessions[sessionId];
                                                // }
                                                
                                                /*
                                                // This code is for fetching the countries list by language                                              
                                                var country = 'https://restcountries.eu/rest/v2/lang/es';
                                                request({
                                                  url: country,
                                                  json: true
                                                }, function(error, response, body) {
                                                  try {
                                                    console.log("body: ", body);
                                                    //var condition = body.query.results.channel.item.condition;
                                                    //callback("Today is " + condition.temp + " and " + condition.text + " in " + location);
                                                    //console.log("Today is condition: ", condition);
                                                  } catch(err) {
                                                    console.error('error caught', err);
                                                    //callback("There was an error");
                                                  }
                                                });*/
                                                // var source = 'Dehradun', target = 'Bangalore';
                                                // var distance = 'https://maps.googleapis.com/maps/api/directions/json?origin=' + source + '&destination=' + target + '&sensor=false';
                                                // request({
                                                //   url: distance,
                                                //   json: true
                                                // }, function(error, response, body) {
                                                //   try {
                                                //     console.log("body: ", response);
                                                //     //var condition = body.query.results.channel.item.condition;
                                                //     //callback("Today is " + condition.temp + " and " + condition.text + " in " + location);
                                                //     //console.log("Today is condition: ", condition);
                                                //   } catch(err) {
                                                //     console.error('error caught', err);
                                                //     //callback("There was an error");
                                                //   }
                                                // });

                                                //console.log("Countries list: ", country);
                                                // Updating the user's current session state
                                                //sessions[sessionId].context = context;
                                                callback(null, context);
                                            }
                                        }
                                    );    
                                }
                                

                            }
                        } else {
                            //delivery confirmation
                            //mids etc

                            callback(null, {});
                            }
                    },
                ],
                function (err, results) {

                    /* var newContext = sessions[sessionId].context;
                     console.log("Old context", newContext);
                     for (let context_return of results) {

                     newContext = newContext.concat(context_return);
                     console.log("New after adding", context_return, newContext);
                     }

                     sessions[sessionId].context = newContext;*/

                    console.log("Session context", sessions[sessionId].context);
                }
            );
            }
        );
    }
    res.sendStatus(200);
});

function sendGenericMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "rift",
            subtitle: "Next-generation virtual reality",
            item_url: "https://www.oculus.com/en-us/rift/",               
            //image_url: SERVER_URL + "/assets/rift.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/rift/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for first bubble",
            }],
          // }, {
          //   title: "touch",
          //   subtitle: "Your Hands, Now in VR",
          //   item_url: "https://www.oculus.com/en-us/touch/",               
          //   //image_url: SERVER_URL + "/assets/touch.png",
          //   buttons: [{
          //     type: "web_url",
          //     url: "https://www.oculus.com/en-us/touch/",
          //     title: "Open Web URL"
          //   }, {
          //     type: "postback",
          //     title: "Call Postback",
          //     payload: "Payload for second bubble",
          //   }]
          }]
        }
      }
    }
  };  

  callSendAPI(messageData);
}

function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback 
  // button for Structured Messages. 
  var payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' " + 
    "at %d", senderID, recipientID, payload, timeOfPostback);

  // When a postback is called, we'll send a message back to the sender to 
  // let them know it was successful
  sendTextMessage(senderID, "Postback called");
}

function receivedWeatherMessage(event) {
  console.log('incoming event', event);
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;
  console.log(JSON.stringify(message));
  var messageId = message.mid;
  var messageText = message.text;
    var messageAttachments = message.attachments;
  if (messageText) {
      sendWeatherMessage(senderID, messageText);
    }
}

function getWeather(callback, location) {
  var weatherEndpoint = 'https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20weather.forecast%20where%20woeid%20in%20(select%20woeid%20from%20geo.places(1)%20where%20text%3D%22' + location + '%22)&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys';
  console.log(weatherEndpoint);
  request({
    url: weatherEndpoint,
    json: true
  }, function(error, response, body) {
    try {
      var condition = body.query.results.channel.item.condition;
      callback("Today is " + condition.temp + " and " + condition.text + " in " + location);
    } catch(err) {
      console.error('error caught', err);
      callback("There was an error");
    }
  });
}

function sendWeatherMessage(recipientId, messageText) {
  console.log('incoming message text', messageText);
  getWeather(function(message) {
    var messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        text: message
      }
    };
    callSendAPI(messageData);
  }, messageText);
}


function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText,
      metadata: "DEVELOPER_DEFINED_METADATA"
    }
  };

  callSendAPI(messageData);
}

function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: 'EAATGCR7oVZCABACyLfju5catYUG6mZAkCgZBGAMaOENsDXDU96guYW7ZBVVjUyndmiqY8Kd8ovkCDZCLYubIEn5ErduXGCmd5D2M9mhRhD8B53hf1MONMMHk5ZBRDnbQBEpTXXkw9XmbBVQTnOPexe0Ap47ZAGpDFB66GbRiKXQnwZDZD'},
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      if (messageId) {
        console.log("Successfully sent message with id %s to recipient %s", 
          messageId, recipientId);
      } else {
      console.log("Successfully called Send API for recipient %s", 
        recipientId);
      }
    } else {
      console.error("Failed calling Send API", response.statusCode, response.statusMessage, body.error);
    }
  });  
}
