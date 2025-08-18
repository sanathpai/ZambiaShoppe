require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { findTop5SimilarProducts } = require('./clip_top5_search');

async function processZipImages(zipFolderPath) {
  console.log('📦 Processing Professor\'s Test Images');
  console.log('='.repeat(60));
  console.log(`📁 Source folder: ${zipFolderPath}\n`);

  try {
    // Check if folder exists
    if (!fs.existsSync(zipFolderPath)) {
      throw new Error(`Folder not found: ${zipFolderPath}`);
    }

    // Get all image files from the folder
    const files = fs.readdirSync(zipFolderPath);
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext);
    });

    if (imageFiles.length === 0) {
      throw new Error('No image files found in the folder');
    }

    console.log(`🖼️  Found ${imageFiles.length} image(s) to process:`);
    imageFiles.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file}`);
    });
    console.log('');

    const allResults = [];

    // Process each image
    for (let i = 0; i < imageFiles.length; i++) {
      const imageFile = imageFiles[i];
      const imagePath = path.join(zipFolderPath, imageFile);
      
      console.log(`🔍 Processing ${i + 1}/${imageFiles.length}: ${imageFile}`);
      console.log('-'.repeat(50));

      try {
        const results = await findTop5SimilarProducts(imagePath);
        
        console.log(`📋 Top 5 matches for: ${imageFile}`);
        results.forEach((result, index) => {
          console.log(`${index + 1}. ${result.formatted}`);
        });
        
        allResults.push({
          imageFile: imageFile,
          imagePath: imagePath,
          results: results
        });
        
        console.log('✅ Completed successfully\n');
        
      } catch (error) {
        console.log(`❌ Error processing ${imageFile}: ${error.message}\n`);
        allResults.push({
          imageFile: imageFile,
          imagePath: imagePath,
          error: error.message
        });
      }
    }

    // Generate summary report
    console.log('='.repeat(60));
    console.log('📊 FINAL SUMMARY REPORT FOR PROFESSOR');
    console.log('='.repeat(60));

    allResults.forEach((result, index) => {
      console.log(`\n${index + 1}. IMAGE: ${result.imageFile}`);
      console.log('-'.repeat(30));
      
      if (result.error) {
        console.log(`❌ Error: ${result.error}`);
      } else {
        console.log('Top 5 matches:');
        result.results.forEach((match, matchIndex) => {
          console.log(`   ${matchIndex + 1}. ${match.formatted}`);
        });
      }
    });

    // Save results to file for professor
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(__dirname, `professor_clip_results_${timestamp}.txt`);
    
    let reportContent = 'CLIP Analysis Results for Professor Shenoy\n';
    reportContent += '='.repeat(50) + '\n';
    reportContent += `Date: ${new Date().toLocaleString()}\n`;
    reportContent += `Images processed: ${allResults.length}\n\n`;

    allResults.forEach((result, index) => {
      reportContent += `${index + 1}. IMAGE: ${result.imageFile}\n`;
      reportContent += '-'.repeat(30) + '\n';
      
      if (result.error) {
        reportContent += `Error: ${result.error}\n\n`;
      } else {
        reportContent += 'Top 5 matches:\n';
        result.results.forEach((match, matchIndex) => {
          reportContent += `   ${matchIndex + 1}. ${match.formatted}\n`;
        });
        reportContent += '\n';
      }
    });

    fs.writeFileSync(outputFile, reportContent);
    
    console.log(`\n📄 Results saved to: ${outputFile}`);
    console.log('📧 You can send this file to the professor');
    
    return allResults;

  } catch (error) {
    console.error('❌ Failed to process images:', error.message);
    throw error;
  }
}

// Helper function to find common download locations
function findZipFolder() {
  const possiblePaths = [
    path.join(process.env.HOME, 'Downloads'),
    path.join(process.env.HOME, 'Desktop'),
    '/Users/soha/Downloads',
    '/Users/soha/Desktop'
  ];

  console.log('🔍 Looking for extracted zip folder in common locations...');
  
  for (const basePath of possiblePaths) {
    if (fs.existsSync(basePath)) {
      const items = fs.readdirSync(basePath);
      
      // Look for folders that might contain the professor's images
      const candidateFolders = items.filter(item => {
        const fullPath = path.join(basePath, item);
        return fs.statSync(fullPath).isDirectory() && 
               (item.toLowerCase().includes('clip') || 
                item.toLowerCase().includes('test') ||
                item.toLowerCase().includes('image'));
      });
      
      if (candidateFolders.length > 0) {
        console.log(`📁 Found potential folders in ${basePath}:`);
        candidateFolders.forEach((folder, index) => {
          console.log(`   ${index + 1}. ${folder}`);
        });
      }
    }
  }
}

// Main execution
if (require.main === module) {
  const zipFolderPath = process.argv[2];
  
  if (!zipFolderPath) {
    console.log('📦 CLIP Zip File Processor');
    console.log('Usage: node process_zip_images.js <path_to_extracted_zip_folder>');
    console.log('');
    console.log('Steps:');
    console.log('1. Extract the professor\'s zip file');
    console.log('2. Run: node process_zip_images.js /path/to/extracted/folder');
    console.log('');
    console.log('Example:');
    console.log('  node process_zip_images.js ~/Downloads/test_images');
    console.log('  node process_zip_images.js "/Users/soha/Downloads/CLIP Test Images"');
    console.log('');
    
    findZipFolder();
    process.exit(1);
  }

  processZipImages(zipFolderPath)
    .then((results) => {
      console.log(`\n🎉 Successfully processed ${results.length} images!`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Processing failed:', error.message);
      process.exit(1);
    });
}

module.exports = { processZipImages }; 