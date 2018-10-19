'use strict'

/* globals window, document */

const Popup = require('./Popup')
const SocketClient = require('./SocketClient')

const utils = require('./utils')
const config = {
	server_url: 'ws://localhost:81',
}

const socket = new SocketClient(config)
socket.onMessage((payload) => {
	try {
		handleJSON(JSON.parse(payload))
	} catch (error) {
		console.error('Failed to parse socket payload', { error })
	}
})

window.addEventListener('load', construct, false)

function construct() {
	const popup = new Popup()

	utils.$('new-vm-btn').addEventListener('click', () => {
		const form = utils.byClass(utils.$('hidden-forms'), 'new-vm')[0].cloneNode(true)
		
		popup.showContent(form)
		
		form.addEventListener('submit', (ev) => {
			ev.preventDefault()
			ev.stopPropagation()

			const caller = ev.target.id
			const payload = {
				action: 'new-vm',
				data: utils.formToJSON(form.elements),
			}

			if (caller === 'create-start') {
				payload.data._start = true
			}

			socket.sendJSON(payload)
			
			popup.close()

			const box = createMachineBox(payload.data)
			utils.$('machine-map').appendChild(box)

			setTimeout(() => {
				socket.sendJSON({
					action: 'vm-status',
					data: { name: payload.data.name }
				})
				socket.sendJSON({
					action: 'vm-config',
					data: { name: payload.data.name }
				})
			}, 200)
		}, false)
	}, false)
}


function handleJSON(payload) {
	switch (payload.action) {
		case 'console':
			const dest = utils.$('console-text')
			const p = document.createElement('p')

			// using text so no html parsing here
			p.innerText = payload.data
			// print to console
			dest.appendChild(p)
			// scroll to bottom
			dest.scrollTop = dest.scrollHeight - dest.clientHeight
		break
		case 'hello':
			payload.data.machines.forEach((name) => {
				if (!getMachineBox(name)) {
					const el = createMachineBox({ name })
					utils.$('machine-map').appendChild(el)
				}

				socket.sendJSON({
					action: 'vm-status',
					data: { name },
				})

				socket.sendJSON({
					action: 'vm-config',
					data: { name },
				})
			})
		break
		case 'vm-config':
		case 'vm-status':
			let box = getMachineBox(payload.data.name)

			if (box) {
				updateMachineBox(box, payload.data)
			} else {
				box = createMachineBox(payload.data)
				utils.$('machine-map').appendChild(box)
			}
		break
	}
}

function createMachineBox(data) {
	let item = utils.byClass(utils.$('hidden-elements'), 'machine-item')[0]
	item = item.cloneNode(true)
	item = updateMachineBox(item, data)

	return item
}

function getMachineBox(vm_name) {
	return utils.$('machine-map').querySelector(`[data-name=${vm_name}]`)
}

function updateMachineBox(item, data) {
	item.dataset.name = data.name

	item.querySelector('.machine-name').innerText = data.name
	
	const itemStatus = item.querySelector('.machine-status')
	itemStatus.innerText = data.status || 'Loading...'
	utils.addClass(itemStatus, data.status)

	item.querySelector('.machine-ip').innerText = data.priv_network_ip || '192.168.2.10'

	return item
}
