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

var client = null;
var messages = {};
var currentNetwork = "0";
var currentChannel = "#test";

function addNetwork(network) {
  var newItem = $('<a id="' + network + '_main" class="item network">' + network + '<div class="ui label">1</div></a>');
  newItem.insertBefore("#menu .item.search");
  newItem.click(function () {
    switchChannel(network, 'main');
  });
  addMessage(network, 'main', {color: 'teal'}, 'Connected to network.');
}

function addChannel(channel) {
  if (!$("#menu #" + channel.network + "_main").length) addNetwork(channel.network);
  var newItem = $('<a id="' + channel.network + '_' + channel.name.replace('#', '_') + '" class="item buffer">' + channel.name + '<div class="ui label">1</div></a>');
  newItem.insertAfter("#menu #" + channel.network + "_main");
  newItem.click(function () {
    switchChannel(channel.network, channel.name);
  });
}

function removeChannel(channel) {
  delete messages[channel.network][channel.name];
  $('#' + channel.network + '_' + channel.name.replace('#', '_')).remove();
}

function refreshMessages() {
  var msgs = messages[currentNetwork][currentChannel];
  var htmlMessages = $('#messages');
  htmlMessages.empty();
  msgs.forEach(function (msg) {
    if (typeof msg[0] === 'object') {
      // this is a system message
      htmlMessages.append($('<div class="ui ' + msg[0].color + ' message">' + msg[1] + '</div>'))
    } else {
      htmlMessages.append($('<li>').text(msg[0] + ': ' + msg[1]));
    }
  });
  $('.messagebox').scrollTop($('.messagebox')[0].scrollHeight);
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
  deactivateItem($('.bufferbox .item'));
  activateItem($('#' + currentNetwork + '_' + currentChannel.replace('#', '_')));
  refreshMessages();
  if (channel === "main") $('.userbox').empty();
  else refreshUserlist();
}

function renderUserlist(names) {
  $('.userbox').empty();
  ['~', '@', '%', '+', ''].forEach(function (rank) {
    var rankTitle;
    var rankSign = '(' + rank + ')';
    switch (rank) {
      case "~":
        rankTitle = "Owner";
        rankColor = "yellow";
        break;
      case "@":
        rankTitle = "Ops";
        rankColor = "red";
        break;
      case "%":
        rankTitle = "Half-Ops";
        rankColor = "orange";
        break;
      case "+":
        rankTitle = "Voiced";
        rankColor = "green";
        break;
      default:
        rankTitle = "Members";
        rankColor = "blue";
        rankSign = '';
        break;
    }
    if (names[rank]) {
      $('.userbox').append('<div id="userlist_rank_' + rankTitle + '" class="item">' + rankTitle + ' <small>' + rankSign + '</small><div class="ui ' + rankColor + ' label">' + names[rank].length + '</div><div class="menu"></div></div>');
      var menu = $('#userlist_rank_' + rankTitle + ' .menu');
      names[rank].sort();
      names[rank].forEach(function (user) {
        menu.append('<a class="item">' + user + '</a>');
      });
    }
  });
}

function refreshUserlist() {
  client.call('names', [currentChannel, currentNetwork]);
}

function adjustHeight() {
  $('.messagebox').height($(window).height() - 100);
}

$(window).resize(function () {
  adjustHeight();
});

$(document).ready(function () {
  adjustHeight();
  client = createClient({'relayid': 114, 'host': 'irc.thepups.net'});

  client.on('message', function (err, event) {
    addMessage(event.channel.network, event.channel.name, event.user.nick, event.message);
    refreshMessages();
  });

  client.on('join', function (err, event) {
    addChannel(event.channel);
    addMessage(event.channel.network, event.channel.name, {color: 'teal'}, 'Joined channel.');
    switchChannel(event.channel.network, event.channel.name);
  });

  client.on('part', function (err, event) {
    removeChannel(event.channel);
  });

  client.on('nick', function (err, event) {
    addMessage(event.network, currentChannel, {color: 'green'}, event.oldNick + ' is now known as ' + event.user.nick);
    refreshMessages();
  });

  client.on('names', function (err, event) {
    var names = {};
    for (var name in event.names) {
      if (event.names.hasOwnProperty(name)) {
        var data = event.names[name];
        if (data.length > 0) {
          var tag = data[0];
          if (!names[tag]) names[tag] = [];
          names[tag].push(name);
        } else {
          if (!names[""]) names[""] = [];
          names[""].push(name);
        }
      }
    }
    renderUserlist(names);
  });

  var m = $('#m');
  m.keyup(function (e) {
    if (e.keyCode == 13) { // enter key
      var msg = m.val();
      if (msg.charAt(0) === '/') {
        var args = parseCommand(msg.substring(1), true);
        client.call(args.shift(), args);
      } else {
        client.call('send', [currentChannel, msg, currentNetwork]);
      }
      m.val('');
      return false;
    }
  });
});
