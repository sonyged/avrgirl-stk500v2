var async = require('async');

function serialCom (port) {
  var self = this;
  this.device = port;
  this.responses = new Buffer([]);
  var devMode = true;
  this.debug = devMode ? console.log : function() {};

};

serialCom.prototype.open = function() {
  this.device.open();
};

serialCom.prototype.setUpInterface = function(callback) {
  var self = this;
  this.device.open(function(error) {
    self.debug('open', error);
    if (error)
      return callback(error);
    self.device.on('data', function(data) {
      self.debug('data', data);
      self.responses = Buffer.concat([new Buffer(self.responses), new Buffer(data)]);
    });
    self.sync(function(error) {
      self.debug('sync success', error);
      return callback(error);
    });
  });
};

serialCom.prototype.close = function() {
  this.responses = new Buffer([]);
  this.device.close();
};

serialCom.prototype.write = function(data, callback) {
  var self = this;
  // this will need to swap between 200 and 1000 depending on the command
  var drainDelay = 400;

  this.device.write(data, function(error, results) {
    if (error) { return callback(new Error(error)); }
    self.device.drain(function() {
      setTimeout(callback, drainDelay * 0);
    });
  });
};

serialCom.prototype.read = function(length, callback) {
  //this.debug(this.responses);
  if (this.responses.length >= length) {
    var packet = this.responses.slice(0, length);
    this.responses = this.responses.slice(length);
    return callback(null, packet);
  } else {
    var self = this;
    setTimeout(function() { self.read(length, callback); }, 10);
  }
};

serialCom.prototype.sync = function(callback) {
  var self = this;
  var attempts = 0;
  var signon = new Buffer([0x1b, 0x03, 0x00, 0x0b, 0x0e, 0x01, 0x00, 0x08, 0x41, 0x56, 0x52, 0x49, 0x53, 0x50, 0x5f, 0x32, 0x76]);
  var drainDelay = 1000;

  function check() {
    self.read(17, function(error, data) {
      attempts += 1;
      if (!data) {
        if (attempts < 10) {
          self.debug("trying again")
          trySync();
        } else {
          self.debug('failure')
          callback(new Error('attempt to sync with programmer failed.'));
        }
      } else {
        self.debug('success');
        callback(null, data);
      }
    });
  }

  function trySync() {
    self.device.write(signon, function(error, results) {
      if (error) { return callback(new Error(error)); }
      self.device.drain(function() {
        setTimeout(check, 10);
      });
    });
  };

  trySync();
};

module.exports = serialCom;
