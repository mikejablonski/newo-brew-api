var express = require('express');
var app = express();
var Gpio = require('onoff').Gpio;
var pinGpioNumHeat = 13;
var pinGpioNumPump = 26;

var max31855 = require('max31855');
var thermoSensor = new max31855();

var relayHeat = new Gpio(pinGpioNumHeat, 'out'); // uses "GPIO" numbering
var relayPump = new Gpio(pinGpioNumPump, 'out'); // uses "GPIO" numbering

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get('/', function(req, res) {
    res.send('Hello from Newo Brew.');
});

// returns temp sensor data
app.get('/temp', function(req, res) {
    thermoSensor.readTempC(function(temp) {
        var tempSensor = {};
        tempSensor.degreesC = Number(temp).toFixed(2);
        tempSensor.degreesF = Number(temp * 9/5 + 32).toFixed(2);
        res.json(tempSensor);
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
    exec('pgrep -f pid-test -c', function(error, stdout, stderr) {
        if (error !== null) {
            console.log('exec error: ', error);
            res.status(500).send(err);
        }

        // not sure why this is 2 when the process is running.
        // from the shell directly this is either 0 or 1. here it's 1 or 2.
        if (stdout.charAt(0) === '2') {
            status.isBrewSessionRunning = true;
        }

        res.json(status);
    });
});

app.post('/brew/:action', function(req, res) {
    var spawn = require('child_process').spawn;

    if (req.params.action == "start") {
        // start the pid process
        var theArgs = ['/home/pi/Documents/pid-test/app.js', 'API_TEST', '30',  '60'];
        var theOptions = {cwd: '/home/pi/Documents/pid-test'};
        var theProcess = spawn('node', theArgs, theOptions);
    }
    if (req.params.action == "stop") {
        var theArgs = ['-f', 'pid-test'];
        var theProcess = spawn('pkill', theArgs);
    }

    var response = {};
    response.action = req.params.action;
    res.json(response);
});

app.listen(3001, function () {
  console.log('Newo Brew API listening on port 3001!')
})

module.exports = app;