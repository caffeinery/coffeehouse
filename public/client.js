var RELAYID = 114; // this can be used as a session
var CONFIG = [
  {'host': 'irc.thepups.net', 'nick': 'den'},
  {'host': 'irc.stripechat.org', 'ssl': true, 'ssl_allow_invalid': true, 'nick': 'den'}
];

/* ~~ */

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

function createClient(relayid, init) {
  var socket = io();
  socket.emit('init', relayid, init);
  return {
    socket: socket,
    call: function (cmd, args) {
      socket.emit('command', cmd, args);
    },
    on: function (name, func) {
      socket.on(name, function (err, event) {
        if (event instanceof Object) event.irc = this;
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
var currentNetwork;
var currentChannel;

function addNetwork(network) {
  if (!$("#menu #" + network + "_main").length) {
    client.call('getServerInfo', [network]);
    var newItem = $('<a id="' + network + '_main" class="item network"><span class="name">' + network + '</span><div class="ui notification label">0</div></a>');
    newItem.insertBefore("#menu .item.search");
    newItem.click(function () {
      switchChannel(network, 'main');
    });
    addMessage(network, 'main', {color: 'teal'}, 'Connected to network.');
  }
}

function addChannel(channel) {
  addNetwork(channel.network);
  var newItem = $('<a id="' + channel.network + '_' + channel.name.replace('#', '_') + '" class="item buffer">' + channel.name + '<div class="ui notification label">0</div></a>');
  newItem.insertAfter("#menu #" + channel.network + "_main");
  newItem.click(function () {
    switchChannel(channel.network, channel.name);
  });
}

function removeChannel(channel) {
  delete messages[channel.network][channel.name];
  $('#' + channel.network + '_' + channel.name.replace('#', '_')).remove();
}

/* special thanks to http://stackoverflow.com/a/7123542 */
if (!String.linkify) {
    String.prototype.linkify = function() {

        // http://, https://, ftp://
        var urlPattern = /\b(?:https?|ftp):\/\/[a-z0-9-+&@#\/%?=~_|!:,.;]*[a-z0-9-+&@#\/%=~_|]/gim;

        // www. sans http:// or https://
        var pseudoUrlPattern = /(^|[^\/])(www\.[\S]+(\b|$))/gim;

        // Email addresses
        var emailAddressPattern = /[\w.]+@[a-zA-Z_-]+?(?:\.[a-zA-Z]{2,6})+/gim;

        return this
            .replace(urlPattern, '<a href="$&" target="_blank">$&</a>')
            .replace(pseudoUrlPattern, '$1<a href="http://$2" target="_blank">$2</a>')
            .replace(emailAddressPattern, '<a href="mailto:$&">$&</a>');
    };
}

var stringToColor = function(str) {
    // str to hash
    for (var i = 0, hash = 0; i < str.length; hash = str.charCodeAt(i++) + ((hash << 5) - hash));

    // int/hash to hex
    for (var i = 0, colour = "#"; i < 3; colour += ("00" + ((hash >> i++ * 8) & 0xFF).toString(16)).slice(-2));

    return colour;
};

function refreshMessages() {
  refreshMe();
  var msgs = messages[currentNetwork][currentChannel];
  var htmlMessages = $('#messages');
  htmlMessages.empty();
  msgs.forEach(function (msg) {
    if (typeof msg[0] === 'object') {
      // this is a system message
      if (!msg[0].class) msg[0].class = '';
      htmlMessages.append($('<div class="ui ' + msg[0].color + ' ' + msg[0].class + ' message">' + msg[1] + '</div>'))
    } else {
      var append = "";
      if (client.me) {
        if (msg[0] === client.me.nick) {
          append = ' class="self"';
        } else if (msg[1].indexOf(client.me.nick) > -1) {
          append = ' class="highlight"';
        }
      }
      htmlMessages.append($('<li' + append + '>').html('<div class="ui black nick horizontal label" style="background-color: ' + stringToColor(msg[0]) + ' !important; border-color: ' + stringToColor(msg[0]) + ' !important;">' + msg[0] + '</div> ' + msg[1].linkify()));
    }
  });
  $('.messagebox').scrollTop($('.messagebox')[0].scrollHeight);
}

function addMessage(network, channel, nick, message) {
  if (!messages[network]) messages[network] = {};
  if (!messages[network][channel]) messages[network][channel] = [];
  messages[network][channel].push([nick, message]);
  if (!((network === currentNetwork) && (channel === currentChannel))) increaseLabel(network, channel);
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
  setLabel(network, channel); // remove label
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

function setLabel(network, channel, number) {
  var select = $('#' + network + '_' + channel.replace('#', '_') + ' .label');
  if ((!number) || (number === 0)) {
    select.hide();
    select.html(0);
  } else {
    select.show();
    select.html(number);
  }
  return true;
}

function getLabel(network, channel) {
  return parseInt($('#' + network + '_' + channel.replace('#', '_') + ' .label').html());
}

function increaseLabel(network, channel) {
  return setLabel(network, channel, getLabel(network, channel) + 1);
}

function refreshUserlist() {
  client.call('names', [currentChannel, currentNetwork]);
}

function adjustHeight() {
  $('.messagebox').height($(window).height() - 100);
}

function refreshMe(network) {
  client.call('getMe', [network]);
}

$(window).resize(function () {
  adjustHeight();
});

$(document).ready(function () {
  adjustHeight();

  $('.notification').hide();

  client = createClient(RELAYID, CONFIG);

  $('#inbox_main').click(function () {
    switchChannel('inbox', 'main');
  });
  addMessage('inbox', 'main', {color: 'teal'}, 'Welcome to the coffeehouse irc client!');

  switchChannel('inbox', 'main');

  client.on('coffeaconnect', function (err, event) {
    addNetwork(event.network);
  });

  client.on('motd', function (err, event) {
    if (event.motd) {
      var motd = event.motd.join("<br />");
      addMessage(event.network, 'main', {color: 'gray', class: 'monospaced'}, motd);
    }
  });

  client.on('message', function (err, event) {
    addMessage(event.channel.network, event.channel.name, event.user.nick, event.message);
    refreshMessages();
  });

  client.on('join', function (err, event) {
    addChannel(event.channel);
    addMessage(event.channel.network, event.channel.name, {color: 'teal'},
      'Joined ' + event.channel.name + ': ' + event.channel.topic.topic +
      ' (topic set ' + event.channel.topic.time + ' by ' + event.channel.topic.user.nick + ')'
    );
    switchChannel(event.channel.network, event.channel.name);
  });

  client.on('part', function (err, event) {
    removeChannel(event.channel);
  });

  client.on('nick', function (err, event) {
    addMessage(event.network, currentChannel, {color: 'green'}, event.oldNick + ' is now known as ' + event.user.nick);
    refreshMessages();
    refreshUserlist();
  });

  client.on('names', function (err, event) {
    var names = {};
    var all_nicks = [];
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
        all_nicks.push(name);
      }
    }

    $("#m").tabcomplete(all_nicks, {
      after: ': '
    });

    renderUserlist(names);
  });

  client.on('getme', function (err, event) {
    client.me = event.me;
  });

  function isInt(value) {
    return !isNaN(value) && (function(x) { return (x | 0) === x; })(parseFloat(value));
  }

  client.on('serverinfo', function (err, event) {
    var net = $('#' + event.network + '_main .name');
    if (isInt(net.html())) net.html(event.info.servername); // use servername instead of number
  });

  var m = $('#m');
  m.keyup(function (e) {
    if (e.keyCode == 13) { // enter key
      var msg = m.val();
      if (msg.charAt(0) === '/') {
        var args = parseCommand(msg.substring(1), true);
        args.push(currentNetwork); // FIXME: this could be buggy
        client.call(args.shift(), args);
      } else {
        client.call('send', [currentChannel, msg, currentNetwork]);
      }
      m.val('');
      return false;
    }
  });
});
