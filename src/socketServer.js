'use strict';

const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const WebSocket = require('ws');
const config = {
	port: 81
};

const wss = new WebSocket.Server(config);

String.prototype.replaceAll = function(pattern, replacement) {
	return this.split(pattern).join(replacement);
};

wss.on('connection', (ws) => {
	ws.send('hello');

	ws.on('message', (data) => {
		let json = null
		let text = null

		try {
			json = JSON.parse(data);
		} catch (err) {
			text = data;
		}

		if (json) {
			try {
				handleJSON(json);
			} catch (err) {
				console.log(err);
			}
		}

		if (text) {
			console.log(text);
		}

		ws.send('ack');
	});

	ws.on('close', () => {
		console.log('bye');
	});
});

function handleJSON (data) {
	switch (data.action) {
		case 'new-vm':
			const defaults = {
				vm_name: 'dev',
				box: 'ubuntu/bionic64',
			};

			const template_vars = _.merge({}, data.data, defaults);
			let template = fs.readFileSync(path.join(process.cwd(), 'Vagrantfile.example')).toString();

			Object.keys(template_vars).forEach(key => {
				const pattern = '{vars.' + key +'}';

				template = template.replaceAll(pattern, template_vars[key]);
			})

			console.log('new vm Vagrantfile generated')
		break;
	}
}

console.log('Socket Server started', config);