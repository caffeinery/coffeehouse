var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var coffea = require('coffea');

app.get('/', function (req, res){
 res.sendFile('index.html', {"root": __dirname});
});

io.on('connection', function (socket){
 console.log('a user connected');
 socket.on('init', function (init) {
  socket.coffea = coffea(init);
  socket.coffea.on('motd', function (err, event) {
   if (err) {
    console.error(err);
    return;
   }
   socket.bncid = init.bncid;
   console.log('[' + socket.bncid + ']', 'coffea init');
  });
 });
 socket.on('command', function (cmd, args) {
  if (!socket.bncid) {
   console.log('not initialized yet');
   return;
  }
  console.log('[' + socket.bncid + ']', 'client.' + cmd, '(', args, ')');
  if (socket.coffea[cmd] instanceof Function) {
   socket.coffea[cmd].apply(socket.coffea, args);
  } else {
   console.log('invalid function', cmd, args);
  }
 });
});

http.listen(3000, function (){
 console.log('listening on *:3000');
});
