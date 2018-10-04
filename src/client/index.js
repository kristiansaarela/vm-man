'use strict';

const SocketClient = require('./SocketClient');
const { $, byClass, formToJSON, elShow, noshow } = require('./utils')

const config = {
	server_url: 'ws://localhost:81',
};


const ws = new SocketClient(config);
ws.onMessage(handleSocketMessage);

window.addEventListener('load', construct, false);


function construct() {
	new Popup()

	$('new-vm-btn').addEventListener('click', () => {
		const container = byClass(document, 'popup-container')[0];
		const content = byClass(document, 'popup-content')[0];
		let form = byClass($('hidden-forms'), 'new-vm')[0]
		form = form.cloneNode(true)

		noshow(container)
		content.innerHTML = ''
		content.append(form)
		elShow(container)

		// init new content
		form.addEventListener('submit', (ev) => {
			ev.preventDefault()

			ws.send(JSON.stringify({
				action: 'new-vm',
				data: formToJSON(form.elements)
			}))

			container.close()
		}, false)
	}, false)
}

class Popup {
	constructor() {
		let self = this

		this.node = byClass(document, 'popup-container')[0]

		this.node.close = () => {
			noshow(self.node)
			self.node.dispatchEvent(new Event('close'))
		}

		this.node.addEventListener('click', (ev) => {
			if (ev.target && ev.target === self.node) {
				self.node.close()
			}
		})
	}
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

			vms.forEach((vm_name) => {
				ws.sendJSON({
					action: 'vm-status',
					data: { vm_name },
				})
			})
		}
		break;
		case 'vm-status': {
			console.log(json.data)
		}
		break;
	}
}