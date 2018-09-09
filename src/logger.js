'use strict'

module.exports = {
	log: (msg, meta) => {
		console.log(msg, meta)
	},
	info: (msg, meta) => {
		console.log(msg, meta)
	},
	debug: (msg, meta) => {
		console.log(msg, meta)
	},
	error: (msg, meta) => {
		console.error(msg, meta)
	},
}