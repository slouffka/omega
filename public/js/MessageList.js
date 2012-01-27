define(['ko', 'underscore'], function (ko, _) {

	function MessageList($element, socket) {
		this.$element = $element;
		this.messages = ko.observableArray();

		socket.on('history', _.bind(this.processHistory, this));
		socket.on('issue created', _.bind(this.append, this));
		socket.on('issue assigned', _.bind(this.append, this));
		socket.on('issue updated', _.bind(function (props, event) {
			this.append(event);
		}, this));
		socket.on('issue prioritized', _.bind(function (props, event) {
			this.append(event);
		}, this));
		socket.on('issue closed', _.bind(function (closer, event) {
			this.append(event);
		}, this));
	}

	MessageList.prototype.processHistory = function (events) {
		this.reset(); // TODO: should properly find where left off

		_.each(events, function (event) {
			this.append(event);
		}, this);
	};

	MessageList.prototype.reset = function (event) {
		if (this.messages().length) {
			this.messages([]);
		}
	};

	MessageList.prototype.append = function (event) {
		this.messages.push({ msg: event.message, speaker: event.speaker });
		scrollToBottom(this.$element.get(0));
	};

	function scrollToBottom(el) {
		el.scrollTop = el.scrollHeight;
	}

	return MessageList;

});