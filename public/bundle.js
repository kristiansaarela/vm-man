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
