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
			const template_vars = _.merge({}, data.data, {
				vm_name: 'dev',
				box: 'ubuntu/bionic64',
				priv_network_ip: '192.168.2.10',
			});

			const template = generateVagrantfile(template_vars);
			const vm_path = path.join(process.cwd(), 'vms', template_vars.vm_name);
			
			savefile(vm_path, 'Vagrantfile', template);
			savefile(vm_path, 'vagrant.json', JSON.stringify(template_vars));

			const vagrant = runCommand(vm_path, 'vagrant', ['up'])
			vagrant.on('data', chunk => pipeToClientConsole(client, chunk.toString()))
			vagrant.on('end', async () => {
				const ssh = new node_ssh()

				try {
					await ssh.connect({ port: 2222, host: '127.0.0.1', username: 'vagrant',
						privateKey: path.join(vm_path, '.vagrant', 'machines', template_vars.vm_name, 'virtualbox', 'private_key')
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
							console.log('stderrChunk', chunk.toString('utf8'))
							pipeToClientConsole(client, chunk.toString('utf8'))
						}
					})
				} catch (error) {
					return pipeToClientConsole(close, error.message)
				}
			})

			/*
			vagrant.on('close', (code) => {
				ws.send(JSON.stringify({
					action: 'console',
					data: `exit code: ${code}`,
				}));

				if (code === 0) {
					const sshConfig = spawn('vagrant', ['ssh-config'], { cwd: vm_path });
					sshConfig.stdout.on('data', (chunk) => {
						console.log(chunk.toString())
					})

					const ssh = new node_ssh()
				
					// ssh vagrant@127.0.0.1 -p 2200 -i ./.vagrant/machines/dev/virtualbox/private_key
					// ssh vagrant@127.0.0.1 -p 2222 -o Compression=yes -o DSAAuthentication=yes -o LogLevel=FATAL -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o IdentitiesOnly=yes -i ~/.vagrant.d/less_insecure_private_key -o ForwardAgent=yes

					ssh.connect({
						port: 2200,
						host: 'localhost',
						username: 'vagrant',
						//privateKey: ''
					})
					/*
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
					*/
					/*
				}
			});
			*/
		}
		break;
		case 'vm-status':
			const vm_path = path.join(process.cwd(), 'vms', data.data.vm_name); // TODO: bad idea
			const vagrant = runCommand(vm_path, 'vagrant', ['status'])
			vagrant.on('data', chunk => pipeToClientConsole(client, chunk.toString()))
		break;
	}
}

function generateVagrantfile(variables) {
	let template = fs.readFileSync(path.join(process.cwd(), 'Vagrantfile.example')).toString();

	Object.keys(variables).forEach(key => {
		const pattern = '{vars.' + key +'}';

		template = template.replaceAll(pattern, variables[key]);
	});

	logger.log('new vm Vagrantfile generated');

	return template;
}

function savefile(filedir, filename, contents) {
	mkdir(filedir);
	fs.writeFileSync(path.join(filedir, filename), contents);
}

function getListOfVMs() {
	return [ 'dev' ]
}

// runCommand(path, vagrant, ['up'])
function runCommand(path, cmd, args) {
	const ps = spawn(cmd, args, { cwd: path });
	const output = new Readable({ read() {} });

	ps.stdout.on('data', (chunk) => output.push(chunk));
	ps.stderr.on('data', (chunk) => output.push(chunk));

	ps.on('close', (code) => {
		output.push(`exit code: ${code}`)
		output.push(null)
	});

	return output;
}

function runCommandSync(path, cmd, args) {
	const deferred = Promise.defer()

	const ps = runCommand(path, cmd, args)
	const output = '';

	ps.on('data', (chunk) => {
		output += chunk.toString()
	})

	ps.on('end', deferred.resolve(output))

	return deferred.promise
}
