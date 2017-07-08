var express = require('express');
var bodyParser = require('body-parser')
var app = express();
var fs = require("fs");
var loki = require('lokijs');
var dateFormat = require('dateformat');
var Gpio = require('onoff').Gpio;
var pinGpioNumHeat = 5;
var pinGpioNumPump = 6;
var pinGpioNumValve1 = 26;
var pinGpioNumValve2 = 13;

var exec = require('child-process-promise').exec;

var relayHeat = new Gpio(pinGpioNumHeat, 'out'); // uses "GPIO" numbering
relayHeat.write(1, function(err) {
    if (err) {
        console.log('Error set heater initial state to off.');
    }
    else {
        console.log('Set heater initial state to off.');
    }
});

var relayPump = new Gpio(pinGpioNumPump, 'out'); // uses "GPIO" numbering
relayPump.write(1, function(err) {
    if (err) {
        console.log('Error set pump initial state to off.');
    }
    else {
        console.log('Set pump initial state to off.');
    }
});

var relayValve1 = new Gpio(pinGpioNumValve1, 'out'); // uses "GPIO" numbering
relayValve1.write(1, function(err) {
    if (err) {
        console.log('Error set valve 1 initial state to off.');
    }
    else {
        console.log('Set valve 1 initial state to off.');
    }
});

var relayValve2 = new Gpio(pinGpioNumValve2, 'out'); // uses "GPIO" numbering
relayValve2.write(1, function(err) {
    if (err) {
        console.log('Error set valve 2 initial state to off.');
    }
    else {
        console.log('Set valve 2 initial state to off.');
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
    
    exec('python ../MAX31865/max31865.py')
        .then(function (result) {
            var stdout = result.stdout;
            var stderr = result.stderr;
            
            tempSensor.degreesC = Number(stdout).toFixed(2);
            tempSensor.degreesF = Number(stdout * 9/5 + 32).toFixed(2);
            res.json(tempSensor);
        })
        .catch(function (err) {
            console.error('ERROR: ', err);
            res.status(500).send('Something broke!');
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
        relay.description = val === 1 ? "off" : "on";
        res.json(relay);
    });
});

// sets heater status
app.post('/heater/:val', function(req, res) {
    var writeVal = 1; // off
    if (req.params.val == "0" || req.params.val == "on") {
        writeVal = 0; // on
    }
    relayHeat.write(writeVal, function(err) {
        if (err) {
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
    exec('pgrep -f pid-test -a', function(error, stdout, stderr) {
        if (error !== null) {
            console.log('exec error: ', error);
            res.status(500).send(err);
        }

        const regex = /\d+\s(node|sudo\snode)(.*)pid-test\/app\.js\s([^\s]+)\s([\d\.]+)\s([\d|\.]+)/g;
        // example stdout
        // 1815 sudo node ../pid-test/app.js PATH_TEST 2 3
        // 1819 node ../pid-test/app.js PATH_TEST 2 3
        // 1911 /bin/sh -c pgrep -f pid-test -a
        let m;

        while ((m = regex.exec(stdout)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }
            
            // The result can be accessed through the `m`-variable.
            m.forEach((match, groupIndex) => {
                status.isBrewSessionRunning = true;
                switch (groupIndex) {
                    case 3:
                        status.sessionName = match;
                        break;
                    case 4:
                        status.mashTemp = match;
                        break;
                    case 5:
                        status.mashHoldTime = match;
                        break;
                }
            });
        }

        res.json(status);
    });
});

app.post('/brew/:action', function(req, res) {
    var spawn = require('child_process').spawn;
    var response = {};

    if (req.params.action == "start") {
        // get the params
        var sessionName = req.body.sessionName;
        var mashTemp = req.body.mashTemp;
        var mashHoldTime = req.body.mashHoldTime;

        // start the pid process
        var theArgs = ['/home/pi/Documents/pid-test/app.js', sessionName, mashTemp,  mashHoldTime];
        var theOptions = {cwd: '/home/pi/Documents/pid-test'};
        var theProcess = spawn('node', theArgs, theOptions);
    }
    if (req.params.action == "stop") {
        var theArgs = ['-f', 'pid-test'];
        var theProcess = spawn('pkill', theArgs);
    }

    if (req.params.action == "save") {
        var db = new loki('../pid-test/brewSessions.json');
        db.loadDatabase({}, function() {
            var brewSessionCollection = db.getCollection('brewSessions');

            // get the params
            var brewSessionName = req.body.name;
            var mashSteps = req.body.mashSteps;
            var boil = req.body.boil;

            var createdDate = new Date().getTime();
            brewSession = {
                'name': brewSessionName,
                'created': createdDate,
                'formattedCreated': dateFormat(createdDate, "mm-dd-yyyy"),
                //'mashStartTime': '',
                //'formattedMashStartTime': '',
                //'mashEndTime': '',
                //'formattedMashEndTime': '',
                'mashSteps': mashSteps,
                'boil': boil,
                'mashTempData': []
            };
            var resultObject = brewSessionCollection.insert(brewSession);
            
            response.id = resultObject.$loki;
            console.log('inserted new item: ', response.id);
            
            db.saveDatabase(function(err) {
                if (err) {
                    console.log('Save database error.', {error: err})
                }
            });

            response.action = req.params.action;
            res.json(response);
        });
    }
});

app.listen(3001, function () {
  console.log('Newo Brew API listening on port 3001!')
})

// returns brew session data from the database
app.get('/brewSession/:sessionId', function(req, res) {
    var db = new loki('../pid-test/brewSessions.json');
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
    var db = new loki('../pid-test/brewSessions.json');
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

module.exports = app;