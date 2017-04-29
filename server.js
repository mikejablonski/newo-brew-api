var express = require('express');
var app = express();
var Gpio = require('onoff').Gpio;
var pinGpioNumHeat = 13;
var pinGpioNumPump = 26;

var max31855 = require('max31855');
var thermoSensor = new max31855();

var relayHeat = new Gpio(pinGpioNumHeat, 'out'); // uses "GPIO" numbering
var relayPump = new Gpio(pinGpioNumPump, 'out'); // uses "GPIO" numbering

app.get('/', function(req, res) {
    res.send('Hello from Newo Brew.');
});

app.get('/temp', function(req, res) {
    thermoSensor.readTempC(function(temp) {
        var tempSensor = {};
        tempSensor.degreesC = Number(temp).toFixed(2);
        tempSensor.degreesF = Number(temp * 9/5 + 32).toFixed(2);
        res.json(tempSensor);
    });
});

app.get('/pump', function(req, res) {
    readVal = relayPump.read(function(err, val) {
        var relay = {};
        relay.name = "pump";
        relay.status = val;
        res.json(relay);
    });    
});

app.post('/pump/:val', function(req, res) {
    var writeVal = 1; // off
    if (req.params.val == "0") {
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

app.get('/heater', function(req, res) {
    readVal = relayHeat.read(function(err, val) {
        var relay = {};
        relay.name = "heater";
        relay.status = val;
        res.json(relay);
    });
});

app.post('/heater/:val', function(req, res) {
    var writeVal = 1; // off
    if (req.params.val == "0") {
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

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})

module.exports = app;