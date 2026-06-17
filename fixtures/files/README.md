# Test Files Directory

This directory contains sample files used for file upload tests.

## Files

Place test files here for upload testing:

- **test-image.jpg** - Sample JPEG image for image upload tests
- **test-document.pdf** - Sample PDF document for document upload tests
- **test-evidence.png** - Sample PNG image for evidence upload tests

## Creating Test Files

You can create simple test files using the following commands:

```bash
# Create a simple text file as placeholder image (for basic tests)
echo "Test image content" > test-image.jpg

# Create a simple text file as placeholder PDF (for basic tests)
echo "Test document content" > test-document.pdf

# Create a simple text file as placeholder PNG (for basic tests)
echo "Test evidence content" > test-evidence.png
```

For more realistic tests, replace these with actual image and PDF files.

## Usage in Tests

```javascript
import fs from 'fs';
import path from 'path';

const imagePath = path.join(__dirname, '../../fixtures/files/test-image.jpg');
const imageFile = fs.createReadStream(imagePath);
```
