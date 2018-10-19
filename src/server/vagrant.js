'use strict'

const fs = require('fs')
const path = require('path')

const mkdir = require('./mkdir')
const logger = require('../logger')

const PARENT_FOLDER = path.join(process.cwd(), 'vms')
const VAGRANTFILE_EXAMPLE = path.join(process.cwd(), 'Vagrantfile.example')

class Vagrant {

	constructor(settings) {
		if (!settings.name) {
			throw new Error('`settings.name` is required')
		}

		this.path = path.join(PARENT_FOLDER, settings.name)

		if (this.exists()) {
			this.settings = this.readVagrantJSON()
		} else {
			logger.debug('Machine doesnt exist', { path: this.path })
			
			mkdir(this.path)

			const defaults = {
				box: 'ubuntu/bionic64',
				priv_network_ip: '192.168.2.10',
				started: false,
			}

			Object.keys(defaults).forEach(key => {
				if (settings[key] && settings[key] !== '') {
					defaults[key] = settings[key]
				}
			})

			this.settings = defaults
			this.settings.name = settings.name

			this.saveVagrantfile()
			this.saveVagrantJSON()
		}
	}

	exists() {
		return fs.existsSync(this.path)
			&& fs.existsSync(`${this.path}/vagrant.json`)
			&& fs.existsSync(`${this.path}/Vagrantfile`)
	}

	saveVagrantfile() {
		const self = this

		try {
			let template = fs.readFileSync(VAGRANTFILE_EXAMPLE, 'utf8')

			Object.keys(this.settings).forEach(key => {
				const pattern = '{vars.' + key +'}'

				template = template.split(pattern).join(self.settings[key])
			});

			fs.writeFileSync(this.path + '/Vagrantfile', template)

			logger.info('Vagrantfile saved', { ńame: this.settings.name, template })
		} catch (error) {
			logger.error('Failed to save Vagrantfile.example', {
				error, VAGRANTFILE_EXAMPLE
			})
		}
	}

	saveVagrantJSON() {
		try {
			fs.writeFileSync(this.path + '/vagrant.json', JSON.stringify(this.settings, null, "\t"))
			logger.info('vagrant.json saved', { name: this.settings.name, settings: this.settings })
		} catch (error) {
			logger.error('Failed to save vagrant.json', { error })
		}
	}

	readVagrantJSON() {
		try {
			return JSON.parse(fs.readFileSync(this.path + '/vagrant.json', 'utf8'))
		} catch (error) {
			return logger.error('Failed to read vagrant.json', { error })
		}
	}

	toJSON() {
		return Object.assign({}, this.settings)
	}
}

module.exports = Vagrant
