'use strict';

class SocketClient {
	constructor(config) {
		this.url = config.server_url;
		this.listeners = [];

		this.connect();
	}

	connect() {
		let self = this;

		this.socket = new WebSocket(this.url);

		this.socket.addEventListener('close', () => {
			console.log('Socket connection closed');

			setTimeout(() => self.connect(), 400);
		}, false);

		this.socket.addEventListener('message', (ev) => {
			console.log('Socket message received', ev.data)
			
			if (!self.listeners.length) {
				return;
			}
			
			self.listeners.forEach((name, idx) => {
				if (typeof self.listeners[idx] !== 'function') {
					return;
				}

				self.listeners[idx](ev.data);
			});
		});
	}

	send(data) {
		console.log('Socket sending data');
		this.socket.send(data);
	}

	sendJSON(json) {
		this.send(JSON.stringify(json));
	}

	onMessage(callback) {
		this.listeners.push(callback);
	}
}

module.exports = SocketClient;