var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var coffea = require('coffea');

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res){
  res.sendFile('index.html', {"root": __dirname + '/public'});
});

http.listen(3000, function (){
  console.log('listening on *:3000');
});

var BACKLOG_LIMIT = 512;

var sockets = {};

io.on('connection', function (socket) {
  socket.on('init', function (relayid, init) {
    if (sockets[relayid]) {
      var othersocket = sockets[relayid];
      socket.coffea = othersocket.coffea;
      socket.relayid = othersocket.relayid;
      if (othersocket.joins) {
        othersocket.joins.forEach(function (element) {
          var err = element[0];
          var event = element[1];
          socket.emit('join', err, event);
        });
      }
      if (othersocket.messages) {
        othersocket.messages.forEach(function (element) {
          var err = element[0];
          var event = element[1];
          socket.emit('message', err, event);
        });
      }
      if (othersocket.motds) {
        othersocket.motds.forEach(function (element) {
          var err = element[0];
          var event = element[1];
          socket.emit('motd', err, event);
        });
      }
      if (othersocket.coffeaconnections) {
        othersocket.coffeaconnections.forEach(function (element) {
          var err = element[0];
          var event = element[1];
          socket.emit('coffeaconnect', err, event);
        });
      }
      console.log('[' + socket.relayid + ']', 'coffea re-init');
    } else {
      socket.coffea = coffea(init);
      socket.coffea.on('connect', function (err, event) {
        if (err) {
          console.error(err);
          return;
        }
        socket.relayid = relayid;
        sockets[socket.relayid] = socket;
        console.log('[' + socket.relayid + ']', 'coffea init');
      });
    }
    socket.coffea.on('join', function (err, event) {
      // save join events
      if (!socket.joins) socket.joins = [];
      if (event.user.nick === socket.coffea.networked_me[event.network].nick) {
            socket.joins.push([err, event]);
      }
    });
    socket.coffea.on('part', function (err, event) {
      // save part events
      if (!socket.joins) socket.joins = [];
      console.log(event);
      if (event.user.nick === socket.coffea.networked_me[event.network].nick) {
            socket.joins.forEach(function (element, index, object) {
              var event_ = element[1];
              console.log(event_);
              if ((event.channel.network === event_.channel.network) &&
                  (event.channel.name === event_.channel.name)) {
                    object.splice(index, 1); // remove channel from buffer
              }
            });
      }
    });
    socket.coffea.on('coffeaconnect', function (err, event) {
      // save connect events
      if (!socket.coffeaconnections) socket.coffeaconnections = [];
      socket.coffeaconnections.push([err, event]);
    })
    socket.coffea.on('motd', function (err, event) {
      // save motd events
      if (!socket.motds) socket.motds = [];
      socket.motds.push([err, event]);
    })
    socket.coffea.on('message', function (err, event) {
      // save message events
      if (!socket.messages) socket.messages = [];
      socket.messages.push([err, event]);
      if (socket.messages.length >= BACKLOG_LIMIT) {
        socket.messages.shift();
      }
    });
    socket.coffea.on('event', function (name, err, event) {
      event.irc = null;
      // TODO: parse by/from/user/channel objects here
      if (event.by) event.by.client = null;
      if (event.from) event.from.client = null;
      if (event.user) event.user.client = null;
      if (event.channel) event.channel.client = null;
      socket.emit(name, err, event);
    });
  });

  socket.on('command', function (cmd, args) {
    if (!socket.relayid) {
      console.log('client not initialized yet');
      return;
    }

    console.log('[' + socket.relayid + ']', 'client.' + cmd, '(', args, ')');
    if (socket.coffea[cmd] instanceof Function) {
      socket.coffea[cmd].apply(socket.coffea, args);
    } else {
      console.log('[' + socket.relayid + ']', 'invalid function', cmd, args);
    }
  });
});
