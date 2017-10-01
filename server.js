var express = require('express');
var apicache = require('apicache');
var bodyParser = require('body-parser')
var app = express();
var loki = require('lokijs');
var dateFormat = require('dateformat');
var Gpio = require('onoff').Gpio;
var pinGpioNumHeat = 27;
var pinGpioNumPump = 6;
var pinGpioNumValve1 = 26;
var pinGpioNumValve2 = 13;

// this is what we'll add to the tempC value from the temp db
var tempCalibrationAdjustment = 1.26;

var cache = apicache.middleware;
const winston = require('winston');
const fs = require('fs');
const env = process.env.NODE_ENV || 'development';
const logDir = 'logs';
// Create the log directory if it does not exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}
const tsFormat = () => (new Date()).toLocaleTimeString();
const logger = new (winston.Logger)({
  transports: [
    // colorize the output to the console
    new (winston.transports.Console)({
      timestamp: tsFormat,
      colorize: true,
      level: env === 'development' ? 'debug' : 'info'
    }),
    new (winston.transports.File)({
      filename: `${logDir}/log.json`,
      timestamp: tsFormat,
      maxsize: 5242880, // 5 MB
      maxFiles: 10,
      level: env === 'development' ? 'debug' : 'info'
    })
  ]
});

var sqlite3 = require('sqlite3').verbose();

var relayHeat = new Gpio(pinGpioNumHeat, 'out'); // uses "GPIO" numbering
// zero is off on the SSR
relayHeat.write(0, function(err) {
    if (err) {
        logger.log('Error set heater initial state to off.');
    }
    else {
        logger.log('Set heater initial state to off.');
    }
});

var relayPump = new Gpio(pinGpioNumPump, 'out'); // uses "GPIO" numbering
relayPump.write(1, function(err) {
    if (err) {
        logger.log('Error set pump initial state to off.');
    }
    else {
        logger.log('Set pump initial state to off.');
    }
});

var relayValve1 = new Gpio(pinGpioNumValve1, 'out'); // uses "GPIO" numbering
relayValve1.write(1, function(err) {
    if (err) {
        logger.log('Error set valve 1 initial state to off.');
    }
    else {
        logger.log('Set valve 1 initial state to off.');
    }
});

var relayValve2 = new Gpio(pinGpioNumValve2, 'out'); // uses "GPIO" numbering
relayValve2.write(1, function(err) {
    if (err) {
        logger.log('Error set valve 2 initial state to off.');
    }
    else {
        logger.log('Set valve 2 initial state to off.');
    }
});

// parse application/x-www-form-urlencoded 
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json 
app.use(bodyParser.json())

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get('/', function(req, res) {
    res.send('Hello from Ballard.');
});

// returns temp sensor data
app.get('/temp', function(req, res) {
    var tempSensor = {};
    var db = new sqlite3.Database('../newo-brew-temp-daemon/temp.db', sqlite3.OPEN_READONLY);

    db.all('SELECT * FROM temp', function(err, rows) {
        if (err) {
            logger.error('Error in temp route.');
            logger.error(err);
            // We still want to return something valid to the controller.
            tempSensor.degreesC = -1;
            tempSensor.degreesF = -1;
            res.json(tempSensor);
            db.close();
        }
        else {
            var dbTemp = Number(rows[0].temp);
            dbTemp += tempCalibrationAdjustment;

            tempSensor.degreesC = Number(dbTemp).toFixed(2);
            tempSensor.degreesF = Number(dbTemp * 9/5 + 32).toFixed(2);
            res.json(tempSensor);
            db.close();
        }
    });
});

// returns pump status
app.get('/pump', function(req, res) {
    readVal = relayPump.read(function(err, val) {
        var relay = {};
        relay.name = "pump";
        relay.status = val;
        relay.description = val === 1 ? "off" : "on";
        res.json(relay);
    });    
});

// sets pump status
app.post('/pump/:val', function(req, res) {
    var writeVal = 1; // off
    if (req.params.val == "0" || req.params.val == "on") {
        writeVal = 0; // on
    }
    relayPump.write(writeVal, function(err) {
        if (err) {
            res.status(500).send(err);
        }
        else {
            res.sendStatus(200);
        }
    });
});

