'use strict'

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { Readable } = require('stream')

const WebSocket = require('ws')

const mkdir = require('./mkdir')
const logger = require('../logger')
const Vagrant = require('./vagrant')
const config = {
	port: 81,
}

const MACHINES_FOLDER = path.join(process.cwd(), 'vms')

// Make sure there's parent folder for machines
mkdir(MACHINES_FOLDER)

// Discover VMs
const machines = {}
fs.readdirSync(MACHINES_FOLDER, { withFileTypes: true })
	.filter(item => item.isDirectory())
	.forEach(item => machines[item.name] = new Vagrant({ name: item.name }))


const server = new WebSocket.Server(config)

logger.info('Socket server started', { config })

// TODO: handle dropped clients
server.on('connection', (client) => {
	client.sendJSON = function sendJSON (payload) {
		if (this.readyState === 1) {
			this.send(JSON.stringify(payload))
		} else {
			logger.error('TODO: queue this and send later')
		}
	}
	client.sendConsole = function sendConsole(data) {
		client.sendJSON({
			action: 'console',
			data: data,
		})
	}

	client.sendJSON({
		action: 'hello',
		data: {
			machines: Object.keys(machines),
		}
	})

	client.on('message', (data) => {
		try {
			controller(client, JSON.parse(data))
		} catch (error) {
			logger.error('Failed to parse message', { error })
		}
	})

	client.on('close', () => {
		logger.log('bye')
	})
})

function controller (client, payload) {
	if (!payload.action || !payload.data.name) {
		return logger.error('Will not handle JSON, missing machine name', { payload })
	}

	switch (payload.action) {
		case 'new-vm': 
			const vm = new Vagrant(payload.data)
			machines[payload.data.name] = vm

			if (payload.data._start) {
				const vagrant = runCommand(vm.path, 'vagrant', ['up'])
				vagrant.on('data', chunk => client.sendConsole(chunk.toString()))
			}
		break
		case 'vm-config':
			if (!machines[payload.data.name]) {
				return
			}
			
			client.sendJSON({
				action: 'vm-config',
				data: machines[payload.data.name].settings,
			})
		break
		case 'vm-status':
			if (!machines[payload.data.name]) {
				return
			}

			const sendStatus = (name, status) => {
				client.sendJSON({
					action: 'vm-status',
					data: { name, status },
				})
			}

			if (machines[payload.data.name].settings.status) {
				return sendStatus(payload.data.name, machines[payload.data.name].settings.status)
			}

			const parseStatus = chunk => {
				const output = chunk.toString()
				const matches = output.match(/(\w+)(\s+)(\w+) \(virtualbox\)/)

				if (!matches) {
					return console.error('vm-status: No matches')
				}

				machines[payload.data.name].settings.status = matches[3]
				machines[payload.data.name].saveVagrantJSON()

				console.info('Machine status:', { name: payload.data.name, status: matches[3] })

				return sendStatus(payload.data.name, matches[3])
			}

			runCommand(machines[payload.data.name].path, 'vagrant', ['status']).on('data', parseStatus)
		break
	}
}

// runCommand(path, vagrant, ['up'], { ignoreExit: true })
// Returns readable stream, to listen use .on('data', fn)
function runCommand(path, cmd, args, opts = {}) {
	const ps = spawn(cmd, args, { cwd: path })
	const output = new Readable({ read() {} })

	ps.stdout.on('data', (chunk) => output.push(chunk))
	ps.stderr.on('data', (chunk) => output.push(chunk))

	if (!opts.ignoreExit) {
		ps.on('close', (code) => {
			output.push(`exit code: ${code}`)
			output.push(null)
		})
	}

	return output
}
