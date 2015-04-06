function parseCommand(str) {
  var args = [];
  var readingPart = false;
  var part = '';
  for (var i=0; i<=str.length; i++) {
    if(str.charAt(i) === ' ' && !readingPart) {
      args.push(part);
      part = '';
    } else {
      if(str.charAt(i) === '\"') {
        readingPart = !readingPart;
      } else {
        part += str.charAt(i);
      }
    }
  }
  args.push(part);
  return args;
}

function createClient(init) {
  var socket = io();
  socket.emit('init', init);
  return {
    socket: socket,
    call: function (cmd, args) {
      socket.emit('command', cmd, args);
    },
    on: function (name, func) {
      socket.on(name, function (err, event) {
        event.irc = this;
        return func(err, event);
      });
    },
    __noSuchMethod__: function (cmd, args) {
      return call(cmd, args);
    }
  };
}

var messages = {};
var currentNetwork = "0";
var currentChannel = "#test";

function addChannel(channel) {
  var newItem = $('<a id="' + channel.network + '_' + channel.name.replace('#', '_') + '" class="item">' + channel.name + '<div class="ui label">1</div></a>');
  newItem.insertBefore("#menu .item.search");
  newItem.click(function () {
    switchChannel(channel.network, channel.name);
  });
}

function refreshMessages() {
  var msgs = messages[currentNetwork][currentChannel];
  var htmlMessages = $('#messages');
  htmlMessages.html('');
  msgs.forEach(function (msg) {
    if (typeof msg[0] === 'object') {
      // this is a system message
      htmlMessages.append($('<div class="ui ' + msg[0].color + ' message">' + msg[1] + '</div>'))
    } else {
      htmlMessages.append($('<li>').text(msg[0] + ': ' + msg[1]));
    }
  });
}

function addMessage(network, channel, nick, message) {
  if (!messages[network]) messages[network] = {};
  if (!messages[network][channel]) messages[network][channel] = [];
  messages[network][channel].push([nick, message]);
}

function activateItem(item) {
  item.addClass("active");
  item.addClass("teal");
  item.find('.label').addClass("teal");
}

function deactivateItem(item) {
  item.removeClass("active");
  item.removeClass("teal");
  item.find('.label').removeClass("teal");
}

function switchChannel(network, channel) {
  currentNetwork = network;
  currentChannel = channel;
  deactivateItem($('.item'));
  activateItem($('#' + currentNetwork + '_' + currentChannel.replace('#', '_')));
  refreshMessages();
}

$(document).ready(function () {
  var client = createClient({'relayid': 114, 'host': 'irc.thepups.net'});

  client.on('message', function (err, event) {
    addMessage(event.channel.network, event.channel.name, event.user.nick, event.message);
    refreshMessages();
  });

  client.on('join', function (err, event) {
    addChannel(event.channel);
    addMessage(event.channel.network, event.channel.name, {color: 'teal'}, 'Joined channel.');
    switchChannel(event.channel.network, event.channel.name);
  });

  $('#m').keyup(function (e) {
    if (e.keyCode == 13) { // enter key
      var args = parseCommand($('#m').val(), true);
      client.call(args.shift(), args);
      $('#m').val('');
      return false;
    }
  });
});
