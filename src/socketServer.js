'use strict';

const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const mkdir = require('./mkdir')
const logger = require('./logger')
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
				handleJSON(ws, json);
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

function handleJSON (ws, data) {
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

			logger.log('new vm Vagrantfile generated')

			const vm_path = path.join(process.cwd(), 'vms', template_vars.vm_name)

			mkdir(vm_path)
			fs.writeFileSync(path.join(vm_path, 'Vagrantfile'), template)

			//const vagrant = spawn('vagrant', ['up'], { cwd: vm_path });
			const vagrant = spawn('ls', [], { cwd: vm_path });

			vagrant.stdout.on('data', (chunk) => {
				console.log('stdout', chunk.toString());

				ws.send(chunk)
			});

			vagrant.stderr.on('data', (chunk) => {
				console.log('stderr', chunk.toString())

				ws.send(chunk)
			})

			vagrant.on('close', (code) => {
				console.log('exit code:', code)

			})
		break;
	}
}

function mkdirIfPossible (dir_path) {

}