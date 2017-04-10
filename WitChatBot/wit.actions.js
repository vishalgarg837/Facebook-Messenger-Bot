'use strict';

const async = require('async');
const FB = require("./facebook.action");
var distance = require('google-distance');
const request = require('request');
var iGoogleNewsRSSScraper = require('googlenews-rss-scraper');
var _ = require('lodash');

let NewsAPI = require('newsapi');
let newsapi = new NewsAPI('259389706f8b44698eead4f2a1b8df5d');

module.exports = {
    say(recipientId, context, message, cb) {
        console.log("say message: ", message);
        var lat = 31.470656, long = 74.412929;
        if(message.includes("maps.google.com")) {
            console.log("split message: ", message.split("==>")[1]);
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
                            title: "Your requested distance:",
                            subtitle: message.split("==>")[0],
                            //item_url: "https://www.oculus.com/en-us/rift/",               
                            //image_url: SERVER_URL + "/assets/rift.png",
                            //image_url: "https:\/\/maps.googleapis.com\/maps\/api\/staticmap?center=Albany,+NY&zoom=13&scale=false&size=600x300&maptype=roadmap&format=png&visual_refresh=true",
                            image_url: "https:\/\/maps.googleapis.com\/maps\/api\/staticmap?center=" + message.split("?")[1].split("=")[1].split("&")[0] + "&zoom=13&scale=false&size=600x300&maptype=roadmap&format=png&visual_refresh=true",
                            item_url: message.split("==>")[1],
                            //image_url: "http:\/\/maps.googleapis.com\/maps\/api\/staticmap?zoom=17&size=512x512&maptype=hybrid&markers=icon:" + message.split("==>")[1] + "|34.052230,%20-118.243680"
                            //item_url: "http:\/\/maps.apple.com\/maps?q="+lat+","+long+"&z=16"
                            //image_url: message.split("==>")[1],
                            // buttons: [{
                            //   type: "web_url",
                            //   url: message.split("==>")[1],
                            //   title: "Check map"
                            // },
                            // ],
                        }]
                    }
                  }
                }
            };  
            callSendAPI(messageData); 
            cb();
        } else if(message.includes("newsArray")) {
            message = message.split(",")[1];
            console.log("\n\nsay newsArray: ", context);
            //console.log("\n\n title: ", context.news[0].title);

            var templateElements = [];
            // _.each(context.news, function (news) {
            //     var tempObj = {};
            //     tempObj.title = news.title,
            //     tempObj.subtitle = news.category,
            //     tempObj.item_url = news.cleanURL,
            //     //tempObj.image_url: "http://messengerdemo.parseapp.com/img/rift.png",
            //     tempObj.buttons = [{
            //         type: "web_url",
            //         url: news.cleanURL,
            //         title: "Read more..."
            //     }]
            //     templateElements.push(tempObj);  
            // });
            _.each(context.news, function (news) {
                var tempObj = {};
                tempObj.title = news.name,
                tempObj.subtitle = news.category,
                tempObj.item_url = news.url,
                tempObj.image_url = news.urlsToLogos.small,
                tempObj.buttons = [{
                    type: "web_url",
                    url: news.url,
                    title: "Read more..."
                }]
                templateElements.push(tempObj);  
            });
            var messageData = {
                recipient: {
                  id: recipientId
                },
                message: {
                  attachment: {
                    type: "template",
                    payload: {
                      template_type: "generic",
                      elements: templateElements
                      // [{
                      //   title: context.news[0].title,
                      //   subtitle: context.news[0].category,
                      //   item_url: context.news[0].cleanURL,               
                      //   //image_url: "http://messengerdemo.parseapp.com/img/rift.png",
                      //   buttons: [{
                      //     type: "web_url",
                      //     url: context.news[0].cleanURL,
                      //     title: "Read more..."
                      //    }],
                      // }]
                    }
                  }
                }
              };   
              callSendAPI(messageData); 
              cb();       
        } else {
            if (recipientId) {
                // Yay, we found our recipient!
                // Let's forward our bot response to her.
                FB.sendText(recipientId, message, (err, data) => {
                    if (err) {
                        console.log(
                            'Oops! An error occurred while forwarding the response to',
                            recipientId,
                            ':',
                            err
                        );
                    }
                    // Let's give the wheel back to our bot
                    cb();
                });
            } else {
                console.log('Oops! Couldn\'t find user for session:', sessionId);
                // Giving the wheel back to our bot
                cb();
            }
        }
    },

    merge(recipientId, context, entities, message, cb) {
        console.log("merge message: ", message);
        if(message.includes("distance") || message.includes("Distance")) {
            console.log("mergeDistance parameters: ", context, entities, message);
            console.log("entities: ", entities.location[0].value, entities.location[1].value);
            context.loc1 = entities.location[0].value;
            context.loc2 = entities.location[1].value;
            cb(context);
        } else if(message.includes("news") || message.includes("News")) {
            //console.log("mergeNewsparameters: ", context, entities, message);
            console.log("entities: ", entities.newsType[0].value, entities.showNews[0].value);
            context.nwsTyp = entities.newsType[0].value;
            context.shNews = entities.showNews[0].value;
            cb(context);
        } else {
            async.forEachOf(entities, (entity, key, cb) => {
            const value = firstEntityValue(entity);
            //console.error("Result", key, value);
            if (value != null && (context[key] == null || context[key] != value)) {

                switch (key) {
                    default:
                        cb();
                }
            }
            else
                cb();

            }, (error) => {
                if (error) {
                    console.error(error);
                } else {
                    console.log("Context after merge:\n", context);
                    cb(context);
                }
            });
        }
    },

    // mergeDistance(sessionId, context, entities, message, cb) {
    //     // Reset the distance story
    //     //delete context.distance
    //     console.log("mergeDistance parameters: ", sessionId, context, entities, message);
    //     // Retrive the location entity and store it in the context field
    //     var loc1 = firstEntityValue(entities, 'location')
    //     if (loc1) {
    //         context.loc1 = loc
    //     }
    //     console.log("mergeDistance: ", loc1);
    //     var loc2 = firstEntityValue(entities, 'location')
    //     if (loc2) {
    //         context.loc2 = loc
    //     }
    //     console.log("mergeDistance: ", loc2);
    //     cb(context);
    // },

    error(recipientId, context, error) {
        console.log(error.message);
    },

    /**** Add your own functions HERE ******/

    ['fetchDistance'](sessionId, context, cb) {
        // Here we can place an API call to a weather service
        // if (context.loc) {
        //  getWeather(context.loc)
        //      .then(function (forecast) {
        //          context.forecast = forecast || 'sunny'
        //      })
        //      .catch(function (err) {
        //          console.log(err)
        //      })
        // }
        console.log("fetchDistance parameters: ", context);
        distance.get(
            {
                origin: context.loc1,
                destination: context.loc2
            },
            function(err, data) {
                if (err) console.log("fetched err is: ", err);
                console.log("fetched distance is: ", data);
                context.distance = data.distance;
        });

        cb(context);
    },

    ['fetchNews'](sessionId, context, cb) {
        console.log("fetchNews parameters: ", context);
        // iGoogleNewsRSSScraper.getGoogleNewsRSSScraperData( { newsType: 'TOPIC', newsTypeTerms: context.nwsTyp }, 
        //     function(data) {
        //         if(!data.error) {
        //             //console.log(JSON.stringify(data.newsArray, null, 2)); 
        //             //context.news = JSON.stringify(data.newsArray, null, 2);
        //             context.news = data.newsArray;     
        //         }
        //         else {
        //             console.log('Some error occured: ', data.error, data);
        //             context.news = data.errorMessage;
        //         }
        //     }
        // );
        newsapi.sources({
          category: context.nwsTyp, // optional 
          language: 'en', // optional 
          //country: 'us' // optional 
        }).then(sourcesResponse => {
          console.log("\n\n sourcesResponse: ", sourcesResponse);
          context.news = sourcesResponse.sources;
        });
        cb(context);
    },
};

// Helper function to get the first message
const firstEntityValue = (entity) => {
    const val = entity && Array.isArray(entity) &&
            entity.length > 0 &&
            entity[0].value
        ;
    if (!val) {
        return null;
    }
    return typeof val === 'object' ? val.value : val;
};

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
