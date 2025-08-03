const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper function to validate file paths (security)
const validatePath = (filePath) => {
  const resolved = path.resolve(filePath);
  const workingDir = process.cwd();
  return resolved.startsWith(workingDir);
};

// Helper function to list directory contents
const listDirectory = async (dirPath) => {
  const items = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(process.cwd(), fullPath);
    
    const item = {
      name: entry.name,
      path: relativePath,
      type: entry.isDirectory() ? 'directory' : 'file'
    };
    
    if (entry.isFile()) {
      try {
        const stats = await fs.stat(fullPath);
        item.size = stats.size;
        item.modified = stats.mtime.toISOString();
      } catch (error) {
        // Continue without stats if we can't get them
      }
    }
    
    items.push(item);
  }
  
  return items.sort((a, b) => {
    // Directories first, then files, both alphabetically
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
};

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    server: 'Kilo Web Server'
  });
});

// File listing endpoint
router.get('/files', async (req, res) => {
  try {
    const targetPath = req.query.path || '.';
    const fullPath = path.resolve(targetPath);
    
    if (!validatePath(fullPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const files = await listDirectory(fullPath);
    res.json({ files, path: targetPath });
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ error: error.message });
  }
});

// File read endpoint
router.get('/files/:path(*)', async (req, res) => {
  try {
    const filePath = req.params.path;
    const fullPath = path.resolve(filePath);
    
    if (!validatePath(fullPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const content = await fs.readFile(fullPath, 'utf8');
    res.json({ content, path: filePath });
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(500).json({ error: error.message });
  }
});

// File write endpoint
router.put('/files/:path(*)', async (req, res) => {
  try {
    const filePath = req.params.path;
    const { content } = req.body;
    const fullPath = path.resolve(filePath);
    
    if (!validatePath(fullPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    
    await fs.writeFile(fullPath, content, 'utf8');
    res.json({ success: true, path: filePath });
  } catch (error) {
    console.error('Error writing file:', error);
    res.status(500).json({ error: error.message });
  }
});

// File creation endpoint
router.post('/files', async (req, res) => {
  try {
    const { path: filePath, content = '', type = 'file' } = req.body;
    const fullPath = path.resolve(filePath);
    
    if (!validatePath(fullPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (type === 'directory') {
      await fs.mkdir(fullPath, { recursive: true });
    } else {
      // Ensure directory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf8');
    }
    
    res.json({ success: true, path: filePath, type });
  } catch (error) {
    console.error('Error creating file/directory:', error);
    res.status(500).json({ error: error.message });
  }
});

// File deletion endpoint
router.delete('/files/:path(*)', async (req, res) => {
  try {
    const filePath = req.params.path;
    const fullPath = path.resolve(filePath);
    
    if (!validatePath(fullPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      await fs.rmdir(fullPath, { recursive: true });
    } else {
      await fs.unlink(fullPath);
    }
    
    res.json({ success: true, path: filePath });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: error.message });
  }
});

// File upload endpoint
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const targetPath = req.body.path || '.';
    const fileName = req.file.originalname;
    const tempPath = req.file.path;
    const finalPath = path.resolve(targetPath, fileName);
    
    if (!validatePath(finalPath)) {
      await fs.unlink(tempPath); // Clean up temp file
      return res.status(403).json({ error: 'Access denied' });
    }

    // Move file from temp location to final destination
    await fs.rename(tempPath, finalPath);
    
    res.json({ success: true, path: path.relative(process.cwd(), finalPath) });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: error.message });
  }
});

// File download endpoint
router.get('/download/:path(*)', async (req, res) => {
  try {
    const filePath = req.params.path;
    const fullPath = path.resolve(filePath);
    
    if (!validatePath(fullPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) {
      return res.status(400).json({ error: 'Path is not a file' });
    }

    res.download(fullPath, path.basename(fullPath));
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Terminal/command execution placeholder
router.post('/execute', (req, res) => {
  // TODO: Implement command execution
  res.json({
    message: 'Command execution endpoint - not yet implemented',
    command: req.body.command,
    output: 'Command execution not yet implemented'
  });
});

// Extension management placeholder
router.get('/extensions', (req, res) => {
  // TODO: Implement extension listing
  res.json({
    message: 'Extension management endpoint - not yet implemented',
    extensions: []
  });
});

module.exports = router;