var http = require('http'),
	sio = require('socket.io'),
	_ = require('underscore'),
	static = require('node-static'),
	issueDb = require('./lib/issueDb');

var PORT = process.argv[2] || 1337;

var fileServer = new static.Server('./public');
var server = http.createServer(function (request, response) {
    request.addListener('end', function () {
        fileServer.serve(request, response);
    });
});
server.listen(PORT);

console.log('Server running at http://127.0.0.1:' + PORT);

var usernames = {};
var issues = issueDb.load();
var UNASSIGNED = "nobody";
var CURRENT_USER = "me";

var io = sio.listen(server);
io.configure(function () {
	// excluded websocket due to Chrome bug: https://github.com/LearnBoost/socket.io/issues/425
	io.set('transports', ['htmlfile', 'xhr-polling', 'jsonp-polling']);
});
io.sockets.on('connection', function(socket) {

	applyIssueDefaults();
	socket.emit('issues', issues);
	socket.emit('usernames', usernames);

	socket.on('login user', function(name, callback) {
		callback(false);
		socket.nickname = name;
		// keep track of duplicate usernames
		usernames[name] = (usernames[name] || 0) + 1;
		// no need to announce... can get spammy in chat
		// socket.broadcast.emit('announcement', name + ' connected.');
		io.sockets.emit('usernames', usernames);
	});
	
	socket.on('user message', function(msg) {
		io.sockets.emit('user message', socket.nickname, msg);
	});
	
	socket.on('new issue', function(desc) {
		var newIssue = {
			id: issues.length+1,
			description: desc,
			critical: false,
			creator: socket.nickname,
			assignee: UNASSIGNED,
			closed: false,
			createdDate: new Date()
		};
		issues.push(newIssue);
		issueDb.write(issues);
		io.sockets.emit('issue created', newIssue);
	});

	socket.on('assign issue', function(id, specifiedAssignee) {
		var assignee = specifiedAssignee;
		if (!specifiedAssignee || specifiedAssignee === CURRENT_USER) {
			assignee = socket.nickname;
		}
		issues[id-1].assignee = assignee; 
		issueDb.write(issues);
		io.sockets.emit('issue assigned', socket.nickname, id, assignee);
	});
	
	socket.on('close issue', function(id) {
		issues[id-1].closed = true;
		issueDb.write(issues);
		io.sockets.emit('issue closed', socket.nickname, id);
	});
	
	socket.on('update issue', function(id, props) {
		var issue = issues[id-1];
		delete props['id'];
		for (key in props) {
			issue[key] = props[key];
		}
		issueDb.write(issues);
		io.sockets.emit('issue updated', socket.nickname, id, props);
	});

	socket.on('prioritize issue', function(id) {
		issues[id-1].critical = !issues[id-1].critical;
		issueDb.write(issues);
		io.sockets.emit('issue prioritized', socket.nickname, id, {critical: issues[id-1].critical});
	});
	
	socket.on('reset issues', function() {
		issues = [];
		issueDb.write(issues);
		io.sockets.emit('issues', issues);
	});

	function removeCurrentUser() {
		if (!socket.nickname) {
			return;
		}
		if (usernames[socket.nickname] == 1) {
			delete usernames[socket.nickname];
		} else {
			usernames[socket.nickname]--;
		}
		delete socket.nickname;
		// no need to announce... can get spammy in chat
		// socket.broadcast.emit('announcement', socket.nickname + ' disconnected.');
		io.sockets.emit('usernames', usernames);
	}

	function applyIssueDefaults() {
		_.each(issues, function (issue) {
			_.defaults(issue, {critical: false});
		});
	}

	socket.on('disconnect', removeCurrentUser);
	socket.on('logout', removeCurrentUser);
});
