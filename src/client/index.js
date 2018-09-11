'use strict';

const SocketClient = require('./SocketClient');
const config = {
	server_url: 'ws://localhost:81',
};

window.addEventListener('load', construct, false);

// helpers
function $(id) { return document.getElementById(id); }
function byClass (el, cl) { return el ? el.getElementsByClassName(cl) : [] }
const formToJSON = elements => [].reduce.call(elements, (data, element) => {
	data[element.name] = element.value;
	return data;
}, {});
// end of help

function construct() {
	const ws = new SocketClient(config);
	ws.onMessage(handleSocketMessage);

	const form = $('new-vm');

	form.addEventListener('submit', (ev) => {
		ev.preventDefault();

		ws.send(JSON.stringify({
			action: form.id,
			data: formToJSON(form.elements)
		}));
	});
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
			const console = $('console');
			const p = document.createElement('p');

			// using text so no html parsing here
			p.innerText = json.data;
			// print to console
			console.appendChild(p);
			// scroll to bottom
			console.scrollTop = console.scrollHeight - console.clientHeight;
		}
		break;
	}
}