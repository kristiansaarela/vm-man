'use strict'

const logger = require('./logger')
const { existsSync, mkdirSync } = require('fs')

module.exports = function mkdir (dir_path) {
	if (existsSync(dir_path) === false) {
		try {
			mkdirSync(dir_path)
			logger.info('/vms folder created', { dir_path })
		} catch (err) {
			logger.error('failed to create /vms folder', err)
		}
	}
}