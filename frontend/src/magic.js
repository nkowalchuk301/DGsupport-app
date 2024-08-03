// src/magic.js

import { Magic } from 'magic-sdk';
const REACT_APP_MAGIC_PUBLISH_KEY = process.env.REACT_APP_MAGIC_PUBLISH_KEY;
const magic = new Magic(`${REACT_APP_MAGIC_PUBLISH_KEY}`);

export default magic;
