'use strict';

const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const mkdir = require('./mkdir');
const logger = require('../logger');
const node_ssh = require('node-ssh');
const { Readable } = require('stream');
const config = {
	port: 81,
};

// make sure there is '/vms' folder
mkdir(path.join(process.cwd(), 'vms'));

String.prototype.replaceAll = function(pattern, replacement) {
	return this.split(pattern).join(replacement);
};

const wss = new WebSocket.Server(config);

logger.info('Socket server started', config);

// TODO: handle dropped clients
wss.on('connection', (ws) => {
	ws.sendJSON = function sendJSON (payload) {
		if (this.readyState === 1) {
			this.send(JSON.stringify(payload));
		} else {
			logger.error('TODO: queue this and send later')
		}
	};

	ws.send(JSON.stringify({
		action: 'hello',
		data: getListOfVMs(),
	}));

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

function pipeToClientConsole(client, data) {
	client.send(JSON.stringify({
		action: 'console',
		data: data,
	}));
}

function handleJSON (client, data) {
	switch (data.action) {
		case 'new-vm': {
			const template_vars = mergeMachineConfig(data.data)
			const template = generateVagrantfile(template_vars);
			const vm_path = path.join(process.cwd(), 'vms', template_vars.name);

			savefile(vm_path, 'Vagrantfile', template);
			savefile(vm_path, 'vagrant.json', JSON.stringify(template_vars));

			if (!data.data._start)
				return

			const vagrant = runCommand(vm_path, 'vagrant', ['up'])
			vagrant.on('data', chunk => pipeToClientConsole(client, chunk.toString()))
			/*
			vagrant.on('end', async () => {
				
			})

			async function sshToMachine() {
				const ssh = new node_ssh()

				try {
					await ssh.connect({ port: 2222, host: '127.0.0.1', username: 'vagrant',
						privateKey: path.join(vm_path, '.vagrant', 'machines', template_vars.name, 'virtualbox', 'private_key')
					})
				} catch (error) {
					// TODO: How do display errors?
					return pipeToClientConsole(client, error.message)
				}

				try {
					ssh.exec('ls', ['-la'], {
						onStdout(chunk) {
							logger.debug('stdoutChunk', chunk.toString('utf8'))
							pipeToClientConsole(client, chunk.toString('utf8'))
						},
						onStderr(chunk) {
							logger.debug('stderrChunk', chunk.toString('utf8'))
							pipeToClientConsole(client, chunk.toString('utf8'))
						}
					})
				} catch (error) {
					return pipeToClientConsole(client, error.message)
				}
			}
			*/
		}
		break;
		case 'vm-config': 
			client.sendJSON({
				action: 'vm-config',
				data: getVMConfig(data.data.name) // TODO: Bad bad bad, trusting too much
			})
		break
		case 'vm-status':
			const vm_path = path.join(process.cwd(), 'vms', data.data.name); // TODO: bad idea. Why? - trusting client, that's why
			const vagrant = runCommand(vm_path, 'vagrant', ['status'], { ignoreClose: true })
			
			vagrant.on('data', chunk => {
				const output = chunk.toString();
				const matches = output.match(/(\w+)(\s+)(\w+) \(virtualbox\)/);

				if (matches === null) {
					logger.error('vm-status: no matches found', { output, name: data.data.name })
					return
				}

				client.sendJSON({
					action: 'vm-status',
					data: {
						name: data.data.name,
						status: matches[3],
					},
				})
			})
		break;
	}
}

function mergeMachineConfig(payload) {
	const defaults = {
		name: 'dev',
		box: 'ubuntu/bionic64',
		priv_network_ip: '192.168.2.10',
		started: false,
	}

	Object.keys(defaults).forEach(key => {
		if (payload[key] && payload[key] !== '') {
			defaults[key] = payload[key];
		}
	})

	return defaults
}

function generateVagrantfile(variables) {
	let template = fs.readFileSync(path.join(process.cwd(), 'Vagrantfile.example')).toString();

	Object.keys(variables).forEach(key => {
		const pattern = '{vars.' + key +'}';

		template = template.replaceAll(pattern, variables[key]);
	});

	logger.log('new vm Vagrantfile generated', { template });

	return template;
}

function savefile(filedir, filename, contents) {
	mkdir(filedir);
	logger.log('saving file', { filedir, filename, contents })
	fs.writeFileSync(path.join(filedir, filename), contents);
}

function getListOfVMs() {
	const vms_path = path.join(process.cwd(), 'vms');
	const vms = fs.readdirSync(vms_path, { withFileTypes: true }).filter(item => item.isDirectory());

	return vms;
}

function getVMConfig(vm_name) {
	// TODO: error handling
	let cfg = fs.readFileSync(path.join(process.cwd(), 'vms', vm_name, 'vagrant.json')).toString()
	return JSON.parse(cfg)
}

// runCommand(path, vagrant, ['up'], { ignoreClose: true })
function runCommand(path, cmd, args, opts = {}) {
	const ps = spawn(cmd, args, { cwd: path });
	const output = new Readable({ read() {} });

	ps.stdout.on('data', (chunk) => output.push(chunk));
	ps.stderr.on('data', (chunk) => output.push(chunk));

	if (!opts.ignoreClose) {
		ps.on('close', (code) => {
			output.push(`exit code: ${code}`)
			output.push(null)
		});
	}

	return output;
}
