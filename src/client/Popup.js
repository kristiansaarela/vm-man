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
