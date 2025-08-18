require('dotenv').config();
const db = require('./config/db');

async function debugEmbeddings() {
  try {
    console.log('🔍 Debugging Embedding Format Issues');
    console.log('='.repeat(50));
    
    // Check a few sample embeddings
    const [samples] = await db.query(`
      SELECT pe.product_id, pe.embedding, p.product_name 
      FROM product_embeddings pe 
      JOIN Products p ON pe.product_id = p.product_id 
      LIMIT 3
    `);
    
    console.log(`📊 Checking ${samples.length} sample embeddings:\n`);
    
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      console.log(`Sample ${i + 1}: ${sample.product_name} (ID: ${sample.product_id})`);
      
      try {
        const embedding = JSON.parse(sample.embedding);
        console.log(`   ✅ Parsed successfully`);
        console.log(`   📏 Length: ${embedding.length}`);
        console.log(`   🔢 Type: ${typeof embedding[0]} (array: ${Array.isArray(embedding)})`);
        console.log(`   📋 First 3 values: [${embedding.slice(0, 3).map(v => v.toFixed(6)).join(', ')}]`);
        console.log(`   📊 Range: ${Math.min(...embedding).toFixed(6)} to ${Math.max(...embedding).toFixed(6)}`);
        
        // Check for any invalid values
        const hasNaN = embedding.some(v => isNaN(v));
        const hasInf = embedding.some(v => !isFinite(v));
        console.log(`   ✅ Valid numbers: ${!hasNaN && !hasInf ? 'YES' : 'NO'}`);
        
        if (hasNaN) console.log(`   ❌ Contains NaN values`);
        if (hasInf) console.log(`   ❌ Contains infinite values`);
        
      } catch (error) {
        console.log(`   ❌ Parse error: ${error.message}`);
      }
      
      console.log('');
    }
    
    // Test embedding normalization
    console.log('🧪 Testing Cosine Similarity Calculation:');
    if (samples.length >= 2) {
      try {
        const emb1 = JSON.parse(samples[0].embedding);
        const emb2 = JSON.parse(samples[1].embedding);
        
        if (emb1.length === emb2.length) {
          let dotProduct = 0;
          let norm1 = 0;
          let norm2 = 0;
          
          for (let i = 0; i < emb1.length; i++) {
            dotProduct += emb1[i] * emb2[i];
            norm1 += emb1[i] * emb1[i];
            norm2 += emb2[i] * emb2[i];
          }
          
          const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
          
          console.log(`   📐 Dot product: ${dotProduct.toFixed(6)}`);
          console.log(`   📏 Norm1: ${Math.sqrt(norm1).toFixed(6)}`);
          console.log(`   📏 Norm2: ${Math.sqrt(norm2).toFixed(6)}`);
          console.log(`   🎯 Similarity: ${similarity.toFixed(6)}`);
          console.log(`   ✅ Valid similarity: ${similarity >= -1 && similarity <= 1 ? 'YES' : 'NO'}`);
        } else {
          console.log(`   ❌ Length mismatch: ${emb1.length} vs ${emb2.length}`);
        }
      } catch (error) {
        console.log(`   ❌ Calculation error: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await db.end();
  }
}

debugEmbeddings(); 