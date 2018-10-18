(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict'

const { noshow, byClass, elShow } = require('./utils')

class Popup {
	constructor() {
		let self = this

		this.node = byClass(document, 'popup-container')[0]
		this.content = byClass(this.node, 'popup-content')[0]

		this.node.close = this.close()

		this.node.addEventListener('click', (ev) => {
			if (ev.target && ev.target === self.node) {
				self.close()
			}
		})
	}

	showContent(src) {
		noshow(this.node)
		this.content.innerHTML = ''
		this.content.append(src)
		elShow(this.node)
	}

	close() {
		noshow(this.node)
		this.node.dispatchEvent(new Event('close'))
	}
}

module.exports = Popup

},{"./utils":4}],2:[function(require,module,exports){
'use strict';

/* globals WebSocket */

const logger = require('../logger');

class SocketClient {
	constructor(config) {
		this.url = config.server_url;
		this.listeners = [];
		this.connected = false;

		this.connect();
	}

	connect() {
		let self = this;

		logger.info('Attempting to connect', { url: self.url });

		try {
			this.socket = new WebSocket(this.url);
		} catch (error) {
			logger.error('Socket error', { error });			
		}

		this.socket.addEventListener('error', (error) => {
			logger.error('Socket error', { error });
		}, false);

		this.socket.addEventListener('open', () => {
			this.connected = true;
			logger.info('Connection established', { url: self.url });
		}, false);

		this.socket.addEventListener('close', () => {
			self.connected = false;
			logger.info('Socket connection closed');

			setTimeout(() => {
				logger.debug('Attempting to reconnect in 400ms', { url: self.url });
				self.connect();
			}, 400);
		}, false);

		this.socket.addEventListener('message', (ev) => {
			logger.debug('Socket message received', { payload: ev.data });
			
			if (!self.listeners.length) {
				return;
			}
			
			self.listeners.forEach((name, idx) => {
				if (typeof self.listeners[idx] !== 'function') {
					return;
				}

				self.listeners[idx](ev.data);
			});
		});
	}

	send(data) {
		if (!this.connected) {
			logger.error('Socket error: Socket not connected', { url: this.url });
			return;
		}

		logger.debug('Socket sending data', { payload: data });
		this.socket.send(data);
	}

	sendJSON(json) {
		this.send(JSON.stringify(json));
	}

	onMessage(callback) {
		this.listeners.push(callback);
	}
}

module.exports = SocketClient;

},{"../logger":5}],3:[function(require,module,exports){
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

},{"./Popup":1,"./SocketClient":2,"./utils":4}],4:[function(require,module,exports){
'use strict'

/* globals document */

function $(id) { return document.getElementById(id); }
function byClass (el, cl) { return el ? el.getElementsByClassName(cl) : [] }
function byTag (el, tg) { return el ? el.getElementsByTagName(tg) : [] }
function allof (cl) { return byClass(document, cl) }
function hasClass (el, cl) { var a = el.className.split(' '); return afind(cl, a) }
function addClass (el, cl) { if (el) { var a = el.className.split(' '); if (!afind(cl, a)) { a.unshift(cl); el.className = a.join(' ')}} }
function remClass (el, cl) { if (el) { var a = el.className.split(' '); arem(a, cl); el.className = a.join(' ') } }
function html (el) { return el ? el.innerHTML : null; }
function attr (el, name) { return el.getAttribute(name) }
function tonum (x) { var n = parseFloat(x); return isNaN(n) ? null : n }
function remEl (el) { el.parentNode.removeChild(el) }
function posf (f, a) { for (var i=0; i < a.length; i++) { if (f(a[i])) return i; } return -1; }
function apos (x, a) { return (typeof x === 'function') ? posf(x,a) : Array.prototype.indexOf.call(a,x) }
function afind (x, a) { var i = apos(x, a); return (i >= 0) ? a[i] : null; }
function acut (a, m, n) { return Array.prototype.slice.call(a, m, n) }
function aeach (fn, a) { return Array.prototype.forEach.call(a, fn) }
function arem (a, x) { var i = apos(x, a); if (i >= 0) { a.splice(i, 1); } return a; }
function alast (a) { return a[a.length - 1] }
function vis(el, on) { if (el) { on ? remClass(el, 'nosee') : addClass(el, 'nosee') } }
function noshow (el) { addClass(el, 'hidden') }
function elShow (el) { remClass(el, 'hidden') }
function ind (el) { return (byTag(el, 'img')[0] || {}).width }

module.exports = {
	$,
	byClass,
	byTag,
	allof,
	hasClass,
	addClass,
	remClass,
	html,
	attr,
	tonum,
	remEl,
	posf,
	apos,
	afind,
	acut,
	aeach,
	arem,
	alast,
	vis,
	noshow,
	elShow,
	ind,
}

module.exports.formToJSON = elements => [].reduce.call(elements, (data, element) => {
	data[element.name] = element.value
	return data
}, {})

},{}],5:[function(require,module,exports){
'use strict';

module.exports = {
	log: (msg, meta) => {
		console.log(msg, meta);
	},
	info: (msg, meta) => {
		console.log(msg, meta);
	},
	debug: (msg, meta) => {
		console.log(msg, meta);
	},
	error: (msg, meta) => {
		console.error(msg, meta);
	},
};

},{}]},{},[3]);
