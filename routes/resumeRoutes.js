const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parseResume, uploadPhoto } = require('../controllers/resumeController');

// Configure Multer for file uploads
const upload = multer({ dest: 'uploads/' });

router.post('/parse', upload.single('resume'), parseResume);
router.post('/upload-photo', upload.single('profilePicture'), uploadPhoto);

module.exports = router;