// get ball valve status
app.get('/valve/:num', function(req, res) {
    var valve = relayValve1;
    if (req.params.num == "2") {
        valve = relayValve2;
    }

    readVal = valve.read(function(err, val) {
        var relay = {};
        relay.name = `valve${req.params.num}`;
        relay.status = val;
        relay.description = val === 1 ? "off" : "on";
        res.json(relay);
    });    
});

// set ball valve position
app.post('/valve/:num/:val', function(req, res) {
    var valve = relayValve1;
    if (req.params.num == "2") {
        valve = relayValve2;
    }

    var writeVal = 1; // off
    if (req.params.val == "0" || req.params.val == "on") {
        writeVal = 0; // on
    }
    valve.write(writeVal, function(err) {
        if (err) {
            logger.error('Error in post valve route.');
            logger.error(err);
            res.status(500).send(err);
        }
        else {
            res.sendStatus(200);
        }
    });
});

// returns heater status
app.get('/heater', function(req, res) {
    readVal = relayHeat.read(function(err, val) {
        var relay = {};
        relay.name = "heater";
        relay.status = val;
        // zero is off on the SSR
        relay.description = val === 0 ? "off" : "on";
        res.json(relay);
    });
});

// sets heater status
app.post('/heater/:val', function(req, res) {
    var writeVal = 0; // zero is off on the SSR
    if (req.params.val == "1" || req.params.val == "on") {
        writeVal = 1; // on
    }
    relayHeat.write(writeVal, function(err) {
        if (err) {
            logger.error('Error in post heater route.');
            logger.error(err);
            res.status(500).send(err);
        }
        else {
            res.sendStatus(200);
        }
    });
});

app.get('/brew', function(req, res) {
    var status = {};
    status.isBrewSessionRunning = false;

    var exec = require('child_process').exec;
    exec('pgrep -f newo-brew-controller -a', function(error, stdout, stderr) {
        if (error !== null) {
            logger.log('exec error: ', error);
            res.status(500).send(err);
        }

        //const regex = /\d+\s(node|sudo\snode)(.*)newo-brew-controller\/app\.js\s([^\s]+)\s([\d\.]+)\s([\d|\.]+)/g;
        const regex = /\d+\s(node|sudo\snode)(.*)newo-brew-controller\/app\.js\s([\d|\.]+)/g;
        // example stdout
        // 1815 sudo node ../newo-brew-controller/app.js PATH_TEST 2 3
        // 1819 node ../newo-brew-controller/app.js PATH_TEST 2 3
        // 1911 /bin/sh -c pgrep -f newo-brew-controller -a

        // updated version, by session id
        // 1815 sudo node ../newo-brew-controller/app.js 1
        let m;

        while ((m = regex.exec(stdout)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }
            
            // The result can be accessed through the `m`-variable.
            m.forEach((match, groupIndex) => {
                status.isBrewSessionRunning = true;
                if (groupIndex == 3) {
                    status.sessionId = match;
                }
            });
        }

        if (!status.isBrewSessionRunning) {
            res.json(status);
        }
        else {
            var db = new loki('../newo-brew-controller/brewSessions.json');
            db.loadDatabase({}, function() {
                var brewSessionCollection = db.getCollection('brewSessions');
                brewSession = brewSessionCollection.get(Number(status.sessionId));
                if (brewSession) {
                    calculateMinutesRemaining(brewSession);
                    status.brewSession = brewSession;
                }
                res.json(status);    
            });
        }
    });
});

