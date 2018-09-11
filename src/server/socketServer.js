'use strict';

const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const mkdir = require('./mkdir');
const logger = require('../logger');
const config = {
	port: 81,
};

// make sure there is '/vms' folder
mkdir(path.join(process.cwd(), 'vms'));

const wss = new WebSocket.Server(config);

String.prototype.replaceAll = function(pattern, replacement) {
	return this.split(pattern).join(replacement);
};

// TODO: handle dropped clients
wss.on('connection', (ws) => {
	ws.send('hello');

	ws.on('message', (data) => {
		let json = null;
		let text = null;

		try {
			json = JSON.parse(data);
		} catch (err) {
			text = data;
		}

		if (json) {
			try {
				handleJSON(ws, json);
			} catch (err) {
				logger.error(err);
			}
		}

		if (text) {
			logger.log(text);
		}
	});

	ws.on('close', () => {
		logger.log('bye');
	});
});

function handleJSON (ws, data) {
	switch (data.action) {
		case 'new-vm': {
			const defaults = {
				vm_name: 'dev',
				box: 'ubuntu/bionic64',
				priv_network_ip: '192.168.2.10',

			};

			const template_vars = _.merge({}, data.data, defaults);
			let template = fs.readFileSync(path.join(process.cwd(), 'Vagrantfile.example')).toString();

			Object.keys(template_vars).forEach(key => {
				const pattern = '{vars.' + key +'}';

				template = template.replaceAll(pattern, template_vars[key]);
			})

			logger.log('new vm Vagrantfile generated');

			const vm_path = path.join(process.cwd(), 'vms', template_vars.vm_name);

			mkdir(vm_path);
			fs.writeFileSync(path.join(vm_path, 'Vagrantfile'), template);

			const vagrant = spawn('vagrant', ['up'], { cwd: vm_path });
			//const vagrant = spawn('ls', ['-la'], { cwd: vm_path });

			vagrant.stdout.on('data', (chunk) => {
				console.log('stdout', chunk.toString());

				ws.send(JSON.stringify({
					action: 'console',
					data: chunk.toString(),
				}));
			});

			vagrant.stderr.on('data', (chunk) => {
				console.log('stderr', chunk.toString());

				ws.send(JSON.stringify({
					action: 'console',
					data: chunk.toString(),
				}));
			});

			vagrant.on('close', (code) => {
				ws.send(JSON.stringify({
					action: 'console',
					data: `exit code: ${code}`,
				}));

				if (code === 0) {
					const vm_node = spawn('vagrant', ['ssh', template_vars.vm_name], { cwd: vm_path })

					vm_node.stdout.on('data', (chunk) => {
						console.log('stdout', chunk.toString());

						ws.send(JSON.stringify({
							action: 'console',
							data: chunk.toString(),
						}));
					});

					vm_node.stderr.on('data', (chunk) => {
						console.log('stderr', chunk.toString());

						ws.send(JSON.stringify({
							action: 'console',
							data: chunk.toString(),
						}));
					});

					vm_node.on('close', (code) => {
						ws.send(JSON.stringify({
							action: 'console',
							data: `exit code: ${code}`,
						}));
					});
				}
			});
		}
		break;
	}
}