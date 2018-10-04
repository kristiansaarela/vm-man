'use strict';

/* globals WebSocket */

const logger = require('../logger');

class SocketClient {
	constructor(config) {
		this.url = config.server_url;
		this.listeners = [];
		this.connected = false;

		this.connect();
	}

	connect() {
		let self = this;

		logger.info('Attempting to connect', { url: self.url });

		try {
			this.socket = new WebSocket(this.url);
		} catch (error) {
			logger.error('Socket error', { error });			
		}

		this.socket.addEventListener('error', (error) => {
			logger.error('Socket error', { error });
		}, false);

		this.socket.addEventListener('open', () => {
			this.connected = true;
			logger.info('Connection established', { url: self.url });
		}, false);

		this.socket.addEventListener('close', () => {
			self.connected = false;
			logger.info('Socket connection closed');

			setTimeout(() => {
				logger.debug('Attempting to reconnect in 400ms', { url: self.url });
				self.connect();
			}, 400);
		}, false);

		this.socket.addEventListener('message', (ev) => {
			logger.debug('Socket message received', { payload: ev.data });
			
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
		if (!this.connected) {
			logger.error('Socket error: Socket not connected', { url: this.url });
			return;
		}

		logger.debug('Socket sending data', { payload: data });
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