app.post('/brew/:action', function(req, res) {
    var spawn = require('child_process').spawn;
    var response = {};
    response.id = 0;

    if (req.params.action == "start") {
        // get the params
        var sessionId = req.body.sessionId;

        // start the pid process
        var theArgs = ['/home/pi/Documents/newo-brew-controller/app.js', sessionId];
        var theOptions = {cwd: '/home/pi/Documents/newo-brew-controller'};
        var theProcess = spawn('node', theArgs, theOptions);

        response.action = req.params.action;
        res.json(response);
    }

    if (req.params.action == "stop") {
        var theArgs = ['-f', 'newo-brew-controller'];
        var theProcess = spawn('pkill', theArgs);

        response.action = req.params.action;
        res.json(response);
    }

    if (req.params.action == "save") {
        var db = new loki('../newo-brew-controller/brewSessions.json');
        db.loadDatabase({}, function() {
            var brewSessionCollection = db.getCollection('brewSessions');
            if (brewSessionCollection === null) {
                brewSessionCollection = db.addCollection('brewSessions');
            }

            // get the params
            var brewSessionName = req.body.name;
            var mashSteps = req.body.mashSteps;
            var boil = req.body.boil;

            var createdDate = new Date().getTime();
            brewSession = {
                'name': brewSessionName,
                'created': createdDate,
                'formattedCreated': dateFormat(createdDate, "mm-dd-yyyy"),
                'step': 1,
                'status': 1, // status: 1=stopped, 2=running, 3=complete
                'mashSteps': mashSteps,
                'boil': boil,
                'mashTempData': []
            };
            var resultObject = brewSessionCollection.insert(brewSession);
            response.id = resultObject.$loki;
            
            db.saveDatabase(function(err) {
                if (err) {
                    logger.error('Save database error.', {error: err})
                }

                response.action = req.params.action;
                res.json(response);
            });
        });
    }
});

app.listen(3001, function () {
  logger.verbose('Newo Brew API listening on port 3001!')
})

// returns brew session data from the database
app.get('/brewSession/:sessionId', function(req, res) {
    var db = new loki('../newo-brew-controller/brewSessions.json');
    db.loadDatabase({}, function() {
        var brewSessionCollection = db.getCollection('brewSessions');
        brewSession = brewSessionCollection.get(Number(req.params.sessionId));
        if (!brewSession) {
            res.status(404).send('Brew session not found');
        }
        else {
            res.json(brewSession);
        }
    });
});

// returns brew session history data from the database
app.get('/brewSessions', function(req, res) {
    var db = new loki('../newo-brew-controller/brewSessions.json');
    db.loadDatabase({}, function() {
        var brewSessionCollection = db.getCollection('brewSessions');
        if (!brewSessionCollection) {
            res.status(404).send('Brew session history not found');
        }
        else {
            res.json(brewSessionCollection);
        }
    });
});

function calculateMinutesRemaining(brewSession) {
    var minutes = 0;

    var hasHitMashStepTemp = false;
    var mashStepTargetTemp = 0;
    var hasHitBoilStepTemp = false;
    var boilStepTargetTemp = 0;

    if (brewSession.step == 1) {
        // we are heating the strike water
        
    }
    for (var i=0; i < brewSession.mashSteps.length; i++) {
        if (brewSession.mashSteps[i].mashEndTime) {
            // this mash step is completed.
            minutes += 0;
        }
        else if (brewSession.mashSteps[i].mashStartTime) {
            // this mash step is running (target temp hit).
            var now = new Date().getTime();
            var mashTimeElapsed = (now - brewSession.mashSteps[i].mashStartTime) / 60000;
            minutes += (brewSession.mashSteps[i].time - mashTimeElapsed);
            hasHitMashStepTemp = true;
            mashStepTargetTemp = brewSession.mashSteps[i].temp;
        }
        else {
            // this mash step has not yet started (or is heating).
            minutes += brewSession.mashSteps[i].time;
            mashStepTargetTemp = brewSession.mashSteps[i].temp;
        }
    }
    
    if (brewSession.boil.boilEndTime) {
        // the boil step is completed.
        minutes += 0;
    }
    else if (brewSession.boil.boilStartTime) {
        // the boil step is running (target temp hit).
        var now = new Date().getTime();
        var boilTimeElapsed = (now - brewSession.boil.boilStartTime) / 60000;
        minutes += (brewSession.boil.time - boilTimeElapsed);
        hasHitBoilStepTemp = true;
    }
    else {
        // the boil step has not yet started (or is heating).
        minutes += brewSession.boil.time;
    }

    brewSession.minutesRemaining = minutes; //minutes.toFixed(2);;
    brewSession.hasHitBoilStepTemp = hasHitBoilStepTemp;
    brewSession.hasHitMashStepTemp = hasHitMashStepTemp;
    brewSession.mashStepTargetTemp = mashStepTargetTemp;

}

// process.on('uncaughtException', function (err) {
//   logger.error((new Date).toUTCString() + ' uncaughtException:', err.message);
//   logger.error(err.stack);
//   process.exit(1);
// })

module.exports = app;