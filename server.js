var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var coffea = require('coffea');

app.get('/', function (req, res){
  res.sendFile('index.html', {"root": __dirname});
});

http.listen(3000, function (){
  console.log('listening on *:3000');
});

var sockets = {};

io.on('connection', function (socket) {
  socket.on('init', function (init) {
    if (sockets[init.relayid]) {
      var othersocket = sockets[init.relayid];
      socket.coffea = othersocket.coffea;
      socket.relayid = othersocket.relayid;
      console.log('[' + socket.relayid + ']', 'coffea re-init');
    } else {
      socket.coffea = coffea(init);
      socket.coffea.on('motd', function (err, event) {
        if (err) {
          console.error(err);
          return;
        }
        socket.relayid = init.relayid;
        sockets[socket.relayid] = socket;
        console.log('[' + socket.relayid + ']', 'coffea init');
      });
    }
    socket.coffea.on('event', function (name, err, event) {
      event.irc = null;
      if (event.by) event.by.client = null;
      if (event.from) event.from.client = null;
      if (event.user) event.user.client = null;
      if (event.channel) event.channel.client = null;
      console.log(event);
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
