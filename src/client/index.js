'use strict';

const Popup = require('./Popup')
const SocketClient = require('./SocketClient');
const { $, byClass, formToJSON, addClass } = require('./utils')

const config = {
	server_url: 'ws://localhost:81',
};


const ws = new SocketClient(config);
ws.onMessage(handleSocketMessage);

window.addEventListener('load', construct, false);


function construct() {
	const popup = new Popup()

	$('new-vm-btn').addEventListener('click', () => {
		let form = byClass($('hidden-forms'), 'new-vm')[0]
		form = form.cloneNode(true)

		popup.showContent(form)

		form.addEventListener('submit', (ev) => {
			ev.preventDefault()
			ev.stopPropagation()

			const caller = ev.target.id
			const payload = {
				action: 'new-vm',
				data: formToJSON(form.elements),
			}

			if (caller === 'create-start') {
				payload.data._start = true
			}

			ws.sendJSON(payload)
			popup.close()

			const box = createMachineBox(payload.data)
			$('machine-map').appendChild(box)

			setTimeout(() => {
				ws.sendJSON({
					action: 'vm-status',
					data: { name: payload.data.name }
				})
				ws.sendJSON({
					action: 'vm-config',
					data: { name: payload.data.name }
				})
			}, 200)
			
		}, false)
	}, false)
}

function handleSocketMessage(data) {
	let json = null;
	let text = null;

	try {
		json = JSON.parse(data);
	} catch (err) {
		text = data;
	}

	if (json) {
		handleJSON(json);
	}

	if (text) {
		console.log('msg: ', data);
	}
}

function handleJSON(json) {
	switch (json.action) {
		case 'console': {
			const dest = $('console-text');
			const p = document.createElement('p');

			// using text so no html parsing here
			p.innerText = json.data;
			// print to console
			dest.appendChild(p);
			// scroll to bottom
			dest.scrollTop = dest.scrollHeight - dest.clientHeight;
		}
		break;
		case 'hello': {
			const vms = json.data

			vms.forEach((vm) => {
				if (!getMachineBox(vm.name)) {
					const el = createMachineBox(vm)
					$('machine-map').appendChild(el)
				}

				ws.sendJSON({
					action: 'vm-status',
					data: { name: vm.name },
				})

				ws.sendJSON({
					action: 'vm-config',
					data: { name: vm.name },
				})
			})
		}
		break;
		case 'vm-status': {
			const map = $('machine-map')
			let el = map.querySelector(`[data-name=${json.data.name}]`)

			if (!el) {
				el = createMachineBox(json.data)
				map.appendChild(el)
			} else {
				// TODO: use createMachineBox fn somehow
				const elStatus = el.querySelector('.machine-status')
				elStatus.innerText = json.data.status
				addClass(elStatus, json.data.status)
			}
		}
		break;
		case 'vm-config': {
			let box = getMachineBox(json.data.name)

			if (box) {
				updateMachineBox(box, json.data)
			} else {
				box = createMachineBox(json.data)
				$('machine-map').appendChild(box)
			}
		}
	}
}

function createMachineBox(data) {
	let item = byClass($('hidden-elements'), 'machine-item')[0]
	item = item.cloneNode(true)
	item = updateMachineBox(item, data)

	return item
}

function getMachineBox(vm_name) {
	return $('machine-map').querySelector(`[data-name=${vm_name}]`)
}

function updateMachineBox(item, data) {
	console.log(data)
	item.dataset.name = data.name

	item.querySelector('.machine-name').innerText = data.name
	
	const itemStatus = item.querySelector('.machine-status')
	itemStatus.innerText = data.status || 'Loading...'
	addClass(itemStatus, data.status)

	item.querySelector('.machine-ip').innerText = data.priv_network_ip || '192.168.2.10'

	return item
}
