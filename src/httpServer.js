'use strict';

const path = require('path');
const logger = require('./logger');
const express = require('express');
const config = {
	port: 80,
};

const app = express();
const public_dir = path.join(process.cwd(), 'public');

app.use(express.static(public_dir));

app.get('/', (req, res) => {
	res.sendFile(path.join(public_dir, 'index.htm'));
});

app.listen(config.port, () => logger.info('HTTP server started', config));